import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * The floating way into Forge, on every public page.
 *
 * The landing page had no entry point to Forge at all -- the only way in
 * was a sidebar behind the login, which a visitor deciding whether to buy
 * anything has not seen. Forge works signed out, so the button belongs
 * where the undecided visitor is.
 *
 * Bottom-right, above the fold on a phone, and it sits on top of the
 * footer rather than inside the flow so it is reachable at any scroll
 * position.
 */
export function ChatLauncher() {
  return (
    <Link
      to="/forge"
      className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-4 py-3 text-sm font-semibold text-void shadow-glow-yellow transition-transform hover:-translate-y-0.5 sm:right-6 sm:bottom-6 sm:px-5"
    >
      <Sparkles className="h-4 w-4" />
      Chat with Forge
    </Link>
  );
}
