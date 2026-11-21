import type {
  LiveMatchDetails,
  LiveMatchHighlight,
  LiveMatchItem,
  LiveMatchPeriodScore,
  LiveMatchRosterPlayer,
  LiveMatchStat,
  LiveScoresResponse,
} from '../types/music';

export type SportCategoryFilter = 'all' | 'soccer' | 'basketball' | 'football' | 'hockey';
export type MatchStatusFilter = 'all' | 'live' | 'upcoming' | 'final';

export interface FetchScoresParams {
  sport?: SportCategoryFilter;
  status?: MatchStatusFilter;
  q?: string;
  refresh?: boolean;
}

interface EspnPublicCompetitor {
  homeAway?: 'home' | 'away';
  score?: string;
  team?: {
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logo?: string;
  };
  records?: Array<{ summary?: string }>;
  linescores?: Array<{ value?: number; displayValue?: string }>;
  statistics?: Array<{
    name?: string;
    abbreviation?: string;
    label?: string;
    displayValue?: string;
  }>;
}

interface EspnPublicEvent {
  id: string;
  date?: string;
  status?: {
    type?: {
      state?: 'in' | 'pre' | 'post';
      shortDetail?: string;
      detail?: string;
    };
  };
  season?: { slug?: string };
  competitions?: Array<{
    venue?: { fullName?: string };
    competitors?: EspnPublicCompetitor[];
    broadcasts?: Array<{ names?: string[] }>;
    geoBroadcasts?: Array<{ media?: { shortName?: string } }>;
    notes?: Array<{ headline?: string }>;
    details?: Array<{
      clock?: { displayValue?: string };
      type?: { text?: string };
      athletesInvolved?: Array<{ shortName?: string }>;
    }>;
  }>;
}

function normalizeEspnSoccerEvents(events: EspnPublicEvent[]): LiveMatchItem[] {
  const items: LiveMatchItem[] = [];

  for (const ev of events) {
    const comp = ev.competitions?.[0];
    const competitors = comp?.competitors || [];
    const home = competitors.find((c) => c.homeAway === 'home') || competitors[0];
    const away = competitors.find((c) => c.homeAway === 'away') || competitors[1];
    if (!home || !away) continue;

    const state = ev.status?.type?.state || 'pre';
    const shortDetail = ev.status?.type?.shortDetail || ev.status?.type?.detail || 'Scheduled';
    const broadcasts = Array.from(
      new Set(
        [
          ...(comp?.broadcasts || []).flatMap((b) => b.names || []),
          ...(comp?.geoBroadcasts || []).map((g) => g.media?.shortName || ''),
        ].filter(Boolean),
      ),
    );

    const noteHeadline = comp?.notes?.[0]?.headline?.trim();
    const slugLabel = ev.season?.slug
      ? ev.season.slug
          .replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, (ch) => ch.toUpperCase())
      : '';
    const leagueName = noteHeadline || slugLabel || 'Global Football';
    const leagueShort = (noteHeadline?.split(' - ')[0] || slugLabel || 'Football').slice(0, 20);

    const highlights: LiveMatchHighlight[] = (comp?.details || [])
      .slice(-4)
      .map((d) => {
        const player = d.athletesInvolved?.[0]?.shortName || '';
        const evType = d.type?.text || '';
        return {
          clock: d.clock?.displayValue || '',
          text: [player, evType].filter(Boolean).join(' · ') || 'Match Event',
        };
      })
      .filter((h) => h.text !== 'Match Event' || h.clock);

    const homeLines = home.linescores || [];
    const awayLines = away.linescores || [];
    const maxPeriods = Math.max(homeLines.length, awayLines.length);
    const periodScores: LiveMatchPeriodScore[] | undefined =
      maxPeriods > 0
        ? Array.from({ length: maxPeriods }, (_, idx) => ({
            period: `${idx + 1}H`,
            home:
              homeLines[idx]?.displayValue ??
              (typeof homeLines[idx]?.value === 'number' ? String(homeLines[idx].value) : '—'),
            away:
              awayLines[idx]?.displayValue ??
              (typeof awayLines[idx]?.value === 'number' ? String(awayLines[idx].value) : '—'),
          }))
        : undefined;

    const homeStatsMap = new Map(
      (home.statistics || []).map((s) => [s.name || s.label || '', s]),
    );
    const awayStatsMap = new Map(
      (away.statistics || []).map((s) => [s.name || s.label || '', s]),
    );
    const stats: LiveMatchStat[] | undefined =
      homeStatsMap.size > 0
        ? Array.from(homeStatsMap.entries())
            .slice(0, 6)
            .map(([key, hStat]) => {
              const aStat = awayStatsMap.get(key);
              return {
                label: hStat.label || hStat.abbreviation || key,
                homeValue: hStat.displayValue || '0',
                awayValue: aStat?.displayValue || '0',
              };
            })
        : undefined;

    items.push({
      id: ev.id,
      sport: 'soccer',
      leagueId: 'soccer.all',
      leagueName,
      leagueShort,
      statusState: state,
      statusDetail: shortDetail,
      isLive: state === 'in',
      startTime: ev.date || new Date().toISOString(),
      venue: comp?.venue?.fullName || undefined,
      broadcasts,
      homeTeam: {
        name: home.team?.displayName || 'Home',
        shortName: home.team?.shortDisplayName || home.team?.displayName || 'Home',
        abbr: home.team?.abbreviation || 'HOM',
        logoUrl: home.team?.logo || '',
        score: home.score ?? (state === 'pre' ? '—' : '0'),
        record: home.records?.[0]?.summary,
      },
      awayTeam: {
        name: away.team?.displayName || 'Away',
        shortName: away.team?.shortDisplayName || away.team?.displayName || 'Away',
        abbr: away.team?.abbreviation || 'AWY',
        logoUrl: away.team?.logo || '',
        score: away.score ?? (state === 'pre' ? '—' : '0'),
        record: away.records?.[0]?.summary,
      },
      highlights,
      stats,
      periodScores,
    });
  }

  return items;
}

