import { useRef, useState } from 'react';
import { FileAudio2, Info, RotateCcw, Sparkles, TriangleAlert, UploadCloud, X } from 'lucide-react';
import { Link } from 'wouter';
import { PageHeading } from '@/components/app-shell';
import { useProcessAudio } from '@/hooks/use-process-audio';

function humanSize(size: number) {
  return size < 1_000_000 ? `${(size / 1024).toFixed(0)} KB` : `${(size / 1_000_000).toFixed(1)} MB`;
}

export default function UploadPage() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState('');
  const { stage, progress, error, processing, processAudio } = useProcessAudio();
  const maxAudioBytes = 50 * 1024 * 1024;
  const supportedAudioMimeTypes = new Set([
    'audio/aac',
    'audio/flac',
    'audio/mp4',
    'audio/m4a',
    'audio/mpeg',
    'audio/mp3',
    'audio/ogg',
    'audio/opus',
    'audio/wav',
    'audio/webm',
    'audio/x-flac',
    'audio/x-m4a',
    'audio/x-wav',
  ]);
  const supportedAudioFile = /\.(aac|flac|m4a|mp3|oga|ogg|opus|wav|webm)$/i;

  const selectFile = (picked?: File) => {
    if (!picked) {
      return;
    }
    setLocalError('');
    if (picked.size > maxAudioBytes) {
      setLocalError('Choose an audio file that is 50 MB or smaller.');
      setFile(null);
      return;
    }
    if (!supportedAudioMimeTypes.has(picked.type.split(';')[0]?.toLowerCase()) && !supportedAudioFile.test(picked.name)) {
      setLocalError('Choose an audio file such as MP3, WAV, M4A, AAC, OGG, FLAC, or WebM.');
      setFile(null);
      return;
    }
    setFile(picked);
    if (!title) {
      setTitle(picked.name.replace(/\.[^.]+$/, '').slice(0, 160));
    }
  };

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeading eyebrow="Bring it into focus" title="Upload archive" description="Turn a recording you already have into thoughtful, editable minutes." action={<Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted" data-testid="link-record-instead"><FileAudio2 size={16} />Record instead</Link>} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,.7fr)]">
        <section className="glass-surface rounded-[30px] p-5 sm:p-8">
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }}
            className={`flex min-h-[255px] w-full flex-col items-center justify-center rounded-[24px] border border-dashed px-5 text-center transition duration-200 ${dragging ? 'border-primary bg-primary/10' : 'border-indigo-200 bg-indigo-50/45 hover:border-primary/60 hover:bg-indigo-50/80 dark:border-indigo-900 dark:bg-indigo-950/20'}`}
            data-testid="dropzone-audio"
            aria-label="Choose an audio file or drop it here"
          >
            <div className={`mb-4 grid size-14 place-items-center rounded-[20px] shadow-sm transition ${dragging ? 'bg-primary text-primary-foreground' : 'bg-card text-primary'}`}><UploadCloud size={25} /></div>
            <span className="font-serif text-lg font-bold tracking-tight">{dragging ? 'Drop it here' : 'Drop your audio here'}</span>
            <span className="mt-1.5 text-xs text-muted-foreground">or choose a file from your device</span>
            <span className="mt-5 rounded-full border border-border bg-card/75 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground">MP3 · WAV · M4A · AAC · OGG · FLAC · WEBM · MAX 50 MB</span>
          </button>
          <input ref={input} type="file" accept="audio/aac,audio/flac,audio/mp4,audio/mpeg,audio/ogg,audio/opus,audio/wav,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.webm" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} data-testid="input-audio-file" />

          {file && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border/80 bg-background/60 p-3.5" data-testid="selected-audio-file">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-100 text-primary dark:bg-indigo-950"><FileAudio2 size={19} /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{humanSize(file.size)}</p></div>
              <button onClick={() => { setFile(null); if (input.current) input.current.value = ''; }} className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove selected file" data-testid="button-remove-file"><X size={17} /></button>
            </div>
          )}

          <label htmlFor="upload-title" className="mt-6 block text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">Meeting name</label>
          <input id="upload-title" value={title} onChange={(event) => setTitle(event.target.value.slice(0, 160))} maxLength={160} placeholder="Give this conversation a name" className="mt-2 h-12 w-full rounded-2xl border border-border/80 bg-background/65 px-4 text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10" data-testid="input-upload-title" />

          {(localError || error) && <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="alert" data-testid="status-upload-error"><TriangleAlert size={15} className="mt-0.5 shrink-0" />{localError || error}</div>}
          {processing && <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/[.045] p-4" aria-live="polite" data-testid="status-upload-progress"><div className="mb-3 flex justify-between text-xs"><span className="font-semibold text-primary">{stage}</span><span className="font-mono text-muted-foreground">{progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-primary/10"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400 transition-all duration-500" style={{ width: `${progress}%` }} /></div></div>}

          <button onClick={() => file && void processAudio(file, title)} disabled={!file || processing} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-indigo-900/15 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-process-upload">
            <Sparkles size={17} />{processing ? 'Creating your minutes…' : 'Create my minutes'}
          </button>
        </section>

        <aside className="space-y-4">
          <section className="glass-surface rounded-[26px] p-5 sm:p-6">
            <div className="mb-4 grid size-10 place-items-center rounded-[14px] bg-indigo-100 text-primary dark:bg-indigo-950"><Info size={18} /></div>
            <h2 className="font-serif text-lg font-bold tracking-tight">A little preparation goes a long way</h2>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-muted-foreground">
              <li className="flex gap-2.5"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />A clear recording helps us separate speakers and capture detail.</li>
              <li className="flex gap-2.5"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />Tamil, English, and naturally mixed conversations are welcome.</li>
              <li className="flex gap-2.5"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />You’ll be able to edit the transcript and every generated insight.</li>
            </ul>
          </section>
          <section className="rounded-[26px] border border-emerald-200/70 bg-emerald-50/60 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300"><RotateCcw size={15} />Nothing is final until you say so</div>
            <p className="mt-2 text-xs leading-5 text-emerald-900/70 dark:text-emerald-100/70">Review the original, translation, and meeting intelligence before sharing your minutes.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
