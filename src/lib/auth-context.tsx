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

    // OAuth callback handling — supports both PKCE (code) and implicit (hash) flows
    const urlCode = new URLSearchParams(window.location.search).get('code');
    const hasHashToken = window.location.hash.includes('access_token');

    (async () => {
      try {
        // PKCE flow: exchange the code for a session
        if (urlCode) {
          console.log('[AUTH] PKCE code detected, exchanging...');
          const { error } = await supabase.auth.exchangeCodeForSession(urlCode);
          if (error) console.error('[AUTH] Code exchange failed:', error.message);
          else console.log('[AUTH] Code exchange succeeded');
        }

        // Get session (works for both PKCE after exchange and implicit via hash)
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[AUTH] getSession result:', session ? `user=${session.user.email}` : 'no session');
        console.log('[AUTH] URL state: code=' + !!urlCode + ' hash_token=' + hasHashToken);

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) loadProfile(session.user.id);

        // Clean URL after everything is processed
        if (urlCode || hasHashToken) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } catch (e) {
        console.error('[AUTH] Init error:', (e as Error).message);
      } finally {
        setLoading(false);
      }
    })();

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

  /** Clear ALL user-specific data from browser storage */
  const clearAllUserData = () => {
    // Supabase session
    sessionStorage.clear();
    // Spotify tokens
    sessionStorage.removeItem('spotify_token');
    sessionStorage.removeItem('spotify_refresh_token');
    sessionStorage.removeItem('spotify_token_expires');
    sessionStorage.removeItem('pkce_verifier');
    // MusicKit — deauthorize if loaded
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const MK = (window as any).MusicKit;
      if (MK) {
        const music = MK.getInstance();
        if (music?.isAuthorized) music.unauthorize();
      }
    } catch { /* MusicKit not loaded */ }
    // User-specific localStorage
    localStorage.removeItem('nmf_guest_mode');
    localStorage.removeItem('nmf_followed_artists');
    localStorage.removeItem('nmf_recent_release_artists');
    localStorage.removeItem('nmf_template');
    localStorage.removeItem('nmf_title_template');
    localStorage.removeItem('nmf_logo_url');
    localStorage.removeItem('nmf_card_size');
    localStorage.removeItem('nmf_panel_ratio');
    // Custom templates (user-scoped keys)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('nmf_custom_templates_') || key?.startsWith('nmf_scan_')) {
        localStorage.removeItem(key);
      }
    }
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setGuestMode(false);
    clearAllUserData();
  };

  const continueAsGuest = () => {
    // Fresh guest session — clear any previous user's data
    clearAllUserData();
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
