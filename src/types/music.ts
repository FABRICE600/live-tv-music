export interface StoreLink {
  id: string;
  name: string;
  tagline: string;
  url: string;
}

export interface MusicStoreDirectoryItem {
  id: string;
  name: string;
  category: string;
  formats: string;
  description: string;
  url: string;
  searchTemplate: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artistHandle?: string;
  artistLocation?: string;
  artistAvatar?: string;
  artistVerified?: boolean;
  album?: string;
  genre: string;
  country: string;
  durationSec: number;
  audioUrl: string;
  coverUrl: string;
  year?: string;
  license: string;
  sourceLabel: string;
  isPreview?: boolean;
  isLive?: boolean;
  bitrateLabel?: string;
  youtubeVideoId?: string;
  videoUrl?: string;
  isVideo?: boolean;
  spotifyId?: string;
  spotifyUrl?: string;
  spotifyEmbedUrl?: string;
  priceLabel?: string;
  storeLinks: StoreLink[];
}

export interface CuratedPlaylist {
  id: string;
  title: string;
  subtitle: string;
  genre: string;
  coverUrl: string;
  tracks: MusicTrack[];
}

export interface SpotifyCuratedPlaylist {
  id: string;
  title: string;
  subtitle: string;
  curator: string;
  coverUrl: string;
  spotifyEmbedUrl: string;
  spotifyUrl: string;
}

export interface ArtistSummary {
  id: string;
  name: string;
  handle?: string;
  location: string;
  avatarUrl: string;
  verified: boolean;
  bio?: string;
  genre?: string;
  sourceLabel: string;
  trackCount?: number;
  followerCount?: number;
  topTracks: MusicTrack[];
}

export interface DiscoverCatalog {
  featuredTitle: string;
  featuredSubtitle: string;
  heroImageUrl: string;
  curatedPlaylists: CuratedPlaylist[];
  spotifyPlaylists: SpotifyCuratedPlaylist[];
  trendingTracks: MusicTrack[];
  liveStations: MusicTrack[];
  featuredArtists: ArtistSummary[];
  countries: string[];
  platforms: string[];
  genres: string[];
  musicStores: MusicStoreDirectoryItem[];
}

export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  trackIds: string[];
}

export interface PlayHistoryEntry {
  trackId: string;
  title: string;
  artist: string;
  genre: string;
  country: string;
  sourceLabel: string;
  coverUrl: string;
  durationSec: number;
  playedAt: string;
}

export interface EqSettings {
  enabled: boolean;
  preset: string;
  bands: [number, number, number, number, number]; // 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz in dB (-12 to +12)
  playbackRate: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

export type SleepTimerMode = 'off' | '15' | '30' | '45' | '60' | 'track';

export interface TvChannel {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  categories: string[];
  logoUrl: string;
  streamUrl: string;
  alternateUrls?: string[];
  embedUrl?: string;
  quality: string;
  website?: string;
}

export interface TvCountryOption {
  code: string;
  name: string;
  flag: string;
  count: number;
}

export interface TvCategoryOption {
  id: string;
  name: string;
  count: number;
}

export interface LiveMatchTeam {
  name: string;
  shortName: string;
  abbr: string;
  logoUrl: string;
  score: string;
  record?: string;
}

export interface LiveMatchHighlight {
  clock: string;
  text: string;
  teamAbbr?: string;
}

export interface LiveMatchStat {
  label: string;
  homeValue: string;
  awayValue: string;
}

export interface LiveMatchPeriodScore {
  period: string;
  home: string;
  away: string;
}

export interface LiveMatchRosterPlayer {
  name: string;
  jersey?: string;
  position?: string;
  starter?: boolean;
}

export interface LiveMatchDetails {
  stats: LiveMatchStat[];
  highlights: LiveMatchHighlight[];
  homeLineup: LiveMatchRosterPlayer[];
  awayLineup: LiveMatchRosterPlayer[];
}

export interface LiveMatchItem {
  id: string;
  sport: 'soccer' | 'basketball' | 'football' | 'hockey';
  leagueId: string;
  leagueName: string;
  leagueShort: string;
  statusState: 'in' | 'pre' | 'post';
  statusDetail: string;
  isLive: boolean;
  startTime: string;
  venue?: string;
  broadcasts: string[];
  homeTeam: LiveMatchTeam;
  awayTeam: LiveMatchTeam;
  highlights: LiveMatchHighlight[];
  stats?: LiveMatchStat[];
  periodScores?: LiveMatchPeriodScore[];
}

export interface LiveScoresResponse {
  updatedAt: string;
  liveCount: number;
  matches: LiveMatchItem[];
  sportsChannels: TvChannel[];
}

export type AppView =
  | { type: 'home' }
  | { type: 'discover' }
  | { type: 'curated'; playlistId: string }
  | { type: 'browse'; initialGenre?: string; initialCountry?: string; initialPlatform?: string }
  | { type: 'artists' }
  | { type: 'rwanda' }
  | { type: 'artist_profile'; artistId: string; artistName?: string }
  | { type: 'videos' }
  | { type: 'tv' }
  | { type: 'matches' }
  | { type: 'listening_room' }
  | { type: 'ai_studio'; initialTab?: 'music' | 'image' | 'video' | 'transcribe' }
  | { type: 'assistant'; initialMode?: 'chat' | 'search' | 'maps'; initialPrompt?: string }
  | { type: 'maps' }
  | { type: 'stage_3d' }
  | { type: 'game_3d' }
  | { type: 'stores' }
  | { type: 'history' }
  | { type: 'liked' }
  | { type: 'playlists' }
  | { type: 'custom_playlist'; playlistId: string };

export interface SpotifyEmbedTarget {
  title: string;
  subtitle: string;
  embedUrl: string;
  externalUrl: string;
  isPlaylist?: boolean;
}

export type SurfaceMode = 'paper' | 'ivory' | 'midnight' | 'slate';
export type AccentMode = 'vermilion' | 'cobalt' | 'emerald' | 'amber' | 'plum';

