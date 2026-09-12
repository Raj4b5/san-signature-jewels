import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthState = {
  session: Session | null;
  isAdmin: boolean;
  /** True until we know whether there is a stored session. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  bootstrap: () => () => void;
};

/**
 * Being signed in is not the same as being an admin -- membership of
 * `admin_users` is what the database checks. The client asks the same
 * question so the UI can refuse before the request round-trips.
 */
async function checkAdmin(session: Session | null): Promise<boolean> {
  if (!session) return false;
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  isAdmin: false,
  loading: true,

  bootstrap: () => {
    supabase.auth.getSession().then(async ({ data }) => {
      const isAdmin = await checkAdmin(data.session);
      set({ session: data.session, isAdmin, loading: false });
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const isAdmin = await checkAdmin(session);
      set({ session, isAdmin, loading: false });
    });

    return () => listener.subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      throw new Error(
        error.message === "Invalid login credentials"
          ? "That email and password do not match."
          : error.message,
      );
    }

    const isAdmin = await checkAdmin(data.session);
    if (!isAdmin) {
      // A valid account that is not on the allow-list gets nothing.
      await supabase.auth.signOut();
      set({ session: null, isAdmin: false });
      throw new Error("This account does not have store access.");
    }
    set({ session: data.session, isAdmin: true });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, isAdmin: false });
  },
}));
