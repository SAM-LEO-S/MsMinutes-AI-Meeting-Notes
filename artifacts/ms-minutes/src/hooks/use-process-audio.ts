import { useCallback, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetDashboardQueryKey, getListMeetingsQueryKey } from '@workspace/api-client-react';

export type ProcessState = {
  stage: string;
  progress: number;
  error: string | null;
  processing: boolean;
};

type ProcessPayload = {
  stage?: string;
  progress?: number;
  percentage?: number;
  step?: string;
  status?: string;
  message?: string;
  error?: string;
  meeting?: { id?: number };
  result?: { id?: number };
  id?: number;
  meetingId?: number;
};

export function useProcessAudio() {
  const [state, setState] = useState<ProcessState>({
    stage: '',
    progress: 0,
    error: null,
    processing: false,
  });
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const processAudio = useCallback(async (file: Blob, title?: string) => {
    setState({ stage: 'Preparing audio', progress: 4, error: null, processing: true });
    const body = new FormData();
    body.append('audio', file, file instanceof File ? file.name : 'recording.webm');
    if (title?.trim()) {
      body.append('title', title.trim());
    }

    try {
      const response = await fetch('/api/meetings/process', {
        method: 'POST',
        body,
        credentials: 'include',
      });
      if (!response.ok) {
        const responseText = await response.text();
        let message = responseText;
        try {
          const body = JSON.parse(responseText) as { error?: string };
          message = body.error || responseText;
        } catch {
          // Keep the server's plain-text message when it is not JSON.
        }
        throw new Error(message || 'We could not process this audio. Please try again.');
      }
      if (!response.body) {
        throw new Error('Live progress is unavailable. Please try again in a moment.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let meetingId: number | undefined;

      const handleMessage = (raw: string) => {
        const text = raw.trim().replace(/^data:\s*/, '');
        if (!text || text === '[DONE]') {
          return;
        }
        let event: ProcessPayload;
        try {
          event = JSON.parse(text) as ProcessPayload;
        } catch {
          setState((current) => ({ ...current, stage: text.slice(0, 100), progress: Math.min(94, current.progress + 10) }));
          return;
        }
        if (event.error) {
          throw new Error(event.error);
        }
        const stage = event.stage || event.step || event.message || event.status || 'Working through your meeting';
        const rawProgress = typeof event.progress === 'number' ? event.progress : event.percentage;
        const progress = typeof rawProgress === 'number' ? (rawProgress <= 1 ? rawProgress * 100 : rawProgress) : undefined;
        setState((current) => ({
          ...current,
          stage,
          progress: progress === undefined ? Math.min(94, current.progress + 13) : Math.max(4, Math.min(progress, 100)),
        }));
        meetingId = event.meeting?.id ?? event.result?.id ?? event.meetingId ?? event.id ?? meetingId;
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const messages = buffer.split(/\r?\n\r?\n/);
        buffer = messages.pop() || '';
        messages.forEach(handleMessage);
        if (done) {
          if (buffer.trim()) {
            handleMessage(buffer);
          }
          break;
        }
      }

      if (!meetingId) {
        throw new Error('Audio was processed, but the meeting link was missing. Check your history in a moment.');
      }
      setState({ stage: 'Your minutes are ready', progress: 100, error: null, processing: false });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
      ]);
      setLocation(`/meetings/${meetingId}`);
    } catch (error) {
      setState({
        stage: '',
        progress: 0,
        error: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        processing: false,
      });
    }
  }, [queryClient, setLocation]);

  return { ...state, processAudio, clearError: () => setState((current) => ({ ...current, error: null })) };
}
