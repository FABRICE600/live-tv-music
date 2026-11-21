import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Radio,
  Clock,
  CheckCircle2,
  RefreshCw,
  Pause,
  Play,
  Tv,
  TrendingUp,
  Bell,
  BellOff,
  Star,
  BarChart3,
  X,
} from 'lucide-react';
import type { LiveMatchItem, TvChannel } from '../types/music';
import {
  fetchLiveFootballMatches,
  fetchLiveSportsScoreboard,
  type SportCategoryFilter,
} from '../services/footballApi';

interface LiveScoreWidgetProps {
  sportFilter?: SportCategoryFilter;
  pinnedMatchIds?: string[];
  onTogglePinMatch?: (matchId: string) => void;
  onInspectMatch?: (match: LiveMatchItem) => void;
  onWatchMatch?: (match: LiveMatchItem, channels: TvChannel[]) => void;
}

const AUTO_REFRESH_SECONDS = 30;

function playScoreChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [587.33, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.11);
      gain.gain.setValueAtTime(0.06, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.26);
    });
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Audio playback blocked or unavailable
  }
}

function WidgetCrest({
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
      <span className="w-6 h-6 shrink-0 rounded-md border border-[var(--sm-border)] bg-[var(--sm-bg)] flex items-center justify-center font-mono text-[10px] font-bold text-[var(--sm-text-sec)]">
        {(abbr || name.slice(0, 3)).toUpperCase()}
      </span>
    );
  }

  return (
    <span className="w-6 h-6 shrink-0 rounded-md border border-[var(--sm-border)] bg-[var(--sm-bg)] p-0.5 flex items-center justify-center overflow-hidden">
      <img
        src={logoUrl}
        alt={`${name} logo`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-contain"
      />
    </span>
  );
}

