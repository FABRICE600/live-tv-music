import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Tv,
  Search,
  Radio,
  Heart,
  RefreshCw,
  Maximize2,
  ShieldCheck,
  Globe,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  PictureInPicture2,
  Play,
  Trophy,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type {
  LiveMatchItem,
  TvCategoryOption,
  TvChannel,
  TvCountryOption,
} from '../types/music';
import { CoverArtwork } from './CoverArtwork';
import { HlsVideoPlayer } from './HlsVideoPlayer';
import { fetchLiveSportsScoreboard } from '../services/footballApi';

const QUICK_FEATURED_CHANNELS: TvChannel[] = [
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
      'https://dash3.antik.sk/live/test_france24_eng/playlist.m3u8',
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
  {
    id: 'MagicSportTV.rw',
    name: 'Magic Sport TV (RBA)',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['sports', 'general'],
    logoUrl: '',
    streamUrl: 'https://5c46fa289c89f.streamlock.net/rtv25/rtv/playlist.m3u8',
    alternateUrls: [
      'https://5c46fa289c89f.streamlock.net/pub1live/mystream/playlist.m3u8',
      'https://bein-xtra-bein.amagi.tv/playlist.m3u8',
    ],
    quality: '720p',
    website: 'https://www.rba.co.rw/',
  },
  {
    id: 'Vevo90s00s.uk',
    name: "Vevo '90s & '00s",
    countryCode: 'GB',
    countryName: 'United Kingdom',
    countryFlag: '🇬🇧',
    categories: ['music'],
    logoUrl: '',
    streamUrl: 'https://d1cj21il6keqa2.cloudfront.net/playlist.m3u8',
    alternateUrls: ['https://d2n3779oy6efpi.cloudfront.net/playlist.m3u8'],
    quality: '1080p',
  },
];

interface LiveTvViewProps {
  initialQuery?: string;
  activeChannel: TvChannel | null;
  useProxyRelay: boolean;
  onSelectChannel: (channel: TvChannel) => void;
  onCloseChannel: () => void;
  onToggleProxyRelay: () => void;
  onEnableProxyRelay: () => void;
  onPopOutMiniPlayer: () => void;
  onPauseMusic: () => void;
  onOpenMatches?: () => void;
}

