import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Search,
  Play,
  CheckCircle2,
  Radio,
  Disc3,
  ArrowRight,
  Music2,
  UserPlus,
} from 'lucide-react';
import type { ArtistSummary, MusicTrack, UserPlaylist } from '../types/music';
import { CoverArtwork } from './CoverArtwork';
import { TrackTable } from './TrackTable';

interface RwandaMusicResponse {
  artists: ArtistSummary[];
  totalArtists: number;
  categories: string[];
  liveRadio: MusicTrack[];
  trendingTracks: MusicTrack[];
}

interface RwandaMusicViewProps {
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
  onSelectArtist: (artistId: string, artistName?: string) => void;
  onWatchVideo?: (track: MusicTrack, contextTracks?: MusicTrack[]) => void;
  resolvingVideoTrackId?: string | null;
  onSearchRwandaCatalog: (query: string) => void;
  onCacheTracks: (tracks: MusicTrack[]) => void;
}

const DEFAULT_CATEGORIES = [
  'All',
  'Afropop & R&B',
  'Hip-Hop & Kinyatrap',
  'Gakondo & Classics',
  'Gospel & Choirs',
  'DJs & Producers',
];

export function RwandaMusicView({
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
  onSelectArtist,
  onWatchVideo,
  resolvingVideoTrackId,
  onSearchRwandaCatalog,
  onCacheTracks,
}: RwandaMusicViewProps) {
  const [data, setData] = useState<RwandaMusicResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/music/rwanda')
      .then((r) => r.json())
      .then((res: RwandaMusicResponse) => {
        if (!active) return;
        setData(res);
        onCacheTracks([...(res.trendingTracks || []), ...(res.liveRadio || [])]);
      })
      .catch(() => {
        if (active) {
          setData({
            artists: [],
            totalArtists: 0,
            categories: DEFAULT_CATEGORIES,
            liveRadio: [],
            trendingTracks: [],
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onCacheTracks]);

  const categories = data?.categories?.length ? data.categories : DEFAULT_CATEGORIES;

  const filteredArtists = useMemo(() => {
    const list = data?.artists || [];
    const q = query.trim().toLowerCase();
    return list.filter((artist) => {
      const catOk =
        category === 'All' || (artist.genre || '').toLowerCase() === category.toLowerCase();
      if (!catOk) return false;
      if (!q) return true;
      return (
        artist.name.toLowerCase().includes(q) ||
        (artist.genre && artist.genre.toLowerCase().includes(q)) ||
        (artist.bio && artist.bio.toLowerCase().includes(q))
      );
    });
  }, [data?.artists, category, query]);

  const filteredTrending = useMemo(() => {
    const list = data?.trendingTracks || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q),
    );
  }, [data?.trendingTracks, query]);

  const handleLookupSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    if (filteredArtists.length === 1) {
      onSelectArtist(filteredArtists[0].id, filteredArtists[0].name);
      return;
    }
    if (filteredArtists.length === 0) {
      onSelectArtist(`rw-lookup-${encodeURIComponent(trimmed)}`, trimmed);
    }
  };

  return (
    <div className="space-y-10 pb-10">
      {/* Header */}
      <section className="border-b border-[var(--sm-border)] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs font-mono text-[var(--sm-text-muted)]">
            Rwanda Music Archive · {data?.totalArtists || 110}+ Verified Artists · Full Songs
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[var(--sm-text)]">
            Abahanzi bo mu Rwanda
          </h1>
          <p className="text-xs sm:text-sm text-[var(--sm-text-sec)] max-w-2xl leading-relaxed">
            Explore every Rwandan artist across Afropop, R&B, Kinyatrap, Hip-Hop, Gakondo heritage, Gospel choirs, and DJs — click any artist to stream their full catalog of songs.
          </p>
        </div>

        {data && data.trendingTracks.length > 0 && (
          <button
            type="button"
            onClick={() => onPlayAll(data.trendingTracks)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs sm:text-sm font-semibold hover:opacity-90 whitespace-nowrap shrink-0"
          >
            <Play size={15} fill="currentColor" />
            <span>Play Rwanda Top Mix</span>
          </button>
        )}
      </section>

      {/* Search & Custom Artist/Song Lookup */}
      <section className="space-y-4">
        <form onSubmit={handleLookupSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--sm-text-muted)]"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Shakisha umuhanzi cyangwa indirimbo (e.g. Bruce Melodie, Meddy, Cecile Kayirebwa, Bushali, Israel Mbonyi)..."
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-[var(--sm-surface)] border border-[var(--sm-border)] text-sm text-[var(--sm-text)] placeholder:text-[var(--sm-text-muted)] focus:outline-none focus:border-[var(--sm-accent)]"
            />
          </div>
          {query.trim() && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onSelectArtist(
                    filteredArtists[0]?.id || `rw-lookup-${encodeURIComponent(query.trim())}`,
                    filteredArtists[0]?.name || query.trim(),
                  )
                }
                className="h-10 px-4 rounded-lg bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap hover:opacity-90"
              >
                <UserPlus size={14} />
                <span>Open "{query.trim()}" Songs</span>
              </button>
              <button
                type="button"
                onClick={() => onSearchRwandaCatalog(query.trim())}
                className="h-10 px-4 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-surface)] text-xs font-medium text-[var(--sm-text)] inline-flex items-center gap-1.5 whitespace-nowrap hover:bg-[var(--sm-muted)]"
              >
                <Music2 size={14} />
                <span>Find Song</span>
              </button>
            </div>
          )}
        </form>

        {/* Genre / Era Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                  active
                    ? 'border-[var(--sm-accent)] bg-[var(--sm-accent)] text-[var(--sm-on-accent)] font-semibold'
                    : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Rwandan Artists Grid */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--sm-text)]">
              Rwandan Artists Directory ({filteredArtists.length})
            </h2>
            <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
              Select any artist card to load their full discography of complete tracks
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-[var(--sm-muted)]" />
            ))}
          </div>
        ) : filteredArtists.length === 0 ? (
          <div className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-8 text-center space-y-3">
            <Disc3 size={28} className="mx-auto text-[var(--sm-text-muted)]" />
            <div className="text-sm font-medium text-[var(--sm-text)]">
              No cached artist matched "{query}" in this category
            </div>
            <p className="text-xs text-[var(--sm-text-sec)]">
              You can still open any artist directly to resolve their full catalog of songs across Soundmark networks.
            </p>
            {query.trim() && (
              <button
                type="button"
                onClick={() =>
                  onSelectArtist(`rw-lookup-${encodeURIComponent(query.trim())}`, query.trim())
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold hover:opacity-90"
              >
                <span>Load All Songs for "{query.trim()}"</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredArtists.map((artist) => (
              <button
                key={artist.id}
                type="button"
                onClick={() => onSelectArtist(artist.id, artist.name)}
                className="group text-left border border-[var(--sm-border)] rounded-2xl bg-[var(--sm-surface)] p-4 flex items-start gap-3.5 hover:border-[var(--sm-accent)] transition-colors"
              >
                <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-[var(--sm-border)] bg-[var(--sm-muted)]">
                  <CoverArtwork
                    src={artist.avatarUrl}
                    alt={artist.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    roundedClassName="rounded-none"
                    sizeIcon={18}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-[var(--sm-text)] truncate group-hover:text-[var(--sm-accent-text)] transition-colors">
                      {artist.name}
                    </span>
                    {artist.verified && (
                      <CheckCircle2 size={13} className="text-[var(--sm-accent-text)] shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--sm-text-muted)] truncate">
                    {artist.genre || 'Rwandan Artist'} · {artist.location}
                  </div>
                  {artist.bio && (
                    <p className="text-xs text-[var(--sm-text-sec)] line-clamp-2 leading-snug">
                      {artist.bio}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Rwanda Top Songs Showcase */}
      {!loading && filteredTrending.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--sm-text)]">
                Indirimbo zikunzwe mu Rwanda ({filteredTrending.length})
              </h2>
              <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
                Full-length hits and classics ready for instant listening and queueing
              </p>
            </div>
            <button
              type="button"
              onClick={() => onPlayAll(filteredTrending)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--sm-accent-text)] hover:underline"
            >
              <Play size={13} fill="currentColor" />
              <span>Play All ({filteredTrending.length})</span>
            </button>
          </div>

          <TrackTable
            tracks={filteredTrending}
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
      )}

      {/* Live Rwanda FM Radio */}
      {!loading && data && data.liveRadio.length > 0 && (
        <section className="space-y-4 pt-2 border-t border-[var(--sm-border)]">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--sm-text)]">
              Radiyo zo mu Rwanda (Live FM)
            </h2>
            <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
              Real-time FM broadcasts direct from Kigali and across Rwanda
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.liveRadio.map((station) => {
              const active = currentTrackId === station.id;
              return (
                <button
                  key={station.id}
                  type="button"
                  onClick={() =>
                    active ? onTogglePlayPause() : onPlayTrack(station, data.liveRadio)
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
                      <span>LIVE · RWANDA</span>
                    </div>
                    <div className="text-sm font-semibold text-[var(--sm-text)] truncate">
                      {station.title}
                    </div>
                    <div className="text-xs text-[var(--sm-text-muted)] truncate">
                      {station.genre} · {station.bitrateLabel || 'Live FM'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
