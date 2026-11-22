import React, { useCallback, useContext, useMemo, useState } from "react";

import { Tooltip, Grow } from "@mui/material";

import {
  BarChartOutlined,
  KeyboardArrowDown,
  KeyboardArrowUp,
  MoreHoriz,
} from "@mui/icons-material";

import GeneralContext from "../context/GeneralContext";
import { api } from "../config/api";
import { usePolling } from "../hooks/usePolling";
import { usePriceFlash } from "../hooks/usePriceFlash";
import { DoughnutChart } from "./DoughnutChart";

const keyOf = (stock) => stock.symbol;

const CHART_COLORS = [
  "rgba(255, 99, 132, 0.5)",
  "rgba(54, 162, 235, 0.5)",
  "rgba(255, 206, 86, 0.5)",
  "rgba(75, 192, 192, 0.5)",
  "rgba(153, 102, 255, 0.5)",
  "rgba(255, 159, 64, 0.5)",
];
const CHART_BORDERS = [
  "rgba(255, 99, 132, 1)",
  "rgba(54, 162, 235, 1)",
  "rgba(255, 206, 86, 1)",
  "rgba(75, 192, 192, 1)",
  "rgba(153, 102, 255, 1)",
  "rgba(255, 159, 64, 1)",
];

// Live market quotes from the API — the same prices orders fill at.
const WatchList = () => {
  const [search, setSearch] = useState("");
  const [stocks, setStocks] = useState([]);

  const fetchStocks = useCallback(async () => {
    try {
      const res = await api.get("/stocks");
      setStocks(res.data);
    } catch {
      // keep the last known quotes on a transient fetch failure
    }
  }, []);

  usePolling(fetchStocks, 5000);
  const flashes = usePriceFlash(stocks, keyOf);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stocks;
    return stocks.filter((stock) => stock.symbol.toLowerCase().includes(q));
  }, [search, stocks]);

  const data = {
    labels: filtered.map((stock) => stock.symbol),
    datasets: [
      {
        label: "Price",
        data: filtered.map((stock) => stock.price),
        backgroundColor: CHART_COLORS,
        borderColor: CHART_BORDERS,
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="watchlist-container">
      <div className="search-container">
        <input
          type="text"
          name="search"
          id="search"
          placeholder="Search eg:infy, bse, nifty fut weekly, gold mcx"
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="counts">
          {filtered.length} / {stocks.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">No matching instruments.</p>
      ) : (
        <>
          <ul className="list">
            {filtered.map((stock) => (
              <WatchListItem stock={stock} flash={flashes[stock.symbol]} key={stock.symbol} />
            ))}
          </ul>

          <DoughnutChart data={data} />
        </>
      )}
    </div>
  );
};

export default WatchList;

const WatchListItem = ({ stock, flash }) => {
  const [showWatchlistActions, setShowWatchlistActions] = useState(false);

  return (
    <li
      onMouseEnter={() => setShowWatchlistActions(true)}
      onMouseLeave={() => setShowWatchlistActions(false)}
    >
      <div className="item">
        <p className={stock.isDown ? "down" : "up"}>{stock.symbol}</p>
        <div className="itemInfo">
          <span className="percent">{stock.day}</span>
          {stock.isDown ? (
            <KeyboardArrowDown className="down" />
          ) : (
            <KeyboardArrowUp className="up" />
          )}
          <span className={`price ${flash || ""}`}>{stock.price.toFixed(2)}</span>
        </div>
      </div>
      {showWatchlistActions && <WatchListActions symbol={stock.symbol} />}
    </li>
  );
};

const WatchListActions = ({ symbol }) => {
  const { openOrderWindow } = useContext(GeneralContext);

  return (
    <span className="actions">
      <span>
        <Tooltip title="Buy (B)" placement="top" arrow TransitionComponent={Grow}>
          <button className="buy" onClick={() => openOrderWindow(symbol, "BUY")}>
            Buy
          </button>
        </Tooltip>
        <Tooltip title="Sell (S)" placement="top" arrow TransitionComponent={Grow}>
          <button className="sell" onClick={() => openOrderWindow(symbol, "SELL")}>
            Sell
          </button>
        </Tooltip>
        <Tooltip title="Analytics (A)" placement="top" arrow TransitionComponent={Grow}>
          <button className="action">
            <BarChartOutlined className="icon" />
          </button>
        </Tooltip>
        <Tooltip title="More" placement="top" arrow TransitionComponent={Grow}>
          <button className="action">
            <MoreHoriz className="icon" />
          </button>
        </Tooltip>
      </span>
    </span>
  );
};
