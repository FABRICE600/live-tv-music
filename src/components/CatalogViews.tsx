import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Search,
  Play,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  Trash2,
  Download,
  Plus,
  ShoppingBag,
  Clock,
  Disc3,
} from 'lucide-react';
import type {
  ArtistSummary,
  MusicStoreDirectoryItem,
  MusicTrack,
  PlayHistoryEntry,
  UserPlaylist,
} from '../types/music';
import {
  exportPlaylistAsJson,
  exportPlaylistAsM3u,
  formatMinutesTotal,
} from '../utils/formatters';
import { CoverArtwork } from './CoverArtwork';
import { TrackTable } from './TrackTable';

const PLATFORMS = [
  'All Platforms',
  'Audius',
  'YouTube Music',
  'Global Radio',
  'Internet Archive',
  'Wikimedia Commons',
];

const GENRES = [
  'All Genres',
  'Afrobeats',
  'Afropop',
  'Amapiano',
  'Gakondo',
  'Gospel',
  'Electronic',
  'Ambient',
  'Jazz',
  'R&B',
  'Soul',
  'Hip-Hop',
  'Acoustic',
  'Classical',
  'Indie',
  'Pop',
  'Rock',
  'World',
];

const COUNTRIES = [
  'All Countries',
  'Rwanda',
  'United States',
  'United Kingdom',
  'Kenya',
  'Uganda',
  'Tanzania',
  'Nigeria',
  'Ghana',
  'South Africa',
  'DR Congo',
  'Japan',
  'Germany',
  'France',
  'Brazil',
  'Jamaica',
  'South Korea',
  'Spain',
  'India',
  'Iceland',
  'Canada',
  'Australia',
  'Global',
];

/* 1. Browse & Search Catalog View */
interface BrowseViewProps {
  initialGenre?: string;
  initialCountry?: string;
  initialPlatform?: string;
  initialQuery: string;
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
  onCacheTracks: (tracks: MusicTrack[]) => void;
}

