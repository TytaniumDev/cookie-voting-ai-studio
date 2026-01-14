import React, { useRef, useEffect, useState } from 'react';
import { BoundingBox, Category } from '../types';
import { Button } from './Button';

interface CropReviewProps {
  originalImage: string;
  detectedBoxes: BoundingBox[];
  categories: Category[];
  onConfirm: (croppedImages: string[], defaultCategoryId: string | null) => void;
  onCancel: () => void;
  onAddCategory: (name: string) => void;
}

type DragMode = 'none' | 'move' | 'resize';
type HandlePosition = 'nw' | 'ne' | 'sw' | 'se';

export const CropReview: React.FC<CropReviewProps> = ({ originalImage, detectedBoxes, categories, onConfirm, onCancel, onAddCategory }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  
  const [boxes, setBoxes] = useState<BoundingBox[]>(detectedBoxes);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [dragHandle, setDragHandle] = useState<HandlePosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Track category length to auto-select new ones
  const prevCategoriesLen = useRef(categories.length);

  useEffect(() => {
    if (categories.length > prevCategoriesLen.current) {
        // A new category was added, likely the last one. Auto-select it.
        const newCat = categories[categories.length - 1];
        if (newCat) setSelectedCategoryId(newCat.id);
    }
    prevCategoriesLen.current = categories.length;
  }, [categories]);

  // Initialize boxes from prop, but only on mount or if prop changes significantly
  useEffect(() => {
    setBoxes(detectedBoxes);
  }, [detectedBoxes]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = originalImage;
  }, [originalImage]);

  // Redraw whenever state changes
  useEffect(() => {
    draw();
  }, [boxes, selectedIndex]);

  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const normToPixel = (val: number, max: number) => (val / 1000) * max;
  const pixelToNorm = (val: number, max: number) => (val / max) * 1000;

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure canvas matches image resolution
    if (canvas.width !== img.naturalWidth) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const scaleFactor = Math.max(1, img.naturalWidth / 1000);
    const lineWidth = 4 * scaleFactor;
    const handleSize = 20 * scaleFactor;
    const fontSize = 24 * scaleFactor;

    boxes.forEach((box, index) => {
      const x = normToPixel(box.xmin, canvas.width);
      const y = normToPixel(box.ymin, canvas.height);
      const w = normToPixel(box.xmax - box.xmin, canvas.width);
      const h = normToPixel(box.ymax - box.ymin, canvas.height);

      const isSelected = index === selectedIndex;

      // Draw Box
      ctx.strokeStyle = isSelected ? '#00FF00' : '#F8B229'; // Green if selected, else Gold
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(isSelected ? [10, 5] : []);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      // Label
      if (!isSelected) {
          ctx.fillStyle = '#BB2528';
          const label = `#${index + 1}`;
          const metrics = ctx.measureText(label);
          ctx.fillRect(x, y - (fontSize * 1.5), metrics.width + 10, fontSize * 1.5);
          ctx.fillStyle = 'white';
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillText(label, x + 5, y - (fontSize * 0.4));
      }

      // Draw Handles if selected
      if (isSelected) {
        ctx.fillStyle = '#00FF00';
        const halfH = handleSize / 2;
        // NW
        ctx.fillRect(x - halfH, y - halfH, handleSize, handleSize);
        // NE
        ctx.fillRect(x + w - halfH, y - halfH, handleSize, handleSize);
        // SW
        ctx.fillRect(x - halfH, y + h - halfH, handleSize, handleSize);
        // SE
        ctx.fillRect(x + w - halfH, y + h - halfH, handleSize, handleSize);
      }
    });
  };

  const getHandleHit = (x: number, y: number, boxIdx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const box = boxes[boxIdx];
    const bx = normToPixel(box.xmin, canvas.width);
    const by = normToPixel(box.ymin, canvas.height);
    const bw = normToPixel(box.xmax - box.xmin, canvas.width);
    const bh = normToPixel(box.ymax - box.ymin, canvas.height);
    
    // Hit tolerance
    const tol = (canvas.width / 1000) * 40; 

    if (Math.abs(x - bx) < tol && Math.abs(y - by) < tol) return 'nw';
    if (Math.abs(x - (bx + bw)) < tol && Math.abs(y - by) < tol) return 'ne';
    if (Math.abs(x - bx) < tol && Math.abs(y - (by + bh)) < tol) return 'sw';
    if (Math.abs(x - (bx + bw)) < tol && Math.abs(y - (by + bh)) < tol) return 'se';
    
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const { x, y } = getCanvasCoordinates(e);
    const canvas = canvasRef.current;
    if(!canvas) return;

    // 1. Check handles of currently selected box
    if (selectedIndex !== null) {
      const handle = getHandleHit(x, y, selectedIndex);
      if (handle) {
        setDragMode('resize');
        setDragHandle(handle);
        setIsDragging(true);
        return;
      }
    }

    // 2. Check if clicking inside a box (select it)
    // Iterate backwards to select top-most box
    let clickedIndex = null;
    for (let i = boxes.length - 1; i >= 0; i--) {
      const box = boxes[i];
      const bx = normToPixel(box.xmin, canvas.width);
      const by = normToPixel(box.ymin, canvas.height);
      const bw = normToPixel(box.xmax - box.xmin, canvas.width);
      const bh = normToPixel(box.ymax - box.ymin, canvas.height);

      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
        clickedIndex = i;
        break;
      }
    }

    if (clickedIndex !== null) {
      setSelectedIndex(clickedIndex);
      setDragMode('move');
      setIsDragging(true);
      setDragStart({ x, y });
    } else {
      setSelectedIndex(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || selectedIndex === null) return;
    e.preventDefault();
    
    const { x, y } = getCanvasCoordinates(e);
    const canvas = canvasRef.current;
    if(!canvas) return;

    const currentBox = boxes[selectedIndex];
    const newBoxes = [...boxes];
    
    // Helpers
    const pxToNormX = (val: number) => pixelToNorm(val, canvas.width);
    const pxToNormY = (val: number) => pixelToNorm(val, canvas.height);

    if (dragMode === 'move') {
      const dx = pxToNormX(x - dragStart.x);
      const dy = pxToNormY(y - dragStart.y);
      
      const newBox = {
        xmin: Math.max(0, Math.min(1000, currentBox.xmin + dx)),
        ymin: Math.max(0, Math.min(1000, currentBox.ymin + dy)),
        xmax: Math.max(0, Math.min(1000, currentBox.xmax + dx)),
        ymax: Math.max(0, Math.min(1000, currentBox.ymax + dy)),
      };
      
      // Keep width/height constant, just clamp to edges
      const w = currentBox.xmax - currentBox.xmin;
      const h = currentBox.ymax - currentBox.ymin;

      if(newBox.xmin === 0) newBox.xmax = w;
      if(newBox.xmax === 1000) newBox.xmin = 1000 - w;
      if(newBox.ymin === 0) newBox.ymax = h;
      if(newBox.ymax === 1000) newBox.ymin = 1000 - h;

      newBoxes[selectedIndex] = newBox;
      setDragStart({ x, y }); // Reset start for incremental updates to avoid drift
    } 
    else if (dragMode === 'resize' && dragHandle) {
      const normX = Math.max(0, Math.min(1000, pxToNormX(x)));
      const normY = Math.max(0, Math.min(1000, pxToNormY(y)));

      const box = { ...currentBox };
      
      if (dragHandle.includes('w')) box.xmin = Math.min(normX, box.xmax - 50);
      if (dragHandle.includes('e')) box.xmax = Math.max(normX, box.xmin + 50);
      if (dragHandle.includes('n')) box.ymin = Math.min(normY, box.ymax - 50);
      if (dragHandle.includes('s')) box.ymax = Math.max(normY, box.ymin + 50);

      newBoxes[selectedIndex] = box;
    }

    setBoxes(newBoxes);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode('none');
    setDragHandle(null);
  };

  const handleAddBox = () => {
    // Add a 200x200 box in the center
    const newBox: BoundingBox = {
      xmin: 400, ymin: 400, xmax: 600, ymax: 600
    };
    setBoxes([...boxes, newBox]);
    setSelectedIndex(boxes.length); // Select the new box
  };

  const handleDeleteBox = () => {
    if (selectedIndex === null) return;
    const newBoxes = boxes.filter((_, i) => i !== selectedIndex);
    setBoxes(newBoxes);
    setSelectedIndex(null);
  };

  const handleCreateCategory = () => {
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName.trim());
      setNewCategoryName('');
    }
  };

  const handleProcess = () => {
    const img = imgRef.current;
    if (!img) return;

    const cropped: string[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    boxes.forEach(box => {
        const w = ((box.xmax - box.xmin) / 1000) * img.naturalWidth;
        const h = ((box.ymax - box.ymin) / 1000) * img.naturalHeight;
        const x = (box.xmin / 1000) * img.naturalWidth;
        const y = (box.ymin / 1000) * img.naturalHeight;

        const padding = Math.max(20, img.naturalWidth / 100);
        const sx = Math.max(0, x - padding);
        const sy = Math.max(0, y - padding);
        const sw = Math.min(img.naturalWidth - sx, w + padding * 2);
        const sh = Math.min(img.naturalHeight - sy, h + padding * 2);

        canvas.width = sw;
        canvas.height = sh;

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        cropped.push(canvas.toDataURL('image/jpeg'));
    });

    onConfirm(cropped, selectedCategoryId || null);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-4xl mx-auto p-4 bg-white dark:bg-gray-800 rounded-xl shadow-xl">
      <h2 className="text-2xl font-festive text-berry dark:text-red-400">Review Detected Cookies</h2>
      <p className="text-gray-600 dark:text-gray-300 text-center">
        We found {boxes.length} cookies!<br/>
        <span className="text-sm">Click a box to select. Drag to move. Drag green corners to resize.</span>
      </p>
      
      <div className="flex gap-4 w-full justify-center">
        <Button size="sm" variant="secondary" onClick={handleAddBox}>+ Add Manual Box</Button>
        {selectedIndex !== null && (
          <Button size="sm" variant="danger" onClick={handleDeleteBox}>Delete Selected Box</Button>
        )}
      </div>

      <div className="relative w-full overflow-hidden rounded-lg border-4 border-holly dark:border-green-400 bg-gray-100 dark:bg-gray-900 touch-none">
        <canvas 
          ref={canvasRef} 
          className="w-full h-auto block cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />
      </div>

      <div className="w-full max-w-md bg-cream dark:bg-gray-700/50 p-4 rounded-lg flex flex-col gap-3">
        <div>
          <label className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 block">
            Assign all to Category (Optional):
          </label>
          <select 
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-holly outline-none"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
          >
            <option value="">-- No Category --</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        
        <div className="pt-3 border-t border-gray-300 dark:border-gray-600">
           <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 block uppercase tracking-wide">
             Or Create New Category:
           </label>
           <div className="flex gap-2">
             <input 
               type="text" 
               value={newCategoryName}
               onChange={(e) => setNewCategoryName(e.target.value)}
               placeholder="New Category Name..."
               className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-holly outline-none"
               onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
             />
             <Button size="sm" onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>Add</Button>
           </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="success" onClick={handleProcess}>Extract {boxes.length} Cookies</Button>
      </div>
    </div>
  );
};