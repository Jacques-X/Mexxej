export default function Logo({ size = 18 }: { size?: number }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      {/* Compass rose — sharp cardinal marks instead of rounded circles */}
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
        {/* Cardinal ticks — sharp, instrument-style */}
        <line x1="10" y1="1.5" x2="10" y2="4.5"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
        <line x1="10" y1="15.5" x2="10" y2="18.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
        <line x1="1.5" y1="10" x2="4.5" y2="10"   stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
        <line x1="15.5" y1="10" x2="18.5" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
        {/* Centre diamond */}
        <rect x="8.3" y="8.3" width="3.4" height="3.4" transform="rotate(45 10 10)" fill="currentColor" />
      </svg>
      <span style={{
        fontFamily: "var(--mxj-display)",
        fontSize: size + 3,
        fontWeight: 600,
        fontStyle: "normal",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        lineHeight: 1,
        color: "var(--mxj-ink)",
      }}>
        Mexxej
      </span>
    </div>
  );
}
