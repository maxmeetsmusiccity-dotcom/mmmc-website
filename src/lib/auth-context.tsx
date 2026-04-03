import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

const ADMIN_EMAILS = ['maxmeetsmusiccity@gmail.com', 'maxblachman@gmail.com'];

export type UserMode = 'guest' | 'registered' | 'admin';

interface AuthState {
  user: User | null;
  session: Session | null;
  mode: UserMode;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  isGuest: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestMode, setGuestMode] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); setGuestMode(true); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setGuestMode(false);
    });

    // Check if previously chose guest mode
    if (localStorage.getItem('nmf_guest_mode') === '1') {
      setGuestMode(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const mode: UserMode = user
    ? (ADMIN_EMAILS.includes(user.email || '') ? 'admin' : 'registered')
    : 'guest';

  const signInWithGoogle = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/newmusicfriday` },
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const continueAsGuest = () => {
    setGuestMode(true);
    localStorage.setItem('nmf_guest_mode', '1');
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{
      user, session, mode, loading,
      signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, continueAsGuest,
      isGuest: !user && guestMode,
      isAdmin: mode === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}
