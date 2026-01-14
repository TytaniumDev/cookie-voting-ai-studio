export interface Baker {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Cookie {
  id: string;
  imageUrl: string; // Base64
  bakerId: string | null;
  categoryId: string | null;
  votes: number; // For simple tracking, though specific votes per category is better
}

// A more robust vote structure
export interface Vote {
  categoryId: string;
  cookieId: string;
}

export interface EventData {
  id: string;
  name: string;
  bakers: Baker[];
  categories: Category[];
  cookies: Cookie[];
  votes: Vote[];
  status: 'setup' | 'voting' | 'completed';
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}