export function BrowseView({
  initialGenre,
  initialCountry,
  initialPlatform,
  initialQuery,
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
  onCacheTracks,
}: BrowseViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [genre, setGenre] = useState(initialGenre || 'All Genres');
  const [country, setCountry] = useState(initialCountry || 'All Countries');
  const [platform, setPlatform] = useState(initialPlatform || 'All Platforms');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const executeSearch = async (qVal = query, gVal = genre, cVal = country, pVal = platform) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: qVal,
        genre: gVal,
        country: cVal,
        platform: pVal,
        limit: '36',
      });
      const res = await fetch(`/api/music/search?${params.toString()}`);
      const data = await res.json();
      const found: MusicTrack[] = data.tracks || [];
      setTracks(found);
      onCacheTracks(found);
    } catch {
      setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialGenre) setGenre(initialGenre);
  }, [initialGenre]);

  useEffect(() => {
    if (initialCountry) setCountry(initialCountry);
  }, [initialCountry]);

  useEffect(() => {
    if (initialPlatform) setPlatform(initialPlatform);
  }, [initialPlatform]);

  useEffect(() => {
    setQuery(initialQuery);
    executeSearch(initialQuery, genre, country, platform);
  }, [initialQuery]);

  useEffect(() => {
    executeSearch(query, genre, country, platform);
  }, [genre, country, platform]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    executeSearch(query, genre, country, platform);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--sm-border)] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--sm-text)]">
            Browse & Search Catalog
          </h1>
          <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
            Query full-length Audius masters, live international radio, open archives, or resolve Spotify links
          </p>
        </div>
        {tracks.length > 0 && (
          <button
            type="button"
            onClick={() => onPlayAll(tracks)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold hover:opacity-90 whitespace-nowrap"
          >
            <Play size={14} fill="currentColor" />
            <span>Play Results ({tracks.length})</span>
          </button>
        )}
      </div>

      {/* Search & Country Bar */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--sm-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search full-length tracks, artists, country, or paste open.spotify.com link..."
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-[var(--sm-surface)] border border-[var(--sm-border)] text-sm text-[var(--sm-text)] placeholder:text-[var(--sm-text-muted)] focus:outline-none focus:border-[var(--sm-accent)]"
          />
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label="Filter by country"
          className="h-10 px-3 rounded-lg bg-[var(--sm-surface)] border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text)] focus:outline-none focus:border-[var(--sm-accent)]"
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 px-5 rounded-lg bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-medium whitespace-nowrap hover:opacity-90"
        >
          Search
        </button>
      </form>

      {/* Segmented Platform & Genre Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[var(--sm-muted)] w-fit max-w-full">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                platform === p
                  ? 'bg-[var(--sm-surface)] text-[var(--sm-text)] shadow-xs'
                  : 'text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {GENRES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(g)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                genre === g
                  ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)]'
                  : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-14 rounded-lg bg-[var(--sm-muted)]" />
          ))}
        </div>
      ) : (
        <TrackTable
          tracks={tracks}
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
      )}
    </div>
  );
}

/* 2. Artists Directory View */
interface ArtistsViewProps {
  onSelectArtist: (artistId: string, artistName?: string) => void;
}

export function ArtistsView({ onSelectArtist }: ArtistsViewProps) {
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('All Countries');
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadArtists = async (qVal = query, cVal = country) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: qVal, country: cVal, limit: '20' });
      const res = await fetch(`/api/music/artists?${params.toString()}`);
      const data = await res.json();
      setArtists(data.artists || []);
    } catch {
      setArtists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArtists(query, country);
  }, [country]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    loadArtists(query, country);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="border-b border-[var(--sm-border)] pb-5">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--sm-text)]">
          Global Artists Directory
        </h1>
        <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
          Discover verified creators and independent musicians across every region
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--sm-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artist name, handle, or city..."
            className="w-full h-10 pl-10 pr-4 rounded-lg bg-[var(--sm-surface)] border border-[var(--sm-border)] text-sm text-[var(--sm-text)] placeholder:text-[var(--sm-text-muted)] focus:outline-none focus:border-[var(--sm-accent)]"
          />
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          aria-label="Filter artists by country"
          className="h-10 px-3 rounded-lg bg-[var(--sm-surface)] border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text)] focus:outline-none focus:border-[var(--sm-accent)]"
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 px-5 rounded-lg bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-medium whitespace-nowrap hover:opacity-90"
        >
          Filter Artists
        </button>
      </form>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="h-60 rounded-xl bg-[var(--sm-muted)]" />
          ))}
        </div>
      ) : artists.length === 0 ? (
        <div className="border border-[var(--sm-border)] rounded-xl p-10 text-center text-sm text-[var(--sm-text-sec)]">
          No artists matched your query.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {artists.map((artist) => (
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
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-[var(--sm-text)] truncate">
                    {artist.name}
                  </span>
                  {artist.verified && (
                    <CheckCircle2 size={13} className="text-[var(--sm-accent-text)] shrink-0" />
                  )}
                </div>
                <div className="text-xs text-[var(--sm-text-sec)] truncate">
                  {artist.location} · {artist.sourceLabel}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* 3. Artist Profile View */
interface ArtistProfileViewProps {
  artistId: string;
  artistName?: string;
  currentTrackId: string | null;
  isPlaying: boolean;
  likedTrackIds: Set<string>;
  userPlaylists: UserPlaylist[];
  onBack: () => void;
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
  onCacheTracks: (tracks: MusicTrack[]) => void;
}

export function ArtistProfileView({
  artistId,
  artistName,
  currentTrackId,
  isPlaying,
  likedTrackIds,
  userPlaylists,
  onBack,
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
  onCacheTracks,
}: ArtistProfileViewProps) {
  const [artist, setArtist] = useState<ArtistSummary | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [songDraft, setSongDraft] = useState('');
  const [submittedSong, setSubmittedSong] = useState('');

  useEffect(() => {
    setSongDraft('');
    setSubmittedSong('');
  }, [artistId, artistName]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ id: artistId });
    if (artistName) params.set('name', artistName);
    if (submittedSong) params.set('song', submittedSong);
    fetch(`/api/music/artist?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setArtist(data.artist || null);
        const list = data.tracks || [];
        setTracks(list);
        onCacheTracks(list);
      })
      .catch(() => {
        if (active) setTracks([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [artistId, artistName, submittedSong]);

  const visibleTracks = useMemo(() => {
    const q = songDraft.trim().toLowerCase();
    if (!q || submittedSong) return tracks;
    const matched = tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q)) ||
        t.genre.toLowerCase().includes(q),
    );
    return matched.length > 0 ? matched : tracks;
  }, [tracks, songDraft, submittedSong]);

  const handleSongSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmittedSong(songDraft.trim());
  };

  return (
    <div className="space-y-6 pb-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
      >
        <ArrowLeft size={14} />
        <span>Back</span>
      </button>

      {loading ? (
        <div className="h-48 rounded-xl bg-[var(--sm-muted)] animate-pulse" />
      ) : (
        <>
          <div className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-28 h-28 shrink-0 rounded-xl overflow-hidden border border-[var(--sm-border)]">
              <CoverArtwork
                src={artist?.avatarUrl || tracks[0]?.coverUrl}
                alt={artist?.name || artistName || 'Artist'}
                roundedClassName="rounded-none"
              />
            </div>
            <div className="space-y-2 flex-1 min-w-0">
              <div className="text-xs text-[var(--sm-text-muted)]">
                {artist?.sourceLabel || 'Catalog'}
                {artist?.genre ? ` · ${artist.genre}` : ''} · {artist?.location || 'Global'} ·{' '}
                <span className="font-mono tabular-nums">{tracks.length} Songs</span>
              </div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--sm-text)] truncate">
                  {artist?.name || artistName}
                </h1>
                {artist?.verified && (
                  <CheckCircle2 size={18} className="text-[var(--sm-accent-text)] shrink-0" />
                )}
              </div>
              {artist?.bio && (
                <p className="text-xs sm:text-sm text-[var(--sm-text-sec)] max-w-2xl line-clamp-2">
                  {artist.bio}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {visibleTracks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onPlayAll(visibleTracks)}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold hover:opacity-90"
                  >
                    <Play size={14} fill="currentColor" />
                    <span>Play All ({visibleTracks.length})</span>
                  </button>
                )}
                {tracks[0] && (
                  <button
                    type="button"
                    onClick={() => onOpenStoreModal(tracks[0])}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text)] hover:bg-[var(--sm-muted)]"
                  >
                    <ShoppingBag size={14} />
                    <span>Buy Lossless / Vinyl</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Search any specific song in this artist's discography */}
          <form onSubmit={handleSongSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--sm-text-muted)]"
              />
              <input
                type="text"
                value={songDraft}
                onChange={(e) => setSongDraft(e.target.value)}
                placeholder={`Search any song by ${artist?.name || artistName || 'this artist'}...`}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-[var(--sm-surface)] border border-[var(--sm-border)] text-xs text-[var(--sm-text)] placeholder:text-[var(--sm-text-muted)] focus:outline-none focus:border-[var(--sm-accent)]"
              />
            </div>
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-medium whitespace-nowrap hover:opacity-90"
            >
              Find Song
            </button>
            {(submittedSong || songDraft) && (
              <button
                type="button"
                onClick={() => {
                  setSongDraft('');
                  setSubmittedSong('');
                }}
                className="h-9 px-3.5 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-surface)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap"
              >
                All Songs
              </button>
            )}
          </form>

          <TrackTable
            tracks={visibleTracks}
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
            emptyMessage={`No songs found for ${artist?.name || artistName || 'this artist'}. Try searching a specific song title above.`}
          />
        </>
      )}
    </div>
  );
}

/* 4. Digital Stores Directory View */
interface StoresViewProps {
  stores: MusicStoreDirectoryItem[];
  onSearchCatalog: (query: string) => void;
}

export function StoresView({ stores, onSearchCatalog }: StoresViewProps) {
  const [storeQuery, setStoreQuery] = useState('');

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--sm-border)] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--sm-text)]">
            Digital Storefronts & Lossless Partners
          </h1>
          <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
            Direct links to DRM-free FLAC, 24-bit studio masters, vinyl pressings, and artist-first stores
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (storeQuery.trim()) onSearchCatalog(storeQuery.trim());
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={storeQuery}
            onChange={(e) => setStoreQuery(e.target.value)}
            placeholder="Lookup track in catalog..."
            className="h-9 px-3 rounded-lg bg-[var(--sm-surface)] border border-[var(--sm-border)] text-xs text-[var(--sm-text)] placeholder:text-[var(--sm-text-muted)] focus:outline-none focus:border-[var(--sm-accent)]"
          />
          <button
            type="submit"
            className="h-9 px-3.5 rounded-lg bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold whitespace-nowrap hover:opacity-90"
          >
            Find Tracks
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stores.map((store) => (
          <div
            key={store.id}
            className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono text-[var(--sm-text-muted)]">
                {store.category} · {store.formats}
              </div>
              <h2 className="font-display text-lg font-bold text-[var(--sm-text)]">
                {store.name}
              </h2>
              <p className="text-xs text-[var(--sm-text-sec)] leading-relaxed">
                {store.description}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[var(--sm-border)]">
              <a
                href={
                  storeQuery.trim()
                    ? store.searchTemplate.replace('{q}', encodeURIComponent(storeQuery.trim()))
                    : store.url
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--sm-accent-text)] hover:underline"
              >
                <span>{storeQuery.trim() ? `Search "${storeQuery.trim()}"` : `Visit ${store.name}`}</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 5. Listening History & Insights View */
interface HistoryViewProps {
  history: PlayHistoryEntry[];
  resolveTrack: (id: string) => MusicTrack | undefined;
  onPlayTrack: (track: MusicTrack) => void;
  onClearHistory: () => void;
}

export function HistoryView({
  history,
  resolveTrack,
  onPlayTrack,
  onClearHistory,
}: HistoryViewProps) {
  const stats = useMemo(() => {
    const totalSec = history.reduce((acc, h) => acc + (h.durationSec || 180), 0);
    const genreCounts: Record<string, number> = {};
    const countries = new Set<string>();
    for (const h of history) {
      genreCounts[h.genre] = (genreCounts[h.genre] || 0) + 1;
      if (h.country && h.country !== 'Global') countries.add(h.country);
    }
    const topGenre =
      Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    return {
      totalPlays: history.length,
      totalTime: formatMinutesTotal(totalSec),
      topGenre,
      countriesCount: countries.size,
    };
  }, [history]);

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--sm-border)] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--sm-text)]">
            Listening History & Insights
          </h1>
          <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
            Session log and regional listening breakdown stored locally in your browser
          </p>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-accent-text)]"
          >
            <Trash2 size={13} />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* 4-column summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Sessions Played', value: String(stats.totalPlays) },
          { label: 'Est. Catalog Runtime', value: stats.totalTime },
          { label: 'Primary Genre', value: stats.topGenre },
          { label: 'Regions Explored', value: String(stats.countriesCount) },
        ].map((item) => (
          <div
            key={item.label}
            className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-4 space-y-1"
          >
            <div className="text-xs text-[var(--sm-text-muted)]">{item.label}</div>
            <div className="font-display text-2xl font-bold font-mono tabular-nums text-[var(--sm-text)] truncate">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {history.length === 0 ? (
        <div className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-12 text-center space-y-2">
          <Clock size={26} className="mx-auto text-[var(--sm-text-muted)]" />
          <p className="text-sm font-medium text-[var(--sm-text)]">
            No playback history recorded yet
          </p>
          <p className="text-xs text-[var(--sm-text-sec)]">
            Tracks you listen to will appear here with instant replay.
          </p>
        </div>
      ) : (
        <div className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] divide-y divide-[var(--sm-border)]">
          {history.map((entry, idx) => {
            const cached = resolveTrack(entry.trackId);
            return (
              <div
                key={`${entry.trackId}-${idx}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--sm-muted)]/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden border border-[var(--sm-border)]">
                    <CoverArtwork src={entry.coverUrl} alt={entry.title} roundedClassName="rounded-none" sizeIcon={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--sm-text)] truncate">
                      {entry.title}
                    </div>
                    <div className="text-xs text-[var(--sm-text-sec)] truncate">
                      {entry.artist} · {entry.genre} · {entry.sourceLabel}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline font-mono tabular-nums text-xs text-[var(--sm-text-muted)]">
                    {new Date(entry.playedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {cached && (
                    <button
                      type="button"
                      onClick={() => onPlayTrack(cached)}
                      className="px-3 py-1.5 rounded-full bg-[var(--sm-muted)] text-xs font-medium text-[var(--sm-text)] hover:bg-[var(--sm-accent)] hover:text-[var(--sm-on-accent)] transition-colors"
                    >
                      Replay
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* 6. Liked Tracks View */
interface LikedViewProps {
  tracks: MusicTrack[];
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
}

export function LikedView(props: LikedViewProps) {
  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--sm-border)] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--sm-text)]">
            Liked Tracks
          </h1>
          <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
            {props.tracks.length} saved recordings in your personal collection
          </p>
        </div>
        {props.tracks.length > 0 && (
          <button
            type="button"
            onClick={() => props.onPlayAll(props.tracks)}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold hover:opacity-90"
          >
            <Play size={14} fill="currentColor" />
            <span>Play All Liked</span>
          </button>
        )}
      </div>

      <TrackTable
        {...props}
        emptyMessage="Tap the heart icon on any track to build your personal liked archive."
      />
    </div>
  );
}

/* 7. Playlists Overview & Custom Playlist Detail */
interface PlaylistsViewProps {
  playlists: UserPlaylist[];
  resolveTrack: (id: string) => MusicTrack | undefined;
  onCreatePlaylist: (name: string) => void;
  onOpenPlaylist: (playlistId: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onPlayAll: (tracks: MusicTrack[]) => void;
}

export function PlaylistsView({
  playlists,
  resolveTrack,
  onCreatePlaylist,
  onOpenPlaylist,
  onDeletePlaylist,
  onPlayAll,
}: PlaylistsViewProps) {
  const [name, setName] = useState('');

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreatePlaylist(name.trim());
    setName('');
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--sm-border)] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--sm-text)]">
            Your Playlists
          </h1>
          <p className="text-xs sm:text-sm text-[var(--sm-text-sec)]">
            Curate custom sequences and export them as JSON or M3U playlists
          </p>
        </div>

        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New playlist name..."
            className="h-9 px-3 rounded-lg bg-[var(--sm-surface)] border border-[var(--sm-border)] text-xs text-[var(--sm-text)] placeholder:text-[var(--sm-text-muted)] focus:outline-none focus:border-[var(--sm-accent)]"
          />
          <button
            type="submit"
            className="h-9 px-3.5 rounded-lg bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap hover:opacity-90"
          >
            <Plus size={14} />
            <span>Create</span>
          </button>
        </form>
      </div>

      {playlists.length === 0 ? (
        <div className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-12 text-center space-y-2">
          <Disc3 size={28} className="mx-auto text-[var(--sm-text-muted)]" />
          <p className="text-sm font-medium text-[var(--sm-text)]">
            No playlists created yet
          </p>
          <p className="text-xs text-[var(--sm-text-sec)]">
            Create a playlist above to organize tracks from any global source.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((pl) => {
            const tracks = pl.trackIds.map(resolveTrack).filter((t): t is MusicTrack => !!t);
            return (
              <div
                key={pl.id}
                className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-5 flex flex-col justify-between gap-4"
              >
                <button
                  type="button"
                  onClick={() => onOpenPlaylist(pl.id)}
                  className="text-left space-y-1"
                >
                  <div className="text-[11px] font-mono tabular-nums text-[var(--sm-text-muted)]">
                    {tracks.length} Tracks
                  </div>
                  <h2 className="font-display text-lg font-bold text-[var(--sm-text)] truncate">
                    {pl.name}
                  </h2>
                </button>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--sm-border)]">
                  <div className="flex items-center gap-3">
                    {tracks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onPlayAll(tracks)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sm-accent-text)] hover:underline"
                      >
                        <Play size={12} fill="currentColor" />
                        <span>Play</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenPlaylist(pl.id)}
                      className="text-xs text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
                    >
                      Open
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeletePlaylist(pl.id)}
                    aria-label={`Delete ${pl.name}`}
                    className="p-1.5 rounded text-[var(--sm-text-muted)] hover:text-[var(--sm-accent-text)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CustomPlaylistViewProps {
  playlist: UserPlaylist;
  tracks: MusicTrack[];
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
  onRemoveTrack: (playlistId: string, trackId: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
}

