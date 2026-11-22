import React from "react";
import { Route, Routes } from "react-router-dom";

import Apps from "../pages/Apps";
import Funds from "../pages/Funds";
import Holdings from "../pages/Holdings";

import Orders from "../pages/Orders";
import Positions from "../pages/Positions";
import Summary from "../pages/Summary";
import WatchList from "./WatchList";
import { GeneralContextProvider } from "../context/GeneralContext";

const Dashboard = () => {
  return (
    <div className="dashboard-container">
      <GeneralContextProvider>
        <WatchList />
      </GeneralContextProvider>
      <div className="content">
        <Routes>
          <Route path="/" element={<Summary />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/holdings" element={<Holdings />} />
          <Route path="/positions" element={<Positions />} />
          <Route path="/funds" element={<Funds />} />
          <Route path="/apps" element={<Apps />} />
        </Routes>
      </div>
    </div>
  );
};

export default Dashboard;
