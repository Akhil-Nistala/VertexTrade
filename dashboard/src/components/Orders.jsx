import React, { useCallback, useState } from "react";

import { api } from "../lib/api";
import { usePolling } from "../hooks/usePolling";

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get("/allOrders");
      setOrders(res.data);
    } catch {
      // keep the last known orders on a transient fetch failure
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchOrders, 5000);

  if (loading) {
    return <div className="skeleton-block" />;
  }

  if (orders.length === 0) {
    return (
      <div className="orders">
        <div className="no-orders">
          <p>You haven't placed any orders today</p>
          <p style={{ fontSize: "0.8rem" }}>
            Buy or sell something from the watchlist to see it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="orders">
      <h3 className="title">Orders ({orders.length})</h3>
      <div className="order-table">
        <table>
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Type</th>
              <th>Qty.</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id}>
                <td>{order.name}</td>
                <td className={order.mode === "SELL" ? "loss" : "profit"}>{order.mode}</td>
                <td>{order.qty}</td>
                <td>{order.price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Orders;
