import React, { useState } from "react";

import OrderActionWindow from "./OrderActionWindow";

const GeneralContext = React.createContext({
  openOrderWindow: (_uid, _mode) => {},
  closeOrderWindow: () => {},
});

export const GeneralContextProvider = ({ children }) => {
  const [isOrderWindowOpen, setIsOrderWindowOpen] = useState(false);
  const [selectedStockUID, setSelectedStockUID] = useState("");
  const [orderMode, setOrderMode] = useState("BUY");

  const openOrderWindow = (uid, mode) => {
    setIsOrderWindowOpen(true);
    setSelectedStockUID(uid);
    setOrderMode(mode);
  };

  const closeOrderWindow = () => {
    setIsOrderWindowOpen(false);
    setSelectedStockUID("");
  };

  return (
    <GeneralContext.Provider value={{ openOrderWindow, closeOrderWindow }}>
      {children}
      {isOrderWindowOpen && (
        <OrderActionWindow uid={selectedStockUID} mode={orderMode} />
      )}
    </GeneralContext.Provider>
  );
};

export default GeneralContext;
