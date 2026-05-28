export type Expense = {
  id: string;
  category: string;
  amount: number;
};

export type DailyEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  earnings: number;
  expenses: Expense[];
  notes?: string;
};

export type TrackerSettings = {
  startDate: string; // YYYY-MM-DD
  dailyTarget: number; // default 220
  totalDays: number; // default 90
};

export type TrackerData = {
  settings: TrackerSettings | null;
  entries: DailyEntry[];
  categories: string[];
};
