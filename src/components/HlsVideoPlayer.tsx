import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertCircle, Loader2, RefreshCw, SkipForward, Volume2 } from 'lucide-react';

interface HlsVideoPlayerProps {
  streamUrl: string;
  alternateUrls?: string[];
  embedUrl?: string;
  channelName: string;
  useProxyRelay: boolean;
  onRequestProxyRelay: () => void;
  onNextChannel?: () => void;
  onPlaybackStart?: () => void;
  className?: string;
  controls?: boolean;
  muted?: boolean;
  videoRefExternal?: React.MutableRefObject<HTMLVideoElement | null>;
}

export function HlsVideoPlayer({
  streamUrl,
  alternateUrls,
  embedUrl,
  channelName,
  useProxyRelay,
  onRequestProxyRelay,
  onNextChannel,
  onPlaybackStart,
  className = 'w-full h-full object-contain',
  controls = true,
  muted = false,
  videoRefExternal,
}: HlsVideoPlayerProps) {
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'embed' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoplayMuted, setAutoplayMuted] = useState(false);

  const candidates = useMemo(() => {
    const list = [streamUrl, ...(alternateUrls || [])].filter(Boolean);
    return Array.from(new Set(list));
  }, [streamUrl, alternateUrls]);

  const [candidateIdx, setCandidateIdx] = useState(0);
  const [localRelay, setLocalRelay] = useState(useProxyRelay);
  const [retryNonce, setRetryNonce] = useState(0);

  // Reset attempt state whenever channel streamUrl or embedUrl changes
  useEffect(() => {
    setCandidateIdx(0);
    setLocalRelay(useProxyRelay);
    setAutoplayMuted(false);
    setRetryNonce(0);
  }, [streamUrl, embedUrl]);

  useEffect(() => {
    setLocalRelay(useProxyRelay);
  }, [useProxyRelay]);

  const activeCandidate = candidates[candidateIdx] || '';
  const requiresProxy = activeCandidate.startsWith('http://');
  const activeRelay = useProxyRelay || localRelay || requiresProxy;

  useEffect(() => {
    const video = internalRef.current;

    if (!activeCandidate) {
      if (embedUrl) {
        onPlaybackStart?.();
        setStatus('embed');
        setErrorMsg(null);
      } else {
        setStatus('error');
        setErrorMsg('No live stream available for this channel.');
      }
      return;
    }

    if (!video) return;
    if (videoRefExternal) videoRefExternal.current = video;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setStatus('loading');
    setErrorMsg(null);
    onPlaybackStart?.();

    const targetSrc = activeRelay
      ? `/api/tv/proxy?url=${encodeURIComponent(activeCandidate)}`
      : activeCandidate;

    let mediaRecoveries = 0;
    let networkRetries = 0;
    let disposed = false;

    const attemptPlay = () => {
      video.muted = muted || autoplayMuted;
      video
        .play()
        .then(() => {
          if (!disposed) setStatus('playing');
        })
        .catch(() => {
          if (disposed) return;
          video.muted = true;
          setAutoplayMuted(true);
          video
            .play()
            .then(() => {
              if (!disposed) setStatus('playing');
            })
            .catch(() => {
              if (!disposed) setStatus('playing');
            });
        });
    };

    const advanceFallback = () => {
      if (disposed) return;
      if (!activeRelay) {
        setLocalRelay(true);
        onRequestProxyRelay();
        return;
      }
      if (candidateIdx < candidates.length - 1) {
        setLocalRelay(false);
        setCandidateIdx((i) => i + 1);
        return;
      }
      if (embedUrl) {
        setStatus('embed');
        setErrorMsg(null);
        return;
      }
      setStatus('error');
      setErrorMsg('Broadcast temporarily offline or geo-restricted in your region.');
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        manifestLoadingTimeOut: 12000,
        fragLoadingTimeOut: 15000,
        levelLoadingTimeOut: 12000,
      });
      hlsRef.current = hls;
      hls.loadSource(targetSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        attemptPlay();
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (!disposed) setStatus('playing');
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (disposed || !data.fatal) return;

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
          mediaRecoveries += 1;
          hls.recoverMediaError();
          return;
        }

        if (
          data.type === Hls.ErrorTypes.NETWORK_ERROR &&
          activeRelay &&
          networkRetries < 1
        ) {
          networkRetries += 1;
          hls.startLoad();
          return;
        }

        advanceFallback();
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = targetSrc;
      const onError = () => advanceFallback();
      video.addEventListener('error', onError, { once: true });
      attemptPlay();
      return () => {
        disposed = true;
        video.removeEventListener('error', onError);
      };
    } else if (embedUrl) {
      setStatus('embed');
    } else {
      setStatus('error');
      setErrorMsg('Live HLS video is not supported in this browser.');
    }

    return () => {
      disposed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeCandidate, activeRelay, candidateIdx, candidates.length, embedUrl, retryNonce]);

  const handleUnmute = () => {
    const video = internalRef.current;
    if (video) {
      video.muted = false;
      video.volume = 1;
    }
    setAutoplayMuted(false);
  };

  if (status === 'embed' && embedUrl) {
    return (
      <div className="relative w-full h-full bg-[#0E0E0D]">
        <iframe
          src={embedUrl}
          title={`${channelName} live broadcast`}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#0E0E0D]">
      <video
        ref={(el) => {
          internalRef.current = el;
          if (videoRefExternal) videoRefExternal.current = el;
        }}
        controls={controls}
        playsInline
        autoPlay
        muted={muted || autoplayMuted}
        className={className}
      />

      {status === 'playing' && autoplayMuted && !muted && (
        <button
          type="button"
          onClick={handleUnmute}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold shadow-lg hover:opacity-90"
        >
          <Volume2 size={14} />
          <span>Tap to Unmute</span>
        </button>
      )}

      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white pointer-events-none">
          <Loader2 size={26} className="animate-spin text-[var(--sm-accent-text)]" />
          <span className="text-xs font-medium px-3 text-center">
            {activeRelay ? `Connecting via Relay · ${channelName}...` : `Tuning ${channelName}...`}
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 text-white p-4 text-center">
          <AlertCircle size={24} className="text-[var(--sm-accent-text)]" />
          <p className="text-xs font-medium max-w-xs leading-relaxed">{errorMsg}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onNextChannel && (
              <button
                type="button"
                onClick={onNextChannel}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold hover:opacity-90"
              >
                <SkipForward size={13} />
                <span>Next Live Channel</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setCandidateIdx(0);
                setLocalRelay(false);
                setRetryNonce((n) => n + 1);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-white/25 text-white text-xs font-medium hover:bg-white/10"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
