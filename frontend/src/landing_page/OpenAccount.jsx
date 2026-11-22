import { Link } from "react-router-dom";

function OpenAccount() {
  return (
    <div className="container p-5 text-center">
      <h1>Open a VertexTrade account</h1>

      <p className="mt-3">
        Modern platforms and apps, ₹0 investments, and a trusted experience.
      </p>

      <Link to="/signup" className="p-2 btn btn-primary fs-5 mt-3">
        Sign up now
      </Link>
    </div>
  );
}

export default OpenAccount;
