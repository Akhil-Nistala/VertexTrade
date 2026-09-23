import { Link } from "react-router-dom";

function ChartGraphic() {
  return (
    <svg viewBox="0 0 480 220" style={{ maxWidth: 480, width: "100%" }} role="img" aria-label="Rising stock chart">
      <rect x="0" y="0" width="480" height="220" rx="16" fill="#fdece4" />
      <polyline
        points="20,170 90,140 150,155 210,100 270,120 330,60 390,80 460,30"
        fill="none"
        stroke="#F56834"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="460" cy="30" r="7" fill="#F56834" />
    </svg>
  );
}

function Hero() {
  return (
    <div className="container p-5 mb-5">
      <div className="row text-center">
        <div className="d-flex justify-content-center mb-5">
          <ChartGraphic />
        </div>

        <h1 className="mt-3">Invest in everything</h1>

        <p>
          Online platform to invest in stocks, derivatives, mutual funds, and
          more
        </p>

        <Link
          to="/signup"
          className="p-2 btn btn-primary fs-5 mb-5"
          style={{ width: "20%", margin: "0 auto" }}
        >
          Signup Now
        </Link>
      </div>
    </div>
  );
}

export default Hero;
