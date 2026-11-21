import { useEffect, useMemo, useState } from 'react';
import {
  Play,
  Pause,
  Compass,
  Tv,
  Trophy,
  Film,
  ArrowRight,
  SlidersHorizontal,
  Heart,
  Radio,
  Clock,
  CheckCircle2,
  Music2,
  BarChart3,
  Sparkles,
  Bot,
  MapPin,
  Box,
  Gamepad2,
} from 'lucide-react';
import type {
  AppView,
  DiscoverCatalog,
  LiveMatchItem,
  MusicTrack,
  PlayHistoryEntry,
  TvChannel,
} from '../types/music';
import { fetchLiveSportsScoreboard } from '../services/footballApi';
import { formatDuration } from '../utils/formatters';
import { CoverArtwork } from './CoverArtwork';
import { MatchDetailModal } from './MatchDetailModal';
import homeStudioHero from '../assets/images/home_studio_hero_1794734117319.jpg';

interface HomeViewProps {
  catalog: DiscoverCatalog | null;
  catalogLoading: boolean;
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  history: PlayHistoryEntry[];
  likedTracks: MusicTrack[];
  likedTrackIds: Set<string>;
  playlistCount: number;
  resolveTrack: (trackId: string) => MusicTrack | undefined;
  onNavigate: (view: AppView) => void;
  onPlayTrack: (track: MusicTrack, context?: MusicTrack[]) => void;
  onPlayAll: (tracks: MusicTrack[]) => void;
  onTogglePlayPause: () => void;
  onToggleLike: (track: MusicTrack) => void;
  onSelectArtist: (artistId: string, artistName?: string) => void;
  onWatchTvChannel: (channel: TvChannel) => void;
  onWatchMatchTv: (channel?: TvChannel) => void;
  onWatchVideo: (track: MusicTrack, context?: MusicTrack[]) => void;
}

