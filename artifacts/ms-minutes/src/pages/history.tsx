import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useListMeetings, getListMeetingsQueryKey } from '@workspace/api-client-react';
import { ArrowUpRight, CalendarDays, Clock3, FileAudio2, Search, Sparkles, TriangleAlert } from 'lucide-react';
import { PageHeading } from '@/components/app-shell';

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes < 1 ? `${seconds}s` : `${minutes} min`;
}

export default function HistoryPage() {
  const [search, setSearch] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const params = useMemo(() => ({ q: search.trim() || undefined }), [search]);
  const meetings = useListMeetings(params, { query: { queryKey: getListMeetingsQueryKey(params) } });
  const filtered = useMemo(() => (meetings.data || []).filter((meeting) => !reviewOnly || meeting.needsReview), [meetings.data, reviewOnly]);

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeading
        eyebrow="A thoughtful record"
        title="Meeting history"
        description="Find a conversation, pick up your review, or revisit a decision."
        action={<div className="flex items-center gap-2 rounded-full bg-card/60 px-3.5 py-2 text-[11px] font-semibold text-muted-foreground"><FileAudio2 size={14} />{meetings.data?.length ?? '—'} saved</div>}
      />

      <div className="glass-surface mb-5 flex flex-col gap-3 rounded-[24px] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
        <label className="flex min-h-12 flex-1 items-center gap-3 rounded-[16px] bg-background/70 px-4">
          <Search size={18} className="shrink-0 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your meetings…" className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/75" data-testid="input-search-meetings" aria-label="Search meetings" />
          {search && <button onClick={() => setSearch('')} className="min-h-10 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground" data-testid="button-clear-search">Clear</button>}
        </label>
        <button onClick={() => setReviewOnly(!reviewOnly)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[15px] px-4 text-xs font-semibold transition ${reviewOnly ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200' : 'bg-background/65 text-muted-foreground hover:text-foreground'}`} data-testid="button-filter-review">
          <TriangleAlert size={15} />Needs review{reviewOnly ? ' · On' : ''}
        </button>
      </div>

      {meetings.isLoading ? (
        <div className="space-y-3" aria-label="Loading meeting history" data-testid="skeleton-meetings">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="glass-surface h-[112px] animate-pulse rounded-[24px]" />)}
        </div>
      ) : meetings.isError ? (
        <div className="glass-surface rounded-[28px] px-6 py-16 text-center" role="alert" data-testid="history-error">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"><TriangleAlert size={21} /></div>
          <h2 className="font-serif text-xl font-bold">Your history didn’t come through</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">The connection had a moment. Your meetings are still safe — try loading them again.</p>
          <button onClick={() => void meetings.refetch()} className="mt-5 min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground" data-testid="button-retry-history">Try again</button>
        </div>
      ) : meetings.data?.length === 0 ? (
        <div className="glass-surface overflow-hidden rounded-[30px] px-6 py-16 text-center" data-testid="empty-meeting-history">
          <div className="relative mx-auto mb-5 grid size-[74px] place-items-center rounded-[26px] bg-indigo-100/80 text-primary dark:bg-indigo-950/60"><FileAudio2 size={30} /><span className="absolute -right-1 -top-1 grid size-7 place-items-center rounded-full border-4 border-background bg-emerald-200 text-emerald-800"><Sparkles size={11} /></span></div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-primary">A fresh page</p>
          <h2 className="font-serif text-2xl font-bold tracking-tight">Your conversations will live here.</h2>
          <p className="mx-auto mt-2 max-w-[370px] text-sm leading-6 text-muted-foreground">Record a meeting or upload a conversation to get minutes you can revisit, refine, and share.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground" data-testid="link-empty-record"><FileAudio2 size={16} />Record a meeting</Link>
            <Link href="/upload" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background/60 px-5 text-sm font-semibold" data-testid="link-empty-upload">Upload audio<ArrowUpRight size={15} /></Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-surface rounded-[28px] px-6 py-14 text-center" data-testid="empty-filtered-history">
          <Search size={24} className="mx-auto mb-3 text-muted-foreground" />
          <h2 className="font-serif text-lg font-bold">{reviewOnly ? 'Nothing waiting for review' : 'No matching meetings'}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{reviewOnly ? 'Everything you’ve saved is in good shape.' : 'Try another search phrase.'}</p>
          {(reviewOnly || search) && <button onClick={() => { setReviewOnly(false); setSearch(''); }} className="mt-3 min-h-10 text-sm font-semibold text-primary" data-testid="button-reset-history-filters">Clear filters</button>}
        </div>
      ) : (
        <div className="space-y-3" data-testid="list-meetings">
          {filtered.map((meeting, index) => (
            <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="glass-surface group flex min-h-[118px] items-center gap-4 rounded-[24px] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 sm:gap-5 sm:p-5" style={{ animationDelay: `${index * 45}ms` }} data-testid={`card-meeting-${meeting.id}`}>
              <div className={`grid size-12 shrink-0 place-items-center rounded-[17px] ${meeting.needsReview ? 'bg-amber-100/80 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-indigo-100/80 text-primary dark:bg-indigo-950/65'}`}><FileAudio2 size={20} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-serif text-[16px] font-bold tracking-tight sm:text-lg">{meeting.title}</h2>
                  {meeting.needsReview && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/75 px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"><TriangleAlert size={10} />Review</span>}
                </div>
                <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">{meeting.summary || 'Open to review this conversation.'}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{dateLabel(meeting.createdAt)}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 size={12} />{durationLabel(meeting.durationSeconds)}</span>
                  <span>{meeting.speakerCount} {meeting.speakerCount === 1 ? 'speaker' : 'speakers'}</span>
                  <span>{meeting.actionItemCount} action {meeting.actionItemCount === 1 ? 'item' : 'items'}</span>
                </div>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary"><ArrowUpRight size={18} /></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
