import React, { useCallback, useState } from "react";

import { api } from "../lib/api";
import { usePolling } from "../hooks/usePolling";

// No funds/margin backend in this demo — a small fixed figure stands in for
// "available margin" so the summary layout still reads correctly.
const MOCK_MARGIN = 3740;

const Summary = () => {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHoldings = useCallback(async () => {
    try {
      const res = await api.get("/allHoldings");
      setHoldings(res.data);
    } catch {
      // keep the last known summary on a transient fetch failure
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchHoldings, 5000);

  if (loading) {
    return <div className="skeleton-block" />;
  }

  const totalInvestment = holdings.reduce((sum, s) => sum + s.avg * s.qty, 0);
  const currentValue = holdings.reduce((sum, s) => sum + s.price * s.qty, 0);
  const pnl = currentValue - totalInvestment;
  const pnlPercent = totalInvestment ? (pnl / totalInvestment) * 100 : 0;

  return (
    <>
      <div className="username">
        <h6>Hi, User!</h6>
        <hr className="divider" />
      </div>

      <div className="section">
        <span>
          <p>Equity</p>
        </span>

        <div className="data">
          <div className="first">
            <h3>{(MOCK_MARGIN / 1000).toFixed(2)}k</h3>
            <p>Margin available</p>
          </div>
          <hr />

          <div className="second">
            <p>
              Margins used <span>0</span>{" "}
            </p>
            <p>
              Opening balance <span>{(MOCK_MARGIN / 1000).toFixed(2)}k</span>{" "}
            </p>
          </div>
        </div>
        <hr className="divider" />
      </div>

      <div className="section">
        <span>
          <p>Holdings ({holdings.length})</p>
        </span>

        <div className="data">
          <div className="first">
            <h3 className={pnl >= 0 ? "profit" : "loss"}>
              {(Math.abs(pnl) / 1000).toFixed(2)}k{" "}
              <small>
                {pnl >= 0 ? "+" : "-"}
                {Math.abs(pnlPercent).toFixed(2)}%
              </small>{" "}
            </h3>
            <p>P&L</p>
          </div>
          <hr />

          <div className="second">
            <p>
              Current Value <span>{(currentValue / 1000).toFixed(2)}k</span>{" "}
            </p>
            <p>
              Investment <span>{(totalInvestment / 1000).toFixed(2)}k</span>{" "}
            </p>
          </div>
        </div>
        <hr className="divider" />
      </div>
    </>
  );
};

export default Summary;
