import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { AudioLines, Clock3, Headphones, Moon, Sun, Upload, PanelLeftClose, Menu, X } from 'lucide-react';

const links = [
  { href: '/', label: 'Record & enhance', icon: Headphones },
  { href: '/upload', label: 'Upload archive', icon: Upload },
  { href: '/history', label: 'Meeting history', icon: Clock3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return localStorage.getItem('ms-minutes-theme') === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('ms-minutes-theme', next ? 'dark' : 'light');
  };

  return (
    <div className="min-h-[100dvh]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[258px] border-r border-sidebar-border bg-sidebar/75 px-5 py-6 backdrop-blur-2xl lg:flex lg:flex-col">
        <Link href="/" className="mb-10 flex items-center gap-3 px-2" data-testid="link-home-brand">
          <div className="grid size-10 place-items-center rounded-[15px] bg-primary text-primary-foreground shadow-lg shadow-indigo-900/15">
            <AudioLines size={21} strokeWidth={2.2} />
          </div>
          <div>
            <div className="font-serif text-[18px] font-extrabold tracking-[-0.04em] text-foreground">Ms.Minutes</div>
            <div className="text-[11px] font-medium tracking-[.08em] text-muted-foreground">MEETING STUDIO</div>
          </div>
        </Link>
        <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Workspace</div>
        <nav className="space-y-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = location === href || (href === '/history' && location.startsWith('/meetings/'));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                data-testid={`nav-${label.toLowerCase().replaceAll(' ', '-')}`}
                className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-[13px] font-semibold transition duration-200 ${
                  active ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' : 'text-sidebar-foreground hover:bg-sidebar-accent/65'
                }`}
              >
                <Icon size={18} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-[22px] border border-sidebar-border/75 bg-background/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            Your workspace is ready
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">Your meeting notes, transcripts, and action items.</p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="mt-3 flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium text-sidebar-foreground transition hover:bg-sidebar-accent"
          data-testid="button-toggle-theme"
          aria-label={`Switch to ${dark ? 'light' : 'dark'} appearance`}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
          {dark ? 'Light appearance' : 'Dark appearance'}
        </button>
      </aside>

      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-border/70 bg-background/72 px-4 backdrop-blur-2xl lg:hidden">
        <Link href="/" className="flex items-center gap-2.5" data-testid="link-mobile-brand">
          <div className="grid size-9 place-items-center rounded-[13px] bg-primary text-primary-foreground">
            <AudioLines size={18} />
          </div>
          <span className="font-serif text-base font-extrabold tracking-[-.04em]">Ms.Minutes</span>
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Toggle appearance" data-testid="button-mobile-theme">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="grid size-11 place-items-center rounded-xl text-foreground hover:bg-muted" aria-label="Toggle navigation" data-testid="button-mobile-menu">
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-x-3 top-[74px] z-50 rounded-[24px] border border-border bg-card/95 p-3 shadow-xl backdrop-blur-2xl lg:hidden">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center gap-3 rounded-2xl px-3 font-semibold text-foreground hover:bg-muted" data-testid={`mobile-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
              <Icon size={18} />{label}
            </Link>
          ))}
          <div className="mt-2 border-t border-border pt-2 text-center text-[11px] text-muted-foreground"><PanelLeftClose size={13} className="mr-1 inline" />Tap a page to continue</div>
        </div>
      )}

      <main className="mx-auto min-h-[calc(100dvh-68px)] max-w-[1440px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pt-7 lg:ml-[258px] lg:min-h-[100dvh] lg:px-10 lg:py-10 xl:px-14">
        {children}
      </main>
      <nav className="fixed inset-x-3 bottom-[calc(.75rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-3 rounded-[22px] border border-white/50 bg-card/95 p-1.5 shadow-[0_12px_40px_-14px_rgba(36,48,89,.24)] backdrop-blur-2xl lg:hidden">
        {links.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href === '/history' && location.startsWith('/meetings/'));
          return (
            <Link key={href} href={href} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-[16px] text-[9px] font-semibold ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`} data-testid={`bottom-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
              <Icon size={17} /><span>{label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: ReactNode; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="reveal">
        {eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p>}
        <h1 className="font-serif text-[clamp(2rem,4vw,3.2rem)] font-extrabold leading-[1.05] tracking-[-.055em] text-foreground">{title}</h1>
        {description && <p className="mt-3 max-w-[570px] text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