function getGreetingLabel(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function loadPinnedMatches(): string[] {
  try {
    const raw = localStorage.getItem('soundmark_pinned_matches');
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function HomeView({
  catalog,
  catalogLoading,
  currentTrack,
  isPlaying,
  history,
  likedTracks,
  likedTrackIds,
  playlistCount,
  resolveTrack,
  onNavigate,
  onPlayTrack,
  onPlayAll,
  onTogglePlayPause,
  onToggleLike,
  onSelectArtist,
  onWatchTvChannel,
  onWatchMatchTv,
  onWatchVideo,
}: HomeViewProps) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [tvChannels, setTvChannels] = useState<TvChannel[]>([]);
  const [tvTotalCount, setTvTotalCount] = useState<number>(800);
  const [videos, setVideos] = useState<MusicTrack[]>([]);
  const [matches, setMatches] = useState<LiveMatchItem[]>([]);
  const [sportsChannels, setSportsChannels] = useState<TvChannel[]>([]);
  const [liveMatchCount, setLiveMatchCount] = useState<number>(0);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [mediaTab, setMediaTab] = useState<'tv' | 'videos'>('tv');
  const [selectedMatch, setSelectedMatch] = useState<LiveMatchItem | null>(null);
  const [pinnedMatchIds, setPinnedMatchIds] = useState<string[]>(loadPinnedMatches);

  useEffect(() => {
    localStorage.setItem('soundmark_pinned_matches', JSON.stringify(pinnedMatchIds));
  }, [pinnedMatchIds]);

  useEffect(() => {
    let active = true;

    fetch('/api/tv/channels?limit=5')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.channels)) setTvChannels(data.channels.slice(0, 5));
        if (typeof data.totalWorldwide === 'number' && data.totalWorldwide > 0) {
          setTvTotalCount(data.totalWorldwide);
        }
      })
      .catch(() => {});

    fetch('/api/videos/catalog?category=all')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.videos)) setVideos(data.videos.slice(0, 5));
      })
      .catch(() => {});

    setMatchesLoading(true);
    setMatchesError(null);
    fetchLiveSportsScoreboard()
      .then((data) => {
        if (!active) return;
        setMatches(data.matches.slice(0, 5));
        setLiveMatchCount(data.liveCount);
        setSportsChannels(data.sportsChannels);
      })
      .catch((err) => {
        if (!active) return;
        setMatchesError(err instanceof Error ? err.message : 'Unable to load live fixtures');
      })
      .finally(() => {
        if (active) setMatchesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const jumpBackTracks = useMemo(() => {
    const seen = new Set<string>();
    const list: MusicTrack[] = [];

    for (const item of history) {
      if (seen.has(item.trackId)) continue;
      const resolved = resolveTrack(item.trackId);
      if (resolved) {
        seen.add(resolved.id);
        list.push(resolved);
      }
      if (list.length >= 4) break;
    }

    if (list.length < 4) {
      for (const t of likedTracks) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        list.push(t);
        if (list.length >= 4) break;
      }
    }

    if (list.length === 0 && catalog?.trendingTracks) {
      return catalog.trendingTracks.slice(0, 4);
    }
    return list;
  }, [history, resolveTrack, likedTracks, catalog?.trendingTracks]);

  const hasPersonalHistory = history.length > 0 || likedTracks.length > 0;
  const trendingTracks = catalog?.trendingTracks || [];

  const handlePrimaryPlay = () => {
    if (currentTrack) {
      onTogglePlayPause();
      return;
    }
    if (jumpBackTracks.length > 0) {
      onPlayAll(jumpBackTracks);
      return;
    }
    if (trendingTracks.length > 0) {
      onPlayAll(trendingTracks);
    }
  };

  const handleTogglePinMatch = (matchId: string) => {
    setPinnedMatchIds((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [matchId, ...prev],
    );
  };

  const handleWatchMatchStream = () => {
    onWatchMatchTv(sportsChannels[0]);
  };

  const totalCatalogTracks = useMemo(() => {
    if (!catalog) return 0;
    const curatedCount = catalog.curatedPlaylists.reduce((sum, p) => sum + p.tracks.length, 0);
    return curatedCount + catalog.trendingTracks.length + catalog.liveStations.length;
  }, [catalog]);

  return (
    <div className="space-y-10 pb-12">
      {/* 1. Primary Home Stage */}
      <section className="grid grid-cols-1 lg:grid-cols-12 border border-[var(--sm-border)] rounded-2xl overflow-hidden bg-[var(--sm-surface)] items-stretch">
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between gap-8">
          <div className="space-y-4">
            <div className="text-xs font-mono tabular-nums text-[var(--sm-accent-text)] flex flex-wrap items-center gap-2">
              <span>{getGreetingLabel()}</span>
              <span aria-hidden="true">·</span>
              <span>{tvTotalCount.toLocaleString()}+ Live Channels</span>
              <span aria-hidden="true">·</span>
              <span>{liveMatchCount} Live Matches Now</span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.08] text-[var(--sm-text)] text-balance max-w-xl">
              Your global sound, live TV, and match studio.
            </h1>

            <p className="text-sm sm:text-base text-[var(--sm-text-sec)] max-w-xl leading-relaxed">
              Stream full-length independent albums, explore Rwandan &amp; global artists, tune into
              verified live world television, and follow real-time match scores in one quiet workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePrimaryPlay}
              disabled={!currentTrack && jumpBackTracks.length === 0 && trendingTracks.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap shrink-0"
            >
              {currentTrack && isPlaying ? (
                <Pause size={15} fill="currentColor" />
              ) : (
                <Play size={15} fill="currentColor" />
              )}
              <span>
                {currentTrack
                  ? isPlaying
                    ? 'Pause Playback'
                    : 'Resume Track'
                  : hasPersonalHistory
                    ? 'Resume Listening'
                    : 'Start Listening'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ type: 'discover' })}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)]/60 text-sm font-medium text-[var(--sm-text)] hover:border-[var(--sm-accent)] transition-colors whitespace-nowrap shrink-0"
            >
              <Compass size={15} />
              <span>Explore Discover</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ type: 'tv' })}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)]/60 text-sm font-medium text-[var(--sm-text)] hover:border-[var(--sm-accent)] transition-colors whitespace-nowrap shrink-0"
            >
              <Tv size={15} />
              <span>Live TV</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ type: 'matches' })}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)]/60 text-sm font-medium text-[var(--sm-text)] hover:border-[var(--sm-accent)] transition-colors whitespace-nowrap shrink-0"
            >
              <Trophy size={15} />
              <span>Live Matches</span>
            </button>
          </div>
        </div>

        <div className="relative lg:col-span-5 min-h-[250px] lg:min-h-[360px] border-t lg:border-t-0 lg:border-l border-[var(--sm-border)] overflow-hidden bg-[#141210]">
          {!heroImgFailed ? (
            <img
              src={homeStudioHero}
              alt="Minimalist warm wood high-fidelity listening studio with glowing tube amplifier and turntable"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover lg:h-full"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#231D18] via-[#171514] to-[#0D0D0C] flex items-center justify-center">
              <Music2 size={44} className="text-white/30" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 text-white flex items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] font-mono text-white/75">
                {currentTrack
                  ? `${isPlaying ? 'Now Playing' : 'Paused'} · ${currentTrack.sourceLabel}`
                  : 'Hi-Fi Listening Room · 5-Band EQ'}
              </div>
              <div className="font-display text-lg font-semibold leading-snug truncate">
                {currentTrack ? `${currentTrack.title} — ${currentTrack.artist}` : 'Ready for Studio Playback'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate({ type: 'listening_room' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-xs text-xs font-medium text-white whitespace-nowrap shrink-0 transition-colors"
            >
              <SlidersHorizontal size={13} />
              <span>Studio EQ</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Four-Column Live Destinations Strip */}
      <section aria-label="Soundmark Studios" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate({ type: 'discover' })}
          className="group p-5 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-accent)] transition-colors text-left flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between">
            <Compass size={18} className="text-[var(--sm-accent-text)]" />
            <ArrowRight
              size={14}
              className="text-[var(--sm-text-muted)] group-hover:text-[var(--sm-text)] group-hover:translate-x-0.5 transition-transform"
            />
          </div>
          <div className="space-y-1">
            <div className="font-mono tabular-nums text-2xl font-bold text-[var(--sm-text)]">
              {catalogLoading ? '—' : totalCatalogTracks.toLocaleString()}
            </div>
            <div className="text-sm font-semibold text-[var(--sm-text)]">Music &amp; Curated Sessions</div>
            <div className="text-xs text-[var(--sm-text-sec)]">
              Full-length vinyl mixes, global radio &amp; indie artists
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate({ type: 'tv' })}
          className="group p-5 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-accent)] transition-colors text-left flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between">
            <Tv size={18} className="text-[var(--sm-accent-text)]" />
            <ArrowRight
              size={14}
              className="text-[var(--sm-text-muted)] group-hover:text-[var(--sm-text)] group-hover:translate-x-0.5 transition-transform"
            />
          </div>
          <div className="space-y-1">
            <div className="font-mono tabular-nums text-2xl font-bold text-[var(--sm-text)]">
              {tvTotalCount.toLocaleString()}+
            </div>
            <div className="text-sm font-semibold text-[var(--sm-text)]">World Live TV</div>
            <div className="text-xs text-[var(--sm-text-sec)]">
              International news, music, culture &amp; cinema streams
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate({ type: 'matches' })}
          className="group p-5 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-accent)] transition-colors text-left flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between">
            <Trophy size={18} className="text-[var(--sm-accent-text)]" />
            <ArrowRight
              size={14}
              className="text-[var(--sm-text-muted)] group-hover:text-[var(--sm-text)] group-hover:translate-x-0.5 transition-transform"
            />
          </div>
          <div className="space-y-1">
            <div className="font-mono tabular-nums text-2xl font-bold text-[var(--sm-text)]">
              {matchesLoading ? '—' : liveMatchCount > 0 ? `${liveMatchCount} Live` : `${matches.length > 0 ? 'Today' : '0'}`}
            </div>
            <div className="text-sm font-semibold text-[var(--sm-text)]">Live Match TV &amp; Scores</div>
            <div className="text-xs text-[var(--sm-text-sec)]">
              Real-time football &amp; multi-sport stats, lineups &amp; channels
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate({ type: 'videos' })}
          className="group p-5 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-accent)] transition-colors text-left flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between">
            <Film size={18} className="text-[var(--sm-accent-text)]" />
            <ArrowRight
              size={14}
              className="text-[var(--sm-text-muted)] group-hover:text-[var(--sm-text)] group-hover:translate-x-0.5 transition-transform"
            />
          </div>
          <div className="space-y-1">
            <div className="font-mono tabular-nums text-2xl font-bold text-[var(--sm-text)]">
              {videos.length > 0 ? 'HD' : '—'}
            </div>
            <div className="text-sm font-semibold text-[var(--sm-text)]">Music Video Cinema</div>
            <div className="text-xs text-[var(--sm-text-sec)]">
              Widescreen music films, Kigali sessions &amp; corner mini-dock
            </div>
          </div>
        </button>
      </section>

      {/* 3. Jump Back In / Essential Listening */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--sm-text)]">
              {hasPersonalHistory ? 'Jump Back In' : 'Essential Listening Picks'}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
              {hasPersonalHistory
                ? 'Resume recent plays and favorites from your personal studio library'
                : 'Independent full-length tracks ready to stream immediately'}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-[var(--sm-text-sec)]">
            <button
              type="button"
              onClick={() => onNavigate({ type: 'rwanda' })}
              className="hover:text-[var(--sm-text)] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Rwanda Music
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ type: 'playlists' })}
              className="hover:text-[var(--sm-text)] hover:underline underline-offset-4 font-mono tabular-nums whitespace-nowrap shrink-0"
            >
              Playlists ({playlistCount})
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ type: 'browse' })}
              className="inline-flex items-center gap-1 text-[var(--sm-accent-text)] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              <span>Full Catalog</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {catalogLoading && jumpBackTracks.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-24 rounded-xl bg-[var(--sm-muted)]" />
            ))}
          </div>
        ) : jumpBackTracks.length === 0 ? (
          <div className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-[var(--sm-text-sec)]">
              Explore curated albums, Rwanda music, and live global radio to build your personal feed.
            </div>
            <button
              type="button"
              onClick={() => onNavigate({ type: 'browse' })}
              className="px-4 py-2 rounded-lg bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Browse Catalog
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {jumpBackTracks.map((track) => {
              const active = currentTrack?.id === track.id;
              const liked = likedTrackIds.has(track.id);
              return (
                <div
                  key={track.id}
                  className={`p-3.5 rounded-xl border transition-colors bg-[var(--sm-surface)] flex items-center gap-3 ${
                    active
                      ? 'border-[var(--sm-accent)]'
                      : 'border-[var(--sm-border)] hover:border-[var(--sm-text-muted)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      active ? onTogglePlayPause() : onPlayTrack(track, jumpBackTracks)
                    }
                    aria-label={active && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                    className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-[var(--sm-border)] group"
                  >
                    <CoverArtwork src={track.coverUrl} alt={track.title} roundedClassName="rounded-none" />
                    <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      {active && isPlaying ? (
                        <Pause size={16} fill="currentColor" />
                      ) : (
                        <Play size={16} fill="currentColor" />
                      )}
                    </span>
                  </button>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        active ? onTogglePlayPause() : onPlayTrack(track, jumpBackTracks)
                      }
                      className="text-left block w-full text-xs font-semibold text-[var(--sm-text)] truncate hover:text-[var(--sm-accent-text)]"
                    >
                      {track.title}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onSelectArtist(track.artistId || track.artist, track.artist)
                      }
                      className="text-left block w-full text-[11px] text-[var(--sm-text-sec)] truncate hover:underline"
                    >
                      {track.artist}
                    </button>
                    <div className="text-[11px] font-mono tabular-nums text-[var(--sm-text-muted)] truncate">
                      {track.genre} · {formatDuration(track.durationSec, track.isLive)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleLike(track)}
                    aria-label={liked ? `Unlike ${track.title}` : `Like ${track.title}`}
                    className={`p-1.5 rounded-md transition-colors shrink-0 ${
                      liked
                        ? 'text-[var(--sm-accent-text)]'
                        : 'text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]'
                    }`}
                  >
                    <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Live Matchday Desk & On-Air Broadcast Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Live & Upcoming Fixtures */}
        <div className="lg:col-span-7 border border-[var(--sm-border)] rounded-2xl bg-[var(--sm-surface)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--sm-border)] flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-[var(--sm-text)] truncate">
                Matchday Scoreboard
              </h2>
              <p className="text-xs text-[var(--sm-text-sec)] truncate">
                Real-time public football &amp; multi-sport fixtures
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate({ type: 'matches' })}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sm-accent-text)] hover:underline whitespace-nowrap shrink-0"
            >
              <span>All Matches</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {matchesLoading ? (
            <div className="divide-y divide-[var(--sm-border)] animate-pulse">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="px-5 py-4 h-16 bg-[var(--sm-bg)]/30" />
              ))}
            </div>
          ) : matchesError ? (
            <div className="p-6 text-xs text-[var(--sm-text-sec)] flex items-center justify-between gap-4">
              <span>{matchesError}</span>
              <button
                type="button"
                onClick={() => onNavigate({ type: 'matches' })}
                className="px-3 py-1.5 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text)] whitespace-nowrap shrink-0"
              >
                Open Match Center
              </button>
            </div>
          ) : matches.length === 0 ? (
            <div className="p-6 text-xs text-[var(--sm-text-sec)] flex items-center justify-between gap-4">
              <span>No fixtures scheduled right now. Open Match Center to filter leagues.</span>
              <button
                type="button"
                onClick={() => onNavigate({ type: 'matches' })}
                className="px-3 py-1.5 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text)] whitespace-nowrap shrink-0"
              >
                Open Match Center
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--sm-border)]">
              {matches.map((match) => {
                const showScore = match.statusState !== 'pre';
                return (
                  <div
                    key={match.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[var(--sm-bg)]/50 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedMatch(match)}
                      className="flex-1 min-w-0 text-left space-y-1"
                    >
                      <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-[var(--sm-text-muted)]">
                        {match.statusState === 'in' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#15803D] dark:text-emerald-400">
                            <Radio size={11} />
                            <span>LIVE · {match.statusDetail}</span>
                          </span>
                        ) : match.statusState === 'pre' ? (
                          <span className="inline-flex items-center gap-1 text-[var(--sm-accent-text)]">
                            <Clock size={11} />
                            <span>{match.statusDetail}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 size={11} />
                            <span>{match.statusDetail}</span>
                          </span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="truncate font-sans">{match.leagueShort}</span>
                      </div>

                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-semibold text-[var(--sm-text)] truncate">
                          {match.homeTeam.shortName || match.homeTeam.name} vs{' '}
                          {match.awayTeam.shortName || match.awayTeam.name}
                        </span>
                        <span className="font-mono tabular-nums font-bold text-[var(--sm-text)] shrink-0">
                          {showScore ? `${match.homeTeam.score} – ${match.awayTeam.score}` : 'vs'}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMatch(match)}
                      aria-label={`Inspect ${match.homeTeam.shortName} vs ${match.awayTeam.shortName}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] hover:border-[var(--sm-accent)] whitespace-nowrap shrink-0"
                    >
                      <BarChart3 size={12} />
                      <span>Stats</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: On Air TV & Music Videos Switcher */}
        <div className="lg:col-span-5 border border-[var(--sm-border)] rounded-2xl bg-[var(--sm-surface)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--sm-border)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--sm-bg)] border border-[var(--sm-border)]">
              <button
                type="button"
                onClick={() => setMediaTab('tv')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  mediaTab === 'tv'
                    ? 'bg-[var(--sm-surface)] text-[var(--sm-text)] shadow-2xs'
                    : 'text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
                }`}
              >
                Live TV
              </button>
              <button
                type="button"
                onClick={() => setMediaTab('videos')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  mediaTab === 'videos'
                    ? 'bg-[var(--sm-surface)] text-[var(--sm-text)] shadow-2xs'
                    : 'text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
                }`}
              >
                Music Videos
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigate({ type: mediaTab === 'tv' ? 'tv' : 'videos' })}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sm-accent-text)] hover:underline whitespace-nowrap shrink-0"
            >
              <span>{mediaTab === 'tv' ? 'TV Theatre' : 'All Videos'}</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {mediaTab === 'tv' ? (
            tvChannels.length === 0 ? (
              <div className="p-6 text-xs text-[var(--sm-text-sec)]">
                Loading live television channels...
              </div>
            ) : (
              <div className="divide-y divide-[var(--sm-border)]">
                {tvChannels.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => onWatchTvChannel(ch)}
                    className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--sm-bg)]/50 transition-colors"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-sm font-semibold text-[var(--sm-text)] truncate">
                        {ch.countryFlag} {ch.name}
                      </div>
                      <div className="text-[11px] text-[var(--sm-text-muted)] truncate">
                        {ch.countryName} · {ch.categories[0] || 'Broadcast'} · {ch.quality}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] whitespace-nowrap shrink-0">
                      <Play size={12} fill="currentColor" />
                      <span>Watch</span>
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : videos.length === 0 ? (
            <div className="p-6 text-xs text-[var(--sm-text-sec)]">
              Loading music video catalog...
            </div>
          ) : (
            <div className="divide-y divide-[var(--sm-border)]">
              {videos.map((vid) => (
                <button
                  key={vid.id}
                  type="button"
                  onClick={() => onWatchVideo(vid, videos)}
                  className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--sm-bg)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-8 shrink-0 rounded overflow-hidden border border-[var(--sm-border)]">
                      <CoverArtwork src={vid.coverUrl} alt={vid.title} roundedClassName="rounded-none" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--sm-text)] truncate">
                        {vid.title}
                      </div>
                      <div className="text-[11px] text-[var(--sm-text-muted)] truncate">
                        {vid.artist} · {formatDuration(vid.durationSec)}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] whitespace-nowrap shrink-0">
                    <Film size={12} />
                    <span>Play</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 6. Interactive Studios, Maps & 3D Stage */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--sm-text)]">
            Interactive Studio &amp; 3D Stage
          </h2>
          <p className="text-xs text-[var(--sm-text-sec)] mt-0.5">
            Compose tracks, edit artwork, chat with grounded search &amp; maps, inspect the 3D hi-fi console, or play Beat Stage 3D.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <button
            type="button"
            onClick={() => onNavigate({ type: 'ai_studio', initialTab: 'music' })}
            className="p-4 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-accent)] text-left space-y-2 transition-colors"
          >
            <Sparkles size={18} className="text-[var(--sm-accent-text)]" />
            <div className="text-sm font-semibold text-[var(--sm-text)]">Creative Studio</div>
            <div className="text-xs text-[var(--sm-text-sec)]">
              Music, artwork, video animation &amp; audio transcriber
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate({ type: 'assistant', initialMode: 'chat' })}
            className="p-4 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-accent)] text-left space-y-2 transition-colors"
          >
            <Bot size={18} className="text-[var(--sm-accent-text)]" />
            <div className="text-sm font-semibold text-[var(--sm-text)]">Studio Assistant</div>
            <div className="text-xs text-[var(--sm-text-sec)]">
              Multi-turn chat with Google Search &amp; Maps grounding
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate({ type: 'maps' })}
            className="p-4 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-accent)] text-left space-y-2 transition-colors"
          >
            <MapPin size={18} className="text-[var(--sm-accent-text)]" />
            <div className="text-sm font-semibold text-[var(--sm-text)]">Venue &amp; Stadium Map</div>
            <div className="text-xs text-[var(--sm-text-sec)]">
              Explore live concert arenas, studios &amp; football stadiums
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate({ type: 'stage_3d' })}
            className="p-4 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-accent)] text-left space-y-2 transition-colors"
          >
            <Box size={18} className="text-[var(--sm-accent-text)]" />
            <div className="text-sm font-semibold text-[var(--sm-text)]">3D Hi-Fi Stage</div>
            <div className="text-xs text-[var(--sm-text-sec)]">
              Orbitable turntable, tube amp &amp; audio-reactive EQ towers
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate({ type: 'game_3d' })}
            className="p-4 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-accent)] text-left space-y-2 transition-colors"
          >
            <Gamepad2 size={18} className="text-[var(--sm-accent-text)]" />
            <div className="text-sm font-semibold text-[var(--sm-text)]">Beat Stage 3D</div>
            <div className="text-xs text-[var(--sm-text-sec)]">
              Interactive 3D rhythm game with live leaderboard
            </div>
          </button>
        </div>
      </section>

      <MatchDetailModal
        match={selectedMatch}
        isPinned={selectedMatch ? pinnedMatchIds.includes(selectedMatch.id) : false}
        onTogglePin={handleTogglePinMatch}
        onWatchTv={handleWatchMatchStream}
        onClose={() => setSelectedMatch(null)}
      />
    </div>
  );
}
