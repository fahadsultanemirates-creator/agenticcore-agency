import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

/**
 * Sign in with Google.
 *
 * One button for both signing in and signing up: Supabase creates the
 * account on first Google sign-in, so there is nothing separate to wire
 * up, and asking a client which of the two they are doing is a question
 * they cannot get wrong but can still be annoyed by.
 *
 * It stays disabled after a successful call -- the browser is on its way
 * to Google and a second tap would start a second redirect.
 */
export function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const { signInWithGoogle } = useAuth();
  const [pending, setPending] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const { error } = await signInWithGoogle();
          if (error) {
            setPending(false);
            onError(error);
          }
        }}
        className="flex w-full items-center justify-center gap-2.5 rounded-full border-2 border-border bg-void px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-yellow-400/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleMark />
        {pending ? "Opening Google…" : "Continue with Google"}
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-fg-faint">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}

/** Google's own mark, in its own colours, as their branding terms require. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
