import { useEffect, useState, type FormEvent } from 'react';
import {
  Film,
  Play,
  Pause,
  Search,
  Heart,
  ListPlus,
  Maximize2,
  RefreshCw,
  FileText,
  Check,
  Tv,
  Sparkles,
} from 'lucide-react';
import type { MusicTrack } from '../types/music';
import { formatDuration } from '../utils/formatters';
import { CoverArtwork } from './CoverArtwork';

interface VideosViewProps {
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  likedTrackIds: Set<string>;
  onWatchVideo: (video: MusicTrack, playlist: MusicTrack[]) => void;
  onTogglePlayPause: () => void;
  onOpenTheater: () => void;
  onToggleLike: (track: MusicTrack) => void;
  onAddToQueue: (track: MusicTrack) => void;
  onOpenLyrics: (track: MusicTrack) => void;
  onOpenLiveTv: () => void;
  onSelectArtist: (artistId: string, artistName?: string) => void;
  onCacheTracks: (tracks: MusicTrack[]) => void;
}

const VIDEO_CATEGORIES = [
  { id: 'all', label: 'All Videos' },
  { id: 'music_videos', label: 'Music Videos' },
  { id: 'rwanda', label: 'Rwanda Videos' },
  { id: 'live_sessions', label: 'Live Studio Sessions' },
  { id: 'cinema', label: 'Archive Cinema' },
] as const;

