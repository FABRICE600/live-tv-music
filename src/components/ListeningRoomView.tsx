import { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  ShoppingBag,
  Heart,
  RotateCcw,
  FileText,
  Sparkles,
  ArrowLeftRight,
} from 'lucide-react';
import type { EqSettings, MusicTrack } from '../types/music';
import { DEFAULT_EQ, EQ_BANDS, EQ_PRESETS, formatDuration } from '../utils/formatters';
import { CoverArtwork } from './CoverArtwork';
import { SpectrumVisualizer } from './SpectrumVisualizer';

interface ListeningRoomViewProps {
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  analyser: AnalyserNode | null;
  hasLiveSignal: boolean;
  eqSettings: EqSettings;
  crossfadeSec: number;
  isCrossfading: boolean;
  isLiked: boolean;
  onUpdateEq: (next: EqSettings) => void;
  onChangeCrossfade: (seconds: number) => void;
  onTogglePlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleLike: () => void;
  onOpenStoreModal: (track: MusicTrack) => void;
  onSelectArtist: (artistId: string, artistName?: string) => void;
  onBrowseCatalog: () => void;
}

export function ListeningRoomView({
  currentTrack,
  isPlaying,
  analyser,
  hasLiveSignal,
  eqSettings,
  crossfadeSec,
  isCrossfading,
  isLiked,
  onUpdateEq,
  onChangeCrossfade,
  onTogglePlayPause,
  onPrevious,
  onNext,
  onToggleLike,
  onOpenStoreModal,
  onSelectArtist,
  onBrowseCatalog,
}: ListeningRoomViewProps) {
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  useEffect(() => {
    if (!currentTrack) {
      setLyrics(null);
      return;
    }
    let active = true;
    setLyricsLoading(true);
    fetch(
      `/api/music/lyrics?artist=${encodeURIComponent(currentTrack.artist)}&title=${encodeURIComponent(currentTrack.title)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (active) setLyrics(data.lyrics || null);
      })
      .catch(() => {
        if (active) setLyrics(null);
      })
      .finally(() => {
        if (active) setLyricsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentTrack?.id]);

  const handleBandChange = (index: number, db: number) => {
    const updated = [...eqSettings.bands] as [number, number, number, number, number];
    updated[index] = db;
    onUpdateEq({
      ...eqSettings,
      enabled: true,
      preset: 'Custom',
      bands: updated,
    });
  };

  const applyPreset = (name: string) => {
    const presetBands = EQ_PRESETS[name] || DEFAULT_EQ.bands;
    onUpdateEq({
      ...eqSettings,
      enabled: true,
      preset: name,
      bands: [...presetBands] as [number, number, number, number, number],
    });
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--sm-border)] pb-5">
        <div>
          <p className="text-xs font-medium text-[var(--sm-text-muted)] mb-1">
            Studio Console
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--sm-text)]">
            Listening Room & Parametric EQ
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onUpdateEq({ ...eqSettings, enabled: !eqSettings.enabled })}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
              eqSettings.enabled
                ? 'bg-[var(--sm-accent)] text-[var(--sm-on-accent)]'
                : 'bg-[var(--sm-muted)] text-[var(--sm-text-sec)]'
            }`}
          >
            {eqSettings.enabled ? 'EQ Active' : 'EQ Bypassed'}
          </button>
          <button
            type="button"
            onClick={() => onUpdateEq(DEFAULT_EQ)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--sm-border)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap"
          >
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      </div>

      {/* Main Split: Sleeve & Spectrum + Parametric EQ Rack */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Active Sleeve & Spectrum */}
        <div className="lg:col-span-5 border border-[var(--sm-border)] rounded-2xl bg-[var(--sm-surface)] p-6 flex flex-col justify-between gap-6">
          {currentTrack ? (
            <>
              <div className="space-y-5">
                <div className="aspect-square w-full max-w-[320px] mx-auto rounded-lg overflow-hidden border border-[var(--sm-border)]">
                  <CoverArtwork
                    src={currentTrack.coverUrl}
                    alt={`${currentTrack.title} artwork`}
                    roundedClassName="rounded-none"
                    sizeIcon={44}
                  />
                </div>

                <div className="text-center space-y-1.5">
                  <h2 className="font-display text-xl font-bold text-[var(--sm-text)] text-balance">
                    {currentTrack.title}
                  </h2>
                  <p className="text-sm text-[var(--sm-text-sec)]">
                    <button
                      type="button"
                      onClick={() =>
                        onSelectArtist(
                          currentTrack.artistId || `artist-${encodeURIComponent(currentTrack.artist)}`,
                          currentTrack.artist,
                        )
                      }
                      className="hover:underline font-medium text-[var(--sm-text)]"
                    >
                      {currentTrack.artist}
                    </button>
                  </p>
                  <p className="text-xs text-[var(--sm-text-muted)]">
                    {currentTrack.genre} · {currentTrack.sourceLabel} ·{' '}
                    <span className="font-mono tabular-nums">
                      {formatDuration(currentTrack.durationSec, currentTrack.isLive)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2 border-t border-[var(--sm-border)]">
                <button
                  type="button"
                  onClick={onPrevious}
                  aria-label="Previous track"
                  className="p-2.5 rounded-lg border border-[var(--sm-border)] text-[var(--sm-text)] hover:bg-[var(--sm-muted)]"
                >
                  <SkipBack size={18} />
                </button>
                <button
                  type="button"
                  onClick={onTogglePlayPause}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="px-6 py-2.5 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] font-semibold text-sm inline-flex items-center gap-2 hover:opacity-90"
                >
                  {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  aria-label="Next track"
                  className="p-2.5 rounded-lg border border-[var(--sm-border)] text-[var(--sm-text)] hover:bg-[var(--sm-muted)]"
                >
                  <SkipForward size={18} />
                </button>
                <button
                  type="button"
                  onClick={onToggleLike}
                  aria-label="Like track"
                  className={`p-2.5 rounded-lg border border-[var(--sm-border)] ${
                    isLiked ? 'text-[var(--sm-accent-text)]' : 'text-[var(--sm-text-sec)]'
                  }`}
                >
                  <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenStoreModal(currentTrack)}
                  aria-label="Store links"
                  className="p-2.5 rounded-lg border border-[var(--sm-border)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
                >
                  <ShoppingBag size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="my-auto py-12 text-center space-y-4">
              <SlidersHorizontal size={32} className="mx-auto text-[var(--sm-text-muted)]" />
              <div className="space-y-1">
                <h2 className="font-display text-lg font-semibold text-[var(--sm-text)]">
                  No Track Loaded
                </h2>
                <p className="text-xs text-[var(--sm-text-sec)] max-w-xs mx-auto">
                  Start playing any track from Discover or Browse Catalog to inspect live frequency spectrums and tune the 5-band equalizer.
                </p>
              </div>
              <button
                type="button"
                onClick={onBrowseCatalog}
                className="px-5 py-2 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold"
              >
                Browse Catalog
              </button>
            </div>
          )}
        </div>

        {/* Right: Real-Time FFT Spectrum + 5-Band EQ + Playback Speed */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Spectrum Box */}
          <div className="border border-[var(--sm-border)] rounded-2xl bg-[var(--sm-surface)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--sm-text-sec)]">
                Real-Time Frequency Analyzer
              </span>
              <span className="font-mono tabular-nums text-[11px] text-[var(--sm-text-muted)]">
                {hasLiveSignal && isPlaying ? 'WebAudio FFT Active' : isPlaying ? 'Harmonic Monitor' : 'Standby'}
              </span>
            </div>
            <div className="rounded-xl bg-[var(--sm-bg)] border border-[var(--sm-border)] p-3">
              <SpectrumVisualizer
                analyser={analyser}
                isPlaying={isPlaying}
                hasLiveSignal={hasLiveSignal}
                height={130}
                bars={56}
              />
            </div>
          </div>

          {/* 5-Band Equalizer Rack */}
          <div className="border border-[var(--sm-border)] rounded-2xl bg-[var(--sm-surface)] p-5 space-y-5 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--sm-text)]">
                  5-Band Parametric Equalizer
                </h3>
                <p className="text-xs text-[var(--sm-text-muted)]">
                  Adjust hardware frequency gain from -12 dB to +12 dB
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[var(--sm-muted)]">
                {Object.keys(EQ_PRESETS).map((presetName) => (
                  <button
                    key={presetName}
                    type="button"
                    onClick={() => applyPreset(presetName)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      eqSettings.preset === presetName
                        ? 'bg-[var(--sm-surface)] text-[var(--sm-text)] shadow-xs'
                        : 'text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
                    }`}
                  >
                    {presetName}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3 sm:gap-4 pt-2">
              {EQ_BANDS.map((band, idx) => {
                const db = eqSettings.bands[idx];
                return (
                  <div
                    key={band.freq}
                    className="flex flex-col items-center gap-2 py-3 px-2 rounded-lg bg-[var(--sm-bg)] border border-[var(--sm-border)]"
                  >
                    <span className="font-mono tabular-nums text-xs font-semibold text-[var(--sm-accent-text)]">
                      {db > 0 ? `+${db.toFixed(1)}` : db.toFixed(1)} dB
                    </span>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={db}
                      disabled={!eqSettings.enabled}
                      onChange={(e) => handleBandChange(idx, Number(e.target.value))}
                      aria-label={`${band.label} gain`}
                      className="soundmark-range w-full disabled:opacity-40"
                    />
                    <div className="text-center">
                      <div className="font-mono text-[11px] font-medium text-[var(--sm-text)]">
                        {band.label}
                      </div>
                      <div className="text-[10px] text-[var(--sm-text-muted)]">
                        {band.sub}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Playback Speed */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--sm-border)]">
              <span className="text-xs font-medium text-[var(--sm-text-sec)]">
                Tape / Playback Speed
              </span>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--sm-muted)]">
                {[0.75, 0.9, 1, 1.15, 1.25, 1.5].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => onUpdateEq({ ...eqSettings, playbackRate: rate })}
                    className={`px-2.5 py-1 rounded-md font-mono tabular-nums text-xs transition-colors ${
                      eqSettings.playbackRate === rate
                        ? 'bg-[var(--sm-surface)] text-[var(--sm-accent-text)] font-semibold'
                        : 'text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {/* Queue Crossfade Transition */}
            <div className="flex flex-col gap-3 pt-3 border-t border-[var(--sm-border)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight size={14} className="text-[var(--sm-text-muted)]" />
                  <span className="text-xs font-medium text-[var(--sm-text-sec)]">
                    Queue Crossfade Transition
                  </span>
                  {isCrossfading && (
                    <span className="text-[11px] font-mono text-[var(--sm-accent-text)]">
                      Blending...
                    </span>
                  )}
                </div>
                <span className="font-mono tabular-nums text-xs font-semibold text-[var(--sm-accent-text)]">
                  {crossfadeSec === 0 ? 'Off (Gapless)' : `${crossfadeSec}s overlap`}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={crossfadeSec}
                  onChange={(e) => onChangeCrossfade(Number(e.target.value))}
                  aria-label="Crossfade duration in seconds"
                  style={{
                    background: `linear-gradient(to right, var(--sm-accent) ${(crossfadeSec / 12) * 100}%, rgba(128,125,116,0.25) ${(crossfadeSec / 12) * 100}%)`,
                  }}
                  className="soundmark-range flex-1 h-1 rounded-full"
                />
                <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--sm-muted)] shrink-0">
                  {[0, 3, 5, 8, 12].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onChangeCrossfade(sec)}
                      className={`px-2 py-1 rounded-md font-mono tabular-nums text-[11px] transition-colors ${
                        crossfadeSec === sec
                          ? 'bg-[var(--sm-surface)] text-[var(--sm-accent-text)] font-semibold'
                          : 'text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
                      }`}
                    >
                      {sec === 0 ? 'Off' : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Liner Notes & Lyrics Panel */}
      {currentTrack && (
        <div className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--sm-border)] pb-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[var(--sm-accent-text)]" />
              <h3 className="font-display text-base font-semibold text-[var(--sm-text)]">
                Lyrics & Session Liner Notes
              </h3>
            </div>
            <span className="text-xs font-mono text-[var(--sm-text-muted)]">
              {currentTrack.license}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2 text-xs text-[var(--sm-text-sec)]">
              <div>
                <span className="text-[var(--sm-text-muted)]">Album / Release: </span>
                <span className="text-[var(--sm-text)] font-medium">
                  {currentTrack.album || 'Single Release'}
                </span>
              </div>
              <div>
                <span className="text-[var(--sm-text-muted)]">Origin: </span>
                <span className="text-[var(--sm-text)] font-medium">
                  {currentTrack.country}
                </span>
              </div>
              <div>
                <span className="text-[var(--sm-text-muted)]">Format / Stream: </span>
                <span className="text-[var(--sm-text)] font-medium">
                  {currentTrack.bitrateLabel || currentTrack.sourceLabel}
                </span>
              </div>
              {currentTrack.year && (
                <div>
                  <span className="text-[var(--sm-text-muted)]">Year: </span>
                  <span className="font-mono text-[var(--sm-text)]">
                    {currentTrack.year}
                  </span>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              {lyricsLoading ? (
                <p className="text-xs text-[var(--sm-text-muted)]">
                  Checking public lyric archive...
                </p>
              ) : lyrics ? (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--sm-text)] max-h-72 overflow-y-auto pr-2">
                  {lyrics}
                </pre>
              ) : (
                <div className="flex items-start gap-2.5 text-xs text-[#57554E] dark:text-[#A3A096] leading-relaxed">
                  <Sparkles size={15} className="shrink-0 mt-0.5 text-[#807D74]" />
                  <p>
                    No public lyric sheet is indexed for this instrumental or independent session. Use the Digital Store Links button to inspect official sleeve notes, lossless FLAC masters, and artist credits on Bandcamp or Qobuz.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
