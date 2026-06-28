import { useEffect, useState, useCallback } from "react";

export type Entry = { date: string; weight: number; note?: string };
export type Settings = {
  startWeight?: number;
  goalWeight?: number;
  unit: "kg" | "lb";
  heightCm?: number;
  startDate?: string;
  endDate?: string;
};

const ENTRIES_KEY = "weight-entries-v1";
const SETTINGS_KEY = "weight-settings-v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useEntries() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setEntries(read<Entry[]>(ENTRIES_KEY, []));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  }, [entries, loaded]);

  const addEntry = useCallback((e: Entry) => {
    setEntries((prev) => {
      const filtered = prev.filter((x) => x.date !== e.date);
      return [...filtered, e].sort((a, b) => a.date.localeCompare(b.date));
    });
  }, []);

  const removeEntry = useCallback((date: string) => {
    setEntries((prev) => prev.filter((x) => x.date !== date));
  }, []);

  const updateEntry = useCallback((originalDate: string, e: Entry) => {
    setEntries((prev) => {
      const without = prev.filter((x) => x.date !== originalDate && x.date !== e.date);
      return [...without, e].sort((a, b) => a.date.localeCompare(b.date));
    });
  }, []);

  return { entries, addEntry, removeEntry, updateEntry, loaded };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({ unit: "kg" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(read<Settings>(SETTINGS_KEY, { unit: "kg" }));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings, loaded]);

  return { settings, setSettings, loaded };
}
