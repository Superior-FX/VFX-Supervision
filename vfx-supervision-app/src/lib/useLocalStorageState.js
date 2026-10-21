import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import * as sharedStore from "./sharedStore.js";

// [value, setValue] persisted under a storage key. Team data — projects,
// the artist roster, and each project's shots/scenes/reports — is shared
// through Supabase (see sharedStore.js); every other key (active project,
// sort choices, remembered frames…) is this browser's own and stays in
// localStorage. A given key is always one or the other, so each call site
// always takes the same branch.
export function useLocalStorageState(key, initialValue) {
  return sharedStore.sharedKeyInfo(key) ? useSharedState(key) : useBrowserState(key, initialValue);
}

function useSharedState(key) {
  const value = useSyncExternalStore(
    useCallback((onChange) => sharedStore.subscribe(key, onChange), [key]),
    () => sharedStore.read(key)
  );
  const setValue = useCallback(
    (update) => sharedStore.write(key, typeof update === "function" ? update(sharedStore.read(key)) : update),
    [key]
  );
  return [value, setValue];
}

function useBrowserState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

export function upsertById(list, item) {
  const idx = list.findIndex((existing) => existing.id === item.id);
  if (idx === -1) return [...list, item];
  const next = [...list];
  next[idx] = item;
  return next;
}

export function moveItem(list, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
