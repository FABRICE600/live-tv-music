import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Tv,
  Trophy,
  Radio,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  PictureInPicture2,
  Maximize2,
  X,
  Play,
  ArrowRight,
  MapPin,
  Star,
  BarChart3,
} from 'lucide-react';
import type { LiveMatchItem, TvChannel } from '../types/music';
import {
  fetchLiveFootballMatches,
  fetchLiveSportsScoreboard,
} from '../services/footballApi';
import { CoverArtwork } from './CoverArtwork';
import { HlsVideoPlayer } from './HlsVideoPlayer';
import { LiveScoreWidget } from './LiveScoreWidget';
import { MatchDetailModal } from './MatchDetailModal';

interface LiveMatchViewProps {
  activeChannel: TvChannel | null;
  useProxyRelay: boolean;
  onSelectChannel: (channel: TvChannel) => void;
  onCloseChannel: () => void;
  onToggleProxyRelay: () => void;
  onEnableProxyRelay: () => void;
  onPopOutMiniPlayer: () => void;
  onPauseMusic: () => void;
  onOpenAllTv: () => void;
}

type SportFilter = 'all' | 'soccer' | 'basketball' | 'football' | 'hockey';
type StatusFilter = 'all' | 'live' | 'upcoming' | 'final';

const SPORT_TABS: Array<{ id: SportFilter; label: string }> = [
  { id: 'all', label: 'All Sports' },
  { id: 'soccer', label: 'Football / Soccer' },
  { id: 'basketball', label: 'Basketball (NBA)' },
  { id: 'football', label: 'NFL' },
  { id: 'hockey', label: 'Hockey (NHL)' },
];

const STATUS_TABS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All Matches' },
  { id: 'live', label: 'Live Now' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'final', label: 'Final' },
];

