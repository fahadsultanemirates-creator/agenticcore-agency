import logoLockup from "../assets/logo-lockup.webp";
import logoMark from "../assets/logo-mark.webp";
import logoWordmark from "../assets/logo-wordmark.webp";

/**
 * The official cyan logo, arranged for the space it sits in.
 *
 * Every pixel here comes from the owner's one artwork file, alpha-keyed
 * off its black field and unpremultiplied so no edge carries a fringe.
 * Nothing is drawn, recoloured or relettered — the mark and the wordmark
 * are cut from that file at the band of empty rows between them.
 *
 * WHY THE HEADER SPLITS THEM. The supplied lockup stacks the AC glyph
 * above the wordmark, so it is nearly square. In a 48px-tall header the
 * wordmark renders at about ten pixels — there, and unreadable. The
 * first attempt at fixing that dropped the wordmark entirely, which read
 * as half a logo. Side by side is the arrangement that actually fits a
 * horizontal header, and it is the same one the owner's own dashboard
 * mockup uses.
 *
 * The stacked lockup is still the right thing where there is vertical
 * room, which is the footer.
 */
export function Logo({
  className = "",
  compact = false,
  variant = "horizontal",
}: {
  className?: string;
  compact?: boolean;
  /** "horizontal" is mark + wordmark side by side; "lockup" is stacked. */
  variant?: "horizontal" | "lockup";
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

  // One <img> would have been simpler, but these are two crops of one
  // file and compositing them here avoids shipping a third rendering of
  // the same artwork that could fall out of step with the other two.
  //
  // The wordmark's height is set by legibility, not by matching the
  // mark. It is 900x206, so width is height x 4.37 -- at 18px tall that
  // is 79px for eighteen characters, about 4px each, which was the first
  // attempt and was no more readable than leaving it off. 32px gives
  // 140px, near 8px a character, which reads. The mark is then sized to
  // sit with it rather than the other way round.
  return (
    // The outer span carries ONLY the caller's classes and sets no
    // display of its own; the row lives on the inner span.
    //
    // Both ways round of baking a display utility in here were wrong.
    // `flex` lost to the nav's `hidden sm:block`, so the mark and
    // wordmark stacked and it looked like a broken logo. Changing it to
    // `inline-flex` beat `hidden` instead, so BOTH size variants
    // rendered at once and the header overflowed by 189px on a phone.
    // A component that fights its caller over `display` will keep
    // losing one of those two ways, so it no longer sets one.
    <span className={className}>
      <span className={`flex shrink-0 items-center ${compact ? "gap-1.5" : "gap-2.5"}`}>
        <img
          src={logoMark}
          alt=""
          aria-hidden
          width={256}
          height={175}
          className={`${compact ? "h-7" : "h-10"} w-auto shrink-0`}
        />
        <img
          src={logoWordmark}
          alt="AgenticCore.Agency"
          width={900}
          height={206}
          className={`${compact ? "h-5" : "h-8"} w-auto shrink-0`}
        />
      </span>
    </span>
  );
}
