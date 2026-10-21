/** Brand mark: a vertical stroke and a chevron — a geometric «К». */
export function BrandMark({ size = 22, color = "var(--accent)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3" width="3.6" height="18" rx="1.8" fill={color} />
      <path d="M19.2 3.6 10.6 12l8.6 8.4" stroke={color} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <BrandMark size={20} />
      <span className="text-[19px] font-semibold tracking-[-0.03em] text-ink">Капитал</span>
    </div>
  );
}
