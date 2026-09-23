function Signup() {
  return (
    <div className="container p-5">
      <div className="row justify-content-center">
        <div className="col-md-6 text-center">
          <h1>Open a VertexTrade account</h1>

          <p className="text-muted mt-3">
            Start investing and trading with VertexTrade.
          </p>

          <div className="input-group mt-4">
            <span className="input-group-text">+91</span>

            <input
              type="tel"
              className="form-control"
              placeholder="Enter your mobile number"
            />
          </div>

          <button className="btn btn-primary mt-4 px-5">
            Continue
          </button>

          <p className="text-muted mt-4" style={{ fontSize: "14px" }}>
            By continuing, you agree to our terms and conditions.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
