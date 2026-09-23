import React, { useCallback, useState } from "react";

import { VerticalGraph } from "./VerticalGraph";
import { api } from "../lib/api";
import { usePolling } from "../hooks/usePolling";
import { usePriceFlash } from "../hooks/usePriceFlash";

const keyOf = (h) => h._id;

const Holdings = () => {
  const [allHoldings, setAllHoldings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHoldings = useCallback(async () => {
    try {
      const res = await api.get("/allHoldings");
      setAllHoldings(res.data);
    } catch {
      // keep the last known holdings on a transient fetch failure
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchHoldings, 5000);
  const flashes = usePriceFlash(allHoldings, keyOf);

  if (loading) {
    return <div className="skeleton-block" />;
  }

  const totalInvestment = allHoldings.reduce((sum, s) => sum + s.avg * s.qty, 0);
  const currentValue = allHoldings.reduce((sum, s) => sum + s.price * s.qty, 0);
  const pnl = currentValue - totalInvestment;

  const data = {
    labels: allHoldings.map((stock) => stock.name),
    datasets: [
      {
        label: "Stock Price",
        data: allHoldings.map((stock) => stock.price),
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
    ],
  };

  return (
    <>
      <h3 className="title">Holdings ({allHoldings.length})</h3>

      {allHoldings.length === 0 ? (
        <p className="empty-state">
          No holdings yet — run <code>npm run seed</code> in the backend to add sample data.
        </p>
      ) : (
        <>
          <div className="order-table">
            <table>
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Qty.</th>
                  <th>Avg. cost</th>
                  <th>LTP</th>
                  <th>Cur. val</th>
                  <th>P&L</th>
                  <th>Net chg.</th>
                  <th>Day chg.</th>
                </tr>
              </thead>
              <tbody>
                {allHoldings.map((stock) => {
                  const curValue = stock.price * stock.qty;
                  const isProfit = curValue - stock.avg * stock.qty >= 0.0;
                  const profClass = isProfit ? "profit" : "loss";
                  const dayClass = stock.isLoss ? "loss" : "profit";

                  return (
                    <tr key={stock._id} className={flashes[stock._id] || ""}>
                      <td>{stock.name}</td>
                      <td>{stock.qty}</td>
                      <td>{stock.avg.toFixed(2)}</td>
                      <td>{stock.price.toFixed(2)}</td>
                      <td>{curValue.toFixed(2)}</td>
                      <td className={profClass}>
                        {(curValue - stock.avg * stock.qty).toFixed(2)}
                      </td>
                      <td className={profClass}>{stock.net}</td>
                      <td className={dayClass}>{stock.day}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="row">
            <div className="col">
              <h5>₹{totalInvestment.toFixed(2)}</h5>
              <p>Total investment</p>
            </div>
            <div className="col">
              <h5>₹{currentValue.toFixed(2)}</h5>
              <p>Current value</p>
            </div>
            <div className="col">
              <h5 className={pnl >= 0 ? "profit" : "loss"}>
                ₹{pnl.toFixed(2)} ({totalInvestment ? ((pnl / totalInvestment) * 100).toFixed(2) : "0.00"}%)
              </h5>
              <p>P&L</p>
            </div>
          </div>
          <VerticalGraph data={data} />
        </>
      )}
    </>
  );
};

export default Holdings;
