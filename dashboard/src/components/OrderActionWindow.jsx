import React, { useCallback, useContext, useState } from "react";

import { api } from "../config/api";
import GeneralContext from "../context/GeneralContext";
import { usePolling } from "../hooks/usePolling";
import { formatRupees, useFunds } from "../hooks/useFunds";

import "../styles/orderActionWindow.css";

// Market order: the user picks quantity and side; the server fills at its
// current price. The price shown here is live but indicative only.
const OrderActionWindow = ({ uid, mode }) => {
  const [qty, setQty] = useState(1);
  const [marketPrice, setMarketPrice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { closeOrderWindow } = useContext(GeneralContext);
  const cash = useFunds();

  const fetchPrice = useCallback(async () => {
    try {
      const res = await api.get("/stocks");
      setMarketPrice(res.data.find((s) => s.symbol === uid)?.price ?? null);
    } catch {
      // keep the last known price
    }
  }, [uid]);

  usePolling(fetchPrice, 4000);

  const isSell = mode === "SELL";
  const q = Number(qty);
  const isValid = Number.isInteger(q) && q > 0;
  const estimate = marketPrice != null && isValid ? q * marketPrice : null;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await api.post("/orders", { name: uid, qty: q, mode });
      closeOrderWindow();
    } catch (err) {
      setError(err.response?.data?.message || "Could not place order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" id="order-window">
      <div className="header" style={{ background: isSell ? "#F56834" : "#4184f3" }}>
        <h3>
          {uid} <span>NSE</span>
        </h3>
        <p className="market-options">
          Market price {marketPrice != null ? formatRupees(marketPrice) : "…"}
        </p>
      </div>

      <div className="regular-order">
        <div className="inputs">
          <fieldset>
            <legend>Qty.</legend>
            <input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </fieldset>
        </div>
        <p className="order-note">Fills at the market price when placed.</p>
        {error && <p className="order-error">{error}</p>}
      </div>

      <div className="buttons">
        <span>
          {isSell ? "Approx. proceeds" : "Approx. cost"} {estimate != null ? formatRupees(estimate) : "—"}
          {" · "}Available {formatRupees(cash)}
        </span>
        <div>
          <button
            type="button"
            className={isSell ? "btn btn-orange" : "btn btn-blue"}
            onClick={handleSubmit}
            disabled={!isValid || submitting}
          >
            {submitting ? "Placing..." : isSell ? "Sell" : "Buy"}
          </button>
          <button type="button" className="btn btn-grey" onClick={closeOrderWindow}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderActionWindow;