function formatTickerKickoff(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function LiveScoreWidget({
  sportFilter = 'all',
  pinnedMatchIds,
  onTogglePinMatch,
  onInspectMatch,
  onWatchMatch,
}: LiveScoreWidgetProps) {
  const [matches, setMatches] = useState<LiveMatchItem[]>([]);
  const [sportsChannels, setSportsChannels] = useState<TvChannel[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(AUTO_REFRESH_SECONDS);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [recentlyScoredIds, setRecentlyScoredIds] = useState<Record<string, 'home' | 'away' | 'both'>>({});
  const [scoreAlertBanner, setScoreAlertBanner] = useState<LiveMatchItem | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);

  const [localPinned, setLocalPinned] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('soundmark_pinned_matches');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const activePinnedIds = pinnedMatchIds ?? localPinned;
  const pinnedSet = useMemo(() => new Set(activePinnedIds), [activePinnedIds]);

  const handleTogglePin = (matchId: string) => {
    if (onTogglePinMatch) {
      onTogglePinMatch(matchId);
      return;
    }
    setLocalPinned((prev) => {
      const next = prev.includes(matchId)
        ? prev.filter((id) => id !== matchId)
        : [...prev, matchId];
      try {
        localStorage.setItem('soundmark_pinned_matches', JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const previousScoresRef = useRef<Record<string, { home: string; away: string }>>({});
  const highlightTimeoutRef = useRef<number | null>(null);
  const alertsEnabledRef = useRef(alertsEnabled);
  alertsEnabledRef.current = alertsEnabled;

  const fetchRealScores = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      setError(null);

      try {
        const data =
          sportFilter === 'soccer'
            ? await fetchLiveFootballMatches({ refresh: isManual })
            : await fetchLiveSportsScoreboard({
                sport: sportFilter,
                refresh: isManual,
              });

        const incoming = Array.isArray(data.matches) ? data.matches : [];
        setLiveCount(incoming.filter((m) => m.isLive).length);

        // Prioritize live fixtures first, then recent finals with scores, then upcoming
        const ranked = [...incoming].sort((a, b) => {
          const scoreRank = (m: LiveMatchItem) =>
            m.statusState === 'in' ? 0 : m.statusState === 'post' ? 1 : 2;
          const rDiff = scoreRank(a) - scoreRank(b);
          if (rDiff !== 0) return rDiff;
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        });

        // Detect live score changes compared to previous poll
        const changed: Record<string, 'home' | 'away' | 'both'> = {};
        let firstChangedMatch: LiveMatchItem | null = null;
        const nextSnapshot: Record<string, { home: string; away: string }> = {
          ...previousScoresRef.current,
        };

        for (const m of ranked) {
          const prev = previousScoresRef.current[m.id];
          if (prev && m.statusState !== 'pre') {
            const homeChanged = prev.home !== m.homeTeam.score;
            const awayChanged = prev.away !== m.awayTeam.score;
            if (homeChanged && awayChanged) {
              changed[m.id] = 'both';
              if (!firstChangedMatch) firstChangedMatch = m;
            } else if (homeChanged) {
              changed[m.id] = 'home';
              if (!firstChangedMatch) firstChangedMatch = m;
            } else if (awayChanged) {
              changed[m.id] = 'away';
              if (!firstChangedMatch) firstChangedMatch = m;
            }
          }
          nextSnapshot[m.id] = {
            home: m.homeTeam.score,
            away: m.awayTeam.score,
          };
        }

        previousScoresRef.current = nextSnapshot;
        setMatches(ranked);
        if (Array.isArray(data.sportsChannels)) {
          setSportsChannels(data.sportsChannels);
        }
        setLastUpdated(data.updatedAt || new Date().toISOString());
        setSecondsRemaining(AUTO_REFRESH_SECONDS);

        if (Object.keys(changed).length > 0) {
          setRecentlyScoredIds(changed);
          if (firstChangedMatch) {
            setScoreAlertBanner(firstChangedMatch);
          }
          if (alertsEnabledRef.current) {
            playScoreChime();
          }
          if (highlightTimeoutRef.current) {
            window.clearTimeout(highlightTimeoutRef.current);
          }
          highlightTimeoutRef.current = window.setTimeout(() => {
            setRecentlyScoredIds({});
          }, 6000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Real-time score feed unavailable');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sportFilter],
  );

  useEffect(() => {
    fetchRealScores(false);
  }, [fetchRealScores]);

  // 30-second auto-refresh timer & 1-second visible countdown
  useEffect(() => {
    if (!autoRefresh) return;

    const refreshInterval = window.setInterval(() => {
      fetchRealScores(true);
    }, AUTO_REFRESH_SECONDS * 1000);

    const countdownInterval = window.setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 1 ? AUTO_REFRESH_SECONDS : prev - 1));
    }, 1000);

    return () => {
      window.clearInterval(refreshInterval);
      window.clearInterval(countdownInterval);
    };
  }, [autoRefresh, fetchRealScores]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const displayedMatches = useMemo(() => {
    const filtered = pinnedOnly ? matches.filter((m) => pinnedSet.has(m.id)) : matches;
    return [...filtered]
      .sort((a, b) => {
        const ap = pinnedSet.has(a.id) ? 0 : 1;
        const bp = pinnedSet.has(b.id) ? 0 : 1;
        return ap - bp;
      })
      .slice(0, 6);
  }, [matches, pinnedOnly, pinnedSet]);

  const updatedTimeLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';

  return (
    <section
      aria-label="Live Score Widget"
      className="border border-[var(--sm-border)] rounded-2xl bg-[var(--sm-surface)] overflow-hidden"
    >
      {/* Header Toolbar */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--sm-border)] flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-[#15803D] dark:text-emerald-400 shrink-0" />
            <h2 className="font-display text-base sm:text-lg font-bold text-[var(--sm-text)] truncate">
              Live Matchday Ticker
            </h2>
            <span className="text-xs text-[var(--sm-text-muted)] font-mono tabular-nums whitespace-nowrap">
              · {liveCount > 0 ? `${liveCount} Live` : `${matches.length} Today`}
            </span>
          </div>
          <p className="text-xs text-[var(--sm-text-sec)] font-mono tabular-nums mt-0.5">
            {autoRefresh
              ? `Real-time sync in ${String(secondsRemaining).padStart(2, '0')}s · Last sync ${updatedTimeLabel}`
              : `Auto-refresh paused · Last sync ${updatedTimeLabel}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPinnedOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
              pinnedOnly
                ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)]'
                : 'border-[var(--sm-border)] bg-[var(--sm-bg)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
            }`}
          >
            <Star size={12} fill={pinnedOnly ? 'currentColor' : 'none'} />
            <span>Pinned ({activePinnedIds.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAlertsEnabled((v) => !v)}
            title="Play a studio chime whenever a live score updates"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
              alertsEnabled
                ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)]'
                : 'border-[var(--sm-border)] bg-[var(--sm-bg)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
            }`}
          >
            {alertsEnabled ? <Bell size={12} /> : <BellOff size={12} />}
            <span>{alertsEnabled ? 'Alerts On' : 'Score Alerts'}</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] hover:border-[var(--sm-accent)] whitespace-nowrap transition-colors"
          >
            {autoRefresh ? <Pause size={12} /> : <Play size={12} />}
            <span>{autoRefresh ? 'Pause 30s' : 'Resume 30s'}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchRealScores(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold hover:opacity-90 whitespace-nowrap disabled:opacity-60 transition-opacity"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            <span>Update Now</span>
          </button>
        </div>
      </div>

      {/* Live Score Change Banner */}
      {scoreAlertBanner && (
        <div className="px-4 sm:px-5 py-2.5 border-b border-[var(--sm-border)] bg-[var(--sm-accent-soft)] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp size={13} className="text-[var(--sm-accent-text)] shrink-0" />
            <span className="font-semibold text-[var(--sm-accent-text)] shrink-0">
              Score Update
            </span>
            <span className="text-[var(--sm-text)] truncate font-mono tabular-nums">
              {scoreAlertBanner.homeTeam.shortName} {scoreAlertBanner.homeTeam.score} –{' '}
              {scoreAlertBanner.awayTeam.score} {scoreAlertBanner.awayTeam.shortName} (
              {scoreAlertBanner.statusDetail})
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onInspectMatch && (
              <button
                type="button"
                onClick={() => onInspectMatch(scoreAlertBanner)}
                className="text-xs font-semibold text-[var(--sm-accent-text)] hover:underline whitespace-nowrap"
              >
                Match Stats
              </button>
            )}
            <button
              type="button"
              onClick={() => setScoreAlertBanner(null)}
              aria-label="Dismiss score alert"
              className="p-1 rounded text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Match Feed Body */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--sm-border)] animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-32 bg-[var(--sm-surface)] p-4" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 text-center space-y-2">
          <p className="text-xs font-medium text-[var(--sm-text)]">{error}</p>
          <button
            type="button"
            onClick={() => fetchRealScores(true)}
            className="px-3.5 py-1.5 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-accent-text)] hover:border-[var(--sm-accent)]"
          >
            Retry Feed
          </button>
        </div>
      ) : displayedMatches.length === 0 ? (
        <div className="p-6 text-center space-y-2">
          <p className="text-xs text-[var(--sm-text-sec)]">
            {pinnedOnly
              ? 'No pinned matches in this sport view yet. Star any match to follow its score here.'
              : 'No matches scheduled right now for this sport. Switch to All Sports to see live fixtures.'}
          </p>
          {pinnedOnly && (
            <button
              type="button"
              onClick={() => setPinnedOnly(false)}
              className="text-xs font-semibold text-[var(--sm-accent-text)] hover:underline"
            >
              Show All Fixtures
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--sm-border)]">
          {displayedMatches.map((match) => {
            const deltaSide = recentlyScoredIds[match.id];
            const homeScored = deltaSide === 'home' || deltaSide === 'both';
            const awayScored = deltaSide === 'away' || deltaSide === 'both';
            const showScores = match.statusState !== 'pre';
            const latestHighlight = match.highlights[0];
            const isPinned = pinnedSet.has(match.id);
            const kickoffTime = formatTickerKickoff(match.startTime);

            return (
              <div
                key={match.id}
                className="bg-[var(--sm-surface)] p-4 flex flex-col justify-between gap-3"
              >
                {/* Unboxed Top Metadata Line + Pin Button */}
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-[var(--sm-text-muted)] truncate">
                    {match.leagueShort}
                    {match.venue ? ` · ${match.venue.split(',')[0]}` : ''}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {match.statusState === 'in' ? (
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-[#15803D] dark:text-emerald-400">
                        <Radio size={10} />
                        <span>LIVE · {match.statusDetail}</span>
                      </span>
                    ) : match.statusState === 'pre' ? (
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[var(--sm-accent-text)]">
                        <Clock size={10} />
                        <span>{kickoffTime || match.statusDetail}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[var(--sm-text-muted)]">
                        <CheckCircle2 size={10} />
                        <span>FINAL</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleTogglePin(match.id)}
                      aria-label={isPinned ? 'Unpin match' : 'Pin match'}
                      title={isPinned ? 'Unpin match' : 'Pin match'}
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

                {/* Teams & Tabular Scores */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <WidgetCrest
                        logoUrl={match.homeTeam.logoUrl}
                        abbr={match.homeTeam.abbr}
                        name={match.homeTeam.name}
                      />
                      <span className="text-xs font-semibold text-[var(--sm-text)] truncate">
                        {match.homeTeam.shortName || match.homeTeam.name}
                      </span>
                      {homeScored && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold text-[var(--sm-accent-text)] shrink-0">
                          <TrendingUp size={10} />
                          <span>Goal/Pts</span>
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono tabular-nums text-lg font-bold shrink-0 transition-colors ${
                        homeScored ? 'text-[var(--sm-accent-text)]' : 'text-[var(--sm-text)]'
                      }`}
                    >
                      {showScores ? match.homeTeam.score : '–'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <WidgetCrest
                        logoUrl={match.awayTeam.logoUrl}
                        abbr={match.awayTeam.abbr}
                        name={match.awayTeam.name}
                      />
                      <span className="text-xs font-semibold text-[var(--sm-text)] truncate">
                        {match.awayTeam.shortName || match.awayTeam.name}
                      </span>
                      {awayScored && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold text-[var(--sm-accent-text)] shrink-0">
                          <TrendingUp size={10} />
                          <span>Goal/Pts</span>
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono tabular-nums text-lg font-bold shrink-0 transition-colors ${
                        awayScored ? 'text-[var(--sm-accent-text)]' : 'text-[var(--sm-text)]'
                      }`}
                    >
                      {showScores ? match.awayTeam.score : '–'}
                    </span>
                  </div>
                </div>

                {/* Latest Event + Stats & Watch TV Actions */}
                <div className="pt-2 border-t border-[var(--sm-border)] flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--sm-text-sec)] truncate">
                    {latestHighlight
                      ? `${latestHighlight.clock} — ${latestHighlight.text}`
                      : match.broadcasts[0] || match.leagueName}
                  </span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {onInspectMatch && (
                      <button
                        type="button"
                        onClick={() => onInspectMatch(match)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap"
                      >
                        <BarChart3 size={11} />
                        <span>Stats</span>
                      </button>
                    )}
                    {onWatchMatch && (
                      <button
                        type="button"
                        onClick={() => onWatchMatch(match, sportsChannels)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--sm-accent-text)] hover:underline whitespace-nowrap"
                      >
                        <Tv size={11} />
                        <span>Watch TV</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
