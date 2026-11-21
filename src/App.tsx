/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Menu,
  Search,
  ListMusic,
  SlidersHorizontal,
  X,
  Maximize2,
  Tv,
  Palette,
  Sun,
  Moon,
  Check,
  Film,
  Minimize2,
  LogIn,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { useAuth } from './contexts/AuthContext';
import { db } from './lib/firebase';
import type {
  AccentMode,
  AppView,
  DiscoverCatalog,
  EqSettings,
  MusicTrack,
  PlayHistoryEntry,
  RepeatMode,
  SleepTimerMode,
  SpotifyCuratedPlaylist,
  SpotifyEmbedTarget,
  SurfaceMode,
  TvChannel,
  UserPlaylist,
} from './types/music';
import { ACCENT_MODES, DEFAULT_EQ, EQ_BANDS, SURFACE_MODES } from './utils/formatters';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { HomeView } from './components/HomeView';
import { DiscoverView } from './components/DiscoverView';
import { RwandaMusicView } from './components/RwandaMusicView';
import { ListeningRoomView } from './components/ListeningRoomView';
import { LiveTvView } from './components/LiveTvView';
import { LiveMatchView } from './components/LiveMatchView';
import { VideosView } from './components/VideosView';
import { HlsVideoPlayer } from './components/HlsVideoPlayer';
import { AiStudioView } from './components/AiStudioView';
import { AiAssistantView } from './components/AiAssistantView';
import { MapExplorerView } from './components/MapExplorerView';
import { Stage3DView } from './components/Stage3DView';
import { RhythmGame3DView } from './components/RhythmGame3DView';
import {
  BrowseView,
  ArtistsView,
  ArtistProfileView,
  StoresView,
  HistoryView,
  LikedView,
  PlaylistsView,
  CustomPlaylistView,
} from './components/CatalogViews';
import {
  StoreLinksModal,
  SpotifyEmbedModal,
  LyricsModal,
  QueueDrawer,
  ShortcutsModal,
} from './components/ModalsAndDrawers';

interface YtPlayerInstance {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setVolume: (vol: number) => void;
  mute: () => void;
  unMute: () => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

interface YtGlobalNamespace {
  Player: new (
    el: HTMLElement | string,
    opts: {
      width?: string | number;
      height?: string | number;
      videoId?: string;
      host?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YtPlayerInstance }) => void;
        onStateChange?: (e: { data: number; target: YtPlayerInstance }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YtPlayerInstance;
  PlayerState?: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
  };
}

let ytApiPromise: Promise<YtGlobalNamespace | null> | null = null;
function loadYouTubeIframeApi(): Promise<YtGlobalNamespace | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const w = window as unknown as {
    YT?: YtGlobalNamespace;
    onYouTubeIframeAPIReady?: () => void;
  };
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const prevReady = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') prevReady();
      resolve(w.YT || null);
    };
    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    }
    setTimeout(() => {
      resolve(w.YT?.Player ? w.YT : null);
    }, 8000);
  });
  return ytApiPromise;
}

function loadJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>(() => {
    const savedSurface = localStorage.getItem('soundmark_surface_v2') as SurfaceMode | null;
    if (savedSurface && ['paper', 'ivory', 'midnight', 'slate'].includes(savedSurface)) {
      return savedSurface;
    }
    return 'midnight';
  });
  const [accentMode, setAccentMode] = useState<AccentMode>(() => {
    const savedAccent = localStorage.getItem('soundmark_accent_v2') as AccentMode | null;
    if (savedAccent && ['vermilion', 'cobalt', 'emerald', 'amber', 'plum'].includes(savedAccent)) {
      return savedAccent;
    }
    return 'amber';
  });
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);
  const { user, isAuthReady, signInWithGoogle, signOutUser } = useAuth();

  const [activeView, setActiveView] = useState<AppView>({ type: 'home' });
  const [previousView, setPreviousView] = useState<AppView>({ type: 'home' });
  const [searchQuery, setSearchQuery] = useState('');
  const [topSearchDraft, setTopSearchDraft] = useState('');
  const [tvSearchQuery, setTvSearchQuery] = useState('');
  const [activeTvChannel, setActiveTvChannel] = useState<TvChannel | null>(null);
  const [tvUseProxyRelay, setTvUseProxyRelay] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const topSearchInputRef = useRef<HTMLInputElement | null>(null);

  // Discovery catalog state
  const [catalog, setCatalog] = useState<DiscoverCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Track cache so liked/playlists/history always resolve full-length metadata
  const [trackCache, setTrackCache] = useState<Record<string, MusicTrack>>(() => {
    const raw = loadJsonStorage<Record<string, MusicTrack>>('soundmark_track_cache', {});
    const cleaned: Record<string, MusicTrack> = {};
    for (const [id, t] of Object.entries(raw)) {
      if (t && !t.isPreview && !id.startsWith('itunes-')) {
        cleaned[id] = t;
      }
    }
    return cleaned;
  });
  const [likedIds, setLikedIds] = useState<string[]>(() =>
    loadJsonStorage<string[]>('soundmark_liked_ids', []),
  );
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>(() =>
    loadJsonStorage<UserPlaylist[]>('soundmark_playlists', []),
  );
  const [history, setHistory] = useState<PlayHistoryEntry[]>(() =>
    loadJsonStorage<PlayHistoryEntry[]>('soundmark_history', []),
  );
  const [eqSettings, setEqSettings] = useState<EqSettings>(() =>
    loadJsonStorage<EqSettings>('soundmark_eq', DEFAULT_EQ),
  );
  const [crossfadeSec, setCrossfadeSec] = useState<number>(() => {
    const saved = Number(localStorage.getItem('soundmark_crossfade_sec'));
    return Number.isFinite(saved) && saved >= 0 && saved <= 12 ? saved : 0;
  });

  // Playback state
  const [queue, setQueue] = useState<MusicTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [sleepTimerMode, setSleepTimerMode] = useState<SleepTimerMode>('off');
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);

  // Modals
  const [storeModalTrack, setStoreModalTrack] = useState<MusicTrack | null>(null);
  const [lyricsModalTrack, setLyricsModalTrack] = useState<MusicTrack | null>(null);
  const [spotifyTarget, setSpotifyTarget] = useState<SpotifyEmbedTarget | null>(null);

  // Dual-Deck Audio & Web Audio API Equalizer + Analyser refs
  const deckARef = useRef<HTMLAudioElement | null>(null);
  const deckBRef = useRef<HTMLAudioElement | null>(null);
  const activeDeckRef = useRef<'A' | 'B'>('A');
  const gainARef = useRef<GainNode | null>(null);
  const gainBRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [hasLiveWebAudio, setHasLiveWebAudio] = useState(false);
  const crossfadeRafRef = useRef<number | null>(null);
  const crossfadingRef = useRef(false);
  const skipNextDeckLoadRef = useRef(false);

  // YouTube Music & Cinema Video Bridge
  const [showMusicVideo, setShowMusicVideo] = useState(false);
  const [videoTheaterExpanded, setVideoTheaterExpanded] = useState(false);
  const [resolvingVideoTrackId, setResolvingVideoTrackId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const htmlVideoRef = useRef<HTMLVideoElement | null>(null);
  const ytPlayerRef = useRef<YtPlayerInstance | null>(null);
  const ytReadyRef = useRef(false);
  const handleNextRef = useRef<() => void>(() => {});
  const repeatModeRef = useRef<RepeatMode>('off');
  const sleepTimerModeRef = useRef<SleepTimerMode>('off');
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  const playbackRateRef = useRef(eqSettings.playbackRate || 1);

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] ?? null : null;
  repeatModeRef.current = repeatMode;
  sleepTimerModeRef.current = sleepTimerMode;
  volumeRef.current = volume;
  isMutedRef.current = isMuted;
  playbackRateRef.current = eqSettings.playbackRate || 1;

  const getActiveAudio = useCallback(
    () => (activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current),
    [],
  );
  const getStandbyDeck = useCallback((): 'A' | 'B' => (activeDeckRef.current === 'A' ? 'B' : 'A'), []);

  // Sync color mode (surface + accent + dark class) on <html>
  useEffect(() => {
    const root = document.documentElement;
    const isDark = surfaceMode === 'midnight' || surfaceMode === 'slate';
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.dataset.surface = surfaceMode;
    root.dataset.accent = accentMode;
    localStorage.setItem('soundmark_surface_v2', surfaceMode);
    localStorage.setItem('soundmark_accent_v2', accentMode);
    localStorage.setItem('soundmark_theme', isDark ? 'dark' : 'light');
  }, [surfaceMode, accentMode]);

  // Persist user collections
  useEffect(() => {
    localStorage.setItem('soundmark_track_cache', JSON.stringify(trackCache));
  }, [trackCache]);
  useEffect(() => {
    localStorage.setItem('soundmark_liked_ids', JSON.stringify(likedIds));
  }, [likedIds]);
  useEffect(() => {
    localStorage.setItem('soundmark_playlists', JSON.stringify(userPlaylists));
  }, [userPlaylists]);
  useEffect(() => {
    localStorage.setItem('soundmark_history', JSON.stringify(history));
  }, [history]);
  useEffect(() => {
    localStorage.setItem('soundmark_eq', JSON.stringify(eqSettings));
  }, [eqSettings]);
  useEffect(() => {
    localStorage.setItem('soundmark_crossfade_sec', String(crossfadeSec));
  }, [crossfadeSec]);

  // Listen for Google Maps Demo Key quota exceeded events (Case A)
  useEffect(() => {
    const onQuota = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  // Firestore real-time sync for signed-in verified users (guarded by isAuthReady)
  const cloudHydratedRef = useRef(false);
  useEffect(() => {
    if (!isAuthReady || !user?.emailVerified) {
      cloudHydratedRef.current = false;
      return;
    }

    const libRef = doc(db, 'users', user.uid, 'library', 'state');
    const unsubLib = onSnapshot(
      libRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as { likedIds?: unknown };
          if (Array.isArray(data.likedIds)) {
            const remoteIds = data.likedIds.filter((x): x is string => typeof x === 'string');
            if (remoteIds.length > 0) {
              setLikedIds((prev) => Array.from(new Set([...remoteIds, ...prev])).slice(0, 200));
            }
          }
        }
        cloudHydratedRef.current = true;
      },
      () => {
        cloudHydratedRef.current = true;
      },
    );

    const plsRef = collection(db, 'users', user.uid, 'playlists');
    const unsubPls = onSnapshot(
      plsRef,
      (snap) => {
        const remotePlaylists: UserPlaylist[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as {
            name?: string;
            description?: string;
            trackIds?: string[];
          };
          if (d?.name) {
            remotePlaylists.push({
              id: docSnap.id,
              name: d.name,
              description: d.description || '',
              createdAt: new Date().toISOString(),
              trackIds: Array.isArray(d.trackIds) ? d.trackIds : [],
            });
          }
        });
        if (remotePlaylists.length > 0) {
          setUserPlaylists((prev) => {
            const map = new Map<string, UserPlaylist>();
            for (const p of prev) map.set(p.id, p);
            for (const p of remotePlaylists) map.set(p.id, p);
            return Array.from(map.values());
          });
        }
      },
      () => {},
    );

    return () => {
      unsubLib();
      unsubPls();
    };
  }, [isAuthReady, user?.uid, user?.emailVerified]);

  // Push liked tracks to Firestore when signed in
  useEffect(() => {
    if (!isAuthReady || !user?.emailVerified || !cloudHydratedRef.current) return;
    const libRef = doc(db, 'users', user.uid, 'library', 'state');
    void getDoc(doc(db, 'users', user.uid))
      .then((userSnap) => {
        if (!userSnap.exists()) return;
        return setDoc(
          libRef,
          {
            ownerUid: user.uid,
            likedIds: likedIds.slice(0, 200),
            pinnedMatchIds: [],
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      })
      .catch(() => {});
  }, [likedIds, isAuthReady, user?.uid, user?.emailVerified]);

  const cacheTracks = useCallback((tracks: MusicTrack[]) => {
    if (!tracks.length) return;
    setTrackCache((prev) => {
      const next = { ...prev };
      for (const t of tracks) {
        next[t.id] = t;
      }
      return next;
    });
  }, []);

  const loadCatalog = useCallback(
    async (refresh = false) => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const res = await fetch(refresh ? '/api/music/discover?refresh=1' : '/api/music/discover');
        if (!res.ok) throw new Error('Catalog unreachable');
        const data = (await res.json()) as DiscoverCatalog;
        setCatalog(data);
        const allTracks = [
          ...data.trendingTracks,
          ...data.liveStations,
          ...data.curatedPlaylists.flatMap((c) => c.tracks),
          ...data.featuredArtists.flatMap((a) => a.topTracks),
        ];
        cacheTracks(allTracks);
      } catch (e) {
        setCatalogError(e instanceof Error ? e.message : 'Unable to reach Soundmark catalog');
      } finally {
        setCatalogLoading(false);
      }
    },
    [cacheTracks],
  );

  useEffect(() => {
    loadCatalog(false);
  }, [loadCatalog]);

  // Initialize dual-deck Web Audio GainNodes + 5-Band EQ & FFT Analyser cleanly
  const ensureWebAudioChain = useCallback(() => {
    const deckA = deckARef.current;
    const deckB = deckBRef.current;
    if (!deckA || !deckB || audioCtxRef.current) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const srcA = ctx.createMediaElementSource(deckA);
      const srcB = ctx.createMediaElementSource(deckB);
      const gainA = ctx.createGain();
      const gainB = ctx.createGain();
      gainA.gain.value = activeDeckRef.current === 'A' ? 1 : 0;
      gainB.gain.value = activeDeckRef.current === 'B' ? 1 : 0;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;

      const filters = EQ_BANDS.map((band, i) => {
        const filter = ctx.createBiquadFilter();
        filter.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = band.freq;
        filter.Q.value = 1.1;
        filter.gain.value = eqSettings.enabled ? eqSettings.bands[i] : 0;
        return filter;
      });

      srcA.connect(gainA);
      srcB.connect(gainB);
      gainA.connect(filters[0]);
      gainB.connect(filters[0]);

      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }
      filters[filters.length - 1].connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      gainARef.current = gainA;
      gainBRef.current = gainB;
      filtersRef.current = filters;
      analyserRef.current = analyser;
      setHasLiveWebAudio(true);
    } catch {
      setHasLiveWebAudio(false);
    }
  }, [eqSettings.bands, eqSettings.enabled]);

  const cancelOngoingCrossfade = useCallback(() => {
    if (crossfadeRafRef.current !== null) {
      cancelAnimationFrame(crossfadeRafRef.current);
      crossfadeRafRef.current = null;
    }
    crossfadingRef.current = false;
    setIsCrossfading(false);

    const standby = getStandbyDeck();
    const standbyEl = standby === 'A' ? deckARef.current : deckBRef.current;
    const standbyGain = standby === 'A' ? gainARef.current : gainBRef.current;
    const activeEl = getActiveAudio();
    const activeGain = activeDeckRef.current === 'A' ? gainARef.current : gainBRef.current;

    if (standbyEl) {
      standbyEl.pause();
      standbyEl.removeAttribute('src');
      standbyEl.load();
    }
    if (standbyGain) standbyGain.gain.value = 0;
    if (activeGain) activeGain.gain.value = 1;
    if (activeEl) activeEl.volume = isMuted ? 0 : volume;
  }, [getActiveAudio, getStandbyDeck, isMuted, volume]);

  // Apply EQ changes in real time
  useEffect(() => {
    filtersRef.current.forEach((filter, idx) => {
      filter.gain.value = eqSettings.enabled ? eqSettings.bands[idx] || 0 : 0;
    });
    const activeEl = getActiveAudio();
    if (activeEl && !currentTrack?.isLive && !currentTrack?.youtubeVideoId) {
      activeEl.playbackRate = eqSettings.playbackRate || 1;
    }
    if (currentTrack?.youtubeVideoId && ytPlayerRef.current && ytReadyRef.current) {
      try {
        ytPlayerRef.current.setPlaybackRate(eqSettings.playbackRate || 1);
      } catch {
        // Ignore unsupported rates
      }
    }
  }, [eqSettings, currentTrack?.isLive, currentTrack?.youtubeVideoId, getActiveAudio]);

  // Helper to push playback history entry cleanly
  const recordTrackHistory = useCallback((track: MusicTrack) => {
    setHistory((prev) => {
      const entry: PlayHistoryEntry = {
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        genre: track.genre,
        country: track.country,
        sourceLabel: track.sourceLabel,
        coverUrl: track.coverUrl,
        durationSec: track.durationSec,
        playedAt: new Date().toISOString(),
      };
      return [entry, ...prev.slice(0, 49)];
    });
  }, []);

  // Sync active audio deck OR YouTube player when currentTrack changes outside an auto-crossfade
  useEffect(() => {
    if (!currentTrack) return;
    if (skipNextDeckLoadRef.current) {
      skipNextDeckLoadRef.current = false;
      return;
    }

    let cancelled = false;
    cancelOngoingCrossfade();

    if (currentTrack.youtubeVideoId) {
      const videoId = currentTrack.youtubeVideoId;
      deckARef.current?.pause();
      deckBRef.current?.pause();
      setPlaybackError(null);
      setIsBuffering(true);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(currentTrack.durationSec || 0);

      loadYouTubeIframeApi().then((YT) => {
        if (cancelled || !YT?.Player) {
          if (!cancelled) {
            setIsBuffering(false);
            setPlaybackError('YouTube player unavailable — try another track');
          }
          return;
        }

        if (ytPlayerRef.current && ytReadyRef.current) {
          try {
            if (isMutedRef.current) {
              ytPlayerRef.current.mute();
            } else {
              ytPlayerRef.current.unMute();
              ytPlayerRef.current.setVolume(Math.round(volumeRef.current * 100));
            }
            ytPlayerRef.current.loadVideoById(videoId);
            ytPlayerRef.current.setPlaybackRate(playbackRateRef.current);
            recordTrackHistory(currentTrack);
          } catch {
            setIsBuffering(false);
          }
          return;
        }

        if (!ytHostRef.current) return;
        ytReadyRef.current = false;
        ytPlayerRef.current = new YT.Player(ytHostRef.current, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              ytReadyRef.current = true;
              if (isMutedRef.current) {
                e.target.mute();
              } else {
                e.target.unMute();
                e.target.setVolume(Math.round(volumeRef.current * 100));
              }
              try {
                e.target.setPlaybackRate(playbackRateRef.current);
              } catch {
                // Ignore unsupported playback rate
              }
              e.target.playVideo();
              recordTrackHistory(currentTrack);
            },
            onStateChange: (e) => {
              if (e.data === 1) {
                setIsPlaying(true);
                setIsBuffering(false);
                setPlaybackError(null);
                const d = e.target.getDuration();
                if (Number.isFinite(d) && d > 0) setDuration(d);
              } else if (e.data === 2) {
                setIsPlaying(false);
                setIsBuffering(false);
              } else if (e.data === 3) {
                setIsBuffering(true);
              } else if (e.data === 0) {
                if (sleepTimerModeRef.current === 'track') {
                  setIsPlaying(false);
                  setSleepTimerMode('off');
                  return;
                }
                if (repeatModeRef.current === 'one') {
                  e.target.seekTo(0, true);
                  e.target.playVideo();
                } else {
                  handleNextRef.current();
                }
              }
            },
            onError: () => {
              setIsBuffering(false);
              setIsPlaying(false);
              setPlaybackError('Track video blocked — skipping to next song');
              setTimeout(() => {
                handleNextRef.current();
              }, 1400);
            },
          },
        });
      });

      return () => {
        cancelled = true;
      };
    }

    // Standard HTML5 Video Track (Archive Cinema MP4)
    if (ytPlayerRef.current && ytReadyRef.current) {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch {
        // Ignore
      }
    }

    if (currentTrack.videoUrl) {
      deckARef.current?.pause();
      deckBRef.current?.pause();
      setPlaybackError(null);
      setIsBuffering(false);
      setCurrentTime(0);
      setDuration(currentTrack.durationSec || 0);
      return;
    }

    const activeEl = getActiveAudio();
    if (!activeEl) return;

    setPlaybackError(null);
    setCurrentTime(0);
    setDuration(currentTrack.durationSec || 0);
    activeEl.src = currentTrack.audioUrl;
    activeEl.volume = isMuted ? 0 : volume;
    activeEl.playbackRate = currentTrack.isLive ? 1 : eqSettings.playbackRate || 1;

    ensureWebAudioChain();
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }

    activeEl
      .play()
      .then(() => {
        setIsPlaying(true);
        recordTrackHistory(currentTrack);
      })
      .catch(() => {
        setIsPlaying(false);
      });
  }, [currentTrack?.id]);

  // Poll YouTube currentTime & duration smoothly during playback
  useEffect(() => {
    if (!currentTrack?.youtubeVideoId || !isPlaying) return;
    const id = setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p || !ytReadyRef.current) return;
      try {
        const t = p.getCurrentTime();
        const d = p.getDuration();
        if (Number.isFinite(t) && t >= 0) setCurrentTime(t);
        if (Number.isFinite(d) && d > 0) setDuration(d);
      } catch {
        // Ignore transient YT bridge errors
      }
    }, 300);
    return () => clearInterval(id);
  }, [currentTrack?.youtubeVideoId, isPlaying]);

  // Volume & Mute sync when not crossfading
  useEffect(() => {
    if (crossfadingRef.current) return;
    const activeEl = getActiveAudio();
    if (activeEl) {
      activeEl.volume = isMuted ? 0 : volume;
    }
    if (ytPlayerRef.current && ytReadyRef.current) {
      try {
        if (isMuted) {
          ytPlayerRef.current.mute();
        } else {
          ytPlayerRef.current.unMute();
          ytPlayerRef.current.setVolume(Math.round(volume * 100));
        }
      } catch {
        // Ignore
      }
    }
  }, [volume, isMuted, getActiveAudio]);

  // Sleep Timer Countdown
  useEffect(() => {
    if (sleepTimerMode === 'off' || sleepTimerMode === 'track') {
      setSleepRemainingSec(null);
      return;
    }
    const mins = Number(sleepTimerMode);
    if (!Number.isFinite(mins)) return;
    setSleepRemainingSec(mins * 60);

    const interval = setInterval(() => {
      setSleepRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          cancelOngoingCrossfade();
          getActiveAudio()?.pause();
          try {
            ytPlayerRef.current?.pauseVideo();
          } catch {
            // Ignore
          }
          setIsPlaying(false);
          setSleepTimerMode('off');
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerMode, cancelOngoingCrossfade, getActiveAudio]);

  const resolveNextIndex = useCallback((): number | null => {
    if (queue.length === 0) return null;
    if (shuffle && queue.length > 1) {
      let nextIdx = Math.floor(Math.random() * queue.length);
      if (nextIdx === currentIndex) nextIdx = (currentIndex + 1) % queue.length;
      return nextIdx;
    }
    if (currentIndex < queue.length - 1) return currentIndex + 1;
    if (repeatMode === 'all') return 0;
    return null;
  }, [queue.length, shuffle, currentIndex, repeatMode]);

  const startCrossfadeToIndex = useCallback(
    (nextIdx: number, fadeSeconds: number) => {
      const nextTrack = queue[nextIdx];
      if (!nextTrack) return;

      const outDeck = activeDeckRef.current;
      const inDeck = getStandbyDeck();
      const outEl = outDeck === 'A' ? deckARef.current : deckBRef.current;
      const inEl = inDeck === 'A' ? deckARef.current : deckBRef.current;
      const outGain = outDeck === 'A' ? gainARef.current : gainBRef.current;
      const inGain = inDeck === 'A' ? gainARef.current : gainBRef.current;

      if (!outEl || !inEl) return;

      crossfadingRef.current = true;
      setIsCrossfading(true);
      ensureWebAudioChain();

      // Switch foreground state to incoming track immediately
      activeDeckRef.current = inDeck;
      skipNextDeckLoadRef.current = true;
      setCurrentIndex(nextIdx);
      setCurrentTime(0);
      setDuration(nextTrack.durationSec || 0);
      setPlaybackError(null);

      // Prepare incoming deck at zero gain
      const masterVol = isMuted ? 0 : volume;
      if (inGain) inGain.gain.value = 0;
      inEl.src = nextTrack.audioUrl;
      inEl.volume = inGain ? masterVol : 0;
      inEl.playbackRate = nextTrack.isLive ? 1 : eqSettings.playbackRate || 1;

      inEl
        .play()
        .then(() => {
          setIsPlaying(true);
          setHistory((prev) => {
            const entry: PlayHistoryEntry = {
              trackId: nextTrack.id,
              title: nextTrack.title,
              artist: nextTrack.artist,
              genre: nextTrack.genre,
              country: nextTrack.country,
              sourceLabel: nextTrack.sourceLabel,
              coverUrl: nextTrack.coverUrl,
              durationSec: nextTrack.durationSec,
              playedAt: new Date().toISOString(),
            };
            return [entry, ...prev.slice(0, 49)];
          });

          const durationMs = Math.max(400, fadeSeconds * 1000);
          const startTs = performance.now();

          const step = (now: number) => {
            const t = Math.min(1, (now - startTs) / durationMs);
            // Smooth equal-power sine/cosine curve
            const outLevel = Math.cos(t * Math.PI * 0.5);
            const inLevel = Math.sin(t * Math.PI * 0.5);
            const liveMaster = isMuted ? 0 : volume;

            if (outGain && inGain) {
              outGain.gain.value = outLevel;
              inGain.gain.value = inLevel;
              outEl.volume = liveMaster;
              inEl.volume = liveMaster;
            } else {
              outEl.volume = liveMaster * outLevel;
              inEl.volume = liveMaster * inLevel;
            }

            if (t < 1 && crossfadingRef.current) {
              crossfadeRafRef.current = requestAnimationFrame(step);
            } else {
              outEl.pause();
              outEl.removeAttribute('src');
              outEl.load();
              if (outGain) outGain.gain.value = 0;
              if (inGain) inGain.gain.value = 1;
              inEl.volume = liveMaster;
              crossfadingRef.current = false;
              crossfadeRafRef.current = null;
              setIsCrossfading(false);
            }
          };

          crossfadeRafRef.current = requestAnimationFrame(step);
        })
        .catch(() => {
          // Fallback to clean cut if standby play fails
          cancelOngoingCrossfade();
          activeDeckRef.current = inDeck;
          setIsPlaying(false);
        });
    },
    [
      queue,
      getStandbyDeck,
      ensureWebAudioChain,
      isMuted,
      volume,
      eqSettings.playbackRate,
      cancelOngoingCrossfade,
    ],
  );

  const handlePlayTrack = useCallback(
    (track: MusicTrack, contextTracks?: MusicTrack[]) => {
      setActiveTvChannel(null);
      cacheTracks([track, ...(contextTracks || [])]);
      if (contextTracks && contextTracks.length > 0) {
        const idx = contextTracks.findIndex((t) => t.id === track.id);
        setQueue(contextTracks);
        setCurrentIndex(idx >= 0 ? idx : 0);
      } else {
        const existingIdx = queue.findIndex((t) => t.id === track.id);
        if (existingIdx >= 0) {
          setCurrentIndex(existingIdx);
        } else {
          setQueue((prev) => [track, ...prev]);
          setCurrentIndex(0);
        }
      }
    },
    [cacheTracks, queue],
  );

  const handlePlayAll = useCallback(
    (tracks: MusicTrack[]) => {
      if (!tracks.length) return;
      setActiveTvChannel(null);
      cacheTracks(tracks);
      setQueue(tracks);
      setCurrentIndex(0);
    },
    [cacheTracks],
  );

  const handleTogglePlayPause = useCallback(() => {
    if (!currentTrack) return;
    if (currentTrack.youtubeVideoId) {
      const yt = ytPlayerRef.current;
      if (!yt || !ytReadyRef.current) return;
      if (isPlaying) {
        yt.pauseVideo();
        setIsPlaying(false);
      } else {
        setActiveTvChannel(null);
        yt.playVideo();
        setIsPlaying(true);
      }
      return;
    }

    if (currentTrack.videoUrl) {
      const vid = htmlVideoRef.current;
      if (!vid) return;
      if (isPlaying) {
        vid.pause();
        setIsPlaying(false);
      } else {
        setActiveTvChannel(null);
        vid.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      return;
    }

    const audioEl = getActiveAudio();
    if (!audioEl) return;
    if (isPlaying) {
      cancelOngoingCrossfade();
      audioEl.pause();
      setIsPlaying(false);
    } else {
      setActiveTvChannel(null);
      ensureWebAudioChain();
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      audioEl
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setPlaybackError('Tap play again to resume stream'));
    }
  }, [currentTrack, ensureWebAudioChain, isPlaying, getActiveAudio, cancelOngoingCrossfade]);

  const handleNext = useCallback(() => {
    const nextIdx = resolveNextIndex();
    if (nextIdx === null) {
      setIsPlaying(false);
      return;
    }
    const nextTrack = queue[nextIdx];
    if (
      crossfadeSec > 0 &&
      isPlaying &&
      !currentTrack?.isLive &&
      !currentTrack?.youtubeVideoId &&
      !nextTrack?.youtubeVideoId &&
      !crossfadingRef.current
    ) {
      startCrossfadeToIndex(nextIdx, Math.min(crossfadeSec, 2));
    } else {
      setCurrentIndex(nextIdx);
    }
  }, [
    resolveNextIndex,
    queue,
    crossfadeSec,
    isPlaying,
    currentTrack?.isLive,
    currentTrack?.youtubeVideoId,
    startCrossfadeToIndex,
  ]);
  handleNextRef.current = handleNext;

  const handlePrevious = useCallback(() => {
    if (!queue.length) return;
    if (currentTime > 4) {
      if (currentTrack?.youtubeVideoId && ytPlayerRef.current && ytReadyRef.current) {
        ytPlayerRef.current.seekTo(0, true);
        setCurrentTime(0);
        return;
      }
      if (currentTrack?.videoUrl && htmlVideoRef.current) {
        htmlVideoRef.current.currentTime = 0;
        setCurrentTime(0);
        return;
      }
      const activeEl = getActiveAudio();
      if (activeEl) {
        activeEl.currentTime = 0;
        setCurrentTime(0);
        return;
      }
    }
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      setCurrentIndex(queue.length - 1);
    }
  }, [queue.length, currentIndex, currentTime, currentTrack?.youtubeVideoId, currentTrack?.videoUrl, getActiveAudio]);

  const handleSeek = useCallback(
    (sec: number) => {
      if (currentTrack?.youtubeVideoId && ytPlayerRef.current && ytReadyRef.current) {
        ytPlayerRef.current.seekTo(sec, true);
        setCurrentTime(sec);
        return;
      }
      if (currentTrack?.videoUrl && htmlVideoRef.current) {
        htmlVideoRef.current.currentTime = sec;
        setCurrentTime(sec);
        return;
      }
      const activeEl = getActiveAudio();
      if (!activeEl) return;
      activeEl.currentTime = sec;
      setCurrentTime(sec);
    },
    [currentTrack?.youtubeVideoId, currentTrack?.videoUrl, getActiveAudio],
  );

  const handleAddToQueue = useCallback(
    (track: MusicTrack) => {
      cacheTracks([track]);
      setQueue((prev) => {
        if (prev.length === 0) {
          setCurrentIndex(0);
          return [track];
        }
        return [...prev, track];
      });
    },
    [cacheTracks],
  );

  const handleToggleLike = useCallback(
    (track: MusicTrack) => {
      cacheTracks([track]);
      setLikedIds((prev) =>
        prev.includes(track.id) ? prev.filter((id) => id !== track.id) : [track.id, ...prev],
      );
    },
    [cacheTracks],
  );

  const handleCreatePlaylist = useCallback(
    (name: string) => {
      const newPl: UserPlaylist = {
        id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        description: '',
        createdAt: new Date().toISOString(),
        trackIds: [],
      };
      setUserPlaylists((prev) => [newPl, ...prev]);
      setActiveView({ type: 'custom_playlist', playlistId: newPl.id });

      if (user?.emailVerified) {
        void setDoc(doc(db, 'users', user.uid, 'playlists', newPl.id), {
          ownerUid: user.uid,
          name: newPl.name.slice(0, 80),
          description: '',
          trackIds: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    },
    [user?.uid, user?.emailVerified],
  );

  const handleAddToPlaylist = useCallback(
    (playlistId: string, track: MusicTrack) => {
      cacheTracks([track]);
      setUserPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id === playlistId && !pl.trackIds.includes(track.id)) {
            const nextIds = [...pl.trackIds, track.id].slice(0, 200);
            if (user?.emailVerified) {
              void setDoc(
                doc(db, 'users', user.uid, 'playlists', playlistId),
                {
                  ownerUid: user.uid,
                  name: pl.name.slice(0, 80),
                  description: pl.description || '',
                  trackIds: nextIds,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
                { merge: true },
              ).catch(() => {});
            }
            return { ...pl, trackIds: nextIds };
          }
          return pl;
        }),
      );
    },
    [cacheTracks, user?.uid, user?.emailVerified],
  );

  const handleRemoveFromPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      setUserPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id === playlistId) {
            const nextIds = pl.trackIds.filter((id) => id !== trackId);
            if (user?.emailVerified) {
              void setDoc(
                doc(db, 'users', user.uid, 'playlists', playlistId),
                {
                  ownerUid: user.uid,
                  name: pl.name.slice(0, 80),
                  description: pl.description || '',
                  trackIds: nextIds,
                  updatedAt: serverTimestamp(),
                },
                { merge: true },
              ).catch(() => {});
            }
            return { ...pl, trackIds: nextIds };
          }
          return pl;
        }),
      );
    },
    [user?.uid, user?.emailVerified],
  );

  const handleDeletePlaylist = useCallback(
    (playlistId: string) => {
      setUserPlaylists((prev) => prev.filter((pl) => pl.id !== playlistId));
      if (activeView.type === 'custom_playlist' && activeView.playlistId === playlistId) {
        setActiveView({ type: 'playlists' });
      }
      if (user?.emailVerified) {
        void deleteDoc(doc(db, 'users', user.uid, 'playlists', playlistId)).catch(() => {});
      }
    },
    [activeView, user?.uid, user?.emailVerified],
  );

  const handleSelectArtist = useCallback(
    (artistId: string, artistName?: string) => {
      if (activeView.type !== 'artist_profile') setPreviousView(activeView);
      setActiveView({ type: 'artist_profile', artistId, artistName });
    },
    [activeView],
  );

  const handleOpenSpotifyEmbed = useCallback((track: MusicTrack) => {
    if (!track.spotifyEmbedUrl) return;
    setSpotifyTarget({
      title: track.title,
      subtitle: `${track.artist} · ${track.album || 'Spotify'}`,
      embedUrl: track.spotifyEmbedUrl,
      externalUrl: track.spotifyUrl || track.spotifyEmbedUrl.replace('/embed/', '/'),
      isPlaylist: false,
    });
  }, []);

  const handleOpenSpotifyPlaylistEmbed = useCallback((pl: SpotifyCuratedPlaylist) => {
    setSpotifyTarget({
      title: pl.title,
      subtitle: pl.subtitle,
      embedUrl: pl.spotifyEmbedUrl,
      externalUrl: pl.spotifyUrl,
      isPlaylist: true,
    });
  }, []);

  const handleImportSpotifyUrl = useCallback((url: string) => {
    setSearchQuery(url);
    setActiveView({ type: 'browse', initialPlatform: 'All Platforms' });
  }, []);

  const handleMoveQueueItem = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (toIdx < 0 || toIdx >= queue.length) return;
      setQueue((prev) => {
        const copy = [...prev];
        const [item] = copy.splice(fromIdx, 1);
        copy.splice(toIdx, 0, item);
        return copy;
      });
      if (currentIndex === fromIdx) {
        setCurrentIndex(toIdx);
      } else if (fromIdx < currentIndex && toIdx >= currentIndex) {
        setCurrentIndex((i) => i - 1);
      } else if (fromIdx > currentIndex && toIdx <= currentIndex) {
        setCurrentIndex((i) => i + 1);
      }
    },
    [currentIndex, queue.length],
  );

  const handleTopSearchSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = topSearchDraft.trim();
      if (activeView.type === 'tv') {
        setTvSearchQuery(trimmed);
      } else {
        setSearchQuery(trimmed);
        setActiveView({ type: 'browse' });
      }
      setMobileSearchOpen(false);
    },
    [topSearchDraft, activeView.type],
  );

  const handlePauseMusicForTv = useCallback(() => {
    cancelOngoingCrossfade();
    getActiveAudio()?.pause();
    try {
      ytPlayerRef.current?.pauseVideo();
    } catch {
      // Ignore
    }
    setIsPlaying(false);
  }, [cancelOngoingCrossfade, getActiveAudio]);

  const handleSelectTvChannel = useCallback(
    (channel: TvChannel) => {
      handlePauseMusicForTv();
      setTvUseProxyRelay(false);
      setActiveTvChannel(channel);
    },
    [handlePauseMusicForTv],
  );

  const handleNavigateView = useCallback(
    (next: AppView) => {
      if (
        (next.type === 'tv' || next.type === 'matches') &&
        activeView.type !== 'tv' &&
        activeView.type !== 'matches'
      ) {
        setPreviousView(activeView);
      }
      setActiveView(next);
    },
    [activeView],
  );

  const handleWatchTvFromDiscover = useCallback(
    (channel: TvChannel) => {
      handleSelectTvChannel(channel);
      if (activeView.type !== 'tv' && activeView.type !== 'matches') {
        setPreviousView(activeView);
      }
      setActiveView({ type: 'tv' });
    },
    [activeView, handleSelectTvChannel],
  );

  const handleWatchMatchTvFromDiscover = useCallback(
    (channel?: TvChannel) => {
      if (channel) handleSelectTvChannel(channel);
      if (activeView.type !== 'tv' && activeView.type !== 'matches') {
        setPreviousView(activeView);
      }
      setActiveView({ type: 'matches' });
    },
    [activeView, handleSelectTvChannel],
  );

  const handlePopOutMiniTv = useCallback(() => {
    setActiveView(
      previousView.type !== 'tv' && previousView.type !== 'matches'
        ? previousView
        : { type: 'discover' },
    );
  }, [previousView]);

  const handleWatchVideoTrack = useCallback(
    async (track: MusicTrack, contextTracks?: MusicTrack[]) => {
      if (track.youtubeVideoId || track.videoUrl) {
        handlePlayTrack(track, contextTracks);
        setShowMusicVideo(true);
        setVideoTheaterExpanded(true);
        return;
      }

      setResolvingVideoTrackId(track.id);
      try {
        const params = new URLSearchParams({
          artist: track.artist || '',
          title: track.title || '',
        });
        const res = await fetch(`/api/videos/resolve?${params.toString()}`);
        const data = await res.json();
        if (data?.videoId) {
          const videoTrack: MusicTrack = {
            ...track,
            youtubeVideoId: data.videoId,
            isVideo: true,
          };
          const updatedContext = contextTracks?.map((t) =>
            t.id === track.id ? videoTrack : t,
          );
          cacheTracks([videoTrack]);
          setQueue((prev) => prev.map((t) => (t.id === track.id ? videoTrack : t)));
          handlePlayTrack(videoTrack, updatedContext);
          setShowMusicVideo(true);
          setVideoTheaterExpanded(true);
        } else {
          setActiveView({ type: 'videos' });
        }
      } catch {
        setActiveView({ type: 'videos' });
      } finally {
        setResolvingVideoTrackId((prev) => (prev === track.id ? null : prev));
      }
    },
    [cacheTracks, handlePlayTrack],
  );

  // Global keyboard shortcuts (Space play/pause, / or Cmd+K search, ? shortcuts, N/P/J/L/M/V/T/Q, Esc close)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        topSearchInputRef.current?.focus();
        return;
      }
      if (e.code === 'Escape') {
        if (shortcutsOpen) return setShortcutsOpen(false);
        if (colorMenuOpen) return setColorMenuOpen(false);
        if (spotifyTarget) return setSpotifyTarget(null);
        if (storeModalTrack) return setStoreModalTrack(null);
        if (lyricsModalTrack) return setLyricsModalTrack(null);
        if (videoTheaterExpanded) return setVideoTheaterExpanded(false);
        if (queueOpen) return setQueueOpen(false);
        if (mobileSearchOpen) return setMobileSearchOpen(false);
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
          e.preventDefault();
          setShortcutsOpen((v) => !v);
          return;
        }
        if (e.key === '/') {
          e.preventDefault();
          topSearchInputRef.current?.focus();
          return;
        }
        if (e.code === 'Space' && currentTrack) {
          e.preventDefault();
          handleTogglePlayPause();
          return;
        }
        const low = e.key.toLowerCase();
        if (low === 'm') {
          e.preventDefault();
          setIsMuted((m) => !m);
        } else if (low === 'n' && currentTrack) {
          e.preventDefault();
          handleNext();
        } else if (low === 'p' && currentTrack) {
          e.preventDefault();
          handlePrevious();
        } else if (low === 'j' && currentTrack && !currentTrack.isLive) {
          e.preventDefault();
          handleSeek(Math.max(0, currentTime - 10));
        } else if (low === 'l' && currentTrack && !currentTrack.isLive) {
          e.preventDefault();
          const maxDur = duration > 0 ? duration : currentTrack.durationSec || currentTime + 10;
          handleSeek(Math.min(maxDur, currentTime + 10));
        } else if (low === 'v') {
          e.preventDefault();
          if (currentTrack?.youtubeVideoId || currentTrack?.videoUrl) {
            if (videoTheaterExpanded) {
              setVideoTheaterExpanded(false);
            } else if (showMusicVideo) {
              setVideoTheaterExpanded(true);
            } else {
              setShowMusicVideo(true);
            }
          } else if (currentTrack && !currentTrack.isLive) {
            handleWatchVideoTrack(currentTrack);
          } else {
            setActiveView({ type: 'videos' });
          }
        } else if (low === 'h') {
          e.preventDefault();
          handleNavigateView({ type: 'home' });
        } else if (low === 't') {
          e.preventDefault();
          handleNavigateView({ type: 'tv' });
        } else if (low === 's') {
          e.preventDefault();
          handleNavigateView({ type: 'matches' });
        } else if (low === 'q') {
          e.preventDefault();
          setQueueOpen((v) => !v);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    colorMenuOpen,
    currentTime,
    currentTrack,
    duration,
    handleNavigateView,
    handleNext,
    handlePrevious,
    handleSeek,
    handleTogglePlayPause,
    lyricsModalTrack,
    mobileSearchOpen,
    queueOpen,
    shortcutsOpen,
    showMusicVideo,
    spotifyTarget,
    storeModalTrack,
    videoTheaterExpanded,
  ]);

  const likedIdSet = useMemo(() => new Set(likedIds), [likedIds]);
  const likedTracks = useMemo(
    () => likedIds.map((id) => trackCache[id]).filter((t): t is MusicTrack => !!t),
    [likedIds, trackCache],
  );
  const upcomingCount = Math.max(0, queue.length - (currentIndex + 1));

  const activeSurfaceMeta = SURFACE_MODES.find((m) => m.id === surfaceMode) || SURFACE_MODES[0];

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[var(--sm-bg)] text-[var(--sm-text)]">
      {/* Google Maps Demo Key Quota Exhaustion Banner (only shown when triggered) */}
      {gmpQuotaExceeded && (
        <div
          role="alert"
          className="sticky top-0 z-50 px-4 py-2 bg-amber-950 text-amber-100 border-b border-amber-700/60 flex items-center justify-between gap-3 text-xs"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <span>
              Demo Google Maps API key daily quota reached. Link your own Google Cloud Maps API key in project environment settings to restore map tiles and autocomplete.
            </span>
          </span>
          <button
            type="button"
            onClick={() => setGmpQuotaExceeded(false)}
            aria-label="Dismiss Maps quota notice"
            className="p-1 text-amber-300 hover:text-white shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {/* Hidden Dual-Deck CORS-enabled audio elements for gapless & crossfade transitions */}
      {(['A', 'B'] as const).map((deck) => (
        <audio
          key={deck}
          ref={deck === 'A' ? deckARef : deckBRef}
          crossOrigin="anonymous"
          preload="metadata"
          onTimeUpdate={(e) => {
            if (activeDeckRef.current !== deck) return;
            const time = e.currentTarget.currentTime;
            const total = e.currentTarget.duration;
            setCurrentTime(time);

            // Trigger automatic crossfade when approaching track end (standard HTML5 tracks only)
            const upcomingTrack = queue[resolveNextIndex() ?? -1];
            if (
              crossfadeSec > 0 &&
              !crossfadingRef.current &&
              currentTrack &&
              !currentTrack.isLive &&
              !currentTrack.youtubeVideoId &&
              !upcomingTrack?.youtubeVideoId &&
              repeatMode !== 'one' &&
              sleepTimerMode !== 'track' &&
              Number.isFinite(total) &&
              total > crossfadeSec + 1.5 &&
              total - time <= crossfadeSec
            ) {
              const nextIdx = resolveNextIndex();
              if (nextIdx !== null) {
                startCrossfadeToIndex(nextIdx, crossfadeSec);
              }
            }
          }}
          onLoadedMetadata={(e) => {
            if (activeDeckRef.current !== deck) return;
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDuration(d);
          }}
          onWaiting={() => {
            if (activeDeckRef.current === deck) setIsBuffering(true);
          }}
          onCanPlay={() => {
            if (activeDeckRef.current === deck) setIsBuffering(false);
          }}
          onPlaying={() => {
            if (activeDeckRef.current !== deck) return;
            setIsPlaying(true);
            setIsBuffering(false);
            setPlaybackError(null);
          }}
          onPause={() => {
            if (activeDeckRef.current === deck && !crossfadingRef.current) {
              setIsPlaying(false);
            }
          }}
          onEnded={() => {
            if (activeDeckRef.current !== deck) return;
            if (sleepTimerMode === 'track') {
              setIsPlaying(false);
              setSleepTimerMode('off');
              return;
            }
            if (repeatMode === 'one') {
              const el = deck === 'A' ? deckARef.current : deckBRef.current;
              if (el) {
                el.currentTime = 0;
                el.play().catch(() => {});
              }
            } else {
              handleNext();
            }
          }}
          onError={() => {
            if (activeDeckRef.current !== deck || crossfadingRef.current) return;
            setIsBuffering(false);
            setIsPlaying(false);
            setPlaybackError('Stream unavailable — try another track');
          }}
        />
      ))}

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <Sidebar
          activeView={activeView}
          onNavigate={handleNavigateView}
          userPlaylists={userPlaylists}
          likedCount={likedTracks.length}
          historyCount={history.length}
          onCreatePlaylist={handleCreatePlaylist}
          surfaceMode={surfaceMode}
          accentMode={accentMode}
          onChangeSurface={setSurfaceMode}
          onChangeAccent={setAccentMode}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* 3-Zone Top Bar */}
          <header className="relative z-20 h-16 shrink-0 px-4 sm:px-8 border-b border-[var(--sm-border)] bg-[var(--sm-surface-glass)] backdrop-blur-md flex items-center justify-between gap-4 sm:gap-8">
            {/* Zone 1: Mobile trigger + Clickable Direct Search Form */}
            <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation"
                className="lg:hidden p-2 -ml-2 rounded-lg text-[var(--sm-text-sec)]"
              >
                <Menu size={20} />
              </button>

              <form
                onSubmit={handleTopSearchSubmit}
                className={`${
                  mobileSearchOpen ? 'flex flex-1' : 'hidden sm:flex'
                } items-center gap-2 px-3.5 h-9 sm:w-52 lg:w-56 xl:w-72 rounded-full bg-[var(--sm-muted)]/65 border border-[var(--sm-border)] focus-within:border-[var(--sm-accent)] focus-within:bg-[var(--sm-bg)] transition-colors`}
              >
                <Search size={14} className="shrink-0 text-[var(--sm-text-muted)]" />
                <input
                  ref={topSearchInputRef}
                  type="text"
                  value={topSearchDraft}
                  onChange={(e) => setTopSearchDraft(e.target.value)}
                  placeholder={
                    activeView.type === 'tv'
                      ? 'Search live TV channels...'
                      : 'Search music, TV, artists...'
                  }
                  aria-label="Global search"
                  className="flex-1 min-w-0 bg-transparent text-xs text-[var(--sm-text)] placeholder:text-[var(--sm-text-muted)] focus:outline-none"
                />
                {topSearchDraft && (
                  <button
                    type="button"
                    onClick={() => {
                      setTopSearchDraft('');
                      if (activeView.type === 'tv') setTvSearchQuery('');
                      else setSearchQuery('');
                      topSearchInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="p-0.5 text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]"
                  >
                    <X size={13} />
                  </button>
                )}
              </form>
            </div>

            {/* Zone 2: Clean single-line view links */}
            <nav className="hidden lg:flex items-center gap-5 xl:gap-6 text-xs font-medium text-[var(--sm-text-sec)]">
              <button
                type="button"
                onClick={() => setActiveView({ type: 'home' })}
                className={`whitespace-nowrap shrink-0 hover:text-[var(--sm-text)] ${
                  activeView.type === 'home' ? 'text-[var(--sm-text)] underline underline-offset-4' : ''
                }`}
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => setActiveView({ type: 'discover' })}
                className={`whitespace-nowrap shrink-0 hover:text-[var(--sm-text)] ${
                  activeView.type === 'discover' ? 'text-[var(--sm-text)] underline underline-offset-4' : ''
                }`}
              >
                Discover
              </button>
              <button
                type="button"
                onClick={() => handleNavigateView({ type: 'tv' })}
                className={`whitespace-nowrap shrink-0 hover:text-[var(--sm-text)] ${
                  activeView.type === 'tv' ? 'text-[var(--sm-text)] underline underline-offset-4' : ''
                }`}
              >
                Live TV
              </button>
              <button
                type="button"
                onClick={() => handleNavigateView({ type: 'matches' })}
                className={`whitespace-nowrap shrink-0 hover:text-[var(--sm-text)] ${
                  activeView.type === 'matches' ? 'text-[var(--sm-text)] underline underline-offset-4' : ''
                }`}
              >
                Matches
              </button>
              <button
                type="button"
                onClick={() => setActiveView({ type: 'videos' })}
                className={`whitespace-nowrap shrink-0 hover:text-[var(--sm-text)] ${
                  activeView.type === 'videos' ? 'text-[var(--sm-text)] underline underline-offset-4' : ''
                }`}
              >
                Videos
              </button>
            </nav>

            {/* Zone 3: Mobile Search Trigger + Color Mode Switcher + Listening Room CTA & Mobile Queue */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMobileSearchOpen((v) => !v);
                  setTimeout(() => topSearchInputRef.current?.focus(), 40);
                }}
                aria-label="Search"
                className="sm:hidden p-2 rounded-lg border border-[var(--sm-border)] text-[var(--sm-text-sec)]"
              >
                <Search size={15} />
              </button>

              {/* Prominent Color Mode Popover Control */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setColorMenuOpen((v) => !v)}
                  aria-label="Change color mode"
                  title="Change Color Mode & Accent"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)] text-xs font-medium text-[var(--sm-text)] hover:border-[var(--sm-accent)] transition-colors whitespace-nowrap shrink-0"
                >
                  <Palette size={14} className="text-[var(--sm-accent-text)] shrink-0" />
                  <span className="hidden sm:inline">Color Mode</span>
                </button>

                {colorMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setColorMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-11 z-40 w-68 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] shadow-xl p-3.5 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--sm-text)]">
                          Color Mode
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSurfaceMode(activeSurfaceMeta.isDark ? 'paper' : 'midnight')
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--sm-border)] bg-[var(--sm-bg)] text-[11px] font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap"
                        >
                          {activeSurfaceMeta.isDark ? <Sun size={12} /> : <Moon size={12} />}
                          <span>{activeSurfaceMeta.isDark ? 'Light' : 'Dark'}</span>
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-[11px] font-medium text-[var(--sm-text-muted)]">
                          Surface Appearance
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {SURFACE_MODES.map((m) => {
                            const selected = surfaceMode === m.id;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setSurfaceMode(m.id)}
                                className={`p-2 rounded-lg border text-left transition-colors flex items-center gap-2 ${
                                  selected
                                    ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)]'
                                    : 'border-[var(--sm-border)] bg-[var(--sm-bg)] hover:border-[var(--sm-text-muted)]'
                                }`}
                              >
                                <span
                                  className="w-5 h-5 rounded-md border border-black/15 shrink-0 flex items-center justify-center"
                                  style={{ backgroundColor: m.bgPreview }}
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-xs"
                                    style={{ backgroundColor: m.surfacePreview }}
                                  />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-[11px] font-semibold text-[var(--sm-text)] truncate">
                                    {m.label}
                                  </span>
                                  <span className="block text-[10px] text-[var(--sm-text-muted)] truncate">
                                    {m.sub}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-[var(--sm-border)]">
                        <div className="text-[11px] font-medium text-[var(--sm-text-muted)]">
                          Accent Color
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {ACCENT_MODES.map((a) => {
                            const selected = accentMode === a.id;
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => setAccentMode(a.id)}
                                className={`py-1.5 px-1 rounded-lg border flex flex-col items-center gap-1 transition-colors ${
                                  selected
                                    ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)]'
                                    : 'border-[var(--sm-border)] bg-[var(--sm-bg)] hover:border-[var(--sm-text-muted)]'
                                }`}
                              >
                                <span
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-white"
                                  style={{ backgroundColor: a.swatch }}
                                >
                                  {selected && <Check size={10} strokeWidth={3} />}
                                </span>
                                <span className="text-[10px] font-medium text-[var(--sm-text-sec)] truncate max-w-full">
                                  {a.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveView({ type: 'listening_room' })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-medium whitespace-nowrap shrink-0 hover:opacity-90"
              >
                <SlidersHorizontal size={13} />
                <span className="hidden xs:inline sm:inline">Listening Room</span>
              </button>

              {user ? (
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  title={`Signed in as ${user.displayName || user.email || 'Listener'} — click to sign out`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)] text-xs font-medium text-[var(--sm-text)] hover:border-[var(--sm-accent)] whitespace-nowrap shrink-0"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Profile'}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <LogOut size={13} />
                  )}
                  <span className="hidden xl:inline max-w-[110px] truncate">
                    {user.displayName?.split(' ')[0] || 'Account'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)] text-xs font-medium text-[var(--sm-text)] hover:border-[var(--sm-accent)] whitespace-nowrap shrink-0"
                >
                  <LogIn size={13} className="text-[var(--sm-accent-text)]" />
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setQueueOpen((v) => !v)}
                className="md:hidden inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[var(--sm-border)] text-xs font-mono tabular-nums whitespace-nowrap shrink-0"
              >
                <ListMusic size={14} />
                <span>{upcomingCount}</span>
              </button>
            </div>
          </header>

          {/* Main Scrollable Workspace */}
          <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
            <div className="max-w-6xl mx-auto">
              {activeView.type === 'home' && (
                <HomeView
                  catalog={catalog}
                  catalogLoading={catalogLoading}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  history={history}
                  likedTracks={likedTracks}
                  likedTrackIds={likedIdSet}
                  playlistCount={userPlaylists.length}
                  resolveTrack={(id) => trackCache[id]}
                  onNavigate={handleNavigateView}
                  onPlayTrack={handlePlayTrack}
                  onPlayAll={handlePlayAll}
                  onTogglePlayPause={handleTogglePlayPause}
                  onToggleLike={handleToggleLike}
                  onSelectArtist={handleSelectArtist}
                  onWatchTvChannel={handleWatchTvFromDiscover}
                  onWatchMatchTv={handleWatchMatchTvFromDiscover}
                  onWatchVideo={handleWatchVideoTrack}
                />
              )}

              {(activeView.type === 'discover' || activeView.type === 'curated') && (
                <DiscoverView
                  catalog={catalog}
                  loading={catalogLoading}
                  error={catalogError}
                  onRetry={loadCatalog}
                  selectedCuratedId={activeView.type === 'curated' ? activeView.playlistId : null}
                  onSelectCurated={(id) =>
                    setActiveView(id ? { type: 'curated', playlistId: id } : { type: 'discover' })
                  }
                  onOpenListeningRoom={() => setActiveView({ type: 'listening_room' })}
                  onOpenLiveTv={() => handleNavigateView({ type: 'tv' })}
                  onOpenMatches={() => handleNavigateView({ type: 'matches' })}
                  onOpenVideos={() => setActiveView({ type: 'videos' })}
                  onWatchTvChannel={handleWatchTvFromDiscover}
                  onWatchMatchTv={handleWatchMatchTvFromDiscover}
                  onWatchVideo={handleWatchVideoTrack}
                  resolvingVideoTrackId={resolvingVideoTrackId}
                  onOpenStoresDirectory={() => setActiveView({ type: 'stores' })}
                  onOpenArtistsDirectory={() => setActiveView({ type: 'artists' })}
                  onOpenRwandaMusic={() => setActiveView({ type: 'rwanda' })}
                  onSelectCountry={(country) => {
                    if (country === 'Rwanda') {
                      setActiveView({ type: 'rwanda' });
                    } else {
                      setSearchQuery('');
                      setActiveView({ type: 'browse', initialCountry: country });
                    }
                  }}
                  onSelectPlatform={(platform) => {
                    setSearchQuery('');
                    setActiveView({ type: 'browse', initialPlatform: platform });
                  }}
                  onSelectArtist={handleSelectArtist}
                  currentTrackId={currentTrack?.id ?? null}
                  isPlaying={isPlaying}
                  likedTrackIds={likedIdSet}
                  userPlaylists={userPlaylists}
                  onPlayTrack={handlePlayTrack}
                  onPlayAll={handlePlayAll}
                  onTogglePlayPause={handleTogglePlayPause}
                  onToggleLike={handleToggleLike}
                  onAddToPlaylist={handleAddToPlaylist}
                  onAddToQueue={handleAddToQueue}
                  onOpenStoreModal={setStoreModalTrack}
                  onOpenLyrics={setLyricsModalTrack}
                  onOpenSpotifyEmbed={handleOpenSpotifyEmbed}
                  onOpenSpotifyPlaylistEmbed={handleOpenSpotifyPlaylistEmbed}
                  onImportSpotifyUrl={handleImportSpotifyUrl}
                />
              )}

              {activeView.type === 'browse' && (
                <BrowseView
                  initialGenre={activeView.initialGenre}
                  initialCountry={activeView.initialCountry}
                  initialPlatform={activeView.initialPlatform}
                  initialQuery={searchQuery}
                  currentTrackId={currentTrack?.id ?? null}
                  isPlaying={isPlaying}
                  likedTrackIds={likedIdSet}
                  userPlaylists={userPlaylists}
                  onPlayTrack={handlePlayTrack}
                  onPlayAll={handlePlayAll}
                  onTogglePlayPause={handleTogglePlayPause}
                  onToggleLike={handleToggleLike}
                  onAddToPlaylist={handleAddToPlaylist}
                  onAddToQueue={handleAddToQueue}
                  onOpenStoreModal={setStoreModalTrack}
                  onOpenLyrics={setLyricsModalTrack}
                  onOpenSpotifyEmbed={handleOpenSpotifyEmbed}
                  onSelectArtist={handleSelectArtist}
                  onWatchVideo={handleWatchVideoTrack}
                  resolvingVideoTrackId={resolvingVideoTrackId}
                  onCacheTracks={cacheTracks}
                />
              )}

              {activeView.type === 'artists' && (
                <ArtistsView onSelectArtist={handleSelectArtist} />
              )}

              {activeView.type === 'rwanda' && (
                <RwandaMusicView
                  currentTrackId={currentTrack?.id ?? null}
                  isPlaying={isPlaying}
                  likedTrackIds={likedIdSet}
                  userPlaylists={userPlaylists}
                  onPlayTrack={handlePlayTrack}
                  onPlayAll={handlePlayAll}
                  onTogglePlayPause={handleTogglePlayPause}
                  onToggleLike={handleToggleLike}
                  onAddToPlaylist={handleAddToPlaylist}
                  onAddToQueue={handleAddToQueue}
                  onOpenStoreModal={setStoreModalTrack}
                  onOpenLyrics={setLyricsModalTrack}
                  onOpenSpotifyEmbed={handleOpenSpotifyEmbed}
                  onSelectArtist={handleSelectArtist}
                  onWatchVideo={handleWatchVideoTrack}
                  resolvingVideoTrackId={resolvingVideoTrackId}
                  onSearchRwandaCatalog={(q) => {
                    setSearchQuery(q);
                    setActiveView({ type: 'browse', initialCountry: 'Rwanda' });
                  }}
                  onCacheTracks={cacheTracks}
                />
              )}

              {activeView.type === 'artist_profile' && (
                <ArtistProfileView
                  artistId={activeView.artistId}
                  artistName={activeView.artistName}
                  currentTrackId={currentTrack?.id ?? null}
                  isPlaying={isPlaying}
                  likedTrackIds={likedIdSet}
                  userPlaylists={userPlaylists}
                  onBack={() => setActiveView(previousView)}
                  onPlayTrack={handlePlayTrack}
                  onPlayAll={handlePlayAll}
                  onTogglePlayPause={handleTogglePlayPause}
                  onToggleLike={handleToggleLike}
                  onAddToPlaylist={handleAddToPlaylist}
                  onAddToQueue={handleAddToQueue}
                  onOpenStoreModal={setStoreModalTrack}
                  onOpenLyrics={setLyricsModalTrack}
                  onOpenSpotifyEmbed={handleOpenSpotifyEmbed}
                  onSelectArtist={handleSelectArtist}
                  onWatchVideo={handleWatchVideoTrack}
                  resolvingVideoTrackId={resolvingVideoTrackId}
                  onCacheTracks={cacheTracks}
                />
              )}

              {activeView.type === 'tv' && (
                <LiveTvView
                  initialQuery={tvSearchQuery}
                  activeChannel={activeTvChannel}
                  useProxyRelay={tvUseProxyRelay}
                  onSelectChannel={handleSelectTvChannel}
                  onCloseChannel={() => setActiveTvChannel(null)}
                  onToggleProxyRelay={() => setTvUseProxyRelay((v) => !v)}
                  onEnableProxyRelay={() => setTvUseProxyRelay(true)}
                  onPopOutMiniPlayer={handlePopOutMiniTv}
                  onPauseMusic={handlePauseMusicForTv}
                  onOpenMatches={() => handleNavigateView({ type: 'matches' })}
                />
              )}

              {activeView.type === 'matches' && (
                <LiveMatchView
                  activeChannel={activeTvChannel}
                  useProxyRelay={tvUseProxyRelay}
                  onSelectChannel={handleSelectTvChannel}
                  onCloseChannel={() => setActiveTvChannel(null)}
                  onToggleProxyRelay={() => setTvUseProxyRelay((v) => !v)}
                  onEnableProxyRelay={() => setTvUseProxyRelay(true)}
                  onPopOutMiniPlayer={handlePopOutMiniTv}
                  onPauseMusic={handlePauseMusicForTv}
                  onOpenAllTv={() => handleNavigateView({ type: 'tv' })}
                />
              )}

              {activeView.type === 'videos' && (
                <VideosView
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  likedTrackIds={likedIdSet}
                  onWatchVideo={handleWatchVideoTrack}
                  onTogglePlayPause={handleTogglePlayPause}
                  onOpenTheater={() => {
                    setShowMusicVideo(true);
                    setVideoTheaterExpanded(true);
                  }}
                  onToggleLike={handleToggleLike}
                  onAddToQueue={handleAddToQueue}
                  onOpenLyrics={setLyricsModalTrack}
                  onOpenLiveTv={() => handleNavigateView({ type: 'tv' })}
                  onSelectArtist={handleSelectArtist}
                  onCacheTracks={cacheTracks}
                />
              )}

              {activeView.type === 'listening_room' && (
                <ListeningRoomView
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  analyser={analyserRef.current}
                  hasLiveSignal={hasLiveWebAudio}
                  eqSettings={eqSettings}
                  crossfadeSec={crossfadeSec}
                  isCrossfading={isCrossfading}
                  isLiked={currentTrack ? likedIdSet.has(currentTrack.id) : false}
                  onUpdateEq={setEqSettings}
                  onChangeCrossfade={setCrossfadeSec}
                  onTogglePlayPause={handleTogglePlayPause}
                  onPrevious={handlePrevious}
                  onNext={handleNext}
                  onToggleLike={() => currentTrack && handleToggleLike(currentTrack)}
                  onOpenStoreModal={setStoreModalTrack}
                  onSelectArtist={handleSelectArtist}
                  onBrowseCatalog={() => setActiveView({ type: 'browse' })}
                  onWatchVideo={() => {
                    setShowMusicVideo(true);
                    setVideoTheaterExpanded(true);
                  }}
                />
              )}

              {activeView.type === 'ai_studio' && (
                <AiStudioView
                  initialTab={activeView.initialTab}
                  onPlayTrack={(t) => handlePlayTrack(t)}
                  onSendToAssistant={(prompt) =>
                    setActiveView({ type: 'assistant', initialMode: 'chat', initialPrompt: prompt })
                  }
                />
              )}

              {activeView.type === 'assistant' && (
                <AiAssistantView
                  initialMode={activeView.initialMode}
                  initialPrompt={activeView.initialPrompt}
                />
              )}

              {activeView.type === 'maps' && (
                <MapExplorerView
                  onAskMapsAssistant={(prompt) =>
                    setActiveView({ type: 'assistant', initialMode: 'maps', initialPrompt: prompt })
                  }
                />
              )}

              {activeView.type === 'stage_3d' && (
                <Stage3DView
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  analyser={analyserRef.current}
                />
              )}

              {activeView.type === 'game_3d' && <RhythmGame3DView />}

              {activeView.type === 'stores' && (
                <StoresView
                  stores={catalog?.musicStores || []}
                  onSearchCatalog={(q) => {
                    setSearchQuery(q);
                    setActiveView({ type: 'browse' });
                  }}
                />
              )}

              {activeView.type === 'history' && (
                <HistoryView
                  history={history}
                  resolveTrack={(id) => trackCache[id]}
                  onPlayTrack={(t) => handlePlayTrack(t)}
                  onClearHistory={() => setHistory([])}
                />
              )}

              {activeView.type === 'liked' && (
                <LikedView
                  tracks={likedTracks}
                  currentTrackId={currentTrack?.id ?? null}
                  isPlaying={isPlaying}
                  likedTrackIds={likedIdSet}
                  userPlaylists={userPlaylists}
                  onPlayTrack={handlePlayTrack}
                  onPlayAll={handlePlayAll}
                  onTogglePlayPause={handleTogglePlayPause}
                  onToggleLike={handleToggleLike}
                  onAddToPlaylist={handleAddToPlaylist}
                  onAddToQueue={handleAddToQueue}
                  onOpenStoreModal={setStoreModalTrack}
                  onOpenLyrics={setLyricsModalTrack}
                  onOpenSpotifyEmbed={handleOpenSpotifyEmbed}
                  onSelectArtist={handleSelectArtist}
                  onWatchVideo={handleWatchVideoTrack}
                  resolvingVideoTrackId={resolvingVideoTrackId}
                />
              )}

              {activeView.type === 'playlists' && (
                <PlaylistsView
                  playlists={userPlaylists}
                  resolveTrack={(id) => trackCache[id]}
                  onCreatePlaylist={handleCreatePlaylist}
                  onOpenPlaylist={(id) => setActiveView({ type: 'custom_playlist', playlistId: id })}
                  onDeletePlaylist={handleDeletePlaylist}
                  onPlayAll={handlePlayAll}
                />
              )}

              {activeView.type === 'custom_playlist' &&
                (() => {
                  const pl = userPlaylists.find((p) => p.id === activeView.playlistId);
                  if (!pl) {
                    return (
                      <PlaylistsView
                        playlists={userPlaylists}
                        resolveTrack={(id) => trackCache[id]}
                        onCreatePlaylist={handleCreatePlaylist}
                        onOpenPlaylist={(id) =>
                          setActiveView({ type: 'custom_playlist', playlistId: id })
                        }
                        onDeletePlaylist={handleDeletePlaylist}
                        onPlayAll={handlePlayAll}
                      />
                    );
                  }
                  const tracks = pl.trackIds
                    .map((id) => trackCache[id])
                    .filter((t): t is MusicTrack => !!t);
                  return (
                    <CustomPlaylistView
                      playlist={pl}
                      tracks={tracks}
                      currentTrackId={currentTrack?.id ?? null}
                      isPlaying={isPlaying}
                      likedTrackIds={likedIdSet}
                      userPlaylists={userPlaylists}
                      onPlayTrack={handlePlayTrack}
                      onPlayAll={handlePlayAll}
                      onTogglePlayPause={handleTogglePlayPause}
                      onToggleLike={handleToggleLike}
                      onAddToPlaylist={handleAddToPlaylist}
                      onAddToQueue={handleAddToQueue}
                      onOpenStoreModal={setStoreModalTrack}
                      onOpenLyrics={setLyricsModalTrack}
                      onOpenSpotifyEmbed={handleOpenSpotifyEmbed}
                      onSelectArtist={handleSelectArtist}
                      onWatchVideo={handleWatchVideoTrack}
                      resolvingVideoTrackId={resolvingVideoTrackId}
                      onRemoveTrack={handleRemoveFromPlaylist}
                      onDeletePlaylist={handleDeletePlaylist}
                    />
                  );
                })()}
            </div>
          </main>
        </div>
      </div>

      {/* Persistent Modals & Queue Drawer */}
      <StoreLinksModal track={storeModalTrack} onClose={() => setStoreModalTrack(null)} />
      <SpotifyEmbedModal target={spotifyTarget} onClose={() => setSpotifyTarget(null)} />
      <LyricsModal track={lyricsModalTrack} onClose={() => setLyricsModalTrack(null)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <QueueDrawer
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        currentTrack={currentTrack}
        queue={queue}
        currentIndex={currentIndex}
        onPlayQueueIndex={(idx) => setCurrentIndex(idx)}
        onMoveQueueItem={handleMoveQueueItem}
        onRemoveFromQueue={(idx) => {
          setQueue((prev) => prev.filter((_, i) => i !== idx));
          if (idx < currentIndex) setCurrentIndex((i) => Math.max(0, i - 1));
        }}
        onClearUpcoming={() =>
          setQueue((prev) => (currentIndex >= 0 ? prev.slice(0, currentIndex + 1) : []))
        }
      />

      {/* Floating Mini TV Video Screen when browsing outside TV Theatre or Match TV */}
      {activeTvChannel && activeView.type !== 'tv' && activeView.type !== 'matches' && (
        <aside
          aria-label="Mini TV Video Screen"
          className="fixed bottom-24 right-4 z-40 w-80 sm:w-96 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] shadow-2xl overflow-hidden"
        >
          <div className="relative aspect-video bg-[#0E0E0D]">
            <HlsVideoPlayer
              streamUrl={activeTvChannel.streamUrl}
              alternateUrls={activeTvChannel.alternateUrls}
              embedUrl={activeTvChannel.embedUrl}
              channelName={activeTvChannel.name}
              useProxyRelay={tvUseProxyRelay}
              onRequestProxyRelay={() => setTvUseProxyRelay(true)}
              onPlaybackStart={handlePauseMusicForTv}
            />
          </div>
          <div className="px-3 py-2 flex items-center justify-between gap-2 border-t border-[var(--sm-border)]">
            <div className="min-w-0 flex items-center gap-2">
              <Tv size={14} className="shrink-0 text-[var(--sm-accent-text)]" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--sm-text)] truncate">
                  {activeTvChannel.name}
                </div>
                <div className="text-[11px] font-mono text-[var(--sm-text-muted)] truncate">
                  {activeTvChannel.countryFlag} LIVE · {activeTvChannel.quality}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleNavigateView({ type: 'tv' })}
                title="Expand to TV Theatre"
                aria-label="Expand to TV Theatre"
                className="p-1.5 rounded-md text-[var(--sm-text-sec)] hover:bg-[var(--sm-muted)] hover:text-[var(--sm-text)]"
              >
                <Maximize2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setActiveTvChannel(null)}
                title="Close Mini TV"
                aria-label="Close Mini TV"
                className="p-1.5 rounded-md text-[var(--sm-text-muted)] hover:bg-[var(--sm-muted)] hover:text-[var(--sm-accent-text)]"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Cinema Dimmer Backdrop when Video Theater is expanded */}
      {videoTheaterExpanded && (currentTrack?.youtubeVideoId || currentTrack?.videoUrl) && !activeTvChannel && (
        <div
          className="fixed inset-0 z-40 bg-black/85 backdrop-blur-md"
          onClick={() => setVideoTheaterExpanded(false)}
        />
      )}

      {/* Persistent Background / Mini-Dock / Widescreen Cinema Music Video Player */}
      <aside
        aria-label="Music Video Player"
        className={
          videoTheaterExpanded && (currentTrack?.youtubeVideoId || currentTrack?.videoUrl) && !activeTvChannel
            ? 'fixed inset-4 sm:inset-8 lg:inset-x-20 lg:inset-y-12 z-50 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] shadow-2xl overflow-hidden flex flex-col'
            : showMusicVideo && (currentTrack?.youtubeVideoId || currentTrack?.videoUrl) && !activeTvChannel
              ? 'fixed bottom-24 right-4 z-40 w-80 sm:w-96 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] shadow-2xl overflow-hidden'
              : 'fixed bottom-0 left-0 w-[200px] h-[112px] opacity-0 pointer-events-none -z-10 overflow-hidden'
        }
      >
        {videoTheaterExpanded && currentTrack && !activeTvChannel && (
          <div className="px-4 sm:px-5 py-3 border-b border-[var(--sm-border)] flex items-center justify-between gap-3 shrink-0 bg-[var(--sm-surface)]">
            <div className="min-w-0 flex items-center gap-2.5">
              <Film size={16} className="shrink-0 text-[var(--sm-accent-text)]" />
              <div className="min-w-0">
                <h2 className="font-display text-sm sm:text-base font-bold text-[var(--sm-text)] truncate">
                  {currentTrack.title}
                </h2>
                <p className="text-xs text-[var(--sm-text-sec)] truncate">
                  {currentTrack.artist} · {currentTrack.sourceLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setLyricsModalTrack(currentTrack)}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
              >
                Lyrics
              </button>
              <button
                type="button"
                onClick={() => setVideoTheaterExpanded(false)}
                title="Dock to Corner Mini Video"
                aria-label="Dock to Corner Mini Video"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
              >
                <Minimize2 size={13} />
                <span className="hidden sm:inline">Mini</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setVideoTheaterExpanded(false);
                  setShowMusicVideo(false);
                }}
                title="Audio Only Mode"
                aria-label="Close Video Theater"
                className="p-1.5 rounded-lg border border-[var(--sm-border)] text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        <div
          className={
            videoTheaterExpanded && !activeTvChannel
              ? 'relative flex-1 min-h-0 bg-[#0B0C10] w-full'
              : 'relative aspect-video bg-[#0B0C10] w-full'
          }
        >
          <div
            ref={ytHostRef}
            className={currentTrack?.youtubeVideoId ? 'w-full h-full' : 'hidden'}
          />
          {currentTrack?.videoUrl && !currentTrack.youtubeVideoId && (
            <video
              key={currentTrack.id}
              ref={htmlVideoRef}
              src={currentTrack.videoUrl}
              controls
              playsInline
              autoPlay
              muted={isMuted}
              className="w-full h-full object-contain bg-[#0B0C10]"
              onTimeUpdate={(e) => {
                setCurrentTime(e.currentTarget.currentTime);
                if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
                  setDuration(e.currentTarget.duration);
                }
              }}
              onPlay={() => {
                setIsPlaying(true);
                recordTrackHistory(currentTrack);
              }}
              onPause={() => setIsPlaying(false)}
              onEnded={() => handleNext()}
            />
          )}
        </div>

        {!videoTheaterExpanded && showMusicVideo && (currentTrack?.youtubeVideoId || currentTrack?.videoUrl) && !activeTvChannel && (
          <div className="px-3 py-2 flex items-center justify-between gap-2 border-t border-[var(--sm-border)]">
            <div className="min-w-0 flex items-center gap-2">
              <Film size={14} className="shrink-0 text-[var(--sm-accent-text)]" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--sm-text)] truncate">
                  {currentTrack.title}
                </div>
                <div className="text-[11px] font-mono text-[var(--sm-text-muted)] truncate">
                  {currentTrack.artist} · Video
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setVideoTheaterExpanded(true)}
                title="Expand to Cinema Theater"
                aria-label="Expand to Cinema Theater"
                className="p-1.5 rounded-md text-[var(--sm-text-sec)] hover:bg-[var(--sm-muted)] hover:text-[var(--sm-text)]"
              >
                <Maximize2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setShowMusicVideo(false)}
                title="Hide Video (Audio Only)"
                aria-label="Hide Video"
                className="p-1.5 rounded-md text-[var(--sm-text-sec)] hover:bg-[var(--sm-muted)] hover:text-[var(--sm-text)]"
              >
                <Minimize2 size={14} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Persistent Hi-Fi Player Bar */}
      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        isBuffering={isBuffering}
        playbackError={playbackError}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        shuffle={shuffle}
        repeatMode={repeatMode}
        isLiked={currentTrack ? likedIdSet.has(currentTrack.id) : false}
        queueOpen={queueOpen}
        queueCount={upcomingCount}
        eqEnabled={eqSettings.enabled}
        crossfadeSec={crossfadeSec}
        isCrossfading={isCrossfading}
        sleepTimerMode={sleepTimerMode}
        sleepRemainingSec={sleepRemainingSec}
        onTogglePlayPause={handleTogglePlayPause}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onSeek={handleSeek}
        onVolumeChange={(v) => {
          setVolume(v);
          if (v > 0 && isMuted) setIsMuted(false);
        }}
        onToggleMute={() => setIsMuted((m) => !m)}
        onToggleShuffle={() => setShuffle((s) => !s)}
        onCycleRepeat={() =>
          setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))
        }
        onToggleLike={() => currentTrack && handleToggleLike(currentTrack)}
        onToggleQueue={() => setQueueOpen((v) => !v)}
        onOpenStoreModal={setStoreModalTrack}
        onOpenLyrics={setLyricsModalTrack}
        onOpenListeningRoom={() => setActiveView({ type: 'listening_room' })}
        onSetSleepTimer={setSleepTimerMode}
        onChangeCrossfade={setCrossfadeSec}
        showMusicVideo={showMusicVideo}
        resolvingMusicVideo={Boolean(currentTrack && resolvingVideoTrackId === currentTrack.id)}
        onToggleMusicVideo={() => {
          if (currentTrack && !currentTrack.youtubeVideoId && !currentTrack.videoUrl && !currentTrack.isLive) {
            handleWatchVideoTrack(currentTrack);
            return;
          }
          if (videoTheaterExpanded) {
            setVideoTheaterExpanded(false);
            setShowMusicVideo(false);
          } else {
            setShowMusicVideo((v) => !v);
          }
        }}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onSelectArtist={handleSelectArtist}
      />
    </div>
  );
}
