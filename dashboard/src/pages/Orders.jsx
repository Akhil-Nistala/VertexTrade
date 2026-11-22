import React, { useCallback, useState } from "react";

import { api } from "../config/api";
import { usePolling } from "../hooks/usePolling";
import { formatRupees } from "../hooks/useFunds";

const STATUS_CLASS = { FILLED: "profit", CANCELLED: "muted", EXPIRED: "muted" };

const formatPrice = (value) => (value == null ? "—" : value.toFixed(2));

// Open (pending limit) orders with a cancel button, and the order history.
const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("open");
  const [cancelling, setCancelling] = useState(null);
  const [error, setError] = useState("");

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get("/orders");
      setOrders(res.data);
    } catch {
      // keep the last known orders on a transient fetch failure
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchOrders, 5000);

  const handleCancel = async (orderId) => {
    setCancelling(orderId);
    setError("");
    try {
      await api.post(`/orders/${orderId}/cancel`);
    } catch (err) {
      // e.g. it filled a moment ago — the refresh below shows its real status
      setError(err.response?.data?.message || "Could not cancel the order");
    } finally {
      setCancelling(null);
      fetchOrders();
    }
  };

  if (loading) {
    return <div className="skeleton-block" />;
  }

  const open = orders.filter((o) => o.status === "PENDING");
  const history = orders.filter((o) => o.status !== "PENDING");

  return (
    <div className="orders">
      <div className="order-tabs">
        <button type="button" className={tab === "open" ? "active" : ""} onClick={() => setTab("open")}>
          Open ({open.length})
        </button>
        <button type="button" className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
          History ({history.length})
        </button>
      </div>

      {error && <p className="order-error">{error}</p>}

      {tab === "open" ? (
        open.length === 0 ? (
          <div className="no-orders">
            <p>No open orders</p>
            <p style={{ fontSize: "0.8rem" }}>Limit orders wait here until the price reaches your limit.</p>
          </div>
        ) : (
          <div className="order-table">
            <table>
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Side</th>
                  <th>Qty.</th>
                  <th>Limit</th>
                  <th>Reserved</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {open.map((order) => (
                  <tr key={order._id}>
                    <td>{order.name}</td>
                    <td className={order.mode === "SELL" ? "loss" : "profit"}>{order.mode}</td>
                    <td>{order.qty}</td>
                    <td>{formatPrice(order.limitPrice)}</td>
                    <td>
                      {order.mode === "BUY" ? formatRupees(order.reserved) : `${order.reserved} shares`}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cancel-order"
                        onClick={() => handleCancel(order._id)}
                        disabled={cancelling === order._id}
                      >
                        {cancelling === order._id ? "Cancelling…" : "Cancel"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : history.length === 0 ? (
        <div className="no-orders">
          <p>You haven't placed any orders yet</p>
          <p style={{ fontSize: "0.8rem" }}>Buy or sell something from the watchlist to see it here.</p>
        </div>
      ) : (
        <div className="order-table">
          <table>
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Type</th>
                <th>Side</th>
                <th>Qty.</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((order) => (
                <tr key={order._id}>
                  <td>{order.name}</td>
                  <td>{order.type === "LIMIT" ? `Limit ${formatPrice(order.limitPrice)}` : "Market"}</td>
                  <td className={order.mode === "SELL" ? "loss" : "profit"}>{order.mode}</td>
                  <td>{order.qty}</td>
                  <td>{formatPrice(order.price)}</td>
                  <td className={STATUS_CLASS[order.status] || ""}>{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Orders;
