import { useEffect, useState } from 'react';
import {
  X,
  ExternalLink,
  ShoppingBag,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import type { MusicTrack, SpotifyEmbedTarget } from '../types/music';
import { formatDuration } from '../utils/formatters';
import { CoverArtwork } from './CoverArtwork';

/* 1. Store Links Modal */
interface StoreLinksModalProps {
  track: MusicTrack | null;
  onClose: () => void;
}

export function StoreLinksModal({ track, onClose }: StoreLinksModalProps) {
  if (!track) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Digital Store Links"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-6 space-y-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-[var(--sm-border)]">
              <CoverArtwork src={track.coverUrl} alt={track.title} roundedClassName="rounded-none" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-[var(--sm-accent-text)] font-medium">
                <ShoppingBag size={13} />
                <span>Direct Digital Storefronts</span>
              </div>
              <h3 className="font-display text-lg font-bold text-[var(--sm-text)] truncate">
                {track.title}
              </h3>
              <p className="text-xs text-[var(--sm-text-sec)] truncate">
                {track.artist} · {track.license}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close store links"
            className="p-1.5 rounded-md text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="divide-y divide-[var(--sm-border)] border border-[var(--sm-border)] rounded-lg">
          {track.storeLinks.map((store) => (
            <a
              key={store.id}
              href={store.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--sm-muted)]/60 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--sm-text)]">
                  {store.name}
                </div>
                <div className="text-xs text-[var(--sm-text-sec)] truncate">
                  {store.tagline}
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--sm-accent-text)] shrink-0">
                <span>Open</span>
                <ExternalLink size={13} />
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/* 2. Spotify Embed Modal */
interface SpotifyEmbedModalProps {
  target: SpotifyEmbedTarget | null;
  onClose: () => void;
}