function loadTvFavorites(): string[] {
  try {
    const raw = localStorage.getItem('soundmark_tv_favorites');
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function LiveTvView({
  initialQuery = '',
  activeChannel,
  useProxyRelay,
  onSelectChannel,
  onCloseChannel,
  onToggleProxyRelay,
  onEnableProxyRelay,
  onPopOutMiniPlayer,
  onPauseMusic,
  onOpenMatches,
}: LiveTvViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [country, setCountry] = useState('ALL');
  const [category, setCategory] = useState('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [liveMatches, setLiveMatches] = useState<LiveMatchItem[]>([]);
  const [sportsChannels, setSportsChannels] = useState<TvChannel[]>([]);

  const [channels, setChannels] = useState<TvChannel[]>([]);
  const [countries, setCountries] = useState<TvCountryOption[]>([]);
  const [categories, setCategories] = useState<TvCategoryOption[]>([]);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [totalWorldwide, setTotalWorldwide] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [favoriteIds, setFavoriteIds] = useState<string[]>(loadTvFavorites);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerBoxRef = useRef<HTMLDivElement | null>(null);
  const userStoppedRef = useRef(false);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    localStorage.setItem('soundmark_tv_favorites', JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  const fetchChannels = useCallback(
    async (nextOffset = 0, append = false, batchLimit = 96) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          q: query.trim(),
          country,
          category,
          limit: String(batchLimit),
          offset: String(nextOffset),
        });
        if (verifiedOnly) params.set('verified', '1');
        const res = await fetch(`/api/tv/channels?${params.toString()}`);
        const data = await res.json();
        const incoming: TvChannel[] = data.channels || [];

        setChannels((prev) => {
          if (!append) return incoming;
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...incoming.filter((c) => !seen.has(c.id))];
        });
        setTotalFiltered(data.total || incoming.length);
        setTotalWorldwide(data.totalWorldwide || incoming.length);
        if (Array.isArray(data.countries) && data.countries.length > 0) {
          setCountries(data.countries);
        }
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
        }
        setOffset(nextOffset + incoming.length);
      } catch {
        if (!append) setChannels([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, country, category, verifiedOnly],
  );

  useEffect(() => {
    fetchChannels(0, false);
  }, [country, category, verifiedOnly, initialQuery]);

  // Automatically start live TV video playback on first visit so video is immediately visible
  useEffect(() => {
    if (!activeChannel && !userStoppedRef.current && !loading && channels.length > 0) {
      onSelectChannel(channels[0]);
    }
  }, [activeChannel, loading, channels, onSelectChannel]);

  // Fetch compact Live Scores & Match TV strip with 45s auto-refresh
  useEffect(() => {
    let active = true;
    const loadScores = () => {
      fetchLiveSportsScoreboard()
        .then((data) => {
          if (!active) return;
          if (Array.isArray(data.matches)) setLiveMatches(data.matches.slice(0, 6));
          if (Array.isArray(data.sportsChannels)) setSportsChannels(data.sportsChannels);
        })
        .catch(() => {});
    };
    loadScores();
    const timer = window.setInterval(loadScores, 45000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev],
    );
  };

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const displayedChannels = useMemo(() => {
    if (!favoritesOnly) return channels;
    return channels.filter((ch) => favoriteSet.has(ch.id));
  }, [channels, favoritesOnly, favoriteSet]);

  const activeListIndex = useMemo(() => {
    if (!activeChannel) return -1;
    return displayedChannels.findIndex((c) => c.id === activeChannel.id);
  }, [activeChannel, displayedChannels]);

  const handlePrevChannel = () => {
    const list = displayedChannels.length > 0 ? displayedChannels : QUICK_FEATURED_CHANNELS;
    if (activeListIndex > 0) {
      onSelectChannel(list[activeListIndex - 1]);
    } else {
      onSelectChannel(list[list.length - 1]);
    }
  };

  const handleNextChannel = () => {
    const list = displayedChannels.length > 0 ? displayedChannels : QUICK_FEATURED_CHANNELS;
    if (activeListIndex >= 0 && activeListIndex < list.length - 1) {
      onSelectChannel(list[activeListIndex + 1]);
    } else {
      onSelectChannel(list[0]);
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetchChannels(0, false);
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--sm-border)] pb-5">
        <div>
          <p className="text-xs font-medium text-[var(--sm-text-muted)] mb-1">
            Global TV Theatre ·{' '}
            <span className="font-mono tabular-nums">
              {totalWorldwide > 0 ? totalWorldwide.toLocaleString() : '800+'}
            </span>{' '}
            Live Channels Worldwide ·{' '}
            <span className="font-mono tabular-nums">{countries.length || '100+'}</span> Countries
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--sm-text)]">
            Watch Live TV
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCategory((c) => (c === 'sports' ? 'all' : 'sports'));
              setFavoritesOnly(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
              category === 'sports'
                ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)] font-semibold'
                : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
            }`}
          >
            <Trophy size={13} />
            <span>Live Match TV</span>
          </button>
          {onOpenMatches && (
            <button
              type="button"
              onClick={onOpenMatches}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-surface)] text-xs font-medium text-[var(--sm-text)] hover:border-[var(--sm-accent)] transition-colors whitespace-nowrap"
            >
              <Radio size={13} className="text-[#15803D] dark:text-emerald-400" />
              <span>Live Scores</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setCategory((c) => (c === 'music' ? 'all' : 'music'));
              setFavoritesOnly(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
              category === 'music'
                ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)]'
                : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
            }`}
          >
            <span>Music TV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCountry((c) => (c === 'RW' ? 'ALL' : 'RW'));
              setCategory('all');
              setFavoritesOnly(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
              country === 'RW'
                ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)]'
                : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
            }`}
          >
            <span>🇷🇼 Rwanda TV</span>
          </button>
          <button
            type="button"
            onClick={() => setVerifiedOnly((v) => !v)}
            title="Filter to fast live-checked HLS relays"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
              verifiedOnly
                ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)]'
                : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
            }`}
          >
            <ShieldCheck size={13} />
            <span>{verifiedOnly ? 'Verified Only' : 'All 800+ Channels'}</span>
          </button>
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
              favoritesOnly
                ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)]'
                : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
            }`}
          >
            <Heart size={13} fill={favoritesOnly ? 'currentColor' : 'none'} />
            <span>Saved ({favoriteIds.length})</span>
          </button>
          <button
            type="button"
            onClick={() => fetchChannels(0, false)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-surface)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Always-Visible Dedicated TV Video Viewing Screen */}
      <section className="border border-[var(--sm-border)] rounded-2xl bg-[var(--sm-surface)] overflow-hidden">
        <div ref={playerBoxRef} className="relative aspect-video bg-[#0E0E0D] w-full max-h-[540px]">
          {activeChannel ? (
            <HlsVideoPlayer
              streamUrl={activeChannel.streamUrl}
              alternateUrls={activeChannel.alternateUrls}
              embedUrl={activeChannel.embedUrl}
              channelName={activeChannel.name}
              useProxyRelay={useProxyRelay}
              onRequestProxyRelay={onEnableProxyRelay}
              onNextChannel={handleNextChannel}
              onPlaybackStart={onPauseMusic}
              videoRefExternal={videoRef}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-5 p-6 text-center bg-gradient-to-b from-[#171715] to-[#0E0E0D] text-[#F3F1EA]">
              <div className="w-14 h-14 rounded-2xl bg-[#232320] border border-[#34342F] flex items-center justify-center text-[var(--sm-accent-text)]">
                <Tv size={26} />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h2 className="font-display text-xl font-bold">TV Video Theatre Ready</h2>
                <p className="text-xs text-[#A3A096] leading-relaxed">
                  Pick a live international broadcast below or jump straight into a verified HD channel stream.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {QUICK_FEATURED_CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => onSelectChannel(ch)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#232320] hover:bg-[var(--sm-accent)] hover:text-[var(--sm-on-accent)] border border-[#34342F] text-xs font-medium text-[#F3F1EA] transition-colors"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>
                      {ch.countryFlag} {ch.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TV Screen Console Toolbar */}
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--sm-border)]">
          {activeChannel ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 shrink-0 rounded-lg overflow-hidden border border-[var(--sm-border)] bg-[var(--sm-bg)]">
                <CoverArtwork
                  src={activeChannel.logoUrl}
                  alt={activeChannel.name}
                  className="w-full h-full object-contain p-1"
                  roundedClassName="rounded-none"
                  sizeIcon={18}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg font-bold text-[var(--sm-text)] truncate">
                    {activeChannel.name}
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#15803D] dark:text-emerald-400 shrink-0">
                    <Radio size={11} />
                    LIVE
                  </span>
                </div>
                <p className="text-xs text-[var(--sm-text-sec)] truncate">
                  {activeChannel.countryFlag} {activeChannel.countryName} ·{' '}
                  {activeChannel.categories.join(', ')} · {activeChannel.quality}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[var(--sm-text-sec)]">
              No broadcast selected — choose any channel below to start live video playback.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Channel Zapper */}
            <div className="inline-flex items-center border border-[var(--sm-border)] rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={handlePrevChannel}
                title="Previous channel"
                aria-label="Previous TV channel"
                className="px-2.5 py-1.5 text-xs text-[var(--sm-text-sec)] hover:bg-[var(--sm-muted)] flex items-center gap-1"
              >
                <ChevronLeft size={14} />
                <span className="hidden sm:inline">Prev</span>
              </button>
              <button
                type="button"
                onClick={handleNextChannel}
                title="Next channel"
                aria-label="Next TV channel"
                className="px-2.5 py-1.5 text-xs text-[var(--sm-text-sec)] hover:bg-[var(--sm-muted)] border-l border-[var(--sm-border)] flex items-center gap-1"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {activeChannel && (
              <>
                <button
                  type="button"
                  onClick={onToggleProxyRelay}
                  title="Toggle CORS relay proxy if stream stalls"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                    useProxyRelay
                      ? 'border-[var(--sm-accent)] text-[var(--sm-accent-text)]'
                      : 'border-[var(--sm-border)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
                  }`}
                >
                  <ShieldCheck size={13} />
                  <span>{useProxyRelay ? 'Relay Active' : 'Direct Stream'}</span>
                </button>

                <button
                  type="button"
                  onClick={onPopOutMiniPlayer}
                  title="Dock as floating Mini TV screen while browsing"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap"
                >
                  <PictureInPicture2 size={14} />
                  <span className="hidden sm:inline">Mini Screen</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleFavorite(activeChannel.id)}
                  className={`p-2 rounded-lg border border-[var(--sm-border)] ${
                    favoriteSet.has(activeChannel.id)
                      ? 'text-[var(--sm-accent-text)]'
                      : 'text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
                  }`}
                  aria-label="Save channel"
                >
                  <Heart size={15} fill={favoriteSet.has(activeChannel.id) ? 'currentColor' : 'none'} />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    (videoRef.current?.requestFullscreen
                      ? videoRef.current.requestFullscreen()
                      : playerBoxRef.current?.requestFullscreen?.()
                    )?.catch(() => {})
                  }
                  aria-label="Fullscreen"
                  className="p-2 rounded-lg border border-[var(--sm-border)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
                >
                  <Maximize2 size={15} />
                </button>

                {activeChannel.website && (
                  <a
                    href={activeChannel.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-[var(--sm-border)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
                    aria-label="Official broadcaster site"
                  >
                    <ExternalLink size={15} />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    userStoppedRef.current = true;
                    onCloseChannel();
                  }}
                  aria-label="Stop live TV"
                  className="p-2 rounded-lg border border-[var(--sm-border)] text-[var(--sm-text-muted)] hover:text-[var(--sm-accent-text)]"
                >
                  <X size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Live & Upcoming Match Scores Strip */}
      {liveMatches.length > 0 && (
        <section className="space-y-3 border border-[var(--sm-border)] rounded-2xl bg-[var(--sm-surface)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy size={15} className="text-[var(--sm-accent-text)]" />
              <h2 className="font-display text-base font-bold text-[var(--sm-text)]">
                Live &amp; Upcoming Match Scores
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {sportsChannels.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    userStoppedRef.current = false;
                    onSelectChannel(sportsChannels[0]);
                  }}
                  className="text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap"
                >
                  Tune Sports TV ({sportsChannels[0].name})
                </button>
              )}
              {onOpenMatches && (
                <button
                  type="button"
                  onClick={onOpenMatches}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--sm-accent-text)] hover:underline whitespace-nowrap"
                >
                  <span>All Scores &amp; Match TV</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveMatches.map((m) => {
              const showScore = m.statusState !== 'pre';
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    if (sportsChannels.length > 0) {
                      userStoppedRef.current = false;
                      onSelectChannel(sportsChannels[0]);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (sportsChannels.length > 0) {
                        userStoppedRef.current = false;
                        onSelectChannel(sportsChannels[0]);
                      }
                    }
                  }}
                  className="cursor-pointer rounded-xl border border-[var(--sm-border)] bg-[var(--sm-bg)]/70 hover:border-[var(--sm-accent)] p-3 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
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
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--sm-text)] truncate">
                        {m.homeTeam.shortName || m.homeTeam.name}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-[var(--sm-text)]">
                        {showScore ? m.homeTeam.score : '–'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--sm-text)] truncate">
                        {m.awayTeam.shortName || m.awayTeam.name}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-[var(--sm-text)]">
                        {showScore ? m.awayTeam.score : '–'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Search & Country + Category Filters */}
      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--sm-text-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search TV channels by name, country, or genre..."
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-[var(--sm-surface)] border border-[var(--sm-border)] text-sm text-[var(--sm-text)] placeholder:text-[var(--sm-text-muted)] focus:outline-none focus:border-[var(--sm-accent)]"
            />
          </div>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="Filter TV channels by country"
            className="h-10 px-3 rounded-lg bg-[var(--sm-surface)] border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text)] sm:w-64 focus:outline-none focus:border-[var(--sm-accent)]"
          >
            <option value="ALL">All Countries Worldwide</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} ({c.count})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-10 px-5 rounded-lg bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-medium whitespace-nowrap hover:opacity-90"
          >
            Search TV
          </button>
        </form>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
              category === 'all'
                ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)]'
                : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
            }`}
          >
            All Categories
          </button>
          {categories.slice(0, 14).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                category === cat.id
                  ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)]'
                  : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Channels Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="h-28 rounded-xl bg-[var(--sm-muted)]" />
          ))}
        </div>
      ) : displayedChannels.length === 0 ? (
        <div className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-12 text-center space-y-2">
          <Globe size={28} className="mx-auto text-[var(--sm-text-muted)]" />
          <p className="text-sm font-medium text-[var(--sm-text)]">
            No live TV channels match your current filter
          </p>
          <p className="text-xs text-[var(--sm-text-sec)]">
            Try switching country to All Countries Worldwide or clearing your search query.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedChannels.map((ch) => {
              const isSelected = activeChannel?.id === ch.id;
              const isFav = favoriteSet.has(ch.id);
              return (
                <div
                  key={ch.id}
                  className={`border rounded-xl p-4 flex flex-col justify-between gap-3 transition-colors ${
                    isSelected
                      ? 'border-[var(--sm-accent)] bg-[var(--sm-muted)]'
                      : 'border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-text-muted)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectChannel(ch)}
                    className="flex items-start gap-3 text-left w-full"
                  >
                    <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-[var(--sm-border)] bg-[var(--sm-bg)]">
                      <CoverArtwork
                        src={ch.logoUrl}
                        alt={`${ch.name} logo`}
                        className="w-full h-full object-contain p-1"
                        roundedClassName="rounded-none"
                        sizeIcon={18}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#15803D] dark:text-emerald-400">
                        <Radio size={10} />
                        <span>LIVE · {ch.quality}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-[var(--sm-text)] truncate mt-0.5">
                        {ch.name}
                      </h3>
                      <p className="text-xs text-[var(--sm-text-sec)] truncate">
                        {ch.countryFlag} {ch.countryName} · {ch.categories[0] || 'general'}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--sm-border)]">
                    <button
                      type="button"
                      onClick={() => onSelectChannel(ch)}
                      className="text-xs font-medium text-[var(--sm-accent-text)] hover:underline"
                    >
                      {isSelected ? 'Watching Now' : 'Watch Live'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(ch.id)}
                      aria-label={isFav ? 'Remove from saved channels' : 'Save channel'}
                      className={`p-1 rounded ${
                        isFav
                          ? 'text-[var(--sm-accent-text)]'
                          : 'text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]'
                      }`}
                    >
                      <Heart size={14} fill={isFav ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {!favoritesOnly && channels.length < totalFiltered && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => fetchChannels(offset, true, 96)}
                className="px-5 py-2.5 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-surface)] text-xs font-medium text-[var(--sm-text)] hover:bg-[var(--sm-muted)] disabled:opacity-50 font-mono tabular-nums"
              >
                {loadingMore
                  ? 'Loading channels...'
                  : `Load More Channels (${channels.length.toLocaleString()} of ${totalFiltered.toLocaleString()})`}
              </button>
              {totalFiltered - channels.length > 96 && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchChannels(offset, true, 200)}
                  className="px-4 py-2.5 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)] text-xs font-medium text-[var(--sm-accent-text)] hover:border-[var(--sm-accent)] disabled:opacity-50 font-mono tabular-nums"
                >
                  Load +200
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
