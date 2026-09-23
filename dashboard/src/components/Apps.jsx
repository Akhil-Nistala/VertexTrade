import React from "react";

const COMING_SOON = ["Mutual Funds", "Bonds", "IPO", "US Stocks"];

const Apps = () => {
  return (
    <>
      <h3 className="title">Apps</h3>
      <div className="apps-grid">
        {COMING_SOON.map((name) => (
          <div className="app-card" key={name}>
            <p>{name}</p>
            <span>Coming soon</span>
          </div>
        ))}
      </div>
    </>
  );
};

export default Apps;
