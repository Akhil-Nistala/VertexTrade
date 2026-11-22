function KiteGraphic() {
  return (
    <svg viewBox="0 0 300 220" className="img-fluid" role="img" aria-label="Kite trading platform preview">
      <rect x="0" y="0" width="300" height="220" rx="16" fill="#eaf1fe" />
      <rect x="30" y="30" width="240" height="160" rx="10" fill="#fff" stroke="#4184f3" strokeWidth="3" />
      <rect x="55" y="120" width="20" height="45" fill="#4184f3" opacity="0.8" />
      <rect x="90" y="90" width="20" height="75" fill="#4184f3" opacity="0.6" />
      <rect x="125" y="60" width="20" height="105" fill="#4184f3" />
      <rect x="160" y="100" width="20" height="65" fill="#4184f3" opacity="0.6" />
      <rect x="195" y="75" width="20" height="90" fill="#4184f3" opacity="0.8" />
    </svg>
  );
}

function RightSection() {
  return (
    <div className="container p-5">
      <div className="row align-items-center">
        <div className="col-6 p-5 order-md-2">
          <KiteGraphic />
        </div>

        <div className="col-6 p-5 order-md-1">
          <h1>Console</h1>
          <p>
            A comprehensive portfolio tracker to analyse your holdings,
            positions, and trade history across every segment.
          </p>

          <a href="#">Console →</a>
        </div>
      </div>
    </div>
  );
}

export default RightSection;
