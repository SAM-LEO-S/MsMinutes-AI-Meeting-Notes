import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  title?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  className?: string;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ src, title = 'Audio Playback', onTimeUpdate, className = '' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [buffered, setBuffered] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setBuffered(audio.buffered.length > 0 ? (audio.buffered.end(audio.buffered.length - 1) / audio.duration) * 100 : 0);
      onTimeUpdate?.(audio.currentTime, audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [onTimeUpdate]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Playback failed:', error);
      }
    }
  };

  const stopPlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const seekTime = (parseFloat(e.target.value) / 100) * duration;
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newVolume = parseFloat(e.target.value);
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.volume = volume || 1;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const skipBackward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  };

  const skipForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(duration, audio.currentTime + 10);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`glass-surface overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-indigo-950/40 via-slate-950/50 to-slate-900/40 shadow-xl backdrop-blur-xl ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className="flex items-center gap-3 p-4">
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={togglePlayPause}
            disabled={isLoading}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 hover:brightness-110 disabled:opacity-50 disabled:hover:scale-100"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} className="ml-0.5" fill="currentColor" />
            )}
          </button>
          
          <button
            onClick={stopPlayback}
            disabled={isLoading || currentTime === 0}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-background/60 text-muted-foreground transition-all hover:bg-background hover:text-foreground disabled:opacity-50"
            aria-label="Stop"
          >
            <Square size={14} fill="currentColor" />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="truncate text-xs font-semibold text-foreground">{title}</p>
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span className="text-muted-foreground/60">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
            <div 
              className="absolute left-0 top-0 h-full rounded-full bg-muted/50 transition-all duration-300"
              style={{ width: `${buffered}%` }}
            />
            <input
              ref={progressRef}
              type="range"
              min="0"
              max="100"
              value={progressPercent}
              onChange={handleSeek}
              disabled={isLoading || duration === 0}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed"
              aria-label="Seek"
            />
            <div 
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-150 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
              style={{ width: `${progressPercent}%` }}
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-lg transition-all duration-150 ease-out"
              style={{ left: `${progressPercent}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={skipBackward}
            disabled={isLoading}
            className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-background/60 hover:text-foreground disabled:opacity-50"
            aria-label="Skip back 10 seconds"
          >
            <SkipBack size={14} />
          </button>
          
          <button
            onClick={skipForward}
            disabled={isLoading}
            className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-background/60 hover:text-foreground disabled:opacity-50"
            aria-label="Skip forward 10 seconds"
          >
            <SkipForward size={14} />
          </button>

          <div className="relative flex items-center gap-1.5">
            <button
              onClick={toggleMute}
              className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-background/60 hover:text-foreground"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-muted/40 [&::-webkit-slider-thumb]:size-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-125"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
