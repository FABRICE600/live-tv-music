import { useEffect, useState, type FormEvent } from 'react';
import {
  Play,
  RefreshCw,
  ArrowLeft,
  Radio,
  ExternalLink,
  SlidersHorizontal,
  Link2,
  ArrowRight,
  CheckCircle2,
  Tv,
  Music2,
  Film,
  Trophy,
  Clock,
} from 'lucide-react';
import type {
  DiscoverCatalog,
  LiveMatchItem,
  MusicTrack,
  SpotifyCuratedPlaylist,
  TvChannel,
  UserPlaylist,
} from '../types/music';
import { formatDuration } from '../utils/formatters';
import { CoverArtwork } from './CoverArtwork';
import { TrackTable } from './TrackTable';
import { fetchLiveSportsScoreboard } from '../services/footballApi';

const FALLBACK_FEATURED_TV: TvChannel[] = [
  {
    id: 'France24.fr',
    name: 'France 24 English',
    countryCode: 'FR',
    countryName: 'France',
    countryFlag: '🇫🇷',
    categories: ['news'],
    logoUrl: '',
    streamUrl:
      'https://amg00106-amg00106c1-rakuten-uk-4654.playouts.now.amagi.tv/playlist/amg00106-france24fast-france24-rakutenuk/playlist.m3u8',
    alternateUrls: [
      'https://amg00106-france24-france24-samsunguk-qvpp8.amagi.tv/playlist/amg00106-france24-france24-samsunguk/playlist.m3u8',
    ],
    quality: '1080p',
  },
  {
    id: 'DWEnglish.de',
    name: 'DW English',
    countryCode: 'DE',
    countryName: 'Germany',
    countryFlag: '🇩🇪',
    categories: ['news', 'documentary'],
    logoUrl: '',
    streamUrl: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
    quality: '1080p',
  },
  {
    id: 'TRACEUK.uk',
    name: 'TRACE UK (Music)',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    countryFlag: '🇬🇧',
    categories: ['music', 'entertainment'],
    logoUrl: '',
    streamUrl: 'https://amg01131-tracetv-amg01131c5-stirr-us-4389.playouts.now.amagi.tv/playlist.m3u8',
    quality: '1080p',
  },
  {
    id: 'RwandaTV.rw',
    name: 'Rwanda TV',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['general', 'news'],
    logoUrl: '',
    streamUrl: 'https://5c46fa289c89f.streamlock.net/rtv25/rtv/playlist.m3u8',
    quality: '720p',
  },
];

interface DiscoverViewProps {
  catalog: DiscoverCatalog | null;
  loading: boolean;
  error: string | null;
  onRetry: (refresh?: boolean) => void;
  selectedCuratedId: string | null;
  onSelectCurated: (playlistId: string | null) => void;
  onOpenListeningRoom: () => void;
  onOpenLiveTv: () => void;
  onOpenMatches: () => void;
  onOpenVideos: () => void;
  onWatchTvChannel: (channel: TvChannel) => void;
  onWatchMatchTv?: (channel?: TvChannel) => void;
  onWatchVideo: (track: MusicTrack, contextTracks?: MusicTrack[]) => void;
  resolvingVideoTrackId?: string | null;
  onOpenStoresDirectory: () => void;
  onOpenArtistsDirectory: () => void;
  onOpenRwandaMusic: () => void;
  onSelectCountry: (country: string) => void;
  onSelectPlatform: (platform: string) => void;
  onSelectArtist: (artistId: string, artistName?: string) => void;
  currentTrackId: string | null;
  isPlaying: boolean;
  likedTrackIds: Set<string>;
  userPlaylists: UserPlaylist[];
  onPlayTrack: (track: MusicTrack, contextTracks?: MusicTrack[]) => void;
  onPlayAll: (tracks: MusicTrack[]) => void;
  onTogglePlayPause: () => void;
  onToggleLike: (track: MusicTrack) => void;
  onAddToPlaylist: (playlistId: string, track: MusicTrack) => void;
  onAddToQueue: (track: MusicTrack) => void;
  onOpenStoreModal: (track: MusicTrack) => void;
  onOpenLyrics: (track: MusicTrack) => void;
  onOpenSpotifyEmbed: (track: MusicTrack) => void;
  onOpenSpotifyPlaylistEmbed: (pl: SpotifyCuratedPlaylist) => void;
  onImportSpotifyUrl: (url: string) => void;
}

