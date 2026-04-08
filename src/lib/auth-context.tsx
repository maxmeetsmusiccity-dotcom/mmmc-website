import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

const ADMIN_EMAILS = ['maxmeetsmusiccity@gmail.com', 'maxblachman@gmail.com'];

export type UserMode = 'guest' | 'registered' | 'admin';
export type UserRole = 'curator' | 'publicist' | 'admin';
export type SubscriptionTier = 'free' | 'intelligence' | 'submissions' | 'priority';

interface AuthState {
  user: User | null;
  session: Session | null;
  mode: UserMode;
  role: UserRole;
  tier: SubscriptionTier;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  isGuest: boolean;
  isAdmin: boolean;
  isPublicist: boolean;
  hasTier: (required: SubscriptionTier) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

const TIER_ORDER: SubscriptionTier[] = ['free', 'intelligence', 'submissions', 'priority'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestMode, setGuestMode] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('curator');
  const [userTier, setUserTier] = useState<SubscriptionTier>('free');

  // Fetch user profile for role/tier
  const loadProfile = async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('user_profiles').select('user_role, subscription_tier').eq('id', userId).single();
    if (data) {
      setUserRole((data.user_role as UserRole) || 'curator');
      setUserTier((data.subscription_tier as SubscriptionTier) || 'free');
    }
  };

  useEffect(() => {
    if (!supabase) { setLoading(false); setGuestMode(true); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
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
    const redirectTo = window.location.origin + window.location.pathname;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  };

  const signInWithApple = async () => {
    if (!supabase) return;
    const redirectTo = window.location.origin + window.location.pathname;
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo },
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
    // Clear Supabase auth
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setGuestMode(false);
    // Clear all cached state
    localStorage.removeItem('nmf_guest_mode');
    localStorage.removeItem('nmf_followed_artists');
    localStorage.removeItem('nmf_recent_release_artists');
    sessionStorage.clear();
  };

  const continueAsGuest = () => {
    setGuestMode(true);
    localStorage.setItem('nmf_guest_mode', '1');
    setLoading(false);
  };

  const effectiveRole: UserRole = mode === 'admin' ? 'admin' : userRole;
  const effectiveTier: SubscriptionTier = mode === 'admin' ? 'priority' : userTier;

  const hasTier = (required: SubscriptionTier): boolean => {
    return TIER_ORDER.indexOf(effectiveTier) >= TIER_ORDER.indexOf(required);
  };

  return (
    <AuthContext.Provider value={{
      user, session, mode, loading,
      role: effectiveRole,
      tier: effectiveTier,
      signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, signOut, continueAsGuest,
      isGuest: !user && guestMode,
      isAdmin: mode === 'admin',
      isPublicist: effectiveRole === 'publicist' || effectiveRole === 'admin',
      hasTier,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
