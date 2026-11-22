
function PricingGraphic({ color }) {
  return (
    <svg viewBox="0 0 120 120" style={{ width: "50%" }} role="img" aria-label="Pricing icon">
      <circle cx="60" cy="60" r="56" fill={color} opacity="0.12" />
      <text x="60" y="72" textAnchor="middle" fontSize="40" fontWeight="700" fill={color}>
        ₹
      </text>
    </svg>
  );
}

function Pricing() {
  return (
    <div className="container p-5">
      <div className="row">
        <div className="col-4 p-5">
          <h1>Unbeatable pricing</h1>
          <p className="mt-3">
            We pioneered the concept of discount broking and price
            transparency in India. Flat fees and no hidden charges.
          </p>
          <a href="#">See pricing →</a>
        </div>

        <div className="col-4 p-5 text-center">
          <PricingGraphic color="#48c237" />
          <p>Free equity delivery and direct mutual funds</p>
        </div>

        <div className="col-4 p-5 text-center">
          <PricingGraphic color="#4184f3" />
          <p>Flat ₹20/order for intraday and F&O</p>
        </div>
      </div>
    </div>
  );
}

export default Pricing;
