import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  /**
   * Resolves with needsConfirmation when the project requires the client to
   * click a link before they have a session.
   */
  signup: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  /** Hands off to Google. Nothing comes back -- the browser leaves. */
  signInWithGoogle: () => Promise<{ error: string | null }>;
  /** Emails a recovery link. Always reports success -- see below. */
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  setPassword: (password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "there";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The display name, from whichever metadata key holds it.
 *
 * The legacy signup wrote `full_name`; Google writes `name` (and often
 * `full_name` too). Reading only one of them is how a client who signed in
 * with Google got greeted as their email address.
 */
function toAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  const metaName = ((meta.full_name as string | undefined) ?? (meta.name as string | undefined))?.trim();
  return {
    id: user.id,
    name: metaName || nameFromEmail(user.email ?? ""),
    email: user.email ?? "",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const login: AuthContextValue["login"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // Deliberately not the raw message. Supabase distinguishes "no such
    // user" from "wrong password", and repeating that distinction turns
    // the login form into a way to ask which email addresses have
    // accounts here.
    return { error: error ? "Incorrect email or password." : null };
  };

  const signup: AuthContextValue["signup"] = async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) return { error: error.message, needsConfirmation: false };

    // Whether a session comes back depends on a project setting the
    // frontend cannot see. With "Confirm email" on, signUp succeeds with
    // session: null and the client has to click a link first -- so the
    // caller has to be told which of the two happened rather than
    // navigating to the dashboard and being bounced straight back.
    return { error: null, needsConfirmation: Boolean(data.user) && !data.session };
  };

  const signInWithGoogle: AuthContextValue["signInWithGoogle"] = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    return { error: error?.message ?? null };
  };

  const requestPasswordReset: AuthContextValue["requestPasswordReset"] = async (email) => {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    // Always null, on purpose. An error here says whether the address has
    // an account, which is the one thing this form must not tell a
    // stranger. The page says "if an account exists" either way.
    return { error: null };
  };

  const setPassword: AuthContextValue["setPassword"] = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user: toAuthUser(session?.user),
        session,
        loading,
        login,
        signup,
        signInWithGoogle,
        requestPasswordReset,
        setPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
