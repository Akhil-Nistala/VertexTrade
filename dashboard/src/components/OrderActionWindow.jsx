import React, { useContext, useMemo, useState } from "react";

import { api } from "../lib/api";
import GeneralContext from "./GeneralContext";

import "./OrderActionWindow.css";

const OrderActionWindow = ({ uid, mode }) => {
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { closeOrderWindow } = useContext(GeneralContext);

  const isSell = mode === "SELL";

  const isValid = useMemo(() => {
    const q = Number(qty);
    const p = Number(price);
    return Number.isInteger(q) && q > 0 && Number.isFinite(p) && p > 0;
  }, [qty, price]);

  const margin = (Number(qty) || 0) * (Number(price) || 0);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await api.post("/newOrder", {
        name: uid,
        qty: Number(qty),
        price: Number(price),
        mode,
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
          <fieldset>
            <legend>Price</legend>
            <input
              type="number"
              min="0"
              step="0.05"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </fieldset>
        </div>
        {error && <p className="order-error">{error}</p>}
      </div>

      <div className="buttons">
        <span>Margin required ₹{margin.toFixed(2)}</span>
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
