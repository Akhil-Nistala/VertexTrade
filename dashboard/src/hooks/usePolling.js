import { useEffect, useRef } from "react";

// Re-runs `callback` immediately and then every `intervalMs`, without
// re-registering the interval when `callback` itself changes identity.
export function usePolling(callback, intervalMs) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    savedCallback.current();
    const id = setInterval(() => savedCallback.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