/**
 * Fetches real-time football match data from Soundmark's public Football API gateway
 * (Football-Data.org v4 when configured + zero-key ESPN Global Soccer Scoreboard),
 * with a direct CORS-enabled public fallback if needed.
 */
export async function fetchLiveFootballMatches(
  params: Omit<FetchScoresParams, 'sport'> = {},
): Promise<LiveScoresResponse> {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.refresh) query.set('refresh', '1');

  const url = query.toString()
    ? `/api/football/matches?${query.toString()}`
    : '/api/football/matches';

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Football API returned ${res.status}`);
    const data = (await res.json()) as LiveScoresResponse;
    return {
      updatedAt: data.updatedAt || new Date().toISOString(),
      liveCount: typeof data.liveCount === 'number' ? data.liveCount : 0,
      matches: Array.isArray(data.matches) ? data.matches : [],
      sportsChannels: Array.isArray(data.sportsChannels) ? data.sportsChannels : [],
    };
  } catch {
    // Direct public CORS-enabled fallback to ESPN Global Soccer Scoreboard
    const fallbackRes = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard',
    );
    if (!fallbackRes.ok) {
      throw new Error('Unable to reach live football data service');
    }
    const raw = (await fallbackRes.json()) as { events?: EspnPublicEvent[] };
    let matches = normalizeEspnSoccerEvents(raw.events || []);

    if (params.status && params.status !== 'all') {
      matches = matches.filter((m) =>
        params.status === 'live'
          ? m.statusState === 'in'
          : params.status === 'upcoming'
            ? m.statusState === 'pre'
            : params.status === 'final'
              ? m.statusState === 'post'
              : true,
      );
    }

    if (params.q?.trim()) {
      const needle = params.q.trim().toLowerCase();
      matches = matches.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(needle) ||
          m.awayTeam.name.toLowerCase().includes(needle) ||
          m.leagueName.toLowerCase().includes(needle),
      );
    }

    return {
      updatedAt: new Date().toISOString(),
      liveCount: matches.filter((m) => m.isLive).length,
      matches,
      sportsChannels: [],
    };
  }
}

/**
 * Fetches real-time multi-sport match data (Global Football, NBA, NFL, NHL)
 * along with verified live sports TV channels.
 */
export async function fetchLiveSportsScoreboard(
  params: FetchScoresParams = {},
): Promise<LiveScoresResponse> {
  const query = new URLSearchParams({
    sport: params.sport || 'all',
    status: params.status || 'all',
  });
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.refresh) query.set('refresh', '1');

  const res = await fetch(`/api/sports/scores?${query.toString()}`);
  if (!res.ok) {
    // If specific football view requested, gracefully fall back to direct football provider
    if (!params.sport || params.sport === 'soccer') {
      return fetchLiveFootballMatches(params);
    }
    throw new Error(`Unable to fetch live scoreboard (${res.status})`);
  }

  const data = (await res.json()) as LiveScoresResponse;
  return {
    updatedAt: data.updatedAt || new Date().toISOString(),
    liveCount: typeof data.liveCount === 'number' ? data.liveCount : 0,
    matches: Array.isArray(data.matches) ? data.matches : [],
    sportsChannels: Array.isArray(data.sportsChannels) ? data.sportsChannels : [],
  };
}

interface EspnPublicSummary {
  boxscore?: {
    teams?: Array<{
      homeAway?: 'home' | 'away';
      statistics?: Array<{
        name?: string;
        label?: string;
        displayValue?: string;
      }>;
    }>;
  };
  keyEvents?: Array<{
    clock?: { displayValue?: string };
    type?: { text?: string };
    text?: string;
    team?: { abbreviation?: string };
  }>;
  rosters?: Array<{
    homeAway?: 'home' | 'away';
    roster?: Array<{
      starter?: boolean;
      jersey?: string;
      position?: { abbreviation?: string; displayName?: string };
      athlete?: { displayName?: string; shortName?: string };
    }>;
  }>;
}

/**
 * Fetches live comparative team statistics, key match events, and lineups
 * for an individual fixture.
 */
export async function fetchMatchDetails(match: LiveMatchItem): Promise<LiveMatchDetails> {
  const empty: LiveMatchDetails = {
    stats: [],
    highlights: [],
    homeLineup: [],
    awayLineup: [],
  };

  if (!match.id || match.id.startsWith('fd-')) {
    return empty;
  }

  const leagueId = match.leagueId || 'soccer.all';
  try {
    const res = await fetch(
      `/api/sports/match/${encodeURIComponent(match.sport)}/${encodeURIComponent(leagueId)}/${encodeURIComponent(match.id)}`,
    );
    if (res.ok) {
      const data = (await res.json()) as Partial<LiveMatchDetails>;
      return {
        stats: Array.isArray(data.stats) ? data.stats : [],
        highlights: Array.isArray(data.highlights) ? data.highlights : [],
        homeLineup: Array.isArray(data.homeLineup) ? data.homeLineup : [],
        awayLineup: Array.isArray(data.awayLineup) ? data.awayLineup : [],
      };
    }
  } catch {
    // Fall through to direct CORS-enabled ESPN summary endpoint
  }

  try {
    const leaguePath = leagueId === 'soccer.all' ? 'all' : leagueId;
    const directRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${encodeURIComponent(match.sport)}/${encodeURIComponent(leaguePath)}/summary?event=${encodeURIComponent(match.id)}`,
    );
    if (!directRes.ok) return empty;
    const raw = (await directRes.json()) as EspnPublicSummary;

    const teams = raw.boxscore?.teams || [];
    const homeTeamBox = teams.find((t) => t.homeAway === 'home') || teams[0];
    const awayTeamBox = teams.find((t) => t.homeAway === 'away') || teams[1];
    const awayMap = new Map(
      (awayTeamBox?.statistics || []).map((s) => [s.name || s.label || '', s]),
    );

    const stats: LiveMatchStat[] = (homeTeamBox?.statistics || [])
      .slice(0, 10)
      .map((hs) => {
        const key = hs.name || hs.label || '';
        const as = awayMap.get(key);
        return {
          label: hs.label || key,
          homeValue: hs.displayValue || '0',
          awayValue: as?.displayValue || '0',
        };
      })
      .filter((s) => s.label);

    const highlights: LiveMatchHighlight[] = (raw.keyEvents || [])
      .filter((ev) => ev.text || ev.type?.text)
      .slice(0, 20)
      .map((ev) => ({
        clock: ev.clock?.displayValue || ev.type?.text || '',
        text: ev.text || ev.type?.text || '',
        teamAbbr: ev.team?.abbreviation,
      }));

    const rosters = raw.rosters || [];
    const homeRosterRaw = rosters.find((r) => r.homeAway === 'home') || rosters[0];
    const awayRosterRaw = rosters.find((r) => r.homeAway === 'away') || rosters[1];
    const mapRoster = (
      list?: NonNullable<EspnPublicSummary['rosters']>[number]['roster'],
    ): LiveMatchRosterPlayer[] =>
      (list || [])
        .map((p) => ({
          name: p.athlete?.displayName || p.athlete?.shortName || '',
          jersey: p.jersey,
          position: p.position?.abbreviation || p.position?.displayName,
          starter: Boolean(p.starter),
        }))
        .filter((p) => p.name)
        .slice(0, 22);

    return {
      stats,
      highlights,
      homeLineup: mapRoster(homeRosterRaw?.roster),
      awayLineup: mapRoster(awayRosterRaw?.roster),
    };
  } catch {
    return empty;
  }
}

