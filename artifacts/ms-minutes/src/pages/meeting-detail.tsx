import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import {
  exportMeetingDocx,
  exportMeetingPdf,
  getGetDashboardQueryKey,
  getGetMeetingQueryKey,
  getListMeetingsQueryKey,
  useDeleteMeeting,
  useGetMeeting,
  useUpdateMeeting,
} from '@workspace/api-client-react';
import type { MeetingIntelligence, TranscriptSegment } from '@workspace/api-client-react';
import { ArrowLeft, Check, ChevronDown, CircleHelp, Clock3, Download, FileText, LoaderCircle, Save, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import { Link } from 'wouter';
import { PageHeading } from '@/components/app-shell';

function time(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

function confidenceLabel(value: number) {
  return value < 0.6 ? 'Check this' : 'Confident';
}

function saveDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const meetingQuery = useGetMeeting(id, { query: { queryKey: getGetMeetingQueryKey(id), enabled: Number.isFinite(id) && id > 0 } });
  const update = useUpdateMeeting();
  const remove = useDeleteMeeting();
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [intelligence, setIntelligence] = useState<MeetingIntelligence | null>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'decisions' | 'actions' | 'risks'>('transcript');
  const [downloadBusy, setDownloadBusy] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const initializedId = useRef<number | null>(null);
  const meeting = meetingQuery.data;

  useEffect(() => {
    if (meeting && initializedId.current !== meeting.id) {
      initializedId.current = meeting.id;
      setTitle(meeting.title);
      setTranscript(meeting.transcript);
      setIntelligence(meeting.intelligence);
    }
  }, [meeting]);

  const hasChanges = Boolean(meeting && intelligence && (
    title !== meeting.title ||
    JSON.stringify(transcript) !== JSON.stringify(meeting.transcript) ||
    JSON.stringify(intelligence) !== JSON.stringify(meeting.intelligence)
  ));

  const saveChanges = () => {
    if (!intelligence || !title.trim()) {
      return;
    }
    update.mutate({ id, data: { title: title.trim(), transcript, intelligence } }, {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetMeetingQueryKey(id), updated);
        void queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        initializedId.current = updated.id;
        setSavedMessage('All changes saved');
        window.setTimeout(() => setSavedMessage(''), 2600);
      },
    });
  };

  const deleteMeeting = () => {
    if (!window.confirm('Delete this meeting and its minutes? This can’t be undone.')) {
      return;
    }
    remove.mutate({ id }, {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
          queryClient.removeQueries({ queryKey: getGetMeetingQueryKey(id) }),
        ]);
        setLocation('/history');
      },
    });
  };

  const download = async (format: 'pdf' | 'docx') => {
    setDownloadBusy(format);
    setDownloadError('');
    try {
      const blob = format === 'pdf' ? await exportMeetingPdf(id) : await exportMeetingDocx(id);
      saveDownload(blob, `${(title || 'meeting-minutes').trim().replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80)}.${format}`);
    } catch {
      setDownloadError(`The ${format.toUpperCase()} export couldn’t be prepared. Please try again.`);
    } finally {
      setDownloadBusy('');
    }
  };

  const setSegment = (index: number, key: 'speaker' | 'originalText' | 'translatedText', value: string) => {
    setTranscript((current) => current.map((segment, position) => position === index ? { ...segment, [key]: value } : segment));
  };

  if (meetingQuery.isLoading) {
    return <div className="mx-auto max-w-[1050px] space-y-5" aria-label="Loading meeting" data-testid="skeleton-meeting"><div className="h-10 w-40 animate-pulse rounded-xl bg-muted" /><div className="glass-surface h-44 animate-pulse rounded-[28px]" /><div className="glass-surface h-80 animate-pulse rounded-[28px]" /></div>;
  }

  if (meetingQuery.isError || !meeting || !intelligence) {
    return <div className="mx-auto max-w-[700px] pt-10"><div className="glass-surface rounded-[30px] px-6 py-14 text-center" role="alert" data-testid="meeting-load-error"><TriangleAlert size={25} className="mx-auto mb-4 text-amber-600" /><h1 className="font-serif text-2xl font-bold">This meeting is out of reach</h1><p className="mt-2 text-sm text-muted-foreground">It may have been removed, or the connection may need another try.</p><div className="mt-5 flex justify-center gap-3"><button onClick={() => void meetingQuery.refetch()} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" data-testid="button-retry-meeting">Try again</button><Link href="/history" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold" data-testid="link-back-history">Back to history</Link></div></div></div>;
  }

  return (
    <div className="mx-auto max-w-[1120px]">
      <Link href="/history" className="mb-6 inline-flex items-center gap-2 rounded-xl px-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground" data-testid="link-back-to-history"><ArrowLeft size={15} />All meetings</Link>
      <PageHeading
        eyebrow={`${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(meeting.createdAt))} · ${time(meeting.durationSeconds)}`}
        title={title || meeting.title}
        description={intelligence.summary}
        action={<div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void download('pdf')} disabled={!!downloadBusy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card/60 px-3.5 text-xs font-semibold hover:bg-muted disabled:opacity-60" data-testid="button-export-pdf"><Download size={15} />{downloadBusy === 'pdf' ? 'Preparing PDF…' : 'PDF'}</button>
          <button onClick={() => void download('docx')} disabled={!!downloadBusy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card/60 px-3.5 text-xs font-semibold hover:bg-muted disabled:opacity-60" data-testid="button-export-docx"><FileText size={15} />{downloadBusy === 'docx' ? 'Preparing…' : 'Word'}</button>
        </div>}
      />
      {downloadError && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="alert" data-testid="status-export-error">{downloadError}</p>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(290px,.75fr)]">
        <section className="glass-surface overflow-hidden rounded-[28px]">
          <div className="border-b border-border/70 px-5 pb-4 pt-5 sm:px-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Review workspace</p><h2 className="mt-1 font-serif text-xl font-bold tracking-tight">Words as they happened</h2></div>
              <label className="sr-only" htmlFor="edit-meeting-title">Meeting title</label>
              <input id="edit-meeting-title" value={title} onChange={(event) => setTitle(event.target.value.slice(0, 160))} maxLength={160} className="h-10 min-w-0 rounded-xl border border-border/80 bg-background/65 px-3 text-sm font-semibold outline-none focus:border-primary/60 sm:w-[230px]" data-testid="input-meeting-title" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Edit either version directly. Your changes stay yours.</p>
          </div>
          <div className="divide-y divide-border/65">
            {transcript.length === 0 ? (
              <div className="px-6 py-16 text-center"><FileText size={24} className="mx-auto mb-3 text-muted-foreground" /><h3 className="font-semibold">No transcript segments yet</h3><p className="mt-1 text-xs text-muted-foreground">This meeting’s original audio may not have produced transcript text.</p></div>
            ) : transcript.map((segment, index) => (
              <article key={`${segment.startTime}-${index}`} className="px-5 py-5 sm:px-7" data-testid={`segment-transcript-${index}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`speaker-${index}`}>Speaker name</label>
                  <input id={`speaker-${index}`} value={segment.speaker} onChange={(event) => setSegment(index, 'speaker', event.target.value)} className="h-7 max-w-36 rounded-full bg-indigo-100 px-2.5 text-[10px] font-bold text-indigo-800 outline-none focus:ring-2 focus:ring-primary/35 dark:bg-indigo-950 dark:text-indigo-200" data-testid={`input-speaker-${index}`} />
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground"><Clock3 size={11} />{time(segment.startTime)}–{time(segment.endTime)}</span>
                   <span className={`ml-auto rounded-full px-2 py-1 text-[9px] font-bold ${segment.confidence < .6 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>{confidenceLabel(segment.confidence)}</span>
                </div>
                <label className="mb-1 block text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground" htmlFor={`original-${index}`}>Original · {segment.language === 'ta' ? 'Tamil' : segment.language === 'en' ? 'English' : 'Mixed'}</label>
                <textarea id={`original-${index}`} value={segment.originalText} onChange={(event) => setSegment(index, 'originalText', event.target.value)} rows={Math.max(2, Math.min(5, Math.ceil(segment.originalText.length / 85)))} className="w-full resize-y rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-[13px] leading-6 outline-none transition focus:border-primary/30 focus:bg-background/55" data-testid={`textarea-original-${index}`} />
                <label className="mb-1 mt-2 block text-[9px] font-bold uppercase tracking-[.12em] text-primary" htmlFor={`translated-${index}`}>Translation · English</label>
                <textarea id={`translated-${index}`} value={segment.translatedText} onChange={(event) => setSegment(index, 'translatedText', event.target.value)} rows={Math.max(2, Math.min(5, Math.ceil(segment.translatedText.length / 85)))} className="w-full resize-y rounded-xl border border-transparent bg-indigo-50/55 px-2 py-1.5 text-[13px] leading-6 outline-none transition focus:border-primary/30 focus:bg-indigo-50/90 dark:bg-indigo-950/25 dark:focus:bg-indigo-950/45" data-testid={`textarea-translated-${index}`} />
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="glass-surface rounded-[26px] p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-primary"><Sparkles size={17} /><p className="text-[10px] font-bold uppercase tracking-[.16em]">Meeting intelligence</p></div>
            <label htmlFor="meeting-summary" className="mb-2 block text-xs font-semibold">The short version</label>
            <textarea id="meeting-summary" value={intelligence.summary} onChange={(event) => setIntelligence({ ...intelligence, summary: event.target.value })} rows={5} className="w-full resize-y rounded-2xl border border-border/70 bg-background/55 p-3 text-xs leading-5 outline-none focus:border-primary/40" data-testid="textarea-meeting-summary" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <InsightCount icon={<Check size={15} />} value={intelligence.decisions.length} label="Decisions" tint="emerald" />
              <InsightCount icon={<CircleHelp size={15} />} value={intelligence.actionItems.length} label="Next steps" tint="indigo" />
              <InsightCount icon={<TriangleAlert size={15} />} value={intelligence.risks.length} label="Risks" tint="amber" />
              <InsightCount icon={<ChevronDown size={15} />} value={intelligence.questions.length} label="Questions" tint="blue" />
            </div>
          </section>

          <section className="glass-surface overflow-hidden rounded-[26px]">
            <div className="flex gap-1 overflow-x-auto border-b border-border/70 p-2">
              {(['decisions', 'actions', 'risks', 'transcript'] as const).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`min-h-10 shrink-0 rounded-xl px-3 text-[10px] font-bold capitalize transition ${activeTab === tab ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`} data-testid={`tab-${tab}`}>{tab === 'actions' ? 'Action items' : tab === 'transcript' ? 'Questions' : tab}</button>)}
            </div>
            <div className="max-h-[400px] space-y-2 overflow-y-auto p-3">
              {activeTab === 'decisions' && <EditableInsightList items={intelligence.decisions} fields={[{ key: 'decision', label: 'Decision' }, { key: 'speaker', label: 'Speaker' }, { key: 'context', label: 'Context' }]} empty="No decisions were identified." onUpdate={(index, key, value) => setIntelligence({ ...intelligence, decisions: intelligence.decisions.map((item, position) => position === index ? { ...item, [key]: value } : item) })} />}
              {activeTab === 'actions' && <EditableInsightList items={intelligence.actionItems} fields={[{ key: 'action', label: 'Action' }, { key: 'assignee', label: 'Assignee' }, { key: 'deadline', label: 'Deadline' }, { key: 'priority', label: 'Priority' }]} empty="No action items were identified." onUpdate={(index, key, value) => setIntelligence({ ...intelligence, actionItems: intelligence.actionItems.map((item, position) => position === index ? { ...item, [key]: value } : item) })} />}
              {activeTab === 'risks' && <EditableInsightList items={intelligence.risks} fields={[{ key: 'risk', label: 'Risk' }, { key: 'speaker', label: 'Speaker' }, { key: 'severity', label: 'Severity' }]} empty="No risks were identified." onUpdate={(index, key, value) => setIntelligence({ ...intelligence, risks: intelligence.risks.map((item, position) => position === index ? { ...item, [key]: value } : item) })} />}
              {activeTab === 'transcript' && <EditableInsightList items={intelligence.questions} fields={[{ key: 'question', label: 'Question' }, { key: 'answerSummary', label: 'Answer summary' }]} empty="No open questions were identified." onUpdate={(index, key, value) => setIntelligence({ ...intelligence, questions: intelligence.questions.map((item, position) => position === index ? { ...item, [key]: value } : item) })} />}
            </div>
          </section>
        </aside>
      </div>

      <div className="sticky bottom-[76px] z-20 mt-5 flex flex-col gap-2 rounded-[22px] border border-border/70 bg-background/82 p-2.5 shadow-xl backdrop-blur-2xl sm:bottom-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-h-10 px-2 text-xs text-muted-foreground" aria-live="polite">{update.isPending ? <span className="inline-flex items-center gap-2"><LoaderCircle size={14} className="animate-spin" />Saving your edits…</span> : savedMessage ? <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><Check size={15} />{savedMessage}</span> : hasChanges ? 'Unsaved changes' : 'Everything is up to date'}</div>
        <div className="flex gap-2">
          <button onClick={deleteMeeting} disabled={remove.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/40" data-testid="button-delete-meeting"><Trash2 size={15} />{remove.isPending ? 'Deleting…' : 'Delete'}</button>
          <button onClick={saveChanges} disabled={!hasChanges || update.isPending || !title.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-save-meeting"><Save size={15} />{update.isPending ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
      {update.isError && <p className="mt-2 text-right text-xs text-rose-700 dark:text-rose-300" role="alert" data-testid="status-save-error">Changes weren’t saved. Please try again.</p>}
      {remove.isError && <p className="mt-2 text-right text-xs text-rose-700 dark:text-rose-300" role="alert" data-testid="status-delete-error">The meeting couldn’t be deleted. Please try again.</p>}
    </div>
  );
}

function InsightCount({ icon, value, label, tint }: { icon: ReactNode; value: number; label: string; tint: string }) {
  const tintClass = tint === 'emerald' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-200' : tint === 'amber' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200' : tint === 'blue' ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/45 dark:text-sky-200' : 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/45 dark:text-indigo-200';
  return <div className={`flex min-h-[60px] items-center gap-2.5 rounded-2xl px-3 ${tintClass}`}><span>{icon}</span><div><p className="font-serif text-lg font-bold leading-tight">{value}</p><p className="text-[9px] font-semibold">{label}</p></div></div>;
}

function EditableInsightList({ items, fields, empty, onUpdate }: { items: object[]; fields: { key: string; label: string }[]; empty: string; onUpdate: (index: number, key: string, value: string) => void }) {
  if (items.length === 0) {
    return <div className="rounded-2xl bg-muted/55 px-4 py-8 text-center text-xs leading-5 text-muted-foreground">{empty}</div>;
  }
  return <>{items.map((item, index) => {
    const values = item as Record<string, unknown>;
    const confidence = Number(values.confidence ?? 0);
    return <article key={`${String(values[fields[0].key] ?? 'item')}-${index}`} className="rounded-2xl border border-border/60 bg-background/45 p-3.5" data-testid={`insight-item-${index}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Insight {index + 1}</span>
         <span className={`rounded-full px-2 py-1 text-[8px] font-bold ${confidence < .6 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>{confidenceLabel(confidence)}</span>
      </div>
      <div className="space-y-2.5">
        {fields.map((field) => <label key={field.key} className="block text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">
          {field.label}
          <textarea value={String(values[field.key] ?? '')} onChange={(event) => onUpdate(index, field.key, event.target.value)} rows={field.key === fields[0].key ? 2 : 1} className="mt-1 block w-full resize-y rounded-xl border border-border/60 bg-background/60 px-2.5 py-2 text-[11px] font-medium normal-case leading-5 tracking-normal text-foreground outline-none focus:border-primary/40" data-testid={`textarea-insight-${field.key}-${index}`} />
        </label>)}
      </div>
    </article>;
  })}</>;
}
