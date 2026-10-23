import { useState, type FormEvent } from 'react';
import { AudioLines, LoaderCircle, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

export default function AuthPage() {
  const { signIn, signUp, configured } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'signup') {
        const verificationPending = await signUp(email.trim(), password, fullName);
        if (verificationPending) setMessage('Account created. Check your email to verify your address, then sign in.');
      } else {
        await signIn(email.trim(), password);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-background to-background px-4 py-10 dark:from-indigo-950/50">
      <section className="glass-surface min-w-0 w-full max-w-[440px] rounded-[30px] p-6 shadow-xl sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><AudioLines size={24} /></div>
          <div><p className="font-serif text-xl font-extrabold tracking-tight">Ms.Minutes</p><p className="text-xs text-muted-foreground">Your private meeting workspace</p></div>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</p>
        <h1 className="mt-2 font-serif text-3xl font-extrabold tracking-tight">{mode === 'signin' ? 'Sign in securely' : 'Keep your minutes yours.'}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Your meetings and account details are available only to your signed-in account.</p>

        {!configured ? (
          <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200" role="alert">Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for this frontend.</p>
        ) : (
          <form className="mt-7 space-y-4" onSubmit={submit}>
            {mode === 'signup' && <label className="block text-xs font-semibold">Full name<div className="mt-1.5 flex h-12 items-center gap-3 rounded-xl border border-border bg-background/70 px-3"><UserRound size={17} className="text-muted-foreground" /><input autoComplete="name" required maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" placeholder="Your name" /></div></label>}
            <label className="block text-xs font-semibold">Email<div className="mt-1.5 flex h-12 items-center gap-3 rounded-xl border border-border bg-background/70 px-3"><Mail size={17} className="text-muted-foreground" /><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" placeholder="you@example.com" /></div></label>
            <label className="block text-xs font-semibold">Password<div className="mt-1.5 flex h-12 items-center gap-3 rounded-xl border border-border bg-background/70 px-3"><LockKeyhole size={17} className="text-muted-foreground" /><input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" placeholder="At least 8 characters" /></div></label>
            {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200" role="alert">{error}</p>}
            {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">{message}</p>}
            <button disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60" type="submit">{busy && <LoaderCircle size={16} className="animate-spin" />}{mode === 'signin' ? 'Sign in' : 'Create account'}</button>
          </form>
        )}
        <div className="mt-6 text-center text-sm text-muted-foreground">{mode === 'signin' ? 'New to Ms.Minutes?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); }} className="font-semibold text-primary hover:underline">{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></div>
      </section>
    </main>
  );
}
