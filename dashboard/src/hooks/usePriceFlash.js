import { useEffect, useRef, useState } from "react";

// Compares each item's `price` against its previous value and returns a
// { [key]: "tick-up" | "tick-down" } map that self-clears after ~900ms, so
// rows can flash green/red when the simulated market moves.
export function usePriceFlash(items, keyFn) {
  const prevPrices = useRef({});
  const [flashes, setFlashes] = useState({});

  useEffect(() => {
    const nextFlashes = {};
    items.forEach((item) => {
      const key = keyFn(item);
      const prev = prevPrices.current[key];
      if (prev !== undefined && item.price !== prev) {
        nextFlashes[key] = item.price > prev ? "tick-up" : "tick-down";
      }
      prevPrices.current[key] = item.price;
    });

    if (Object.keys(nextFlashes).length === 0) return undefined;

    setFlashes((f) => ({ ...f, ...nextFlashes }));
    const timeout = setTimeout(() => {
      setFlashes((f) => {
        const copy = { ...f };
        Object.keys(nextFlashes).forEach((k) => delete copy[k]);
        return copy;
      });
    }, 900);

    return () => clearTimeout(timeout);
  }, [items, keyFn]);

  return flashes;
}
