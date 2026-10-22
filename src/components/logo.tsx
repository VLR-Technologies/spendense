export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      {!compact && (
        <span>
          Spendense<span className="brand-dot">.</span>
        </span>
      )}
    </div>
  );
}
