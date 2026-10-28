import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { getInitialAuthSession, isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let mounted = true;
    void getInitialAuthSession().then((initialSession) => {
      if (!mounted) return;
      setSession(initialSession);
      setLoading(false);
    }).catch((error: unknown) => {
      if (!mounted) return;
      console.error('Unable to restore Supabase session:', error instanceof Error ? error.message : error);
      setSession(null);
      setLoading(false);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    setAuthTokenGetter(async () => {
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
      setAuthTokenGetter(null);
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    loading,
    configured: isSupabaseConfigured,
    async signIn(email, password) {
      if (!supabase) throw new Error('Supabase Auth is not configured.');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signUp(email, password, fullName) {
      if (!supabase) throw new Error('Supabase Auth is not configured.');
      const appUrl = import.meta.env.VITE_APP_URL;
      const redirectUrl = appUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: redirectUrl,
        },
      });
      if (error) throw error;
      return !data.session;
    },
    async signOut() {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
