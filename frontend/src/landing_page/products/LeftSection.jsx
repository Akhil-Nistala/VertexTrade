function KiteGraphic() {
  return (
    <svg viewBox="0 0 300 220" className="img-fluid" role="img" aria-label="Kite trading platform preview">
      <rect x="0" y="0" width="300" height="220" rx="16" fill="#fdece4" />
      <rect x="30" y="30" width="240" height="160" rx="10" fill="#fff" stroke="#F56834" strokeWidth="3" />
      <polyline
        points="45,150 80,130 110,140 140,100 170,115 200,70 230,90 255,55"
        fill="none"
        stroke="#F56834"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LeftSection() {
  return (
    <div className="container p-5">
      <div className="row align-items-center">
        <div className="col-6 p-5">
          <KiteGraphic />
        </div>

        <div className="col-6 p-5">
          <h1>Kite</h1>
          <p>
            Our flagship trading platform with streaming market data,
            advanced charts, and powerful order types.
          </p>

          <a href="#">Kite →</a>
        </div>
      </div>
    </div>
  );
}

export default LeftSection;