export function CustomPlaylistView({
  playlist,
  tracks,
  onPlayAll,
  onRemoveTrack,
  onDeletePlaylist,
  ...tableProps
}: CustomPlaylistViewProps) {
  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--sm-border)] pb-5">
        <div>
          <div className="text-xs font-mono tabular-nums text-[var(--sm-text-muted)]">
            Custom Playlist · {tracks.length} Tracks
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--sm-text)]">
            {playlist.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tracks.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => onPlayAll(tracks)}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold hover:opacity-90"
              >
                <Play size={14} fill="currentColor" />
                <span>Play All</span>
              </button>
              <button
                type="button"
                onClick={() => exportPlaylistAsJson(playlist.name, tracks)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
              >
                <Download size={13} />
                <span>JSON</span>
              </button>
              <button
                type="button"
                onClick={() => exportPlaylistAsM3u(playlist.name, tracks)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
              >
                <Download size={13} />
                <span>M3U</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onDeletePlaylist(playlist.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-muted)] hover:text-[var(--sm-accent-text)]"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      <TrackTable
        {...tableProps}
        tracks={tracks}
        onRemoveFromPlaylist={(trackId) => onRemoveTrack(playlist.id, trackId)}
        emptyMessage="This playlist is empty. Click the + icon on any track to add it here."
      />
    </div>
  );
}
