import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * The floating way into Forge, on every public page.
 *
 * Matches .click's: a labelled pill at every width, 56px tall, with the
 * pulse ring. The owner compared the two and wants this one, so the
 * earlier icon-only-on-mobile version is gone.
 *
 * The one thing kept from that version is
 * `bottom-[max(1.25rem,env(safe-area-inset-bottom))]`, which costs
 * nothing visually and keeps the pill clear of the iOS home indicator
 * and any browser chrome pinned to the bottom of the viewport.
 *
 * It does sit over page content while scrolling -- that is what a fixed
 * launcher does, and .click has always behaved this way. Pages that
 * scroll carry bottom padding greater than this pill's height plus its
 * offset so the LAST row of a list is never the thing underneath it.
 */
export function ChatLauncher() {
  return (
    <Link
      to="/forge"
      aria-label="Chat with Forge"
      className="animate-pulse-ring fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50 flex h-14 items-center gap-2 rounded-full bg-cyan-400 px-5 font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 sm:right-8 sm:bottom-8"
    >
      <Sparkles className="h-4 w-4 shrink-0" />
      Chat with Forge
    </Link>
  );
}