export function SpotifyEmbedModal({ target, onClose }: SpotifyEmbedModalProps) {
  if (!target) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Spotify Player"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-6 space-y-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-[var(--sm-text)] truncate">
              {target.title}
            </h3>
            <p className="text-xs text-[var(--sm-text-sec)] truncate">{target.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Spotify player"
            className="p-1.5 rounded-md text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]"
          >
            <X size={18} />
          </button>
        </div>

        <iframe
          src={target.embedUrl}
          width="100%"
          height={target.isPlaylist ? 380 : 152}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title={target.title}
          className="rounded-lg border border-[var(--sm-border)]"
        />

        <div className="flex items-center justify-end gap-3">
          <a
            href={target.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold hover:opacity-90"
          >
            <span>Open in Spotify</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}

/* 3. Lyrics & Liner Notes Modal */
interface LyricsModalProps {
  track: MusicTrack | null;
  onClose: () => void;
}

export function LyricsModal({ track, onClose }: LyricsModalProps) {
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!track) return;
    let active = true;
    setLoading(true);
    setLyrics(null);
    fetch(
      `/api/music/lyrics?artist=${encodeURIComponent(track.artist)}&title=${encodeURIComponent(track.title)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (active) setLyrics(data.lyrics || null);
      })
      .catch(() => {
        if (active) setLyrics(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [track?.id]);

  if (!track) return null;

  const copyDetails = () => {
    const text = `${track.title} — ${track.artist} (${track.sourceLabel} · ${track.country})`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Lyrics and Liner Notes"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-6 space-y-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--sm-border)] pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 shrink-0 rounded-md overflow-hidden border border-[var(--sm-border)]">
              <CoverArtwork src={track.coverUrl} alt={track.title} roundedClassName="rounded-none" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-[var(--sm-accent-text)] font-medium">
                <FileText size={13} />
                <span>Lyrics & Liner Metadata</span>
              </div>
              <h3 className="font-display text-lg font-bold text-[var(--sm-text)] truncate">
                {track.title}
              </h3>
              <p className="text-xs text-[var(--sm-text-sec)] truncate">
                {track.artist} · {track.album || 'Single'} · {track.country}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close lyrics modal"
            className="p-1.5 rounded-md text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-xs text-[var(--sm-text-muted)] py-6 text-center">
              Looking up lyric archive...
            </p>
          ) : lyrics ? (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--sm-text)]">
              {lyrics}
            </pre>
          ) : (
            <div className="py-4 space-y-2 text-xs text-[var(--sm-text-sec)] leading-relaxed">
              <p>
                Lyrics are unavailable for this instrumental, live broadcast, or independent master.
              </p>
              <div className="pt-2 border-t border-[var(--sm-border)] space-y-1">
                <div>
                  <span className="text-[var(--sm-text-muted)]">Source Platform: </span>
                  <span className="text-[var(--sm-text)]">{track.sourceLabel}</span>
                </div>
                <div>
                  <span className="text-[var(--sm-text-muted)]">License & Stream: </span>
                  <span className="text-[var(--sm-text)]">{track.license}</span>
                </div>
                <div>
                  <span className="text-[var(--sm-text-muted)]">Duration: </span>
                  <span className="font-mono text-[var(--sm-text)]">
                    {formatDuration(track.durationSec, track.isLive)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[var(--sm-border)]">
          <button
            type="button"
            onClick={copyDetails}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
          >
            {copied ? <Check size={13} className="text-[#15803D]" /> : <Copy size={13} />}
            <span>{copied ? 'Copied track info' : 'Copy track info'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* 4. Reorderable Queue Drawer */
interface QueueDrawerProps {
  open: boolean;
  onClose: () => void;
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  currentIndex: number;
  onPlayQueueIndex: (idx: number) => void;
  onMoveQueueItem: (fromIdx: number, toIdx: number) => void;
  onRemoveFromQueue: (idx: number) => void;
  onClearUpcoming: () => void;
}

export function QueueDrawer({
  open,
  onClose,
  currentTrack,
  queue,
  currentIndex,
  onPlayQueueIndex,
  onMoveQueueItem,
  onRemoveFromQueue,
  onClearUpcoming,
}: QueueDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative z-10 w-full max-w-md h-full bg-[var(--sm-surface)] border-l border-[var(--sm-border)] flex flex-col shadow-2xl">
        <div className="h-16 shrink-0 px-5 flex items-center justify-between border-b border-[var(--sm-border)]">
          <div>
            <h2 className="font-display text-base font-bold text-[var(--sm-text)]">
              Playback Queue
            </h2>
            <p className="text-xs font-mono tabular-nums text-[var(--sm-text-muted)]">
              {queue.length} tracks
            </p>
          </div>
          <div className="flex items-center gap-2">
            {queue.length > currentIndex + 1 && (
              <button
                type="button"
                onClick={onClearUpcoming}
                className="px-2.5 py-1 rounded-md text-xs text-[var(--sm-text-sec)] hover:bg-[var(--sm-muted)]"
              >
                Clear upcoming
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close queue"
              className="p-1.5 rounded-md text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {queue.length === 0 ? (
            <p className="text-xs text-[var(--sm-text-muted)] text-center py-12">
              Your playback queue is empty.
            </p>
          ) : (
            queue.map((track, idx) => {
              const isCurrent = idx === currentIndex && currentTrack?.id === track.id;
              return (
                <div
                  key={`${track.id}-${idx}`}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                    isCurrent
                      ? 'border-[var(--sm-accent)] bg-[var(--sm-muted)]'
                      : 'border-[var(--sm-border)] bg-[var(--sm-bg)]/70'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onPlayQueueIndex(idx)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                  >
                    <div className="w-9 h-9 shrink-0 rounded overflow-hidden border border-[var(--sm-border)]">
                      <CoverArtwork src={track.coverUrl} alt={track.title} roundedClassName="rounded-none" sizeIcon={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-xs font-semibold truncate ${
                          isCurrent
                            ? 'text-[var(--sm-accent-text)]'
                            : 'text-[var(--sm-text)]'
                        }`}
                      >
                        {track.title}
                      </div>
                      <div className="text-[11px] text-[var(--sm-text-sec)] truncate">
                        {track.artist} · {formatDuration(track.durationSec, track.isLive)}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onMoveQueueItem(idx, idx - 1)}
                      aria-label="Move up"
                      className="p-1 rounded text-[var(--sm-text-muted)] hover:text-[var(--sm-text)] disabled:opacity-25"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === queue.length - 1}
                      onClick={() => onMoveQueueItem(idx, idx + 1)}
                      aria-label="Move down"
                      className="p-1 rounded text-[var(--sm-text-muted)] hover:text-[var(--sm-text)] disabled:opacity-25"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFromQueue(idx)}
                      aria-label="Remove from queue"
                      className="p-1 rounded text-[var(--sm-text-muted)] hover:text-[var(--sm-accent-text)]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
