import { useEffect, useState } from 'react';

// Store only UI preferences in this tab; never tokens, API data or form contents.
export default function useSessionPreference(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`main-ui:${key}`);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(initialValue) ? Array.isArray(parsed) && parsed.every(Number.isFinite)
          : typeof parsed === typeof initialValue && (typeof parsed !== 'number' || Number.isFinite(parsed))) return parsed;
      }
    } catch { /* Storage may be disabled or contain an old value. */ }
    return initialValue;
  });
  useEffect(() => {
    try { sessionStorage.setItem(`main-ui:${key}`, JSON.stringify(value)); } catch { /* Optional persistence. */ }
  }, [key, value]);
  return [value, setValue];
}
