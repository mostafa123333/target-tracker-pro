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

export type Category = {
  name: string;
  /** If true, expenses in this category are subtracted from the target net. */
  deductsFromTarget: boolean;
  /**
   * Optional budget/goal amount for this category. Mainly useful for
   * non-deductible categories (e.g. "Savings": you want to reach 5000 EGP).
   */
  budget?: number;
};

export type TrackerData = {
  settings: TrackerSettings | null;
  entries: DailyEntry[];
  categories: Category[];
};