export function VideosView({
  currentTrack,
  isPlaying,
  likedTrackIds,
  onWatchVideo,
  onTogglePlayPause,
  onOpenTheater,
  onToggleLike,
  onAddToQueue,
  onOpenLyrics,
  onOpenLiveTv,
  onSelectArtist,
  onCacheTracks,
}: VideosViewProps) {
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [videos, setVideos] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [queuedId, setQueuedId] = useState<string | null>(null);

  const loadVideos = async (cat: string, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ category: cat });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/videos/catalog?${params.toString()}`);
      const data = await res.json();
      const list: MusicTrack[] = data.videos || [];
      setVideos(list);
      onCacheTracks(list);
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos(category, query);
  }, [category, query]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setQuery(draftQuery.trim());
  };

  const activeIsVideo = Boolean(currentTrack?.youtubeVideoId || currentTrack?.videoUrl);
  const spotlight = activeIsVideo ? currentTrack! : videos[0] || null;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--sm-border)] pb-5">
        <div>
          <p className="text-xs font-medium text-[var(--sm-text-muted)] mb-1">
            Widescreen Cinema &amp; Live Sessions
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--sm-text)]">
            Music Videos &amp; Cinema
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {videos.length > 0 && (
            <button
              type="button"
              onClick={() => onWatchVideo(videos[0], videos)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold hover:opacity-90 whitespace-nowrap"
            >
              <Play size={13} fill="currentColor" />
              <span>Play Video Mix ({videos.length})</span>
            </button>
          )}
          {activeIsVideo && (
            <button
              type="button"
              onClick={onOpenTheater}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)] text-xs font-semibold hover:opacity-90 whitespace-nowrap"
            >
              <Maximize2 size={13} />
              <span>Open Cinema Screen</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenLiveTv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-surface)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap"
          >
            <Tv size={13} />
            <span>Switch to Live TV</span>
          </button>
          <button
            type="button"
            onClick={() => loadVideos(category, query)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-surface)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Featured Spotlight Video Stage */}
      {spotlight && (
        <section className="rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 relative aspect-video lg:aspect-auto lg:min-h-[300px] bg-[#0B0C10] overflow-hidden group">
            <CoverArtwork
              src={spotlight.coverUrl}
              alt={spotlight.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              roundedClassName="rounded-none"
              sizeIcon={44}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10 flex flex-col justify-between p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-white/85">
                  {activeIsVideo && currentTrack?.id === spotlight.id
                    ? isPlaying
                      ? 'Now Playing Video'
                      : 'Paused Video'
                    : 'Featured Video Release'}
                </span>
                <span className="text-xs font-mono tabular-nums text-white/80">
                  {formatDuration(spotlight.durationSec)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (currentTrack?.id === spotlight.id) {
                      onOpenTheater();
                    } else {
                      onWatchVideo(spotlight, videos);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold shadow-lg hover:opacity-90 whitespace-nowrap"
                >
                  <Play size={14} fill="currentColor" />
                  <span>
                    {currentTrack?.id === spotlight.id ? 'Watch in Cinema Mode' : 'Play Video Now'}
                  </span>
                </button>
                {currentTrack?.id === spotlight.id && (
                  <button
                    type="button"
                    onClick={onTogglePlayPause}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-black/60 text-white border border-white/25 text-xs font-medium hover:bg-black/80"
                  >
                    {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                    <span>{isPlaying ? 'Pause' : 'Resume'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 p-6 sm:p-7 flex flex-col justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[var(--sm-accent-text)] font-medium">
                <Film size={14} />
                <span>{spotlight.genre}</span>
                <span aria-hidden="true">·</span>
                <span>{spotlight.country}</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--sm-text)] text-balance leading-snug">
                {spotlight.title}
              </h2>
              <p className="text-sm text-[var(--sm-text-sec)]">
                <button
                  type="button"
                  onClick={() =>
                    onSelectArtist(
                      spotlight.artistId || `artist-${encodeURIComponent(spotlight.artist)}`,
                      spotlight.artist,
                    )
                  }
                  className="hover:underline font-medium text-[var(--sm-text)]"
                >
                  {spotlight.artist}
                </button>
                <span aria-hidden="true"> · </span>
                <span>{spotlight.sourceLabel}</span>
              </p>
              <p className="text-xs text-[var(--sm-text-muted)] leading-relaxed pt-1">
                Watch in widescreen Cinema Mode with synchronized playback speed, instant lyrics lookup, queue auto-advance, and corner Picture-in-Picture docking.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-[var(--sm-border)]">
              <button
                type="button"
                onClick={() => onToggleLike(spotlight)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--sm-border)] text-xs font-medium transition-colors ${
                  likedTrackIds.has(spotlight.id)
                    ? 'text-[var(--sm-accent-text)] border-[var(--sm-accent)]'
                    : 'text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
                }`}
              >
                <Heart size={13} fill={likedTrackIds.has(spotlight.id) ? 'currentColor' : 'none'} />
                <span>{likedTrackIds.has(spotlight.id) ? 'Liked' : 'Like Video'}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenLyrics(spotlight)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
              >
                <FileText size={13} />
                <span>Lyrics &amp; Notes</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Search & Category Controls */}
      <div className="space-y-3">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--sm-text-muted)]"
            />
            <input
              type="text"
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
              placeholder="Search music videos, live concerts, Rwanda artists..."
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-[var(--sm-surface)] border border-[var(--sm-border)] text-sm text-[var(--sm-text)] placeholder:text-[var(--sm-text-muted)] focus:outline-none focus:border-[var(--sm-accent)]"
            />
          </div>
          <button
            type="submit"
            className="h-10 px-5 rounded-lg bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-medium whitespace-nowrap hover:opacity-90"
          >
            Search Videos
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          {VIDEO_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                category === cat.id
                  ? 'bg-[var(--sm-accent)] text-[var(--sm-on-accent)] border-[var(--sm-accent)] font-semibold'
                  : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Video Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="aspect-video rounded-2xl bg-[var(--sm-muted)]" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-12 text-center space-y-2">
          <Sparkles size={28} className="mx-auto text-[var(--sm-text-muted)]" />
          <p className="text-sm font-semibold text-[var(--sm-text)]">
            No videos found for your query
          </p>
          <p className="text-xs text-[var(--sm-text-sec)]">
            Try clearing your search or switching video categories above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((video) => {
            const isCurrent = currentTrack?.id === video.id;
            const isLiked = likedTrackIds.has(video.id);
            return (
              <div
                key={video.id}
                className={`group rounded-2xl border overflow-hidden flex flex-col justify-between transition-colors ${
                  isCurrent
                    ? 'border-[var(--sm-accent)] bg-[var(--sm-muted)]/75'
                    : 'border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-text-muted)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onWatchVideo(video, videos)}
                  className="text-left w-full block"
                >
                  <div className="relative aspect-video bg-[#0B0C10] overflow-hidden">
                    <CoverArtwork
                      src={video.coverUrl}
                      alt={video.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      roundedClassName="rounded-none"
                      sizeIcon={32}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end justify-between p-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-[11px] font-semibold opacity-95 group-hover:opacity-100">
                        {isCurrent && isPlaying ? (
                          <>
                            <Pause size={11} fill="currentColor" />
                            <span>Playing</span>
                          </>
                        ) : (
                          <>
                            <Play size={11} fill="currentColor" />
                            <span>Watch</span>
                          </>
                        )}
                      </span>
                      <span className="font-mono tabular-nums text-[11px] text-white/90 bg-black/65 px-2 py-0.5 rounded">
                        {formatDuration(video.durationSec)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 pb-2 space-y-1">
                    <h3 className="text-sm font-semibold text-[var(--sm-text)] line-clamp-2 leading-snug">
                      {video.title}
                    </h3>
                    <p className="text-xs text-[var(--sm-text-sec)] truncate">
                      {video.artist} · {video.genre} · {video.sourceLabel}
                    </p>
                  </div>
                </button>

                <div className="px-4 py-2.5 flex items-center justify-between border-t border-[var(--sm-border)]/70">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectArtist(
                        video.artistId || `artist-${encodeURIComponent(video.artist)}`,
                        video.artist,
                      )
                    }
                    className="text-xs font-medium text-[var(--sm-text-muted)] hover:text-[var(--sm-text)] truncate max-w-[160px]"
                  >
                    {video.artist}
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleLike(video)}
                      aria-label={isLiked ? 'Unlike video' : 'Like video'}
                      className={`p-1.5 rounded-md transition-colors ${
                        isLiked
                          ? 'text-[var(--sm-accent-text)]'
                          : 'text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]'
                      }`}
                    >
                      <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAddToQueue(video);
                        setQueuedId(video.id);
                        setTimeout(() => setQueuedId(null), 1200);
                      }}
                      title="Add video to queue"
                      aria-label="Add video to queue"
                      className="p-1.5 rounded-md text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]"
                    >
                      {queuedId === video.id ? (
                        <Check size={14} className="text-[#15803D] dark:text-emerald-400" />
                      ) : (
                        <ListPlus size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenLyrics(video)}
                      title="Lyrics & Notes"
                      aria-label="Lyrics and notes"
                      className="p-1.5 rounded-md text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]"
                    >
                      <FileText size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
