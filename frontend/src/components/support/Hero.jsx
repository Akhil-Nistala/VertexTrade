function Hero() {
  return (
    <div className="container p-5">
      <h1>Support</h1>

      <p className="mt-3">
        Search our support portal or create a ticket for assistance.
      </p>

      <div className="input-group mt-4">
        <input
          type="text"
          className="form-control"
          placeholder="Search for your query..."
        />

        <button className="btn btn-primary">
          Search
        </button>
      </div>
    </div>
  );
}

export default Hero;