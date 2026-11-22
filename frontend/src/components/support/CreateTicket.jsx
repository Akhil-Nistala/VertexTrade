function CreateTicket() {
  return (
    <div className="container p-5">
      <div className="row">
        <div className="col-md-8">
          <h2>Create a support ticket</h2>

          <p className="text-muted">
            Can't find what you're looking for? Submit a ticket and our
            support team will get back to you.
          </p>

          <button className="btn btn-primary">
            Create Ticket
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateTicket;