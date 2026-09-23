import { Link } from "react-router-dom";

import Logo from "./Logo";

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || "http://localhost:5174";

function Navbar() {
  return (
    <nav
      className="navbar navbar-expand-lg border-bottom"
      style={{ backgroundColor: "#FFF" }}
    >
      <div className="container p-2">
        <Link className="navbar-brand" to="/">
          <Logo />
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarSupportedContent"
          aria-controls="navbarSupportedContent"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div
          className="collapse navbar-collapse"
          id="navbarSupportedContent"
        >
          <ul className="navbar-nav mb-lg-0 me-auto">
            <li className="nav-item">
              <Link className="nav-link active" to="/about">
                About
              </Link>
            </li>

            <li className="nav-item">
              <Link className="nav-link active" to="/product">
                Product
              </Link>
            </li>

            <li className="nav-item">
              <Link className="nav-link active" to="/pricing">
                Pricing
              </Link>
            </li>

            <li className="nav-item">
              <Link className="nav-link active" to="/support">
                Support
              </Link>
            </li>
          </ul>

          <div className="d-flex gap-2">
            <Link className="btn btn-outline-primary" to="/signup">
              Signup
            </Link>
            <a className="btn btn-primary" href={DASHBOARD_URL}>
              Login
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
