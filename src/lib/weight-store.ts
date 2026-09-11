import { useCallback } from "react";
import { useCloudDoc } from "./cloud-store";

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

const EMPTY_ENTRIES: Entry[] = [];
const DEFAULT_SETTINGS: Settings = { unit: "kg" };

export function useEntries() {
  const { value: entries, setValue, loaded } = useCloudDoc<Entry[]>(ENTRIES_KEY, EMPTY_ENTRIES);

  const addEntry = useCallback(
    (e: Entry) => {
      setValue((prev) => [...prev.filter((x) => x.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date)));
    },
    [setValue],
  );

  const removeEntry = useCallback(
    (date: string) => setValue((prev) => prev.filter((x) => x.date !== date)),
    [setValue],
  );

  const updateEntry = useCallback(
    (originalDate: string, e: Entry) => {
      setValue((prev) =>
        [...prev.filter((x) => x.date !== originalDate && x.date !== e.date), e].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      );
    },
    [setValue],
  );

  return { entries, addEntry, removeEntry, updateEntry, loaded };
}

export function useSettings() {
  const { value, setValue, loaded } = useCloudDoc<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  return { settings: value, setSettings: setValue, loaded };
}
