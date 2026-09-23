import React, { useState } from "react";

import { Link } from "react-router-dom";

import Logo from "./Logo";

const MARKETING_URL = import.meta.env.VITE_MARKETING_URL || "http://localhost:5173";

const MENU_ITEMS = [
  { index: 0, label: "Dashboard", to: "/" },
  { index: 1, label: "Orders", to: "/orders" },
  { index: 2, label: "Holdings", to: "/holdings" },
  { index: 3, label: "Positions", to: "/positions" },
  { index: 4, label: "Funds", to: "/funds" },
  { index: 5, label: "Apps", to: "/apps" },
];

const Menu = () => {
  const [selectedMenu, setSelectedMenu] = useState(0);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const menuClass = "menu";
  const activeMenuClass = "menu selected";

  return (
    <div className="menu-container">
      <a href={MARKETING_URL} style={{ display: "flex" }}>
        <Logo withText={false} size={26} />
      </a>
      <div className="menus">
        <ul>
          {MENU_ITEMS.map(({ index, label, to }) => (
            <li key={label}>
              <Link
                style={{ textDecoration: "none" }}
                to={to}
                onClick={() => setSelectedMenu(index)}
              >
                <p className={selectedMenu === index ? activeMenuClass : menuClass}>
                  {label}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <hr />
        <div className="profile" onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}>
          <div className="avatar">VT</div>
          <p className="username">USERID</p>
        </div>
      </div>
    </div>
  );
};

export default Menu;
