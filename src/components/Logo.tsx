import logoLockup from "../assets/logo-lockup.webp";
import logoMark from "../assets/logo-mark.webp";

/**
 * The official cyan logo, in the two crops the layout actually has room
 * for.
 *
 * Both come from the one owner-supplied artwork — this does not draw,
 * recolour or reletter anything. The black field is keyed out so the
 * glow falls off into the page instead of ending on a rectangle edge.
 *
 * WHY TWO. The supplied lockup stacks the AC mark above the wordmark, so
 * it is nearly square. Constrained to a 48px-tall header it renders the
 * wordmark at about ten pixels — present, and completely unreadable. A
 * logo nobody can read is not branding. So the header takes the mark on
 * its own, which stays legible at any size, and the footer takes the
 * full lockup where there is vertical room for the type to be read.
 */
export function Logo({
  className = "",
  compact = false,
  variant = "mark",
}: {
  className?: string;
  compact?: boolean;
  /** "mark" is the AC glyph alone; "lockup" is the glyph over the wordmark. */
  variant?: "mark" | "lockup";
}) {
  if (variant === "lockup") {
    return (
      <img
        src={logoLockup}
        alt="AgenticCore.Agency"
        width={420}
        height={357}
        className={`h-20 w-auto shrink-0 ${className}`}
      />
    );
  }

  return (
    <img
      src={logoMark}
      alt="AgenticCore.Agency"
      width={256}
      height={177}
      className={`${compact ? "h-8" : "h-10"} w-auto shrink-0 ${className}`}
    />
  );
}
