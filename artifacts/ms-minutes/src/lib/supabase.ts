import { createClient } from '@supabase/supabase-js';

type AuthCallbackTokens = { access_token: string; refresh_token: string };

let authCallbackTokens: AuthCallbackTokens | null = null;

// Supabase's cross-device email confirmation flow returns tokens in the URL
// fragment. Capture them in memory and replace the current history entry before
// React renders, so the credentials never remain in the address bar/history.
if (typeof window !== 'undefined' && window.location.hash) {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const hasAuthCallback = Boolean(
    accessToken || refreshToken || hashParams.has('error') || hashParams.has('error_description'),
  );

  if (accessToken && refreshToken) {
    authCallbackTokens = { access_token: accessToken, refresh_token: refreshToken };
  }

  if (hasAuthCallback) {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Determine the correct redirect URL based on environment
// In production, use VITE_APP_URL; in dev, use window.location.origin
export const getRedirectUrl = () => {
  const appUrl = import.meta.env.VITE_APP_URL;
  if (appUrl) return appUrl;
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      // Callback tokens are captured and scrubbed above before being exchanged.
      auth: { autoRefreshToken: true, detectSessionInUrl: false, persistSession: true },
    })
  : null;

export async function getInitialAuthSession() {
  if (!supabase) return null;

  if (authCallbackTokens) {
    const tokens = authCallbackTokens;
    authCallbackTokens = null;
    const { data, error } = await supabase.auth.setSession(tokens);
    if (error) throw error;
    return data.session;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
