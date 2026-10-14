import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGetDashboard, getHealthCheckQueryKey, useHealthCheck } from '@workspace/api-client-react';
import { AudioLines, Check, Clock3, FileAudio2, Mic, Pause, Play, ShieldCheck, Sparkles, TriangleAlert, Upload } from 'lucide-react';
import { Link } from 'wouter';
import { PageHeading } from '@/components/app-shell';
import { useProcessAudio } from '@/hooks/use-process-audio';

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

export default function HomePage() {
  const dashboard = useGetDashboard();
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false } });
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [title, setTitle] = useState('');
  const [recordError, setRecordError] = useState('');
  const [playing, setPlaying] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [waveHeights, setWaveHeights] = useState(() =>
    Array.from({ length: 48 }, (_, index) => 10 + ((index * 7) % 9)),
  );
  const { stage, progress, error, processing, processAudio } = useProcessAudio();

  useEffect(() => {
    if (!recording) {
      return;
    }
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }, [audioUrl]);

  useEffect(() => {
    const analyser = analyserRef.current;
    if (!recording || !analyser) {
      return;
    }
    const samples = new Uint8Array(analyser.frequencyBinCount);
    let lastUpdated = 0;
    let animationFrame = 0;
    const draw = (now: number) => {
      analyser.getByteFrequencyData(samples);
      if (now - lastUpdated >= 45) {
        lastUpdated = now;
        const heights = Array.from({ length: 48 }, (_, index) => {
          const start = Math.floor(index * samples.length / 48);
          const end = Math.max(start + 1, Math.floor((index + 1) * samples.length / 48));
          const average = samples.slice(start, end).reduce((sum, sample) => sum + sample, 0) / (end - start);
          return Math.max(7, Math.min(100, 9 + (average / 255) * 91));
        });
        setWaveHeights(heights);
      }
      animationFrame = requestAnimationFrame(draw);
    };
    animationFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrame);
  }, [recording]);

  const releaseMicrophone = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined);
    }
  };

  useEffect(() => () => {
    const recorder = mediaRecorder.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined);
    }
  }, []);

  const startRecording = async () => {
    setRecordError('');
    setAudioBlob(null);
    setElapsed(0);
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error('This browser does not support microphone recording.');
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          sampleRate: { ideal: 16000 },
          channelCount: { ideal: 1 },
        },
      });
      streamRef.current = stream;
      try {
        const context = new AudioContext({ sampleRate: 16000 });
        await context.resume();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(stream).connect(analyser);
        audioContextRef.current = context;
        analyserRef.current = analyser;
      } catch {
        // Some browsers do not allow a requested AudioContext sample rate.
        analyserRef.current = null;
      }
      const preferredMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ];
      const supportedMimeType = preferredMimeTypes.find((mimeType) =>
        MediaRecorder.isTypeSupported(mimeType),
      );
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);
      chunks.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        releaseMicrophone();
      };
      recorder.start(250);
      mediaRecorder.current = recorder;
      setRecording(true);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      releaseMicrophone();
      setRecordError(error instanceof Error && error.message.includes('does not support')
        ? error.message
        : 'Microphone access is unavailable. Check your browser permissions, or upload an audio file instead.');
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
  };

  const togglePlayback = async () => {
    if (!audioRef.current) {
      return;
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      await audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <div className="mx-auto max-w-[1050px]">
      <PageHeading
        eyebrow="Your meeting studio"
        title={<>Make space for<br className="hidden sm:block" /> the conversation.</>}
        description="Record a conversation or bring in audio. We’ll shape it into clear minutes, in the language that works for you."
        action={<div className="flex w-fit items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-2 text-[11px] font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300" data-testid="status-service">
          <span className={`size-1.5 rounded-full ${health.isError ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          {health.isLoading ? 'Checking studio' : health.isError ? 'Studio connection uncertain' : 'Studio ready'}
        </div>}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.75fr)]">
        <section className="glass-surface relative overflow-hidden rounded-[30px] p-4 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-indigo-300/20 blur-3xl dark:bg-indigo-400/10" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-primary"><AudioLines size={15} /> Live capture</div>
              <h2 className="font-serif text-[22px] font-bold tracking-[-.035em]">Record a conversation</h2>
            </div>
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Mic size={21} /></div>
          </div>
          <p className="relative mt-2 max-w-md text-sm leading-6 text-muted-foreground">Use your browser microphone. You can listen back before sending it for transcription.</p>

          <label className="relative mt-5 block text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground sm:mt-7" htmlFor="meeting-title">Meeting name <span className="font-normal normal-case tracking-normal">(optional)</span></label>
          <input id="meeting-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="e.g. Tuesday product sync" className="relative mt-2 h-12 w-full rounded-2xl border border-border/80 bg-background/65 px-4 text-sm outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10" data-testid="input-recording-title" />

          <div className="mt-6 flex h-[96px] items-center justify-center gap-[5px] overflow-hidden rounded-[24px] border border-indigo-100/80 bg-indigo-50/50 px-5 dark:border-indigo-900/70 dark:bg-indigo-950/25 sm:mt-8 sm:h-[118px]" aria-label={recording ? 'Recording waveform in progress' : 'Audio waveform'} data-testid="waveform-canvas">
            {Array.from({ length: 48 }, (_, index) => (
              <span key={index} className={`wave-bar w-[3px] rounded-full bg-gradient-to-t from-indigo-400 to-blue-300 dark:from-indigo-400 dark:to-sky-300 ${recording ? 'opacity-100' : 'opacity-45'}`} style={{ height: `${waveHeights[index]}%` }} />
            ))}
          </div>
          <p className="mt-3 text-center text-[10px] font-medium text-muted-foreground">
            Noise suppression · Echo cancellation · Auto-gain requested when supported
          </p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {recording ? <><span className="relative flex size-2"><span className="absolute size-full animate-ping rounded-full bg-rose-400 opacity-60" /><span className="relative size-2 rounded-full bg-rose-500" /></span>Recording in progress</> : audioBlob ? 'Recording ready to review' : 'Your microphone is standing by'}
            </div>
            <span className="font-mono text-sm font-semibold tabular-nums" data-testid="text-recording-duration">{formatDuration(elapsed)}</span>
          </div>

          {audioBlob && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-muted/65 p-3">
              <button onClick={togglePlayback} className="grid size-11 shrink-0 place-items-center rounded-xl bg-background text-foreground shadow-sm" data-testid="button-preview-recording" aria-label={playing ? 'Pause recording' : 'Play recording'}>
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">Your recording</p><p className="text-[11px] text-muted-foreground">{formatDuration(elapsed)} · Ready to process</p></div>
              <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
            </div>
          )}

          {recordError && <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/45 dark:text-amber-200" role="alert"><TriangleAlert size={15} className="mt-0.5 shrink-0" />{recordError}</p>}
          {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200" role="alert" data-testid="status-processing-error">{error}</p>}

          {processing && (
            <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/[.045] p-4" aria-live="polite" data-testid="status-processing">
              <div className="mb-3 flex items-center justify-between text-xs"><span className="font-semibold text-primary">{stage}</span><span className="font-mono text-muted-foreground">{progress}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-primary/10"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
            </div>
          )}

          <div className="relative mt-4 flex flex-col gap-3 sm:mt-6 sm:flex-row">
            {recording ? (
              <button onClick={stopRecording} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700" data-testid="button-stop-recording"><span className="size-2.5 rounded-sm bg-white" />Finish recording</button>
            ) : audioBlob ? (
              <>
                <button onClick={() => void processAudio(audioBlob, title)} disabled={processing} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-indigo-900/15 transition hover:brightness-105 disabled:opacity-60" data-testid="button-process-recording"><Sparkles size={17} />{processing ? 'Preparing your minutes' : 'Create my minutes'}</button>
                <button onClick={() => { setAudioBlob(null); setElapsed(0); }} className="min-h-12 rounded-2xl border border-border bg-background/70 px-5 text-sm font-semibold hover:bg-muted" data-testid="button-discard-recording">Discard</button>
              </>
            ) : (
              <>
                <button onClick={() => void startRecording()} disabled={processing} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-indigo-900/15 transition hover:brightness-105 disabled:opacity-60" data-testid="button-start-recording"><Mic size={17} />Start recording</button>
                <Link href="/upload" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background/70 px-5 text-sm font-semibold text-foreground transition hover:bg-muted" data-testid="link-upload-instead"><Upload size={16} />Upload audio instead</Link>
              </>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="glass-surface rounded-[26px] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-muted-foreground">At a glance</p><h2 className="mt-1 font-serif text-lg font-bold">Your workspace</h2></div><Sparkles size={18} className="text-primary" /></div>
            {dashboard.isLoading ? (
              <div className="space-y-3" aria-label="Loading workspace totals"><div className="h-12 animate-pulse rounded-xl bg-muted" /><div className="h-12 animate-pulse rounded-xl bg-muted" /></div>
            ) : dashboard.isError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200" role="alert">
                <p className="font-semibold">Workspace totals didn’t load.</p><button onClick={() => void dashboard.refetch()} className="mt-2 min-h-10 underline underline-offset-2" data-testid="button-retry-dashboard">Try again</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <Stat icon={<FileAudio2 size={16} />} value={dashboard.data?.totalMeetings ?? 0} label="Meetings" />
                <Stat icon={<Clock3 size={16} />} value={`${dashboard.data?.totalMinutes ?? 0}m`} label="Captured" />
                <Stat icon={<Check size={16} />} value={dashboard.data?.actionItems ?? 0} label="Action items" />
                <Stat icon={<TriangleAlert size={16} />} value={dashboard.data?.reviewCount ?? 0} label="To review" />
              </div>
            )}
          </section>

          <section className="rounded-[26px] border border-indigo-100/70 bg-gradient-to-br from-indigo-50/80 via-white/60 to-sky-50/70 p-5 dark:border-indigo-900/60 dark:from-indigo-950/35 dark:via-card/60 dark:to-sky-950/25 sm:p-6">
            <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-white/80 text-primary shadow-sm dark:bg-white/10"><ShieldCheck size={18} /></div>
            <h3 className="font-semibold tracking-tight">Made for the details that matter</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Original words and translations stay side by side, ready for you to refine.</p>
            <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"><Check size={14} />Editable, bilingual minutes</div>
          </section>

          {dashboard.data && dashboard.data.recentMeetings.length > 0 && (
            <Link href="/history" className="flex min-h-[58px] items-center justify-between rounded-2xl px-1 text-sm font-semibold text-primary transition hover:translate-x-0.5" data-testid="link-view-history">
              <span>Continue with recent meetings</span><span aria-hidden="true">→</span>
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number | string; label: string }) {
  return <div className="rounded-[17px] bg-background/60 px-3 py-3"><div className="mb-2 flex items-center gap-1.5 text-primary">{icon}<span className="text-[10px] font-semibold text-muted-foreground">{label}</span></div><div className="font-serif text-[22px] font-bold tracking-tight tabular-nums" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</div></div>;
}
