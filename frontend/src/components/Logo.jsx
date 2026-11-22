const ACCENT = "#F56834";

function Logo({ withText = true, size = 28 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M3 17L9 11L13 15L21 6"
          stroke={ACCENT}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 6H21V12"
          stroke={ACCENT}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withText && (
        <span style={{ fontWeight: 700, fontSize: size * 0.6, color: "#222" }}>
          Vertex<span style={{ color: ACCENT }}>Trade</span>
        </span>
      )}
    </span>
  );
}

export default Logo;
