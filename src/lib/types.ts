export interface SportsGame {
  id: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  time: string;
  channel?: string;
  isLive: boolean;
  isCompleted: boolean;
  homeScore?: number;
  awayScore?: number;
  isThunder: boolean;
  isFavorite: boolean;
  isPrimetime: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
}

export interface LocalEvent {
  id: string;
  name: string;
  venue?: string;
  category: string;
  start: string;
  end?: string;
  distance?: number;
  source: "eventbrite" | "predicthq";
  url?: string;
}

export interface Holiday {
  date: string;
  name: string;
  emoji?: string;
  type: "public" | "custom" | "drinking";
  recurring?: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  style?: string;
  abv?: number;
  brewery?: string;
  description?: string;
  section?: string;
}

export interface MenuChange {
  type: "added" | "removed" | "changed";
  item: MenuItem;
  timestamp: string;
  detail?: string;
}

export interface MenuData {
  items: MenuItem[];
  changes: MenuChange[];
  lastUpdated: string | null;
}

export interface WeatherData {
  temp: number;
  high: number;
  low: number;
  condition: string;
  icon: string;
  description: string;
}

export interface BriefingData {
  date: string;
  dayOfWeek: string;
  weather?: WeatherData;
  holidays: Holiday[];
  thunderGame?: SportsGame;
  tvGames: SportsGame[];
  calendarEvents: CalendarEvent[];
  menuData: MenuData;
  localEvents: LocalEvent[];
}
