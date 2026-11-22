const TEAM = [
  { initials: "AR", name: "Aanya Rao", role: "Founder & CEO", bg: "#F56834" },
  { initials: "KM", name: "Kabir Mehta", role: "Head of Engineering", bg: "#4184f3" },
  { initials: "SN", name: "Sana Narayan", role: "Head of Product", bg: "#48c237" },
];

function Avatar({ initials, bg }) {
  return (
    <div
      className="rounded-circle d-flex align-items-center justify-content-center mx-auto"
      style={{ width: 150, height: 150, background: bg, color: "#fff", fontSize: "2.5rem", fontWeight: 600 }}
    >
      {initials}
    </div>
  );
}

function Team() {
  return (
    <div className="container p-5">
      <div className="row text-center">
        <div className="col-12 mb-5">
          <h1>People at VertexTrade</h1>
          <p className="text-muted"> Meet the (fictional) people building the platform.</p>
        </div>

        {TEAM.map((member) => (
          <div className="col-md-4" key={member.initials}>
            <Avatar initials={member.initials} bg={member.bg} />
            <h4 className="mt-3">{member.name}</h4>
            <p className="text-muted">{member.role}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Team;
