import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  AlertCircle,
  Camera,
  Loader2,
  Maximize,
  PictureInPicture2,
  RefreshCw,
  SlidersHorizontal,
  SkipForward,
  Volume2,
} from 'lucide-react';

interface HlsLevelOption {
  index: number;
  label: string;
}

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
  onVideoElementChange?: (el: HTMLVideoElement | null) => void;
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
  className = 'w-full h-full',
  controls = true,
  muted = false,
  videoRefExternal,
  onVideoElementChange,
}: HlsVideoPlayerProps) {
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'embed' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoplayMuted, setAutoplayMuted] = useState(false);
  const [fillFrame, setFillFrame] = useState(false);
  const [levels, setLevels] = useState<HlsLevelOption[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);

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
    setLevels([]);
    setCurrentLevel(-1);
    setQualityMenuOpen(false);
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
      onVideoElementChange?.(null);
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
    onVideoElementChange?.(video);

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

      hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
        if (!disposed && Array.isArray(data?.levels) && data.levels.length > 0) {
          const mapped = data.levels
            .map((lvl, idx) => ({
              index: idx,
              label: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)}k`,
            }))
            .filter((item, i, arr) => arr.findIndex((x) => x.label === item.label) === i);
          setLevels(mapped);
          setCurrentLevel(-1);
        }
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

  const handleTogglePip = async () => {
    const video = internalRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch {
      setSnapshotNotice('PiP unavailable for this stream');
      setTimeout(() => setSnapshotNotice(null), 2000);
    }
  };

  const handleSelectQuality = (lvlIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = lvlIndex;
      setCurrentLevel(lvlIndex);
    }
    setQualityMenuOpen(false);
  };

  const handleSnapshot = () => {
    const video = internalRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${channelName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-frame.png`;
      a.click();
      setSnapshotNotice('Frame saved');
      setTimeout(() => setSnapshotNotice(null), 1800);
    } catch {
      if (!activeRelay) {
        onRequestProxyRelay();
        setSnapshotNotice('Switching to Relay for frame capture...');
      } else {
        setSnapshotNotice('Stream blocks frame export');
      }
      setTimeout(() => setSnapshotNotice(null), 2200);
    }
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
    <div className="relative w-full h-full bg-[#0E0E0D] group/vid">
      <video
        ref={(el) => {
          internalRef.current = el;
          if (videoRefExternal) videoRefExternal.current = el;
          onVideoElementChange?.(el);
        }}
        controls={controls}
        playsInline
        autoPlay
        crossOrigin="anonymous"
        muted={muted || autoplayMuted}
        className={`${className} ${fillFrame ? 'object-cover' : 'object-contain'}`}
      />

      {/* Video Overlay Tools (Quality, PiP, Aspect Fill, Snapshot) */}
      {status === 'playing' && (
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 opacity-95 sm:opacity-0 sm:group-hover/vid:opacity-100 transition-opacity z-20">
          {levels.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setQualityMenuOpen((v) => !v)}
                title="Video quality"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/75 text-white border border-white/20 text-[11px] font-mono hover:bg-black"
              >
                <SlidersHorizontal size={11} />
                <span>
                  {currentLevel === -1
                    ? 'Auto'
                    : levels.find((l) => l.index === currentLevel)?.label || 'Auto'}
                </span>
              </button>
              {qualityMenuOpen && (
                <div
                  onMouseLeave={() => setQualityMenuOpen(false)}
                  className="absolute left-0 top-8 w-28 rounded-lg bg-[#13151C] border border-[#252936] shadow-xl py-1 z-30"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectQuality(-1)}
                    className={`w-full px-3 py-1.5 text-left text-[11px] font-mono ${
                      currentLevel === -1
                        ? 'text-[var(--sm-accent-text)] font-semibold'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    Auto
                  </button>
                  {levels.map((lvl) => (
                    <button
                      key={lvl.index}
                      type="button"
                      onClick={() => handleSelectQuality(lvl.index)}
                      className={`w-full px-3 py-1.5 text-left text-[11px] font-mono ${
                        currentLevel === lvl.index
                          ? 'text-[var(--sm-accent-text)] font-semibold'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setFillFrame((v) => !v)}
            title={fillFrame ? 'Fit original aspect ratio' : 'Fill widescreen frame'}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/75 text-white border border-white/20 text-[11px] hover:bg-black"
          >
            <Maximize size={11} />
            <span>{fillFrame ? 'Fit' : 'Fill'}</span>
          </button>

          {typeof document !== 'undefined' && document.pictureInPictureEnabled && (
            <button
              type="button"
              onClick={handleTogglePip}
              title="Picture-in-Picture floating window"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/75 text-white border border-white/20 text-[11px] hover:bg-black"
            >
              <PictureInPicture2 size={11} />
              <span>PiP</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSnapshot}
            title="Capture video frame PNG"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/75 text-white border border-white/20 text-[11px] hover:bg-black"
          >
            <Camera size={11} />
            <span className="hidden sm:inline">Snap</span>
          </button>

          {snapshotNotice && (
            <span className="px-2.5 py-1 rounded-md bg-black/85 text-white text-[11px]">
              {snapshotNotice}
            </span>
          )}
        </div>
      )}

      {status === 'playing' && autoplayMuted && !muted && (
        <button
          type="button"
          onClick={handleUnmute}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold shadow-lg hover:opacity-90 z-20"
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
