
function AwardGraphic() {
  return (
    <svg viewBox="0 0 300 240" style={{ width: "90%" }} role="img" aria-label="Largest broker badge">
      <rect x="0" y="0" width="300" height="240" rx="16" fill="#fdece4" />
      <circle cx="150" cy="100" r="60" fill="#fff" stroke="#F56834" strokeWidth="6" />
      <path d="M150 60 L162 90 L195 90 L168 110 L178 142 L150 122 L122 142 L132 110 L105 90 L138 90 Z" fill="#F56834" />
      <rect x="120" y="170" width="60" height="14" rx="4" fill="#F56834" opacity="0.4" />
    </svg>
  );
}

function Awards() {
  return (
    <div className="container">
      <div className="row p-5">
        <div className="col-6 p-5 d-flex align-items-center justify-content-center">
          <AwardGraphic />
        </div>

        <div className="col-6 p-5">
          <h1>Largest stock broker in India</h1>

          <p className="mt-3">
            1+ Crore customers with over ₹4.5 lakh crore of equity investments
            with us
          </p>

          <p>
            <a href="#">The largest stock broker in India</a>
          </p>

          <p>
            <a href="#">See our awards →</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Awards;
