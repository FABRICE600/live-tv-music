import { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  ListMusic,
  ShoppingBag,
  SlidersHorizontal,
  Timer,
  FileText,
  Loader2,
  Radio,
  ArrowLeftRight,
  Film,
} from 'lucide-react';
import type { MusicTrack, RepeatMode, SleepTimerMode } from '../types/music';
import { formatDuration } from '../utils/formatters';
import { CoverArtwork } from './CoverArtwork';

interface PlayerBarProps {
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackError: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  isLiked: boolean;
  queueOpen: boolean;
  queueCount: number;
  eqEnabled: boolean;
  crossfadeSec: number;
  isCrossfading: boolean;
  sleepTimerMode: SleepTimerMode;
  sleepRemainingSec: number | null;
  onTogglePlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleLike: () => void;
  onToggleQueue: () => void;
  onOpenStoreModal: (track: MusicTrack) => void;
  onOpenLyrics: (track: MusicTrack) => void;
  onOpenListeningRoom: () => void;
  onSetSleepTimer: (mode: SleepTimerMode) => void;
  onChangeCrossfade: (seconds: number) => void;
  showMusicVideo?: boolean;
  onToggleMusicVideo?: () => void;
  onSelectArtist: (artistId: string, artistName?: string) => void;
}

export function PlayerBar({
  currentTrack,
  isPlaying,
  isBuffering,
  playbackError,
  currentTime,
  duration,
  volume,
  isMuted,
  shuffle,
  repeatMode,
  isLiked,
  queueOpen,
  queueCount,
  eqEnabled,
  crossfadeSec,
  isCrossfading,
  sleepTimerMode,
  sleepRemainingSec,
  onTogglePlayPause,
  onPrevious,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onToggleLike,
  onToggleQueue,
  onOpenStoreModal,
  onOpenLyrics,
  onOpenListeningRoom,
  onSetSleepTimer,
  onChangeCrossfade,
  showMusicVideo,
  onToggleMusicVideo,
  onSelectArtist,
}: PlayerBarProps) {
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const [crossfadeMenuOpen, setCrossfadeMenuOpen] = useState(false);

  const safeDuration = currentTrack?.isLive ? 0 : duration > 0 ? duration : currentTrack?.durationSec || 0;
  const progressPct = safeDuration > 0 ? Math.min(100, (currentTime / safeDuration) * 100) : 0;

  return (
    <footer className="shrink-0 bg-[var(--sm-surface)] border-t border-[var(--sm-border)] px-3 sm:px-6 py-3 z-30">
      <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Zone 1: Track Info */}
        <div className="flex items-center gap-3.5 w-full md:w-[30%] min-w-0">
          {currentTrack ? (
            <>
              <button
                type="button"
                onClick={onOpenListeningRoom}
                title="Open Listening Room"
                className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden border-2 border-[var(--sm-border)] hover:border-[var(--sm-accent)] transition-colors"
              >
                <CoverArtwork
                  src={currentTrack.coverUrl}
                  alt={`${currentTrack.title} cover`}
                  className={`w-full h-full object-cover ${isPlaying ? 'soundmark-spin-slow' : ''}`}
                  roundedClassName="rounded-none"
                  sizeIcon={18}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 m-auto w-2.5 h-2.5 rounded-full bg-[var(--sm-surface)] border border-[var(--sm-border)] pointer-events-none"
                />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenListeningRoom}
                    className="text-sm font-semibold text-[var(--sm-text)] truncate hover:underline text-left"
                  >
                    {currentTrack.title}
                  </button>
                  {currentTrack.isLive && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#15803D] dark:text-emerald-400 shrink-0">
                      <Radio size={10} />
                      LIVE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--sm-text-sec)] truncate">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectArtist(
                        currentTrack.artistId || `artist-${encodeURIComponent(currentTrack.artist)}`,
                        currentTrack.artist,
                      )
                    }
                    className="hover:text-[var(--sm-text)] hover:underline truncate"
                  >
                    {currentTrack.artist}
                  </button>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{currentTrack.sourceLabel}</span>
                </div>
                {playbackError && (
                  <p className="text-[11px] text-[var(--sm-accent-text)] truncate">
                    {playbackError}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onToggleLike}
                aria-label={isLiked ? 'Unlike track' : 'Like track'}
                className={`p-2 rounded-md shrink-0 transition-colors ${
                  isLiked
                    ? 'text-[var(--sm-accent-text)]'
                    : 'text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]'
                }`}
              >
                <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3 text-xs text-[var(--sm-text-muted)]">
              <div className="w-11 h-11 rounded-md border border-dashed border-[var(--sm-border)] flex items-center justify-center shrink-0">
                <Play size={14} />
              </div>
              <span>Select any track or live radio station to begin listening.</span>
            </div>
          )}
        </div>

        {/* Zone 2: Transport + Seek */}
        <div className="flex flex-col items-center gap-1.5 w-full md:w-[40%] max-w-xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onToggleShuffle}
              aria-label="Toggle shuffle"
              title="Shuffle"
              className={`p-1.5 rounded-md transition-colors ${
                shuffle
                  ? 'text-[var(--sm-accent-text)]'
                  : 'text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]'
              }`}
            >
              <Shuffle size={15} />
            </button>

            <button
              type="button"
              onClick={onPrevious}
              disabled={!currentTrack}
              aria-label="Previous track"
              className="p-1.5 rounded-md text-[var(--sm-text)] disabled:opacity-35 hover:bg-[var(--sm-muted)] transition-colors"
            >
              <SkipBack size={17} />
            </button>

            <button
              type="button"
              onClick={onTogglePlayPause}
              disabled={!currentTrack}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-10 h-10 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] flex items-center justify-center hover:scale-105 disabled:opacity-35 transition-transform shrink-0 shadow-md"
            >
              {isBuffering ? (
                <Loader2 size={17} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={17} fill="currentColor" />
              ) : (
                <Play size={17} fill="currentColor" className="ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={!currentTrack}
              aria-label="Next track"
              className="p-1.5 rounded-md text-[var(--sm-text)] disabled:opacity-35 hover:bg-[var(--sm-muted)] transition-colors"
            >
              <SkipForward size={17} />
            </button>

            <button
              type="button"
              onClick={onCycleRepeat}
              aria-label={`Repeat mode: ${repeatMode}`}
              title={`Repeat: ${repeatMode}`}
              className={`p-1.5 rounded-md transition-colors ${
                repeatMode !== 'off'
                  ? 'text-[var(--sm-accent-text)]'
                  : 'text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
            </button>
          </div>

          {/* Seekbar */}
          <div className="w-full flex items-center gap-2.5">
            <span className="font-mono tabular-nums text-[11px] text-[var(--sm-text-muted)] w-10 text-right shrink-0">
              {formatDuration(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={safeDuration || 100}
              step={1}
              value={currentTrack?.isLive ? 0 : Math.min(currentTime, safeDuration || 100)}
              disabled={!currentTrack || currentTrack.isLive || safeDuration === 0}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Seek playback position"
              style={{
                background: `linear-gradient(to right, var(--sm-accent) ${progressPct}%, rgba(128,125,116,0.25) ${progressPct}%)`,
              }}
              className="soundmark-range flex-1 h-1 rounded-full disabled:opacity-40"
            />
            <span className="font-mono tabular-nums text-[11px] text-[var(--sm-text-muted)] w-10 shrink-0">
              {currentTrack ? formatDuration(safeDuration, currentTrack.isLive) : '0:00'}
            </span>
          </div>
        </div>

        {/* Zone 3: Studio Tools, Sleep Timer, Volume & Queue */}
        <div className="hidden md:flex items-center justify-end gap-1.5 w-[30%]">
          {currentTrack && (
            <>
              {currentTrack.youtubeVideoId && onToggleMusicVideo && (
                <button
                  type="button"
                  onClick={onToggleMusicVideo}
                  title={showMusicVideo ? 'Hide Music Video' : 'Show Music Video'}
                  aria-label={showMusicVideo ? 'Hide Music Video' : 'Show Music Video'}
                  className={`p-2 rounded-md transition-colors ${
                    showMusicVideo
                      ? 'bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)]'
                      : 'text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] hover:bg-[var(--sm-muted)]'
                  }`}
                >
                  <Film size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenLyrics(currentTrack)}
                title="Lyrics & Liner Notes"
                aria-label="Lyrics and liner notes"
                className="p-2 rounded-md text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] hover:bg-[var(--sm-muted)] transition-colors"
              >
                <FileText size={16} />
              </button>
              <button
                type="button"
                onClick={() => onOpenStoreModal(currentTrack)}
                title="Digital Store Links"
                aria-label="Digital store links"
                className="p-2 rounded-md text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] hover:bg-[var(--sm-muted)] transition-colors"
              >
                <ShoppingBag size={16} />
              </button>
            </>
          )}

          {/* Sleep Timer */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSleepMenuOpen((v) => !v)}
              title="Sleep Timer"
              aria-label="Sleep Timer"
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-mono tabular-nums transition-colors ${
                sleepTimerMode !== 'off'
                  ? 'bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)]'
                  : 'text-[var(--sm-text-sec)] hover:bg-[var(--sm-muted)]'
              }`}
            >
              <Timer size={15} />
              {sleepTimerMode === 'track' && <span>End</span>}
              {sleepRemainingSec !== null && sleepRemainingSec > 0 && (
                <span>{Math.ceil(sleepRemainingSec / 60)}m</span>
              )}
            </button>
            {sleepMenuOpen && (
              <div
                onMouseLeave={() => setSleepMenuOpen(false)}
                className="absolute bottom-10 right-0 z-40 w-44 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-surface)] shadow-lg py-1.5"
              >
                <div className="px-3 py-1 text-[11px] font-medium text-[var(--sm-text-muted)]">
                  Sleep Timer
                </div>
                {(
                  [
                    ['off', 'Off'],
                    ['15', '15 minutes'],
                    ['30', '30 minutes'],
                    ['45', '45 minutes'],
                    ['60', '60 minutes'],
                    ['track', 'End of current track'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      onSetSleepTimer(mode);
                      setSleepMenuOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                      sleepTimerMode === mode
                        ? 'text-[var(--sm-accent-text)] font-semibold bg-[var(--sm-muted)]'
                        : 'text-[var(--sm-text)] hover:bg-[var(--sm-muted)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Crossfade Duration Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setCrossfadeMenuOpen((v) => !v);
                setSleepMenuOpen(false);
              }}
              title="Queue Crossfade Settings"
              aria-label="Queue Crossfade Settings"
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-mono tabular-nums transition-colors ${
                crossfadeSec > 0
                  ? 'bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)]'
                  : 'text-[var(--sm-text-sec)] hover:bg-[var(--sm-muted)]'
              }`}
            >
              <ArrowLeftRight size={14} className={isCrossfading ? 'animate-pulse' : ''} />
              {crossfadeSec > 0 && <span>{crossfadeSec}s</span>}
            </button>
            {crossfadeMenuOpen && (
              <div
                onMouseLeave={() => setCrossfadeMenuOpen(false)}
                className="absolute bottom-10 right-0 z-40 w-56 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-surface)] shadow-lg p-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--sm-text-muted)]">
                    Queue Crossfade
                  </span>
                  <span className="font-mono tabular-nums text-xs font-semibold text-[var(--sm-accent-text)]">
                    {crossfadeSec === 0 ? 'Off' : `${crossfadeSec}s`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={crossfadeSec}
                  onChange={(e) => onChangeCrossfade(Number(e.target.value))}
                  aria-label="Crossfade duration"
                  style={{
                    background: `linear-gradient(to right, var(--sm-accent) ${(crossfadeSec / 12) * 100}%, rgba(128,125,116,0.25) ${(crossfadeSec / 12) * 100}%)`,
                  }}
                  className="soundmark-range w-full h-1 rounded-full"
                />
                <div className="grid grid-cols-5 gap-1">
                  {[0, 3, 5, 8, 12].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onChangeCrossfade(sec)}
                      className={`py-1 rounded text-[11px] font-mono tabular-nums transition-colors ${
                        crossfadeSec === sec
                          ? 'bg-[var(--sm-accent)] text-[var(--sm-on-accent)] font-semibold'
                          : 'bg-[var(--sm-muted)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
                      }`}
                    >
                      {sec === 0 ? 'Off' : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Listening Room / EQ */}
          <button
            type="button"
            onClick={onOpenListeningRoom}
            title="Listening Room & 5-Band EQ"
            aria-label="Open Listening Room and EQ"
            className={`p-2 rounded-md transition-colors ${
              eqEnabled
                ? 'text-[var(--sm-accent-text)] hover:bg-[var(--sm-muted)]'
                : 'text-[var(--sm-text-sec)] hover:bg-[var(--sm-muted)]'
            }`}
          >
            <SlidersHorizontal size={16} />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1.5 pl-1">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="p-1.5 rounded-md text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
            >
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="Volume"
              style={{
                background: `linear-gradient(to right, var(--sm-accent) ${(isMuted ? 0 : volume) * 100}%, rgba(128,125,116,0.25) ${(isMuted ? 0 : volume) * 100}%)`,
              }}
              className="soundmark-range w-20 h-1 rounded-full"
            />
          </div>

          {/* Queue toggle */}
          <button
            type="button"
            onClick={onToggleQueue}
            aria-label="Toggle playback queue"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              queueOpen
                ? 'bg-[var(--sm-accent)] text-[var(--sm-on-accent)]'
                : 'text-[var(--sm-text-sec)] hover:bg-[var(--sm-muted)]'
            }`}
          >
            <ListMusic size={15} />
            <span className="font-mono tabular-nums">{queueCount}</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
