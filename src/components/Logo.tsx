export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <img src="/logo-mark.png" alt="" aria-hidden className="h-9 w-9 shrink-0 rounded-xl object-contain" />
      {!compact && (
        <span className="font-display text-xl font-semibold tracking-tight whitespace-nowrap text-fg">
          AgenticCore<span className="font-sans text-base font-medium text-fg-muted">.Agency</span>
        </span>
      )}
    </span>
  );
}
