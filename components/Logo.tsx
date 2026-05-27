export default function Logo({ size = 18, color }: { size?: number; color?: string }) {
  const c = color ?? "currentColor";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="18" height="18" stroke={c} strokeWidth="1.2" opacity="0.35" />
        <line x1="10" y1="1" x2="10" y2="5"  stroke={c} strokeWidth="1.6" />
        <line x1="10" y1="15" x2="10" y2="19" stroke={c} strokeWidth="1.6" />
        <line x1="1"  y1="10" x2="5"  y2="10" stroke={c} strokeWidth="1.6" />
        <line x1="15" y1="10" x2="19" y2="10" stroke={c} strokeWidth="1.6" />
        <rect x="8.2" y="8.2" width="3.6" height="3.6" fill={c} />
      </svg>
      <span style={{
        fontFamily: "var(--mxj-display)",
        fontSize: size + 3,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        lineHeight: 1,
        color: c,
      }}>
        Mexxej
      </span>
      <span style={{
        width: 6,
        height: 6,
        background: "var(--mxj-red)",
        flexShrink: 0,
        marginBottom: 2,
      }} />
    </div>
  );
}
