import React, { useCallback, useContext, useState } from "react";

import { api } from "../config/api";
import GeneralContext from "../context/GeneralContext";
import { usePolling } from "../hooks/usePolling";
import { formatRupees, useFunds } from "../hooks/useFunds";

import "../styles/orderActionWindow.css";

const hasAtMostTwoDecimals = (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

// Market orders fill at the server's price straight away. Limit orders fill
// once the market reaches the limit; until then the server reserves the cash
// (buy) or shares (sell). The prices shown here are live but indicative.
const OrderActionWindow = ({ uid, mode }) => {
  const [orderType, setOrderType] = useState("MARKET");
  const [qty, setQty] = useState(1);
  const [limitPrice, setLimitPrice] = useState("");
  const [marketPrice, setMarketPrice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { closeOrderWindow } = useContext(GeneralContext);
  const funds = useFunds();

  const fetchPrice = useCallback(async () => {
    try {
      const res = await api.get("/stocks");
      const price = res.data.find((s) => s.symbol === uid)?.price ?? null;
      setMarketPrice(price);
      // Start the limit at the current price the first time we know it.
      setLimitPrice((current) => (current === "" && price != null ? price.toFixed(2) : current));
    } catch {
      // keep the last known price
    }
  }, [uid]);

  usePolling(fetchPrice, 4000);

  const isSell = mode === "SELL";
  const isLimit = orderType === "LIMIT";

  const q = Number(qty);
  const limit = Number(limitPrice);
  const qtyValid = Number.isInteger(q) && q > 0;
  const limitValid = Number.isFinite(limit) && limit > 0 && hasAtMostTwoDecimals(limit);
  const isValid = qtyValid && (!isLimit || limitValid);

  // A limit the market already satisfies fills immediately at the market price.
  const fillsNow =
    isLimit && limitValid && marketPrice != null && (isSell ? marketPrice >= limit : marketPrice <= limit);

  const note = (() => {
    if (!isLimit) return "Fills at the market price when placed.";
    if (!limitValid) return "Enter a limit price (up to 2 decimals).";
    if (fillsNow) return "The market already meets this limit, so it fills now at the market price.";
    return isSell
      ? `Fills when the price reaches ${formatRupees(limit)} or more. ${qtyValid ? q : "The"} share${q === 1 ? " is" : "s are"} reserved until then.`
      : `Fills when the price drops to ${formatRupees(limit)} or less. ${qtyValid ? formatRupees(q * limit) : "The cost"} is reserved until then.`;
  })();

  const estimate = (() => {
    if (!qtyValid) return null;
    if (!isLimit || fillsNow) return marketPrice != null ? q * marketPrice : null;
    return limitValid ? q * limit : null;
  })();
  const estimateLabel = isLimit && !fillsNow ? (isSell ? "Min. proceeds" : "Max. cost") : isSell ? "Approx. proceeds" : "Approx. cost";

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await api.post("/orders", {
        name: uid,
        qty: q,
        mode,
        type: orderType,
        ...(isLimit && { limitPrice: limit }),
      });
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
        <div className="market-options">
          <span>Market price {marketPrice != null ? formatRupees(marketPrice) : "…"}</span>
          <span className="order-type">
            {["MARKET", "LIMIT"].map((type) => (
              <label key={type}>
                <input
                  type="radio"
                  name="order-type"
                  value={type}
                  checked={orderType === type}
                  onChange={() => setOrderType(type)}
                />
                {type === "MARKET" ? "Market" : "Limit"}
              </label>
            ))}
          </span>
        </div>
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
          {isLimit && (
            <fieldset>
              <legend>Limit price</legend>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
              />
            </fieldset>
          )}
        </div>
        <p className="order-note">{note}</p>
        {error && <p className="order-error">{error}</p>}
      </div>

      <div className="buttons">
        <span>
          {estimateLabel} {estimate != null ? formatRupees(estimate) : "—"}
          {" · "}Available {formatRupees(funds?.cash)}
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
