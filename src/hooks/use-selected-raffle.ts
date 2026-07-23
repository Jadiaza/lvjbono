import { useEffect, useState, useCallback } from "react";

const KEY = "rifa.selected";

export function useSelectedRaffle() {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) setId(v);
    } catch {
      /* ignore */
    }
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setId(e.newValue);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const select = useCallback((next: string | null) => {
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setId(next);
    // notify same tab
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: next }));
  }, []);

  return { id, select };
}
