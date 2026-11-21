import { useEffect, useState } from 'react';
import {
  X,
  Radio,
  Clock,
  CheckCircle2,
  Star,
  Tv,
  MapPin,
  BarChart3,
  ListOrdered,
  Users,
  Loader2,
} from 'lucide-react';
import type { LiveMatchDetails, LiveMatchItem, LiveMatchRosterPlayer } from '../types/music';
import { fetchMatchDetails } from '../services/footballApi';

interface MatchDetailModalProps {
  match: LiveMatchItem | null;
  isPinned: boolean;
  onTogglePin: (matchId: string) => void;
  onWatchTv: (match: LiveMatchItem) => void;
  onClose: () => void;
}

type ModalTab = 'stats' | 'timeline' | 'lineups';

function ModalCrest({
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
      <div className="w-12 h-12 shrink-0 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-bg)] flex items-center justify-center font-mono text-sm font-bold text-[var(--sm-text-sec)]">
        {(abbr || name.slice(0, 3)).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="w-12 h-12 shrink-0 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-bg)] p-1.5 flex items-center justify-center overflow-hidden">
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

function parseStatNumber(val: string): number {
  const match = val.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function LineupColumn({
  teamName,
  players,
}: {
  teamName: string;
  players: LiveMatchRosterPlayer[];
}) {
  const starters = players.filter((p) => p.starter);
  const subs = players.filter((p) => !p.starter);

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-[var(--sm-text)] pb-1.5 border-b border-[var(--sm-border)] flex items-center justify-between">
        <span className="truncate">{teamName}</span>
        <span className="font-mono tabular-nums text-[var(--sm-text-muted)] shrink-0">
          {players.length}
        </span>
      </div>

      {starters.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-[var(--sm-text-muted)]">Starting Lineup</div>
          <div className="divide-y divide-[var(--sm-border)]">
            {starters.map((player, i) => (
              <div
                key={`starter-${player.name}-${i}`}
                className="py-1.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono tabular-nums text-[11px] text-[var(--sm-accent-text)] w-6 shrink-0">
                    {player.jersey ? `#${player.jersey}` : '—'}
                  </span>
                  <span className="text-[var(--sm-text)] truncate">{player.name}</span>
                </div>
                {player.position && (
                  <span className="font-mono text-[11px] text-[var(--sm-text-muted)] shrink-0">
                    {player.position}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {subs.length > 0 && (
        <div className="space-y-1 pt-1">
          <div className="text-[11px] font-medium text-[var(--sm-text-muted)]">
            {starters.length > 0 ? 'Bench & Substitutes' : 'Squad'}
          </div>
          <div className="divide-y divide-[var(--sm-border)]">
            {subs.map((player, i) => (
              <div
                key={`sub-${player.name}-${i}`}
                className="py-1.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono tabular-nums text-[11px] text-[var(--sm-text-muted)] w-6 shrink-0">
                    {player.jersey ? `#${player.jersey}` : '—'}
                  </span>
                  <span className="text-[var(--sm-text-sec)] truncate">{player.name}</span>
                </div>
                {player.position && (
                  <span className="font-mono text-[11px] text-[var(--sm-text-muted)] shrink-0">
                    {player.position}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MatchDetailModal({
  match,
  isPinned,
  onTogglePin,
  onWatchTv,
  onClose,
}: MatchDetailModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('stats');
  const [details, setDetails] = useState<LiveMatchDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!match) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [match, onClose]);

  useEffect(() => {
    if (!match) {
      setDetails(null);
      return;
    }

    let cancelled = false;
    setActiveTab('stats');
    setDetails(null);
    setLoadingDetails(true);

    fetchMatchDetails(match)
      .then((res) => {
        if (!cancelled) setDetails(res);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [match?.id]);

  if (!match) return null;

  const showScore = match.statusState !== 'pre';
  const kickoff = match.startTime
    ? new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const mergedStats =
    details && details.stats.length > 0 ? details.stats : match.stats || [];
  const mergedHighlights =
    details && details.highlights.length > 0 ? details.highlights : match.highlights || [];
  const homeLineup = details?.homeLineup || [];
  const awayLineup = details?.awayLineup || [];
  const hasLineups = homeLineup.length > 0 || awayLineup.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-center-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] shadow-2xl overflow-hidden"
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[var(--sm-border)] flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="text-xs text-[var(--sm-text-muted)] flex items-center gap-2 truncate">
              <span>{match.leagueName}</span>
              {match.venue && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 truncate">
                    <MapPin size={11} className="shrink-0" />
                    <span className="truncate">{match.venue}</span>
                  </span>
                </>
              )}
            </div>
            <h2
              id="match-center-title"
              className="font-display text-lg font-bold text-[var(--sm-text)] truncate mt-0.5"
            >
              {match.homeTeam.shortName || match.homeTeam.name} vs{' '}
              {match.awayTeam.shortName || match.awayTeam.name}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onTogglePin(match.id)}
              aria-label={isPinned ? 'Unpin match' : 'Pin match to watchlist'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isPinned
                  ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)]'
                  : 'border-[var(--sm-border)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
              }`}
            >
              <Star size={13} fill={isPinned ? 'currentColor' : 'none'} />
              <span>{isPinned ? 'Pinned' : 'Pin Match'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close match center"
              className="p-2 rounded-lg text-[var(--sm-text-muted)] hover:text-[var(--sm-text)] hover:bg-[var(--sm-muted)] shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--sm-border)]">
          {/* Scoreboard Banner */}
          <div className="px-6 py-5 bg-[var(--sm-bg)]/45">
            <div className="flex items-center justify-between gap-4">
              {/* Home */}
              <div className="flex-1 flex flex-col items-center text-center gap-2 min-w-0">
                <ModalCrest
                  logoUrl={match.homeTeam.logoUrl}
                  abbr={match.homeTeam.abbr}
                  name={match.homeTeam.name}
                />
                <div className="text-sm font-bold text-[var(--sm-text)] truncate max-w-full">
                  {match.homeTeam.name}
                </div>
                {match.homeTeam.record && (
                  <div className="text-[11px] font-mono tabular-nums text-[var(--sm-text-muted)]">
                    Home · {match.homeTeam.record}
                  </div>
                )}
              </div>

              {/* Center Score & Clock */}
              <div className="flex flex-col items-center justify-center gap-1.5 px-3 shrink-0">
                {match.statusState === 'in' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums font-semibold text-[#15803D] dark:text-emerald-400">
                    <Radio size={12} />
                    <span>LIVE · {match.statusDetail}</span>
                  </span>
                ) : match.statusState === 'pre' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-[var(--sm-accent-text)]">
                    <Clock size={12} />
                    <span>{kickoff || match.statusDetail}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-[var(--sm-text-muted)]">
                    <CheckCircle2 size={12} />
                    <span>FINAL · {match.statusDetail}</span>
                  </span>
                )}

                <div className="font-mono tabular-nums text-3xl sm:text-4xl font-bold tracking-tight text-[var(--sm-text)] flex items-center gap-3">
                  <span>{showScore ? match.homeTeam.score : '–'}</span>
                  <span className="text-[var(--sm-text-muted)] text-xl">:</span>
                  <span>{showScore ? match.awayTeam.score : '–'}</span>
                </div>

                {match.broadcasts.length > 0 && (
                  <div className="text-[11px] text-[var(--sm-text-muted)]">
                    TV: {match.broadcasts.join(', ')}
                  </div>
                )}
              </div>

              {/* Away */}
              <div className="flex-1 flex flex-col items-center text-center gap-2 min-w-0">
                <ModalCrest
                  logoUrl={match.awayTeam.logoUrl}
                  abbr={match.awayTeam.abbr}
                  name={match.awayTeam.name}
                />
                <div className="text-sm font-bold text-[var(--sm-text)] truncate max-w-full">
                  {match.awayTeam.name}
                </div>
                {match.awayTeam.record && (
                  <div className="text-[11px] font-mono tabular-nums text-[var(--sm-text-muted)]">
                    Away · {match.awayTeam.record}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Match Center Tabs */}
          <div className="px-6 flex items-center justify-between gap-4 bg-[var(--sm-surface)]">
            <div className="flex items-center gap-4 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('stats')}
                className={`py-3 text-xs font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'stats'
                    ? 'border-[var(--sm-accent)] text-[var(--sm-text)]'
                    : 'border-transparent text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]'
                }`}
              >
                <BarChart3 size={13} />
                <span>Stats{mergedStats.length > 0 ? ` (${mergedStats.length})` : ''}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`py-3 text-xs font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'timeline'
                    ? 'border-[var(--sm-accent)] text-[var(--sm-text)]'
                    : 'border-transparent text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]'
                }`}
              >
                <ListOrdered size={13} />
                <span>
                  Timeline{mergedHighlights.length > 0 ? ` (${mergedHighlights.length})` : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('lineups')}
                className={`py-3 text-xs font-semibold border-b-2 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeTab === 'lineups'
                    ? 'border-[var(--sm-accent)] text-[var(--sm-text)]'
                    : 'border-transparent text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]'
                }`}
              >
                <Users size={13} />
                <span>Lineups{hasLineups ? ` (${homeLineup.length + awayLineup.length})` : ''}</span>
              </button>
            </div>

            {loadingDetails && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--sm-text-muted)] whitespace-nowrap shrink-0">
                <Loader2 size={12} className="animate-spin" />
                <span>Syncing live data</span>
              </span>
            )}
          </div>

          {/* Tab Panel: Stats & Period Breakdown */}
          {activeTab === 'stats' && (
            <div className="divide-y divide-[var(--sm-border)]">
              {match.periodScores && match.periodScores.length > 0 && (
                <div className="px-6 py-4 space-y-2.5">
                  <h3 className="text-xs font-semibold text-[var(--sm-text-muted)]">
                    Score by Period
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono tabular-nums">
                      <thead>
                        <tr className="text-[var(--sm-text-muted)] border-b border-[var(--sm-border)]">
                          <th className="py-1.5 text-left font-medium">Team</th>
                          {match.periodScores.map((p) => (
                            <th key={p.period} className="py-1.5 px-2 text-center font-medium">
                              {p.period}
                            </th>
                          ))}
                          <th className="py-1.5 pl-2 text-right font-semibold text-[var(--sm-text)]">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--sm-border)]">
                        <tr>
                          <td className="py-2 font-sans font-semibold text-[var(--sm-text)]">
                            {match.homeTeam.shortName || match.homeTeam.abbr}
                          </td>
                          {match.periodScores.map((p) => (
                            <td
                              key={`h-${p.period}`}
                              className="py-2 px-2 text-center text-[var(--sm-text-sec)]"
                            >
                              {p.home}
                            </td>
                          ))}
                          <td className="py-2 pl-2 text-right font-bold text-[var(--sm-accent-text)]">
                            {match.homeTeam.score}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 font-sans font-semibold text-[var(--sm-text)]">
                            {match.awayTeam.shortName || match.awayTeam.abbr}
                          </td>
                          {match.periodScores.map((p) => (
                            <td
                              key={`a-${p.period}`}
                              className="py-2 px-2 text-center text-[var(--sm-text-sec)]"
                            >
                              {p.away}
                            </td>
                          ))}
                          <td className="py-2 pl-2 text-right font-bold text-[var(--sm-accent-text)]">
                            {match.awayTeam.score}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="px-6 py-4 space-y-3">
                <h3 className="text-xs font-semibold text-[var(--sm-text-muted)]">
                  Team Statistics
                </h3>
                {mergedStats.length === 0 ? (
                  <p className="text-xs text-[var(--sm-text-sec)] py-2">
                    {loadingDetails
                      ? 'Fetching live team statistics from match feed...'
                      : match.statusState === 'pre'
                        ? 'Detailed comparative team statistics appear once kickoff begins.'
                        : 'Detailed boxscore statistics are unavailable for this competition feed.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {mergedStats.map((st) => {
                      const hVal = parseStatNumber(st.homeValue);
                      const aVal = parseStatNumber(st.awayValue);
                      const sum = hVal + aVal;
                      const homePct = sum > 0 ? Math.round((hVal / sum) * 100) : 50;
                      return (
                        <div key={st.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className="font-mono tabular-nums font-semibold text-[var(--sm-text)]">
                              {st.homeValue}
                            </span>
                            <span className="text-[var(--sm-text-sec)] text-center truncate">
                              {st.label}
                            </span>
                            <span className="font-mono tabular-nums font-semibold text-[var(--sm-text)]">
                              {st.awayValue}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[var(--sm-muted)] overflow-hidden flex">
                            <div
                              className="h-full bg-[var(--sm-accent)] transition-all duration-300"
                              style={{ width: `${homePct}%` }}
                            />
                            <div
                              className="h-full bg-[var(--sm-text-muted)]/45 transition-all duration-300"
                              style={{ width: `${100 - homePct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Panel: Timeline */}
          {activeTab === 'timeline' && (
            <div className="px-6 py-4 space-y-2.5">
              <h3 className="text-xs font-semibold text-[var(--sm-text-muted)]">
                Live Match Timeline
              </h3>
              {mergedHighlights.length === 0 ? (
                <p className="text-xs text-[var(--sm-text-sec)] py-2">
                  {loadingDetails
                    ? 'Loading match events...'
                    : match.statusState === 'pre'
                      ? 'Match events and play-by-play commentary will appear once kickoff begins.'
                      : 'No key timeline events logged for this fixture yet.'}
                </p>
              ) : (
                <div className="divide-y divide-[var(--sm-border)]">
                  {mergedHighlights.map((hl, idx) => (
                    <div
                      key={`${match.id}-timeline-${idx}`}
                      className="py-2.5 flex items-baseline gap-3 text-xs"
                    >
                      <span className="font-mono tabular-nums font-semibold text-[var(--sm-accent-text)] w-16 shrink-0">
                        {hl.clock || 'Event'}
                      </span>
                      <span className="text-[var(--sm-text)] leading-relaxed flex-1">
                        {hl.teamAbbr ? (
                          <span className="font-mono font-semibold text-[var(--sm-text-sec)] mr-1.5">
                            {hl.teamAbbr}
                          </span>
                        ) : null}
                        {hl.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Panel: Lineups */}
          {activeTab === 'lineups' && (
            <div className="px-6 py-4">
              {!hasLineups ? (
                <p className="text-xs text-[var(--sm-text-sec)] py-2">
                  {loadingDetails
                    ? 'Loading confirmed team sheets...'
                    : 'Confirmed team lineups are not published for this fixture yet.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <LineupColumn
                    teamName={match.homeTeam.shortName || match.homeTeam.name}
                    players={homeLineup}
                  />
                  <LineupColumn
                    teamName={match.awayTeam.shortName || match.awayTeam.name}
                    players={awayLineup}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-3.5 border-t border-[var(--sm-border)] flex items-center justify-between gap-3 shrink-0 bg-[var(--sm-surface)]">
          <span className="text-xs text-[var(--sm-text-muted)] truncate">
            {match.broadcasts.length > 0
              ? `Available on ${match.broadcasts[0]}`
              : 'Live Sports TV Theatre'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap shrink-0"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onWatchTv(match);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold hover:opacity-90 whitespace-nowrap shrink-0"
            >
              <Tv size={13} />
              <span>Watch Sports TV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
