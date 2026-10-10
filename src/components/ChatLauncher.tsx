import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * The floating way into Forge, on every public page.
 *
 * Icon-only below `sm`, labelled above. The labelled pill is about 150px
 * wide, and the mobile screenshots showed it parked across service card
 * prices and their tap targets -- on a phone that is a third of the
 * screen sitting on the one number a visitor came to read. A 48px circle
 * still clears Apple's and Google's minimum touch target while covering
 * about a quarter of the area.
 *
 * `bottom-[max(1rem,env(safe-area-inset-bottom))]` keeps it clear of the
 * home indicator and any browser chrome pinned to the bottom of the
 * viewport on iOS.
 *
 * Pages that scroll also need to end clear of it, which is why the public
 * shell and the dashboard both carry bottom padding greater than this
 * button's height plus its offset. A launcher that hides the last row of
 * a list is a launcher that loses the last item.
 */
export function ChatLauncher() {
  return (
    <Link
      to="/forge"
      aria-label="Chat with Forge"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400 text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5 sm:right-6 sm:bottom-6 sm:h-auto sm:w-auto sm:gap-2 sm:px-5 sm:py-3 sm:text-sm sm:font-semibold"
    >
      <Sparkles className="h-5 w-5 sm:h-4 sm:w-4" />
      <span className="hidden sm:inline">Chat with Forge</span>
    </Link>
  );
}
