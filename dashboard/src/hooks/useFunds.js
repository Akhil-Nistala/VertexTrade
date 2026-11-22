import { useCallback, useState } from "react";

import { api } from "../config/api";
import { usePolling } from "./usePolling";

// The logged-in user's cash balance, refreshed every `intervalMs`.
// `cash` is null until the first response arrives.
export function useFunds(intervalMs = 5000) {
  const [cash, setCash] = useState(null);

  const fetchFunds = useCallback(async () => {
    try {
      const res = await api.get("/funds");
      setCash(res.data.cash);
    } catch {
      // keep the last known balance on a transient failure
    }
  }, []);

  usePolling(fetchFunds, intervalMs);

  return cash;
}

export const formatRupees = (value) =>
  value == null
    ? "—"
    : `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
