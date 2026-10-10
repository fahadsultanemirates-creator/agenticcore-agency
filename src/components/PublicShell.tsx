import { useEffect, type ReactNode } from "react";
import { ChatLauncher } from "./ChatLauncher";
import { Footer } from "./landing/Footer";
import { Nav } from "./landing/Nav";

/**
 * The frame every public page below the homepage sits in.
 *
 * The bottom padding is not decoration: it clears the floating Forge
 * button so the last card in a list is still tappable. Without it the
 * launcher sits on top of whatever ends the page.
 */
export function PublicShell({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} — AgenticCore.agency`;
  }, [title]);

  return (
    <div className="min-h-dvh bg-void">
      <Nav />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 sm:px-6">{children}</main>
      <Footer />
      <ChatLauncher />
    </div>
  );
}
