export default function Logo({ size = 18 }: { size?: number }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
        <circle cx="10" cy="10" r="2.4" fill="currentColor" />
        <path d="M10 1 L10 4 M10 16 L10 19 M1 10 L4 10 M16 10 L19 10"
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
      </svg>
      <span style={{
        fontFamily: "var(--mxj-serif)",
        fontSize: size + 4,
        fontStyle: "italic",
        letterSpacing: "-0.02em",
        lineHeight: 1,
        color: "var(--mxj-ink)",
      }}>
        Mexxej
      </span>
    </div>
  );
}
