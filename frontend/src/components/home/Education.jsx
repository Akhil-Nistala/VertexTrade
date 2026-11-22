
function EducationGraphic() {
  return (
    <svg viewBox="0 0 300 240" style={{ width: "90%" }} role="img" aria-label="Market education">
      <rect x="0" y="0" width="300" height="240" rx="16" fill="#eaf1fe" />
      <rect x="70" y="60" width="160" height="120" rx="6" fill="#fff" stroke="#4184f3" strokeWidth="4" />
      <line x1="90" y1="90" x2="210" y2="90" stroke="#4184f3" strokeWidth="4" strokeLinecap="round" />
      <line x1="90" y1="115" x2="210" y2="115" stroke="#4184f3" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      <line x1="90" y1="140" x2="170" y2="140" stroke="#4184f3" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function Education() {
  return (
    <div className="container p-5">
      <div className="row">
        <div className="col-6 p-5 d-flex align-items-center justify-content-center">
          <EducationGraphic />
        </div>

        <div className="col-6 p-5">
          <h1>Free and open market education</h1>

          <p className="mt-3">
            Varsity, the largest online stock market education book in the
            world covering everything from the basics to advanced trading.
          </p>

          <p>
            <a href="#">Varsity →</a>
          </p>

          <p>
            Our free resources help you understand investing and make better
            financial decisions.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Education;
