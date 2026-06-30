/**
 * O(1) Prep wordmark lockup: `O(1)` (VT323 display, amber glow) + a blinking
 * block caret + a quiet lowercase `prep` (JetBrains Mono, dimmed). Children size
 * in `em`, so control the overall size with a font-size class on `className`
 * (e.g. `text-2xl`).
 */
export function Logo({
  className = "",
  caret = true,
  sub = true,
}: {
  className?: string;
  caret?: boolean;
  sub?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label="O(1) Prep"
      className={`inline-flex select-none items-baseline leading-none ${className}`}
    >
      <span className="font-display glow text-amber" aria-hidden>
        O(1)
      </span>
      {caret && <span className="caret" data-brand-caret aria-hidden />}
      {sub && (
        <span
          className="ml-[0.35em] font-mono text-[0.6em] font-semibold lowercase tracking-[0.12em] text-amber-dim"
          aria-hidden
        >
          prep
        </span>
      )}
    </span>
  );
}