export function DiscoverView({
  catalog,
  loading,
  error,
  onRetry,
  selectedCuratedId,
  onSelectCurated,
  onOpenListeningRoom,
  onOpenLiveTv,
  onOpenMatches,
  onOpenVideos,
  onWatchTvChannel,
  onWatchMatchTv,
  onWatchVideo,
  resolvingVideoTrackId,
  onOpenStoresDirectory,
  onOpenArtistsDirectory,
  onOpenRwandaMusic,
  onSelectCountry,
  onSelectPlatform,
  onSelectArtist,
  currentTrackId,
  isPlaying,
  likedTrackIds,
  userPlaylists,
  onPlayTrack,
  onPlayAll,
  onTogglePlayPause,
  onToggleLike,
  onAddToPlaylist,
  onAddToQueue,
  onOpenStoreModal,
  onOpenLyrics,
  onOpenSpotifyEmbed,
  onOpenSpotifyPlaylistEmbed,
  onImportSpotifyUrl,
}: DiscoverViewProps) {
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [featuredTv, setFeaturedTv] = useState<TvChannel[]>(FALLBACK_FEATURED_TV);
  const [tvTotalCount, setTvTotalCount] = useState<number>(800);
  const [featuredVideos, setFeaturedVideos] = useState<MusicTrack[]>([]);
  const [featuredMatches, setFeaturedMatches] = useState<LiveMatchItem[]>([]);
  const [featuredSportsChannel, setFeaturedSportsChannel] = useState<TvChannel | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/tv/channels?limit=4')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.channels) && data.channels.length > 0) {
          setFeaturedTv(data.channels.slice(0, 4));
        }
        if (typeof data.totalWorldwide === 'number' && data.totalWorldwide > 0) {
          setTvTotalCount(data.totalWorldwide);
        }
      })
      .catch(() => {});

    fetch('/api/videos/catalog?category=all')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && Array.isArray(data?.videos)) {
          setFeaturedVideos(data.videos.slice(0, 4));
        }
      })
      .catch(() => {});

    fetchLiveSportsScoreboard()
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data.matches)) {
          setFeaturedMatches(data.matches.slice(0, 4));
        }
        if (Array.isArray(data.sportsChannels) && data.sportsChannels.length > 0) {
          setFeaturedSportsChannel(data.sportsChannels[0]);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  if (loading && !catalog) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-64 rounded-xl bg-[var(--sm-muted)]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-64 rounded-xl bg-[var(--sm-muted)]" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !catalog) {
    return (
      <div className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-10 text-center space-y-4">
        <h2 className="font-display text-xl font-bold text-[var(--sm-text)]">
          Unable to load discovery catalog
        </h2>
        <p className="text-sm text-[var(--sm-text-sec)]">{error}</p>
        <button
          type="button"
          onClick={() => onRetry(true)}
          className="px-5 py-2 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold hover:opacity-90"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!catalog) return null;

  // Curated Session Detail View
  if (selectedCuratedId) {
    const session = catalog.curatedPlaylists.find((c) => c.id === selectedCuratedId);
    if (session) {
      return (
        <div className="space-y-8 pb-8">
          <button
            type="button"
            onClick={() => onSelectCurated(null)}
            className="inline-flex items-center gap-2 text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
          >
            <ArrowLeft size={14} />
            <span>Back to Discover</span>
          </button>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-6">
            <div className="md:col-span-4 aspect-square rounded-lg overflow-hidden border border-[var(--sm-border)]">
              <CoverArtwork src={session.coverUrl} alt={session.title} roundedClassName="rounded-none" />
            </div>
            <div className="md:col-span-8 space-y-4">
              <div className="text-xs text-[var(--sm-text-muted)]">
                Curated Session · {session.genre} · {session.tracks.length} Full Tracks
              </div>
              <h1 className="font-display text-3xl font-bold text-[var(--sm-text)] text-balance">
                {session.title}
              </h1>
              <p className="text-sm text-[var(--sm-text-sec)] max-w-2xl leading-relaxed">
                {session.subtitle}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onPlayAll(session.tracks)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-sm font-semibold hover:opacity-90"
                >
                  <Play size={15} fill="currentColor" />
                  <span>Play All Tracks</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenListeningRoom}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--sm-border)] text-sm font-medium text-[var(--sm-text)] hover:bg-[var(--sm-muted)]"
                >
                  <SlidersHorizontal size={15} />
                  <span>Listening Room & EQ</span>
                </button>
              </div>
            </div>
          </div>

          <TrackTable
            tracks={session.tracks}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            likedTrackIds={likedTrackIds}
            userPlaylists={userPlaylists}
            onPlayTrack={onPlayTrack}
            onTogglePlayPause={onTogglePlayPause}
            onToggleLike={onToggleLike}
            onAddToPlaylist={onAddToPlaylist}
            onAddToQueue={onAddToQueue}
            onOpenStoreModal={onOpenStoreModal}
            onOpenLyrics={onOpenLyrics}
            onOpenSpotifyEmbed={onOpenSpotifyEmbed}
            onSelectArtist={onSelectArtist}
            onWatchVideo={onWatchVideo}
            resolvingVideoTrackId={resolvingVideoTrackId}
          />
        </div>
      );
    }
  }

  const handleSpotifySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!spotifyUrl.trim()) return;
    onImportSpotifyUrl(spotifyUrl.trim());
    setSpotifyUrl('');
  };

  return (
    <div className="space-y-12 pb-10">
      {/* 1. Architectural Nocturne Hero Stage */}
      <section className="grid grid-cols-1 lg:grid-cols-12 border border-[var(--sm-border)] rounded-2xl overflow-hidden bg-[var(--sm-surface)] items-stretch">
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between gap-8">
          <div className="space-y-4">
            <div className="text-xs font-mono text-[var(--sm-accent-text)]">
              Soundmark Studio Archive · Full-Length Worldwide Streaming
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.08] text-[var(--sm-text)] text-balance max-w-xl">
              {catalog.featuredTitle}
            </h1>
            <p className="text-sm sm:text-base text-[var(--sm-text-sec)] max-w-xl leading-relaxed">
              {catalog.featuredSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onPlayAll(catalog.trendingTracks)}
              disabled={catalog.trendingTracks.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap shrink-0"
            >
              <Play size={15} fill="currentColor" />
              <span>Play Trending Mix</span>
            </button>

            <button
              type="button"
              onClick={onOpenRwandaMusic}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--sm-border)] bg-[var(--sm-bg)]/60 text-sm font-medium text-[var(--sm-text)] hover:border-[var(--sm-accent)] transition-colors whitespace-nowrap shrink-0"
            >
              <Music2 size={15} />
              <span>Rwanda Artists</span>
            </button>

            <button
              type="button"
              onClick={onOpenListeningRoom}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--sm-border)] bg-[var(--sm-bg)]/60 text-sm font-medium text-[var(--sm-text)] hover:border-[var(--sm-accent)] transition-colors whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal size={15} />
              <span>Studio EQ</span>
            </button>

            <button
              type="button"
              onClick={onOpenVideos}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--sm-border)] bg-[var(--sm-bg)]/60 text-sm font-medium text-[var(--sm-text)] hover:border-[var(--sm-accent)] transition-colors whitespace-nowrap shrink-0"
            >
              <Film size={15} />
              <span>Music Videos</span>
            </button>

            <button
              type="button"
              onClick={onOpenLiveTv}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--sm-border)] bg-[var(--sm-bg)]/60 text-sm font-medium text-[var(--sm-text)] hover:border-[var(--sm-accent)] transition-colors whitespace-nowrap shrink-0"
            >
              <Tv size={15} />
              <span>Watch Live TV</span>
            </button>

            <button
              type="button"
              onClick={onOpenMatches}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--sm-border)] bg-[var(--sm-bg)]/60 text-sm font-medium text-[var(--sm-text)] hover:border-[var(--sm-accent)] transition-colors whitespace-nowrap shrink-0"
            >
              <Trophy size={15} />
              <span>Match TV &amp; Scores</span>
            </button>

            <button
              type="button"
              onClick={() => onRetry(true)}
              aria-label="Refresh live catalog"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] transition-colors whitespace-nowrap"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="relative lg:col-span-5 min-h-[240px] lg:min-h-[340px] border-t lg:border-t-0 lg:border-l border-[var(--sm-border)] overflow-hidden">
          <CoverArtwork
            src={catalog.heroImageUrl}
            alt="Minimalist architectural hi-fi listening room"
            className="w-full h-full object-cover lg:h-full"
            roundedClassName="rounded-none"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <div className="text-[11px] font-mono text-white/75">
              5-Band EQ · Equal-Power Crossfade
            </div>
            <div className="font-display text-lg font-semibold leading-snug">
              Curated Albums, Live World Radio &amp; TV
            </div>
          </div>
        </div>
      </section>

      {/* 2. Curated Editorial Sessions */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--sm-text)]">
              Curated Vinyl & Studio Sessions
            </h2>
            <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
              Full-length genre collections sourced across independent streaming networks
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {catalog.curatedPlaylists.map((session) => (
            <div
              key={session.id}
              className="group border border-[var(--sm-border)] rounded-2xl bg-[var(--sm-surface)] overflow-hidden flex flex-col justify-between hover:border-[var(--sm-accent)] transition-colors"
            >
              <button
                type="button"
                onClick={() => onSelectCurated(session.id)}
                className="text-left block w-full"
              >
                <div className="aspect-square overflow-hidden border-b border-[var(--sm-border)]">
                  <CoverArtwork
                    src={session.coverUrl}
                    alt={session.title}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    roundedClassName="rounded-none"
                  />
                </div>
                <div className="p-4 space-y-1.5">
                  <div className="text-[11px] font-mono text-[var(--sm-text-muted)]">
                    {session.genre} · {session.tracks.length} Tracks
                  </div>
                  <h3 className="font-display text-base font-bold text-[var(--sm-text)] leading-snug">
                    {session.title}
                  </h3>
                  <p className="text-xs text-[var(--sm-text-sec)] line-clamp-2">
                    {session.subtitle}
                  </p>
                </div>
              </button>
              <div className="px-4 pb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onPlayAll(session.tracks)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--sm-accent-text)] hover:underline"
                >
                  <Play size={13} fill="currentColor" />
                  <span>Play Session</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectCurated(session.id)}
                  className="text-xs text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]"
                >
                  Tracklist
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Trending Full-Length Tracks */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--sm-text)]">
              Trending Full-Length Streams
            </h2>
            <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
              Complete end-to-end tracks with 5-band parametric EQ, crossfade, and direct storefront access
            </p>
          </div>
          <button
            type="button"
            onClick={() => onPlayAll(catalog.trendingTracks)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--sm-accent-text)] hover:underline"
          >
            <Play size={13} fill="currentColor" />
            <span>Queue & Play All</span>
          </button>
        </div>

        <TrackTable
          tracks={catalog.trendingTracks}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          likedTrackIds={likedTrackIds}
          userPlaylists={userPlaylists}
          onPlayTrack={onPlayTrack}
          onTogglePlayPause={onTogglePlayPause}
          onToggleLike={onToggleLike}
          onAddToPlaylist={onAddToPlaylist}
          onAddToQueue={onAddToQueue}
          onOpenStoreModal={onOpenStoreModal}
          onOpenLyrics={onOpenLyrics}
          onOpenSpotifyEmbed={onOpenSpotifyEmbed}
          onSelectArtist={onSelectArtist}
          onWatchVideo={onWatchVideo}
          resolvingVideoTrackId={resolvingVideoTrackId}
        />
      </section>

      {/* 4. Live Global Radio Stations */}
      {catalog.liveStations.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--sm-text)]">
              Live World Radio Relays
            </h2>
            <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
              Real-time FM and internet broadcasts streamed directly from international stations
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {catalog.liveStations.map((station) => {
              const active = currentTrackId === station.id;
              return (
                <button
                  key={station.id}
                  type="button"
                  onClick={() =>
                    active ? onTogglePlayPause() : onPlayTrack(station, catalog.liveStations)
                  }
                  className={`text-left p-4 rounded-xl border transition-colors flex items-center gap-3.5 ${
                    active
                      ? 'border-[var(--sm-accent)] bg-[var(--sm-muted)]'
                      : 'border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-text-muted)]'
                  }`}
                >
                  <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-[var(--sm-border)]">
                    <CoverArtwork
                      src={station.coverUrl}
                      alt={station.title}
                      roundedClassName="rounded-none"
                      sizeIcon={18}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#15803D] dark:text-emerald-400">
                      <Radio size={11} />
                      <span>LIVE · {station.country}</span>
                    </div>
                    <div className="text-sm font-semibold text-[var(--sm-text)] truncate">
                      {station.title}
                    </div>
                    <div className="text-xs text-[var(--sm-text-muted)] truncate">
                      {station.genre} · {station.bitrateLabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 4a. Featured Music Videos & Cinema */}
      {featuredVideos.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--sm-text)]">
                Music Videos &amp; Cinema
              </h2>
              <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
                Official music videos, Rwanda visuals, and studio sessions in widescreen Cinema Mode
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenVideos}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sm-accent-text)] hover:underline whitespace-nowrap shrink-0"
            >
              <span>All Music Videos</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredVideos.map((vid) => (
              <button
                key={vid.id}
                type="button"
                onClick={() => onWatchVideo(vid, featuredVideos)}
                className="group text-left rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-accent)] transition-colors overflow-hidden flex flex-col"
              >
                <div className="relative aspect-video bg-[#0B0C10] overflow-hidden">
                  <CoverArtwork
                    src={vid.coverUrl}
                    alt={vid.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    roundedClassName="rounded-none"
                    sizeIcon={24}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end justify-between p-2.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-[11px] font-semibold">
                      <Play size={10} fill="currentColor" />
                      <span>Watch Video</span>
                    </span>
                    <span className="font-mono tabular-nums text-[11px] text-white/90 bg-black/65 px-1.5 py-0.5 rounded">
                      {formatDuration(vid.durationSec)}
                    </span>
                  </div>
                </div>
                <div className="p-3.5 space-y-0.5">
                  <div className="text-sm font-semibold text-[var(--sm-text)] line-clamp-1">
                    {vid.title}
                  </div>
                  <div className="text-xs text-[var(--sm-text-muted)] truncate">
                    {vid.artist} · {vid.genre}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 4b. Live World TV Video Channels */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--sm-text)]">
              Live TV Video Broadcasts
            </h2>
            <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
              Watch <span className="font-mono tabular-nums">{tvTotalCount.toLocaleString()}+</span> live international news, music, sports, and documentary streams in the TV Theatre
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenLiveTv}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sm-accent-text)] hover:underline whitespace-nowrap shrink-0"
          >
            <span>Browse All {tvTotalCount.toLocaleString()}+ Channels</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredTv.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => onWatchTvChannel(ch)}
              className="text-left p-4 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-text-muted)] transition-colors flex items-center gap-3.5"
            >
              <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-[var(--sm-border)] bg-[var(--sm-bg)]">
                <CoverArtwork
                  src={ch.logoUrl}
                  alt={ch.name}
                  className="w-full h-full object-contain p-1"
                  roundedClassName="rounded-none"
                  sizeIcon={18}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#15803D] dark:text-emerald-400">
                  <Tv size={11} />
                  <span>VIDEO · {ch.quality}</span>
                </div>
                <div className="text-sm font-semibold text-[var(--sm-text)] truncate">
                  {ch.name}
                </div>
                <div className="text-xs text-[var(--sm-text-muted)] truncate">
                  {ch.countryFlag} {ch.countryName} · {ch.categories[0] || 'live'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 4c. Live Scores & Match TV */}
      {featuredMatches.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--sm-text)]">
                Live Scores &amp; Match TV
              </h2>
              <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
                Real-time football, NBA, NFL, and NHL scores paired with live Sports TV broadcasts
              </p>
            </div>
            <div className="flex items-center gap-4">
              {featuredSportsChannel && onWatchMatchTv && (
                <button
                  type="button"
                  onClick={() => onWatchMatchTv(featuredSportsChannel)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--sm-text)] hover:text-[var(--sm-accent-text)] whitespace-nowrap"
                >
                  <Tv size={13} />
                  <span>Watch Match TV</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenMatches}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sm-accent-text)] hover:underline whitespace-nowrap shrink-0"
              >
                <span>Full Scoreboard</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredMatches.map((m) => {
              const showScore = m.statusState !== 'pre';
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={onOpenMatches}
                  className="text-left p-4 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-accent)] transition-colors flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] pb-2 border-b border-[var(--sm-border)] w-full">
                    <span className="text-[var(--sm-text-muted)] truncate">{m.leagueShort}</span>
                    {m.isLive ? (
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-[#15803D] dark:text-emerald-400 shrink-0">
                        <Radio size={10} />
                        <span>LIVE · {m.statusDetail}</span>
                      </span>
                    ) : m.statusState === 'pre' ? (
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[var(--sm-accent-text)] shrink-0">
                        <Clock size={10} />
                        <span>{m.statusDetail}</span>
                      </span>
                    ) : (
                      <span className="font-mono tabular-nums text-[var(--sm-text-muted)] shrink-0">
                        FINAL
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 w-full text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--sm-text)] truncate">
                        {m.homeTeam.shortName || m.homeTeam.name}
                      </span>
                      <span className="font-mono tabular-nums text-base font-bold text-[var(--sm-text)]">
                        {showScore ? m.homeTeam.score : '–'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--sm-text)] truncate">
                        {m.awayTeam.shortName || m.awayTeam.name}
                      </span>
                      <span className="font-mono tabular-nums text-base font-bold text-[var(--sm-text)]">
                        {showScore ? m.awayTeam.score : '–'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. Spotify Playlists & URL Importer */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--sm-text)]">
              Spotify Editorial & URL Importer
            </h2>
            <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
              Listen via embedded Spotify players or paste any Spotify track/playlist URL to resolve across Soundmark
            </p>
          </div>

          <form onSubmit={handleSpotifySubmit} className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Link2
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sm-text-muted)]"
              />
              <input
                type="url"
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
                placeholder="Paste open.spotify.com URL..."
                className="w-full h-9 pl-8 pr-3 rounded-lg bg-[var(--sm-surface)] border border-[var(--sm-border)] text-xs text-[var(--sm-text)] placeholder:text-[var(--sm-text-muted)] focus:outline-none focus:border-[var(--sm-accent)]"
              />
            </div>
            <button
              type="submit"
              className="h-9 px-3.5 rounded-lg bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-medium whitespace-nowrap hover:opacity-90"
            >
              Import
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {catalog.spotifyPlaylists.map((pl) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => onOpenSpotifyPlaylistEmbed(pl)}
              className="text-left border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-4 flex items-center gap-3.5 hover:border-[var(--sm-text-muted)] transition-colors"
            >
              <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-[var(--sm-border)]">
                <CoverArtwork src={pl.coverUrl} alt={pl.title} roundedClassName="rounded-none" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-[var(--sm-text-muted)]">{pl.curator}</div>
                <div className="text-sm font-semibold text-[var(--sm-text)] truncate">
                  {pl.title}
                </div>
                <div className="inline-flex items-center gap-1 text-xs text-[var(--sm-accent-text)] mt-1">
                  <span>Open Embed</span>
                  <ExternalLink size={11} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 6. Featured Global Artists */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--sm-text)]">
              Featured Global Artists
            </h2>
            <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
              Explore artist profiles, regional scenes, and direct discographies
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onOpenRwandaMusic}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sm-accent-text)] hover:underline whitespace-nowrap"
            >
              <span>Rwanda Artists (110+)</span>
              <ArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={onOpenArtistsDirectory}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] hover:underline whitespace-nowrap"
            >
              <span>All Artists</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {catalog.featuredArtists.slice(0, 5).map((artist) => (
            <button
              key={artist.id}
              type="button"
              onClick={() => onSelectArtist(artist.id, artist.name)}
              className="text-left border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-4 space-y-3 hover:border-[var(--sm-text-muted)] transition-colors"
            >
              <div className="aspect-square rounded-lg overflow-hidden border border-[var(--sm-border)]">
                <CoverArtwork
                  src={artist.avatarUrl}
                  alt={artist.name}
                  className="w-full h-full object-cover"
                  roundedClassName="rounded-none"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-[var(--sm-text)] truncate">
                    {artist.name}
                  </span>
                  {artist.verified && (
                    <CheckCircle2 size={13} className="text-[var(--sm-accent-text)] shrink-0" />
                  )}
                </div>
                <div className="text-xs text-[var(--sm-text-muted)] truncate">
                  {artist.location} · {artist.sourceLabel}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 7. Country & Platform Launchers + Store Directory CTA */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 border-t border-[var(--sm-border)]">
        <div className="space-y-3">
          <h3 className="font-display text-base font-bold text-[var(--sm-text)]">
            Explore by Country & Scene
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {catalog.countries
              .filter((c) => c !== 'All Countries')
              .map((country) => (
                <button
                  key={country}
                  type="button"
                  onClick={() => onSelectCountry(country)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--sm-surface)] border border-[var(--sm-border)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] hover:border-[var(--sm-text-muted)] transition-colors whitespace-nowrap"
                >
                  {country}
                </button>
              ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-[var(--sm-text)]">
              Source Networks & Storefronts
            </h3>
            <button
              type="button"
              onClick={onOpenStoresDirectory}
              className="text-xs font-medium text-[var(--sm-accent-text)] hover:underline"
            >
              Open Stores Directory
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {catalog.platforms
              .filter((p) => p !== 'All Platforms')
              .map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => onSelectPlatform(platform)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--sm-surface)] border border-[var(--sm-border)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] hover:border-[var(--sm-text-muted)] transition-colors whitespace-nowrap"
                >
                  {platform}
                </button>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}
