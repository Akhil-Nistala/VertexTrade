import React, { useCallback, useState } from "react";

import { api } from "../lib/api";
import { usePolling } from "../hooks/usePolling";
import { usePriceFlash } from "../hooks/usePriceFlash";

const keyOf = (p) => p._id;

const Positions = () => {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await api.get("/allPositions");
      setPositions(res.data);
    } catch {
      // keep the last known positions on a transient fetch failure
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchPositions, 5000);
  const flashes = usePriceFlash(positions, keyOf);

  if (loading) {
    return <div className="skeleton-block" />;
  }

  return (
    <>
      <h3 className="title">Positions ({positions.length})</h3>

      {positions.length === 0 ? (
        <p className="empty-state">
          No open positions yet — run <code>npm run seed</code> in the backend to add sample data.
        </p>
      ) : (
        <div className="order-table">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Instrument</th>
                <th>Qty.</th>
                <th>Avg.</th>
                <th>LTP</th>
                <th>P&L</th>
                <th>Chg.</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((stock) => {
                const curValue = stock.price * stock.qty;
                const isProfit = curValue - stock.avg * stock.qty >= 0.0;
                const profClass = isProfit ? "profit" : "loss";
                const dayClass = stock.isLoss ? "loss" : "profit";

                return (
                  <tr key={stock._id} className={flashes[stock._id] || ""}>
                    <td>{stock.product}</td>
                    <td>{stock.name}</td>
                    <td>{stock.qty}</td>
                    <td>{stock.avg.toFixed(2)}</td>
                    <td>{stock.price.toFixed(2)}</td>
                    <td className={profClass}>
                      {(curValue - stock.avg * stock.qty).toFixed(2)}
                    </td>
                    <td className={dayClass}>{stock.day}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default Positions;
