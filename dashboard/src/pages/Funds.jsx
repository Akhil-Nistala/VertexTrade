import React, { useCallback, useState } from "react";

import { api } from "../config/api";
import { usePolling } from "../hooks/usePolling";
import { formatRupees, useFunds } from "../hooks/useFunds";

const STARTING_CASH = 100000;

// Real balances from the API; invested and current value are computed from
// the user's holdings. Adding or withdrawing funds isn't supported.
const Funds = () => {
  const funds = useFunds();
  const [holdings, setHoldings] = useState([]);

  const fetchHoldings = useCallback(async () => {
    try {
      const res = await api.get("/holdings");
      setHoldings(res.data);
    } catch {
      // keep the last known holdings
    }
  }, []);

  usePolling(fetchHoldings, 5000);

  const invested = holdings.reduce((sum, h) => sum + h.avg * h.qty, 0);
  const currentValue = holdings.reduce((sum, h) => sum + h.price * h.qty, 0);
  const accountValue = funds == null ? null : funds.cash + funds.reservedCash + currentValue;

  return (
    <>
      <div className="funds">
        <p>Every account starts with {formatRupees(STARTING_CASH)} of virtual cash.</p>
      </div>

      <div className="row">
        <div className="col">
          <span>
            <p>Equity</p>
          </span>

          <div className="table">
            <div className="data">
              <p>Available cash</p>
              <p className="imp colored">{formatRupees(funds?.cash)}</p>
            </div>
            <div className="data">
              <p>Reserved for open orders</p>
              <p className="imp">{formatRupees(funds?.reservedCash)}</p>
            </div>
            <div className="data">
              <p>Invested</p>
              <p className="imp">{formatRupees(invested)}</p>
            </div>
            <div className="data">
              <p>Holdings value</p>
              <p className="imp">{formatRupees(currentValue)}</p>
            </div>
            <hr />
            <div className="data">
              <p>Account value</p>
              <p>{formatRupees(accountValue)}</p>
            </div>
            <div className="data">
              <p>Starting balance</p>
              <p>{formatRupees(STARTING_CASH)}</p>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="commodity">
            <p>You don't have a commodity account</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Funds;
