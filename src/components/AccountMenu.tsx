import { FolderKanban, LayoutGrid, LogIn, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// The one account control, used by the landing nav and the dashboard header
// alike, so "am I signed in" is answered the same way everywhere. Signed out
// it renders Log in / Get started instead of an avatar.
export function AccountMenu() {
  const { user } = useAuth();
  return user ? <SignedInMenu /> : <SignedOutActions />;
}

function SignedOutActions() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {/* The label collapses to the icon on a phone so the header never
          gets crowded next to the primary button. */}
      <Link
        to="/login"
        aria-label="Log in"
        className="flex h-9 items-center gap-1.5 rounded-full border border-border px-2.5 text-sm font-semibold text-fg-muted transition-colors hover:border-cyan-400/50 hover:text-fg sm:px-4"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Log in</span>
      </Link>
      <Link
        to="/signup"
        className="flex h-9 items-center rounded-full bg-cyan-400 px-3.5 text-sm font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5 active:translate-y-0 sm:px-5"
      >
        Get started
      </Link>
    </div>
  );
}

function SignedInMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  const signOut = async () => {
    setOpen(false);
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-sm font-semibold text-fg transition-colors hover:border-cyan-400/50"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-border bg-surface shadow-glow"
        >
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <UserRound className="h-4 w-4 shrink-0 text-fg-faint" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">{user?.name}</p>
              <p className="truncate text-xs text-fg-faint">{user?.email}</p>
            </div>
          </div>

          <Link
            to="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <LayoutGrid className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            to="/projects"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <FolderKanban className="h-4 w-4" />
            Your projects
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2.5 border-t border-border px-4 py-2.5 text-left text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
