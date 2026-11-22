
function EcosystemGraphic() {
  return (
    <svg viewBox="0 0 400 260" className="img-fluid" role="img" aria-label="VertexTrade ecosystem">
      <rect x="0" y="0" width="400" height="260" rx="16" fill="#fdece4" />
      <circle cx="200" cy="130" r="55" fill="#F56834" opacity="0.9" />
      <circle cx="90" cy="80" r="34" fill="#4184f3" opacity="0.85" />
      <circle cx="320" cy="70" r="26" fill="#48c237" opacity="0.85" />
      <circle cx="100" cy="190" r="26" fill="#4184f3" opacity="0.6" />
      <circle cx="310" cy="195" r="34" fill="#F56834" opacity="0.55" />
      <text x="200" y="136" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700">VT</text>
    </svg>
  );
}

function Stats() {
  return (
    <div className="container p-5">
      <div className="row">
        <div className="col-6 p-5">
          <h1>Trust with confidence</h1>

          <h2 className="fs-4 mt-5">Customer-first always</h2>
          <p className="text-muted">
            That's why 1.3+ Cr customers trust VertexTrade with their hard-earned
            money. We aim to build long-lasting relationships with our
            customers.
          </p>

          <h2 className="fs-4 mt-5">No spam or gimmicks</h2>
          <p className="text-muted">
            No gimmicks, spam, "gamification", or annoying push notifications.
            Just great products, transparent pricing, and helpful customer
            support.
          </p>

          <h2 className="fs-4 mt-5">Do better with money</h2>
          <p className="text-muted">
            With initiatives like Nudge and Kill Switch, we don't just
            facilitate investing, but actively help you do better with your
            money.
          </p>
        </div>

        <div className="col-6 p-5 d-flex align-items-center">
          <EcosystemGraphic />
        </div>
      </div>
    </div>
  );
}

export default Stats;
