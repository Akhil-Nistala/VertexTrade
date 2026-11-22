import { useCallback, useState } from "react";

import { api } from "../config/api";
import { usePolling } from "./usePolling";

// The logged-in user's balances, refreshed every `intervalMs`:
// { cash, reservedCash } — reservedCash is held for open limit buys.
// null until the first response arrives.
export function useFunds(intervalMs = 5000) {
  const [funds, setFunds] = useState(null);

  const fetchFunds = useCallback(async () => {
    try {
      const res = await api.get("/funds");
      setFunds(res.data);
    } catch {
      // keep the last known balances on a transient failure
    }
  }, []);

  usePolling(fetchFunds, intervalMs);

  return funds;
}

export const formatRupees = (value) =>
  value == null
    ? "—"
    : `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
