import { useEffect, useState } from 'react';

/**
 * Trail a rapidly-changing value by `delay`.
 *
 * The screener re-filters 160 pairs on every keystroke; debouncing the search
 * term keeps typing smooth without throttling the input itself, so the field
 * stays perfectly responsive while the expensive work lags behind.
 */
export function useDebounced<T>(value: T, delay = 180): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
