import React, { useState, useEffect, useMemo } from 'react';
import { EventData, Cookie, Vote, BoundingBox } from './types';
import { Button } from './components/Button';
import { CropReview } from './components/CropReview';
import { detectCookies } from './services/geminiService';

// --- Helper Components ---

const Header: React.FC<{ 
  onNavigate: (view: string) => void, 
  currentView: string,
  eventName?: string,
  isDarkMode: boolean,
  toggleDarkMode: () => void
}> = ({ onNavigate, currentView, eventName, isDarkMode, toggleDarkMode }) => (
  <header className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm sticky top-0 z-50 shadow-sm border-b-4 border-berry dark:border-red-500 p-4 mb-6 transition-colors duration-300">
    <div className="max-w-6xl mx-auto flex items-center justify-between">
      <div 
        className="flex items-center gap-2 cursor-pointer" 
        onClick={() => onNavigate('landing')}
      >
        <span className="text-4xl">🍪</span> 
        <div className="flex flex-col">
          <h1 className="text-2xl md:text-3xl font-festive text-holly dark:text-green-400 font-bold leading-none">
            Cookie Voting
          </h1>
          {eventName && (
            <span className="text-xs text-berry dark:text-red-400 font-bold uppercase tracking-wider">{eventName}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-6">
        <nav className="flex gap-4 hidden md:flex">
          <button 
            className={`font-bold hover:text-berry dark:hover:text-red-400 transition-colors ${currentView === 'landing' ? 'text-berry dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}
            onClick={() => onNavigate('landing')}
          >
            Home
          </button>
          {eventName && (
            <>
              <button 
                className={`font-bold hover:text-berry dark:hover:text-red-400 transition-colors ${currentView === 'vote' ? 'text-berry dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}
                onClick={() => onNavigate('vote')}
              >
                Vote
              </button>
              <button 
                className={`font-bold hover:text-berry dark:hover:text-red-400 transition-colors ${currentView.startsWith('admin') ? 'text-berry dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}
                onClick={() => onNavigate('admin-dashboard')}
              >
                Admin
              </button>
            </>
          )}
        </nav>
        <button 
          onClick={toggleDarkMode}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-yellow-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="Toggle Dark Mode"
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  </header>
);

const Card: React.FC<{children: React.ReactNode, className?: string}> = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 transition-colors duration-300 ${className}`}>
    {children}
  </div>
);

// --- Main App ---

const INITIAL_TEMPLATE: EventData = {
  id: '',
  name: '',
  bakers: [],
  categories: [
    { id: 'cat-1', name: 'Best Taste' },
    { id: 'cat-2', name: 'Most Festive' },
    { id: 'cat-3', name: 'Best Decoration' }
  ],
  cookies: [],
  votes: [],
  status: 'setup'
};

export default function App() {
  // Global State
  const [events, setEvents] = useState<EventData[]>([]);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  
  // Navigation State
  const [view, setView] = useState<string>('landing');
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('cookie_theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Admin Processing State
  const [trayImage, setTrayImage] = useState<string | null>(null);
  const [detectedBoxes, setDetectedBoxes] = useState<BoundingBox[]>([]);
  
  // Input State
  const [newCatName, setNewCatName] = useState('');
  const [newEventName, setNewEventName] = useState('');
  
  // Voting State
  const [currentVoteCategory, setCurrentVoteCategory] = useState(0);

  // --- Derived State ---
  const currentEvent = useMemo(() => 
    events.find(e => e.id === currentEventId), 
  [events, currentEventId]);

  // --- Persistence & Init ---
  useEffect(() => {
    const saved = localStorage.getItem('cookie_events_db');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setEvents(parsed);
        } else {
          setEvents([parsed]);
        }
      } catch (e) {
        console.error("Failed to load events", e);
      }
    }
  }, []);

  useEffect(() => {
    if (events.length > 0) {
      localStorage.setItem('cookie_events_db', JSON.stringify(events));
    }
  }, [events]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('cookie_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('cookie_theme', 'light');
    }
  }, [isDarkMode]);

  // --- Navigation Helpers ---
  const navigateTo = (newView: string) => {
    setView(newView);
    window.scrollTo(0, 0);
  };

  const updateCurrentEvent = (updater: (prev: EventData) => EventData) => {
    if (!currentEventId) return;
    setEvents(prevEvents => 
      prevEvents.map(e => e.id === currentEventId ? updater(e) : e)
    );
  };

  // --- Actions ---

  const handleCreateEvent = () => {
    if (!newEventName.trim()) return;
    const newEvent: EventData = {
      ...INITIAL_TEMPLATE,
      id: `event-${Date.now()}`,
      name: newEventName,
    };
    setEvents(prev => [...prev, newEvent]);
    setCurrentEventId(newEvent.id);
    setNewEventName('');
    navigateTo('admin-dashboard');
  };

  const handleDeleteEvent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this event? This cannot be undone.")) {
      setEvents(prev => prev.filter(ev => ev.id !== id));
      if (currentEventId === id) setCurrentEventId(null);
    }
  };

  const handleUploadTray = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setTrayImage(base64);
      
      try {
        const boxes = await detectCookies(base64);
        if (boxes.length === 0) {
           setError("We couldn't detect any cookies automatically. Try a clearer photo.");
        }
        setDetectedBoxes(boxes);
      } catch (err) {
        setError("Failed to process image with Gemini.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExtractCookies = (croppedImages: string[], defaultCategoryId: string | null) => {
    const newCookies: Cookie[] = croppedImages.map((img, idx) => ({
      id: `cookie-${Date.now()}-${idx}`,
      imageUrl: img,
      bakerId: null,
      categoryId: defaultCategoryId,
      votes: 0
    }));

    updateCurrentEvent(prev => ({ ...prev, cookies: [...prev.cookies, ...newCookies] }));
    setTrayImage(null);
    setDetectedBoxes([]);
  };

  const handleVote = (cookieId: string) => {
    if (!currentEvent) return;
    if (currentVoteCategory >= currentEvent.categories.length) return;

    const categoryId = currentEvent.categories[currentVoteCategory].id;
    const newVote: Vote = { categoryId, cookieId };
    
    updateCurrentEvent(prev => {
        const updatedCookies = prev.cookies.map(c => 
             c.id === cookieId ? { ...c, votes: c.votes + 1 } : c
        );
        return { ...prev, cookies: updatedCookies, votes: [...prev.votes, newVote] };
    });

    if (currentVoteCategory < currentEvent.categories.length - 1) {
      setCurrentVoteCategory(prev => prev + 1);
    } else {
      navigateTo('results');
    }
  };

  const handleAddCategory = () => {
    if(!newCatName) return;
    updateCurrentEvent(prev => ({
      ...prev, 
      categories: [...prev.categories, { id: `cat-${Date.now()}`, name: newCatName }]
    }));
    setNewCatName('');
  };

  // --- Styles for Background ---
  const bgStyle = {
    backgroundColor: isDarkMode ? '#111827' : '#F8F9FA',
    backgroundImage: isDarkMode 
      ? `radial-gradient(#374151 1px, transparent 1px), radial-gradient(#1f2937 1px, transparent 1px)`
      : `radial-gradient(#BB2528 1px, transparent 1px), radial-gradient(#165B33 1px, transparent 1px)`,
    backgroundSize: '40px 40px',
    backgroundPosition: '0 0, 20px 20px',
  };

  // --- Views ---

  const renderLanding = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-8 px-4">
      <div className="animate-bounce text-6xl">🎅</div>
      <h1 className="text-5xl md:text-7xl font-festive text-berry dark:text-red-500 drop-shadow-sm transition-colors">
        Cookie Voting
      </h1>
      <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl transition-colors">
        The ultimate Christmas cookie showdown app.
      </p>
      <div className="flex gap-4 flex-wrap justify-center mt-8">
        <Button size="lg" onClick={() => navigateTo('event-list')}>
          Join an Event 🍪
        </Button>
        <Button variant="secondary" size="lg" onClick={() => navigateTo('admin-list')}>
          Host an Event 🎩
        </Button>
      </div>
    </div>
  );

  const renderEventList = (isAdmin: boolean) => (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      <div className="flex justify-between items-center border-b dark:border-gray-700 pb-4">
        <h2 className="text-3xl font-festive text-berry dark:text-red-400">{isAdmin ? 'Manage Events' : 'Select an Event'}</h2>
        {isAdmin && (
           <div className="flex gap-2">
             <input 
               type="text" 
               placeholder="New Event Name..." 
               className="border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-holly outline-none placeholder:text-gray-400"
               value={newEventName}
               onChange={(e) => setNewEventName(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleCreateEvent()}
             />
             <Button onClick={handleCreateEvent} disabled={!newEventName}>Create</Button>
           </div>
        )}
      </div>

      <div className="grid gap-4">
        {events.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-10 italic">
            {isAdmin ? 'No events yet. Create one above!' : 'No active events found.'}
          </p>
        ) : (
          events.map(ev => (
            <div 
              key={ev.id} 
              onClick={() => {
                setCurrentEventId(ev.id);
                setCurrentVoteCategory(0); // Reset vote progress
                navigateTo(isAdmin ? 'admin-dashboard' : 'vote');
              }}
              className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer border-l-8 border-holly dark:border-green-600 group flex justify-between items-center"
            >
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 group-hover:text-holly dark:group-hover:text-green-400 transition-colors">{ev.name}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {ev.cookies.length} cookies &bull; {ev.bakers.length} bakers &bull; {ev.votes.length} votes
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-berry dark:text-red-400 font-bold group-hover:translate-x-1 transition-transform">
                  {isAdmin ? 'Manage →' : 'Enter →'}
                </span>
                {isAdmin && (
                  <button 
                    onClick={(e) => handleDeleteEvent(ev.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 z-10"
                    title="Delete Event"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="text-center pt-8">
        <Button variant="secondary" onClick={() => navigateTo('landing')}>Back to Home</Button>
      </div>
    </div>
  );

  const renderAdminDashboard = () => {
    if (!currentEvent) return null;

    if (trayImage && detectedBoxes.length > 0) {
      return (
        <CropReview 
          originalImage={trayImage} 
          detectedBoxes={detectedBoxes} 
          categories={currentEvent.categories}
          onConfirm={handleExtractCookies} 
          onCancel={() => { setTrayImage(null); setDetectedBoxes([]); }} 
          onAddCategory={(name) => {
             updateCurrentEvent(prev => ({
                ...prev, 
                categories: [...prev.categories, { id: `cat-${Date.now()}`, name }]
             }));
          }}
        />
      );
    }

    return (
      <div className="max-w-6xl mx-auto p-4 space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-festive text-berry dark:text-red-400">Admin Dashboard</h2>
          <Button variant="secondary" size="sm" onClick={() => navigateTo('admin-list')}>Switch Event</Button>
        </div>

        {/* Setup Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Bakers Section */}
          <Card>
            <h3 className="text-xl font-bold mb-4 text-holly dark:text-green-400 flex items-center gap-2">👨‍🍳 Manage Bakers</h3>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                id="newBaker"
                placeholder="Enter baker name..." 
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-holly outline-none placeholder:text-gray-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value;
                    if(val) {
                      updateCurrentEvent(prev => ({...prev, bakers: [...prev.bakers, { id: `baker-${Date.now()}`, name: val }]}));
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
            </div>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {currentEvent.bakers.map(b => (
                <li key={b.id} className="bg-cream dark:bg-gray-700/50 px-4 py-2 rounded-lg flex justify-between items-center">
                  <span className="text-gray-900 dark:text-gray-200">{b.name}</span>
                  <button onClick={() => updateCurrentEvent(prev => ({...prev, bakers: prev.bakers.filter(x => x.id !== b.id)}))} className="text-red-500 hover:text-red-700">&times;</button>
                </li>
              ))}
              {currentEvent.bakers.length === 0 && <li className="text-gray-400 italic">No bakers added yet.</li>}
            </ul>
          </Card>

           {/* Categories Section */}
           <Card>
            <h3 className="text-xl font-bold mb-4 text-holly dark:text-green-400 flex items-center gap-2">🏷️ Manage Categories</h3>
            <div className="space-y-3 mb-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category Name (e.g. Best Icing)"
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-holly outline-none text-sm placeholder:text-gray-400"
                />
                <Button size="sm" onClick={handleAddCategory} disabled={!newCatName}>Add</Button>
              </div>
            </div>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {currentEvent.categories.map(c => (
                <li key={c.id} className="bg-cream dark:bg-gray-700/50 px-4 py-2 rounded-lg flex justify-between items-center group">
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="font-bold text-sm text-gray-900 dark:text-gray-200 truncate">{c.name}</div>
                  </div>
                  <button onClick={() => updateCurrentEvent(prev => ({...prev, categories: prev.categories.filter(x => x.id !== c.id)}))} className="text-red-400 hover:text-red-700 opacity-50 group-hover:opacity-100 transition-opacity">&times;</button>
                </li>
              ))}
              {currentEvent.categories.length === 0 && <li className="text-gray-400 italic">No categories. Add one!</li>}
            </ul>
          </Card>
        </div>

        {/* Upload Section */}
        <Card className="border-2 border-dashed border-holly dark:border-green-800 bg-holly/5 dark:bg-green-900/10 flex flex-col items-center justify-center min-h-[200px] text-center">
          <div className="text-4xl mb-2">📸</div>
          <h3 className="text-xl font-bold text-holly dark:text-green-400 mb-2">Add Cookies</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4 px-4">Upload a photo of a cookie tray. Our AI will help you separate them!</p>
          <label className="cursor-pointer">
            <span className="bg-holly dark:bg-green-700 text-white px-6 py-2 rounded-full hover:bg-green-800 dark:hover:bg-green-600 transition shadow-md">
              Upload Tray Photo
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadTray} />
          </label>
          {loading && <p className="mt-4 text-berry dark:text-red-400 font-bold animate-pulse">Analyzing image with Gemini...</p>}
          {error && <p className="mt-4 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 p-2 rounded">{error}</p>}
        </Card>

        {/* Cookie List */}
        <div className="space-y-4">
          <h3 className="text-2xl font-festive text-berry dark:text-red-400">Cookie Inventory ({currentEvent.cookies.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {currentEvent.cookies.map(cookie => (
              <div key={cookie.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden flex flex-col group relative border border-gray-100 dark:border-gray-700">
                <div className="relative h-48 bg-gray-100 dark:bg-gray-900">
                  <img src={cookie.imageUrl} alt="Cookie" className="w-full h-full object-contain p-2" />
                  <button 
                    onClick={() => updateCurrentEvent(prev => ({...prev, cookies: prev.cookies.filter(c => c.id !== cookie.id)}))}
                    className="absolute top-2 left-2 bg-red-500/80 text-white w-8 h-8 rounded-full flex items-center justify-center shadow hover:bg-red-600 transition"
                  >
                    &times;
                  </button>
                </div>
                <div className="p-4 space-y-3 flex-1 bg-cream/30 dark:bg-gray-700/20 border-t border-gray-100 dark:border-gray-700">
                  <select 
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm p-1.5 focus:ring-1 focus:ring-holly outline-none"
                    value={cookie.bakerId || ''}
                    onChange={(e) => updateCurrentEvent(prev => ({
                      ...prev, cookies: prev.cookies.map(c => c.id === cookie.id ? {...c, bakerId: e.target.value} : c)
                    }))}
                  >
                    <option value="">Select Baker...</option>
                    {currentEvent.bakers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  
                  <select 
                     className="w-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm p-1.5 focus:ring-1 focus:ring-holly outline-none"
                     value={cookie.categoryId || ''}
                     onChange={(e) => updateCurrentEvent(prev => ({
                       ...prev, cookies: prev.cookies.map(c => c.id === cookie.id ? {...c, categoryId: e.target.value} : c)
                     }))}
                  >
                     <option value="">Primary Category...</option>
                     {currentEvent.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            ))}
            {currentEvent.cookies.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 border-dashed">
                No cookies extracted yet. Upload a tray above!
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderVote = () => {
    if (!currentEvent) return null;
    if (currentEvent.categories.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center p-4">
          <h2 className="text-2xl font-bold text-gray-500">No Categories Defined</h2>
          <p className="dark:text-gray-400">Please ask the host to add voting categories in the Admin panel.</p>
          <Button className="mt-4" onClick={() => navigateTo('landing')}>Go Home</Button>
        </div>
      );
    }
    
    const safeIndex = Math.min(currentVoteCategory, currentEvent.categories.length - 1);
    const currentCat = currentEvent.categories[safeIndex];
    // Filter cookies by category ID
    const eligibleCookies = currentEvent.cookies.filter(c => c.categoryId === currentCat.id);

    const handleSkip = () => {
      if (currentVoteCategory < currentEvent.categories.length - 1) {
        setCurrentVoteCategory(prev => prev + 1);
      } else {
        navigateTo('results');
      }
    };

    return (
      <div className="max-w-4xl mx-auto p-4 flex flex-col h-[calc(100vh-100px)]">
        <div className="text-center mb-8">
          <span className="bg-gold/20 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-3 py-1 rounded-full text-sm font-bold tracking-wider">
            CATEGORY {safeIndex + 1} OF {currentEvent.categories.length}
          </span>
          <h2 className="text-4xl font-festive text-berry dark:text-red-400 mt-2">{currentCat.name}</h2>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 pb-4">
           {eligibleCookies.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
               <p className="text-xl text-gray-500 dark:text-gray-400 mb-4">No cookies have been assigned to this category.</p>
               <Button onClick={handleSkip}>Skip to Next Category</Button>
             </div>
           ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               {eligibleCookies.map(cookie => (
                 <div key={cookie.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden group hover:ring-4 ring-gold transition-all cursor-pointer transform hover:-translate-y-1"
                      onClick={() => handleVote(cookie.id)}>
                   <div className="aspect-square bg-gray-50 dark:bg-gray-900 p-4 flex items-center justify-center">
                     <img src={cookie.imageUrl} className="max-h-full max-w-full object-contain drop-shadow-md" />
                   </div>
                   <div className="p-4 bg-berry dark:bg-red-700 text-white text-center font-bold group-hover:bg-gold dark:group-hover:bg-yellow-500 group-hover:text-black transition-colors">
                     Vote for this Cookie
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!currentEvent) return null;

    return (
      <div className="max-w-4xl mx-auto p-4 space-y-10">
         <div className="text-center">
           <h2 className="text-5xl font-festive text-holly dark:text-green-400 mb-4">🏆 The Results 🏆</h2>
           <p className="text-xl text-gray-600 dark:text-gray-300">The votes are in! Here are the champions for <br/><span className="font-bold text-berry dark:text-red-400">{currentEvent.name}</span></p>
         </div>

         <div className="space-y-12">
           {currentEvent.categories.map((cat) => {
             // Get all cookies in this category
             const catCookies = currentEvent.cookies.filter(c => c.categoryId === cat.id);
             
             // Calculate votes
             const cookieResults = catCookies.map(cookie => {
               const count = currentEvent.votes.filter(v => v.categoryId === cat.id && v.cookieId === cookie.id).length;
               const baker = currentEvent.bakers.find(b => b.id === cookie.bakerId);
               return { cookie, baker, count };
             }).sort((a, b) => b.count - a.count);

             const winner = cookieResults.length > 0 && cookieResults[0].count > 0 ? cookieResults[0] : null;
             const runnersUp = winner ? cookieResults.slice(1) : cookieResults;

             return (
               <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border-2 border-gold relative">
                 <div className="bg-gold p-2 text-center font-bold text-white tracking-widest uppercase dark:text-gray-900">
                   {cat.name}
                 </div>
                 
                 {/* Winner Section */}
                 <div className="p-8 flex flex-col md:flex-row items-center gap-8 border-b border-gray-100 dark:border-gray-700">
                   {winner ? (
                     <>
                       <div className="relative w-48 h-48 flex-shrink-0">
                          <img src={winner.cookie.imageUrl} className="w-full h-full object-contain drop-shadow-lg animate-[pulse_3s_infinite]" />
                          <div className="absolute -top-4 -right-4 text-5xl">🥇</div>
                       </div>
                       <div className="text-center md:text-left flex-1">
                         <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Winner: {winner.baker ? winner.baker.name : 'Unknown Baker'}</h3>
                         <div className="text-4xl font-festive text-berry dark:text-red-400 mb-4">
                           {winner.count} Votes
                         </div>
                       </div>
                     </>
                   ) : (
                     <p className="w-full text-center text-gray-400 italic py-4">No votes cast in this category yet.</p>
                   )}
                 </div>

                 {/* Runners Up Section */}
                 {runnersUp.length > 0 && (
                   <div className="bg-gray-50 dark:bg-gray-900/50 p-6">
                     <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Other Rankings</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {runnersUp.map((result) => (
                         <div key={result.cookie.id} className="flex items-center gap-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-md flex-shrink-0">
                              <img src={result.cookie.imageUrl} className="w-full h-full object-contain p-1" />
                            </div>
                            <div>
                              <div className="font-bold text-gray-800 dark:text-gray-200">
                                {result.baker ? result.baker.name : 'Unknown Baker'}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {result.count} vote{result.count !== 1 ? 's' : ''}
                              </div>
                            </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
             );
           })}
           {currentEvent.categories.length === 0 && <div className="text-center text-gray-500 dark:text-gray-400">No categories or votes yet.</div>}
         </div>
         
         <div className="text-center pb-10 flex justify-center gap-4">
           <Button onClick={() => navigateTo('landing')}>Back to Home</Button>
           <Button variant="secondary" onClick={() => navigateTo('event-list')}>Vote in Another Event</Button>
         </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-gray-800 dark:text-gray-200 pb-10 transition-colors duration-300" style={bgStyle}>
      <Header 
        onNavigate={navigateTo} 
        currentView={view} 
        eventName={currentEvent?.name}
        isDarkMode={isDarkMode}
        toggleDarkMode={() => setIsDarkMode(prev => !prev)}
      />
      <main>
        {view === 'landing' && renderLanding()}
        {view === 'event-list' && renderEventList(false)}
        {view === 'admin-list' && renderEventList(true)}
        {view === 'admin-dashboard' && renderAdminDashboard()}
        {view === 'vote' && renderVote()}
        {view === 'results' && renderResults()}
      </main>
    </div>
  );
}