function TeamCrest({
  logoUrl,
  abbr,
  name,
}: {
  logoUrl?: string;
  abbr: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!logoUrl || failed) {
    return (
      <div className="w-9 h-9 shrink-0 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)] flex items-center justify-center font-mono text-[11px] font-bold text-[var(--sm-text-sec)]">
        {(abbr || name.slice(0, 3)).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="w-9 h-9 shrink-0 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)] p-1 flex items-center justify-center overflow-hidden">
      <img
        src={logoUrl}
        alt={`${name} crest`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
}

function formatKickoff(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function pickBroadcastChannel(
  match: LiveMatchItem,
  channels: TvChannel[],
): TvChannel | null {
  if (channels.length === 0) return null;
  const hints = [...(match.broadcasts || []), match.leagueName, match.leagueShort, match.sport]
    .join(' ')
    .toLowerCase();

  const keywordPairs: Array<[string, string[]]> = [
    ['bein', ['bein']],
    ['cbs', ['cbs']],
    ['fifa', ['fifa']],
    ['real madrid', ['real madrid', 'laliga', 'esp']],
    ['tv10', ['rwanda', 'afcon', 'caf']],
    ['red bull', ['red bull']],
    ['dazn', ['dazn', 'ufc', 'combat']],
  ];

  for (const [channelTerm, hintTerms] of keywordPairs) {
    if (hintTerms.some((t) => hints.includes(t))) {
      const found = channels.find((c) => c.name.toLowerCase().includes(channelTerm));
      if (found) return found;
    }
  }

  // Fallback to a reliable verified sports stream
  return (
    channels.find((c) => c.name.toLowerCase().includes('bein')) ||
    channels.find((c) => c.name.toLowerCase().includes('fifa')) ||
    channels[0]
  );
}

export function LiveMatchView({
  activeChannel,
  useProxyRelay,
  onSelectChannel,
  onCloseChannel,
  onToggleProxyRelay,
  onEnableProxyRelay,
  onPopOutMiniPlayer,
  onPauseMusic,
  onOpenAllTv,
}: LiveMatchViewProps) {
  const [sportFilter, setSportFilter] = useState<SportFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [matches, setMatches] = useState<LiveMatchItem[]>([]);
  const [sportsChannels, setSportsChannels] = useState<TvChannel[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [inspectedMatch, setInspectedMatch] = useState<LiveMatchItem | null>(null);
  const [pinnedMatchIds, setPinnedMatchIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('soundmark_pinned_matches');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const playerSectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerBoxRef = useRef<HTMLDivElement | null>(null);
  const userStoppedRef = useRef(false);

  const pinnedSet = useMemo(() => new Set(pinnedMatchIds), [pinnedMatchIds]);

  const togglePinMatch = useCallback((matchId: string) => {
    setPinnedMatchIds((prev) => {
      const next = prev.includes(matchId)
        ? prev.filter((id) => id !== matchId)
        : [...prev, matchId];
      try {
        localStorage.setItem('soundmark_pinned_matches', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const fetchScores = useCallback(
    async (manualRefresh = false, silent = false) => {
      if (manualRefresh) setRefreshing(true);
      else if (!silent) setLoading(true);
      setLoadError(null);

      try {
        const data =
          sportFilter === 'soccer'
            ? await fetchLiveFootballMatches({
                status: statusFilter,
                q: searchTerm.trim(),
                refresh: manualRefresh,
              })
            : await fetchLiveSportsScoreboard({
                sport: sportFilter,
                status: statusFilter,
                q: searchTerm.trim(),
                refresh: manualRefresh,
              });

        setMatches(Array.isArray(data.matches) ? data.matches : []);
        if (Array.isArray(data.sportsChannels) && data.sportsChannels.length > 0) {
          setSportsChannels(data.sportsChannels);
        }
        setLiveCount(typeof data.liveCount === 'number' ? data.liveCount : 0);
        setUpdatedAt(data.updatedAt || new Date().toISOString());
      } catch (err) {
        if (!silent) {
          setMatches([]);
          setLoadError(err instanceof Error ? err.message : 'Unable to fetch live match scores');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sportFilter, statusFilter, searchTerm],
  );

  useEffect(() => {
    fetchScores(false, false);
  }, [fetchScores]);

  // Live auto-refresh every 30 seconds
  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchScores(true, true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [fetchScores]);

  // Auto-tune first sports TV stream when opening Match TV without an active channel
  useEffect(() => {
    if (!activeChannel && !userStoppedRef.current && sportsChannels.length > 0) {
      onSelectChannel(sportsChannels[0]);
    }
  }, [activeChannel, sportsChannels, onSelectChannel]);

  const activeChannelIndex = useMemo(() => {
    if (!activeChannel) return -1;
    return sportsChannels.findIndex((c) => c.id === activeChannel.id);
  }, [activeChannel, sportsChannels]);

  const handlePrevChannel = () => {
    if (sportsChannels.length === 0) return;
    userStoppedRef.current = false;
    if (activeChannelIndex > 0) {
      onSelectChannel(sportsChannels[activeChannelIndex - 1]);
    } else {
      onSelectChannel(sportsChannels[sportsChannels.length - 1]);
    }
  };

  const handleNextChannel = () => {
    if (sportsChannels.length === 0) return;
    userStoppedRef.current = false;
    if (activeChannelIndex >= 0 && activeChannelIndex < sportsChannels.length - 1) {
      onSelectChannel(sportsChannels[activeChannelIndex + 1]);
    } else {
      onSelectChannel(sportsChannels[0]);
    }
  };

  const handleWatchMatchChannel = (match: LiveMatchItem, overrideChannels?: TvChannel[]) => {
    const channelPool =
      overrideChannels && overrideChannels.length > 0 ? overrideChannels : sportsChannels;
    const ch = pickBroadcastChannel(match, channelPool);
    if (!ch) return;
    userStoppedRef.current = false;
    onSelectChannel(ch);
    playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchDraft.trim());
  };

  const visibleMatches = useMemo(() => {
    const filtered = pinnedOnly ? matches.filter((m) => pinnedSet.has(m.id)) : matches;
    return [...filtered].sort((a, b) => {
      const ap = pinnedSet.has(a.id) ? 0 : 1;
      const bp = pinnedSet.has(b.id) ? 0 : 1;
      return ap - bp;
    });
  }, [matches, pinnedOnly, pinnedSet]);

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--sm-border)] pb-5">
        <div>
          <p className="text-xs font-medium text-[var(--sm-text-muted)] mb-1">
            Live Match TV &amp; Real-Time Scoreboard ·{' '}
            <span className="font-mono tabular-nums text-[var(--sm-text)]">
              {liveCount} Live {liveCount === 1 ? 'Match' : 'Matches'}
            </span>{' '}
            ·{' '}
            <span className="font-mono tabular-nums">
              {sportsChannels.length} Sports Channels
            </span>
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--sm-text)]">
            Live Match TV &amp; Scores
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono tabular-nums text-[var(--sm-text-muted)] px-2">
            Updated {updatedLabel}
          </span>
          <button
            type="button"
            onClick={() => fetchScores(true, true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-surface)] text-xs font-medium text-[var(--sm-text)] hover:border-[var(--sm-accent)] whitespace-nowrap disabled:opacity-60"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh Scores</span>
          </button>
          <button
            type="button"
            onClick={onOpenAllTv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
          >
            <Tv size={13} />
            <span>All Sports TV</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Live Match TV Theatre Stage */}
      <section
        ref={playerSectionRef}
        className="border border-[var(--sm-border)] rounded-2xl bg-[var(--sm-surface)] overflow-hidden"
      >
        <div
          ref={playerBoxRef}
          className="relative aspect-video bg-[#0E0E0D] w-full max-h-[520px]"
        >
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
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-6 text-center bg-gradient-to-b from-[#171715] to-[#0E0E0D] text-[#F3F1EA]">
              <div className="w-14 h-14 rounded-2xl bg-[#232320] border border-[#34342F] flex items-center justify-center text-[var(--sm-accent-text)]">
                <Trophy size={26} />
              </div>
              <div className="space-y-1 max-w-md">
                <h2 className="font-display text-xl font-bold">Live Sports Broadcast Stage</h2>
                <p className="text-xs text-[#A3A096] leading-relaxed">
                  Tune any live sports channel below to watch matches alongside real-time scores.
                </p>
              </div>
              {sportsChannels.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {sportsChannels.slice(0, 5).map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        userStoppedRef.current = false;
                        onSelectChannel(ch);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#232320] hover:bg-[var(--sm-accent)] hover:text-[var(--sm-on-accent)] border border-[#34342F] text-xs font-medium text-[#F3F1EA] transition-colors whitespace-nowrap"
                    >
                      <Play size={12} fill="currentColor" />
                      <span>
                        {ch.countryFlag} {ch.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* TV Stage Console Bar */}
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
              Select any live sports broadcast channel below to start watching.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center border border-[var(--sm-border)] rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={handlePrevChannel}
                title="Previous sports channel"
                aria-label="Previous sports channel"
                className="px-2.5 py-1.5 text-xs text-[var(--sm-text-sec)] hover:bg-[var(--sm-muted)] flex items-center gap-1"
              >
                <ChevronLeft size={14} />
                <span className="hidden sm:inline">Prev</span>
              </button>
              <button
                type="button"
                onClick={handleNextChannel}
                title="Next sports channel"
                aria-label="Next sports channel"
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

                <button
                  type="button"
                  onClick={() => {
                    userStoppedRef.current = true;
                    onCloseChannel();
                  }}
                  aria-label="Stop live sports TV"
                  className="p-2 rounded-lg border border-[var(--sm-border)] text-[var(--sm-text-muted)] hover:text-[var(--sm-accent-text)]"
                >
                  <X size={15} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sports Channel Quick Switcher Rail */}
        {sportsChannels.length > 0 && (
          <div className="px-4 sm:px-5 py-3.5 border-t border-[var(--sm-border)] bg-[var(--sm-bg)]/50 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-[var(--sm-text-muted)]">
                LIVE SPORTS TV CHANNELS ({sportsChannels.length})
              </span>
              <button
                type="button"
                onClick={onOpenAllTv}
                className="text-[11px] font-medium text-[var(--sm-accent-text)] hover:underline whitespace-nowrap"
              >
                Browse 450+ Sports TV Channels
              </button>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {sportsChannels.slice(0, 18).map((ch) => {
                const selected = activeChannel?.id === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      userStoppedRef.current = false;
                      onSelectChannel(ch);
                    }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                      selected
                        ? 'border-[var(--sm-accent)] bg-[var(--sm-accent)] text-[var(--sm-on-accent)] font-semibold'
                        : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text)] hover:border-[var(--sm-text-muted)]'
                    }`}
                  >
                    <Radio size={11} className={selected ? 'text-current' : 'text-[#15803D] dark:text-emerald-400'} />
                    <span>
                      {ch.countryFlag} {ch.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Real-Time Auto-Refreshing Live Score Widget (30s public feed sync) */}
      <LiveScoreWidget
        sportFilter={sportFilter}
        pinnedMatchIds={pinnedMatchIds}
        onTogglePinMatch={togglePinMatch}
        onInspectMatch={(m) => setInspectedMatch(m)}
        onWatchMatch={(match, widgetChannels) => handleWatchMatchChannel(match, widgetChannels)}
      />

      {loadError && (
        <div className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] px-4 py-3 flex items-center justify-between gap-3 text-xs">
          <span className="text-[var(--sm-text-sec)]">{loadError}</span>
          <button
            type="button"
            onClick={() => fetchScores(true, false)}
            className="font-semibold text-[var(--sm-accent-text)] hover:underline whitespace-nowrap"
          >
            Retry Feed
          </button>
        </div>
      )}

      {/* Live Scores Filters */}
      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {SPORT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSportFilter(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                  sportFilter === tab.id
                    ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)] font-semibold'
                    : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sm-text-muted)]"
              />
              <input
                type="text"
                value={searchDraft}
                onChange={(e) => {
                  setSearchDraft(e.target.value);
                  if (!e.target.value.trim()) setSearchTerm('');
                }}
                placeholder="Filter by team or league..."
                className="w-full h-9 pl-8 pr-3 rounded-lg bg-[var(--sm-surface)] border border-[var(--sm-border)] text-xs text-[var(--sm-text)] placeholder:text-[var(--sm-text-muted)] focus:outline-none focus:border-[var(--sm-accent)]"
              />
            </div>
            <button
              type="submit"
              className="h-9 px-3.5 rounded-lg bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-medium whitespace-nowrap hover:opacity-90"
            >
              Filter
            </button>
          </form>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'border-[var(--sm-accent)] bg-[var(--sm-accent)] text-[var(--sm-on-accent)] font-semibold'
                  : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
              }`}
            >
              {tab.label}
              {tab.id === 'live' && liveCount > 0 ? ` (${liveCount})` : ''}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPinnedOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
              pinnedOnly
                ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)] font-semibold'
                : 'border-[var(--sm-border)] bg-[var(--sm-surface)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
            }`}
          >
            <Star size={12} fill={pinnedOnly ? 'currentColor' : 'none'} />
            <span>Pinned ({pinnedMatchIds.length})</span>
          </button>
        </div>

        {/* Live Match Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-44 rounded-xl bg-[var(--sm-muted)]" />
            ))}
          </div>
        ) : visibleMatches.length === 0 ? (
          <div className="border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)] p-10 text-center space-y-3">
            <Trophy size={26} className="mx-auto text-[var(--sm-text-muted)]" />
            <div className="space-y-1">
              <h3 className="font-display text-base font-bold text-[var(--sm-text)]">
                {pinnedOnly
                  ? 'No pinned fixtures in this league view'
                  : statusFilter === 'live'
                    ? 'No live matches in play at this moment'
                    : 'No matches found for this filter'}
              </h3>
              <p className="text-xs text-[var(--sm-text-sec)]">
                {pinnedOnly
                  ? 'Click the star icon on any match to track it in your watchlist.'
                  : 'Switch between Upcoming or Final fixtures, or watch 24/7 Live Sports TV channels above.'}
              </p>
            </div>
            {(statusFilter !== 'all' || pinnedOnly) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setPinnedOnly(false);
                }}
                className="px-4 py-2 rounded-lg bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold hover:opacity-90"
              >
                Show All Fixtures &amp; Results
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleMatches.map((match) => {
              const homeNum = Number(match.homeTeam.score);
              const awayNum = Number(match.awayTeam.score);
              const showScores = match.statusState !== 'pre';
              const homeLeads =
                showScores && Number.isFinite(homeNum) && Number.isFinite(awayNum) && homeNum > awayNum;
              const awayLeads =
                showScores && Number.isFinite(homeNum) && Number.isFinite(awayNum) && awayNum > homeNum;
              const kickoffTime = formatKickoff(match.startTime);
              const isPinned = pinnedSet.has(match.id);

              return (
                <article
                  key={match.id}
                  className={`rounded-xl border p-4 flex flex-col justify-between gap-4 transition-colors ${
                    match.isLive
                      ? 'border-[var(--sm-accent)] bg-[var(--sm-surface)]'
                      : 'border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-text-muted)]'
                  }`}
                >
                  {/* Top Match Header */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--sm-border)]">
                    <span className="text-[11px] font-medium text-[var(--sm-text-sec)] truncate">
                      {match.leagueName}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {match.statusState === 'in' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums font-semibold text-[#15803D] dark:text-emerald-400">
                          <Radio size={11} />
                          <span>LIVE · {match.statusDetail}</span>
                        </span>
                      ) : match.statusState === 'pre' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-[var(--sm-accent-text)]">
                          <Clock size={11} />
                          <span>UPCOMING · {kickoffTime || match.statusDetail}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-[var(--sm-text-muted)]">
                          <CheckCircle2 size={11} />
                          <span>FINAL · {match.statusDetail}</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => togglePinMatch(match.id)}
                        aria-label={isPinned ? 'Unpin match' : 'Pin match'}
                        className={`p-0.5 rounded transition-colors ${
                          isPinned
                            ? 'text-[var(--sm-accent-text)]'
                            : 'text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]'
                        }`}
                      >
                        <Star size={12} fill={isPinned ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>

                  {/* Teams & Scores */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TeamCrest
                          logoUrl={match.homeTeam.logoUrl}
                          abbr={match.homeTeam.abbr}
                          name={match.homeTeam.name}
                        />
                        <div className="min-w-0">
                          <div
                            className={`text-sm truncate ${
                              homeLeads
                                ? 'font-bold text-[var(--sm-text)]'
                                : 'font-semibold text-[var(--sm-text)]'
                            }`}
                          >
                            {match.homeTeam.shortName || match.homeTeam.name}
                          </div>
                          {match.homeTeam.record && (
                            <div className="text-[11px] font-mono tabular-nums text-[var(--sm-text-muted)]">
                              Home · {match.homeTeam.record}
                            </div>
                          )}
                        </div>
                      </div>
                      <span
                        className={`font-mono tabular-nums text-2xl shrink-0 ${
                          homeLeads
                            ? 'font-bold text-[var(--sm-accent-text)]'
                            : 'font-semibold text-[var(--sm-text)]'
                        }`}
                      >
                        {showScores ? match.homeTeam.score : '–'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TeamCrest
                          logoUrl={match.awayTeam.logoUrl}
                          abbr={match.awayTeam.abbr}
                          name={match.awayTeam.name}
                        />
                        <div className="min-w-0">
                          <div
                            className={`text-sm truncate ${
                              awayLeads
                                ? 'font-bold text-[var(--sm-text)]'
                                : 'font-semibold text-[var(--sm-text)]'
                            }`}
                          >
                            {match.awayTeam.shortName || match.awayTeam.name}
                          </div>
                          {match.awayTeam.record && (
                            <div className="text-[11px] font-mono tabular-nums text-[var(--sm-text-muted)]">
                              Away · {match.awayTeam.record}
                            </div>
                          )}
                        </div>
                      </div>
                      <span
                        className={`font-mono tabular-nums text-2xl shrink-0 ${
                          awayLeads
                            ? 'font-bold text-[var(--sm-accent-text)]'
                            : 'font-semibold text-[var(--sm-text)]'
                        }`}
                      >
                        {showScores ? match.awayTeam.score : '–'}
                      </span>
                    </div>
                  </div>

                  {/* Match Highlights if live or finished */}
                  {match.highlights.length > 0 && (
                    <div className="pt-2 border-t border-[var(--sm-border)] space-y-1">
                      {match.highlights.slice(0, 2).map((hl, idx) => (
                        <div
                          key={`${match.id}-hl-${idx}`}
                          className="text-[11px] text-[var(--sm-text-sec)] flex items-baseline gap-1.5 truncate"
                        >
                          <span className="font-mono tabular-nums text-[var(--sm-accent-text)] shrink-0">
                            {hl.clock || '•'}
                          </span>
                          <span className="truncate">{hl.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer Venue + Broadcast + Stats & Watch Button */}
                  <div className="pt-2.5 border-t border-[var(--sm-border)] flex items-center justify-between gap-2">
                    <div className="min-w-0 text-[11px] text-[var(--sm-text-muted)] flex items-center gap-1.5 truncate">
                      {match.broadcasts.length > 0 ? (
                        <span className="truncate">TV: {match.broadcasts.slice(0, 2).join(', ')}</span>
                      ) : match.venue ? (
                        <>
                          <MapPin size={11} className="shrink-0" />
                          <span className="truncate">{match.venue}</span>
                        </>
                      ) : (
                        <span>{match.leagueShort}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setInspectedMatch(match)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--sm-border)] text-[11px] font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] hover:border-[var(--sm-accent)] whitespace-nowrap"
                      >
                        <BarChart3 size={11} />
                        <span>Stats</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleWatchMatchChannel(match)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-[11px] font-semibold hover:opacity-90 whitespace-nowrap"
                      >
                        <Tv size={12} />
                        <span>Watch TV</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <MatchDetailModal
        match={inspectedMatch}
        isPinned={inspectedMatch ? pinnedSet.has(inspectedMatch.id) : false}
        onTogglePin={togglePinMatch}
        onWatchTv={(m) => handleWatchMatchChannel(m)}
        onClose={() => setInspectedMatch(null)}
      />
    </div>
  );
}
