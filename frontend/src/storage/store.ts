import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  PREFS: "tipcalc:prefs:v1",
  HISTORY: "tipcalc:history:v1",
};

export type Prefs = {
  currencyCode: string;
  roundUp: boolean;
};

export type HistoryItem = {
  id: string;
  createdAt: number;
  bill: number;
  tipPercent: number;
  people: number;
  totalTip: number;
  totalBill: number;
  totalPerPerson: number;
  tipPerPerson: number;
  currencyCode: string;
  roundUp: boolean;
};

const DEFAULT_PREFS: Prefs = {
  currencyCode: "USD",
  roundUp: false,
};

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PREFS);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  await AsyncStorage.setItem(KEYS.PREFS, JSON.stringify(prefs));
}

export async function loadHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addHistory(item: HistoryItem): Promise<HistoryItem[]> {
  const existing = await loadHistory();
  const next = [item, ...existing].slice(0, 50);
  await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(next));
  return next;
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.HISTORY);
}
