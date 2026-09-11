import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Doc = {
  value: unknown;
  loaded: boolean;
  loading: boolean;
  listeners: Set<() => void>;
};

const docs = new Map<string, Doc>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let userId: string | null = null;

function getDoc(key: string): Doc {
  let d = docs.get(key);
  if (!d) {
    d = { value: undefined, loaded: false, loading: false, listeners: new Set() };
    docs.set(key, d);
  }
  return d;
}

function emit(d: Doc) {
  d.listeners.forEach((f) => f());
}

function readLocal(key: string): unknown {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function writeLocal(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

async function persist(key: string, value: unknown) {
  writeLocal(key, value);
  if (!userId) return;
  await supabase
    .from("user_data")
    .upsert({ user_id: userId, key, value: value as never }, { onConflict: "user_id,key" });
}

function schedulePersist(key: string, value: unknown) {
  writeLocal(key, value);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      void persist(key, value);
    }, 400),
  );
}

async function load(key: string) {
  const d = getDoc(key);
  if (d.loading) return;
  d.loading = true;
  const local = readLocal(key);
  if (!userId) {
    d.value = local;
    d.loaded = true;
    d.loading = false;
    emit(d);
    return;
  }
  const { data } = await supabase
    .from("user_data")
    .select("value")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();

  if (data) {
    d.value = data.value;
    writeLocal(key, data.value);
  } else {
    d.value = local;
    if (local !== undefined) void persist(key, local);
  }
  d.loaded = true;
  d.loading = false;
  emit(d);
}

/** Called by the auth provider whenever the signed-in user changes. */
export function setCloudUser(id: string | null) {
  if (id === userId) return;
  userId = id;
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  docs.forEach((d, key) => {
    d.value = undefined;
    d.loaded = false;
    d.loading = false;
    emit(d);
    void load(key);
  });
}

export function useCloudDoc<T>(key: string, fallback: T) {
  const d = getDoc(key);
  const [, force] = useState(0);

  useEffect(() => {
    const listener = () => force((n) => n + 1);
    d.listeners.add(listener);
    if (!d.loaded && !d.loading) void load(key);
    return () => {
      d.listeners.delete(listener);
    };
  }, [key, d]);

  const value = (d.value === undefined ? fallback : d.value) as T;

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const doc = getDoc(key);
      const prev = (doc.value === undefined ? fallback : doc.value) as T;
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      doc.value = resolved;
      doc.loaded = true;
      emit(doc);
      schedulePersist(key, resolved);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return { value, setValue, loaded: d.loaded };
}
