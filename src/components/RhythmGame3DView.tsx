import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  Award,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';

type GamePhase = 'title' | 'playing' | 'paused' | 'ended';
type Difficulty = 'chill' | 'studio' | 'encore';

interface LeaderboardEntry {
  id: number;
  playerName: string;
  score: number;
  maxCombo: number;
  accuracy: number;
  difficulty: string;
  createdAt: string;
}

const LANE_KEYS = ['D', 'F', 'J', 'K'] as const;
const LANE_X = [-2.25, -0.75, 0.75, 2.25];
const LANE_FREQS = [220, 261.63, 329.63, 440]; // A3, C4, E4, A4 minor pentatonic chord
const LANE_COLORS = ['#E0A432', '#3B82F6', '#10B981', '#E04F2B'];

const DIFFICULTY_CFG: Record<
  Difficulty,
  { label: string; speed: number; spawnInterval: number; durationSec: number }
> = {
  chill: { label: 'Chill', speed: 8.5, spawnInterval: 0.68, durationSec: 45 },
  studio: { label: 'Studio', speed: 12.0, spawnInterval: 0.46, durationSec: 45 },
  encore: { label: 'Encore', speed: 15.8, spawnInterval: 0.33, durationSec: 45 },
};

function isSoftwareGl(renderer: THREE.WebGLRenderer): boolean {
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const r = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  return /SwiftShader|ANGLE \(.*(SwiftShader|Software|llvmpipe)/i.test(r);
}

export function RhythmGame3DView() {
  const { user, getIdToken } = useAuth();
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [difficulty, setDifficulty] = useState<Difficulty>('studio');
  const [playerName, setPlayerName] = useState(
    user?.displayName || user?.email?.split('@')[0] || 'Studio Producer',
  );
  const [muted, setMuted] = useState(false);

  // HUD live telemetry (tabular-nums)
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [hits, setHits] = useState(0);
  const [totalJudged, setTotalJudged] = useState(0);
  const [timeLeft, setTimeLeft] = useState(45);
  const [lastJudgment, setLastJudgment] = useState<'PERFECT' | 'GOOD' | 'MISS' | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);

  const phaseRef = useRef<GamePhase>('title');
  const difficultyRef = useRef<Difficulty>('studio');
  const mutedRef = useRef(false);
  phaseRef.current = phase;
  difficultyRef.current = difficulty;
  mutedRef.current = muted;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const scoreSubmittedRunRef = useRef(false);

  const statsRef = useRef({
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    totalJudged: 0,
    timeLeft: 45,
  });

  useEffect(() => {
    if (user?.displayName) setPlayerName(user.displayName);
  }, [user?.displayName]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/sql/leaderboard');
      if (res.ok) {
        const data = (await res.json()) as { scores?: LeaderboardEntry[] };
        setLeaderboard(data.scores || []);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const playSfx = useCallback((lane: number, type: 'hit' | 'miss') => {
    if (mutedRef.current) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'hit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(LANE_FREQS[lane] || 330, now);
        osc.frequency.exponentialRampToValueAtTime((LANE_FREQS[lane] || 330) * 1.02, now + 0.14);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.12);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Ignore audio errors
    }
  }, []);

  const triggerLaneRef = useRef<(lane: number) => void>(() => {});
  const resetRunRef = useRef<() => void>(() => {});

  const submitFinalScore = useCallback(async () => {
    if (scoreSubmittedRunRef.current || statsRef.current.totalJudged === 0) return;
    scoreSubmittedRunRef.current = true;
    setSubmittingScore(true);

    const accuracyPct =
      statsRef.current.totalJudged > 0
        ? Math.round((statsRef.current.hits / statsRef.current.totalJudged) * 100)
        : 100;
    const cleanName = playerName.trim().slice(0, 60) || 'Studio Producer';

    try {
      const token = await getIdToken();
      await fetch('/api/sql/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          playerName: cleanName,
          score: statsRef.current.score,
          maxCombo: statsRef.current.maxCombo,
          accuracy: accuracyPct,
          difficulty: difficultyRef.current,
        }),
      });

      if (user?.emailVerified) {
        await addDoc(collection(db, 'stageScores'), {
          ownerUid: user.uid,
          playerName: cleanName,
          score: statsRef.current.score,
          maxCombo: statsRef.current.maxCombo,
          accuracy: accuracyPct,
          difficulty: difficultyRef.current,
          createdAt: serverTimestamp(),
        });
      }
      setScoreSaved(true);
      await loadLeaderboard();
    } catch {
      // Ignore non-critical sync failure
    } finally {
      setSubmittingScore(false);
    }
  }, [getIdToken, loadLeaderboard, playerName, user]);

  useEffect(() => {
    if (phase === 'ended') {
      void submitFinalScore();
    }
  }, [phase, submitFinalScore]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090A0F');
    scene.fog = new THREE.FogExp2('#090A0F', 0.032);

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 560;
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 80);
    camera.position.set(0, 4.4, 7.6);
    camera.lookAt(0, 0.2, -5.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const softGl = isSoftwareGl(renderer);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, softGl ? 1.5 : 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight('#8fb4ff', '#1b1612', 0.8);
    scene.add(hemi);
    const key = new THREE.DirectionalLight('#ffdca8', 2.0);
    key.position.set(3, 8, 5);
    scene.add(key);

    const disposables: Array<{ dispose: () => void }> = [];
    const trackDisp = <T extends { dispose: () => void }>(d: T): T => {
      disposables.push(d);
      return d;
    };

    // Runway Deck
    const deckMat = trackDisp(
      new THREE.MeshStandardMaterial({ color: '#12141C', roughness: 0.5, metalness: 0.4 }),
    );
    const deck = new THREE.Mesh(trackDisp(new THREE.BoxGeometry(7.2, 0.2, 34)), deckMat);
    deck.position.set(0, -0.15, -13);
    scene.add(deck);

    // 4 Lane Rails
    const railMat = trackDisp(
      new THREE.MeshStandardMaterial({ color: '#272C3D', roughness: 0.4, metalness: 0.6 }),
    );
    const railGeo = trackDisp(new THREE.BoxGeometry(0.06, 0.05, 34));
    [-3.0, -1.5, 0, 1.5, 3.0].forEach((rx) => {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(rx, 0.0, -13);
      scene.add(rail);
    });

    // Hit-line Receptor Pads (Composite 3D Groups)
    const hitZ = 2.2;
    const padMeshes: THREE.Mesh[] = [];
    const ringGeo = trackDisp(new THREE.TorusGeometry(0.46, 0.06, 12, 32));
    const coreGeo = trackDisp(new THREE.CylinderGeometry(0.36, 0.38, 0.08, 24));

    LANE_X.forEach((lx, idx) => {
      const padGroup = new THREE.Group();
      padGroup.position.set(lx, 0.03, hitZ);

      const ringMat = trackDisp(
        new THREE.MeshStandardMaterial({
          color: LANE_COLORS[idx],
          emissive: LANE_COLORS[idx],
          emissiveIntensity: 0.45,
          roughness: 0.3,
        }),
      );
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      padGroup.add(ring);

      const coreMat = trackDisp(
        new THREE.MeshStandardMaterial({
          color: '#171A24',
          emissive: LANE_COLORS[idx],
          emissiveIntensity: 0.15,
          roughness: 0.25,
          metalness: 0.6,
        }),
      );
      const core = new THREE.Mesh(coreGeo, coreMat);
      padGroup.add(core);

      padMeshes.push(core);
      scene.add(padGroup);
    });

    const noteGeo = trackDisp(new THREE.CylinderGeometry(0.38, 0.42, 0.18, 20));
    const noteMats = LANE_COLORS.map((col) =>
      trackDisp(
        new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.85,
          roughness: 0.2,
          metalness: 0.3,
        }),
      ),
    );

    interface ActiveNote {
      lane: number;
      z: number;
      mesh: THREE.Mesh;
      hit: boolean;
    }

    let activeNotes: ActiveNote[] = [];
    const padFlash = [0, 0, 0, 0];
    let spawnAcc = 0;

    const clearNotes = () => {
      for (const n of activeNotes) {
        scene.remove(n.mesh);
      }
      activeNotes = [];
    };

    resetRunRef.current = () => {
      clearNotes();
      spawnAcc = 0;
      const cfg = DIFFICULTY_CFG[difficultyRef.current];
      statsRef.current = {
        score: 0,
        combo: 0,
        maxCombo: 0,
        hits: 0,
        totalJudged: 0,
        timeLeft: cfg.durationSec,
      };
      scoreSubmittedRunRef.current = false;
      setScoreSaved(false);
      setScore(0);
      setCombo(0);
      setMaxCombo(0);
      setHits(0);
      setTotalJudged(0);
      setTimeLeft(cfg.durationSec);
      setLastJudgment(null);
    };

    const syncHud = () => {
      setScore(statsRef.current.score);
      setCombo(statsRef.current.combo);
      setMaxCombo(statsRef.current.maxCombo);
      setHits(statsRef.current.hits);
      setTotalJudged(statsRef.current.totalJudged);
    };

    triggerLaneRef.current = (lane: number) => {
      if (phaseRef.current !== 'playing') return;
      padFlash[lane] = 1;

      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < activeNotes.length; i++) {
        const n = activeNotes[i];
        if (n.lane !== lane || n.hit) continue;
        const dist = Math.abs(n.z - hitZ);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0 && bestDist <= 1.25) {
        const note = activeNotes[bestIdx];
        note.hit = true;
        scene.remove(note.mesh);
        activeNotes.splice(bestIdx, 1);

        const isPerfect = bestDist <= 0.55;
        statsRef.current.combo += 1;
        statsRef.current.maxCombo = Math.max(statsRef.current.maxCombo, statsRef.current.combo);
        const mult = Math.min(4, 1 + Math.floor(statsRef.current.combo / 8));
        statsRef.current.score += (isPerfect ? 150 : 90) * mult;
        statsRef.current.hits += 1;
        statsRef.current.totalJudged += 1;
        setLastJudgment(isPerfect ? 'PERFECT' : 'GOOD');
        playSfx(lane, 'hit');
      } else {
        statsRef.current.combo = 0;
        statsRef.current.totalJudged += 1;
        setLastJudgment('MISS');
        playSfx(lane, 'miss');
      }
      syncHud();
    };

    const clock = new THREE.Clock();
    let rafId = 0;
    let disposed = false;

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 560;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.05);

      if (phaseRef.current === 'playing' && !document.hidden) {
        const cfg = DIFFICULTY_CFG[difficultyRef.current];

        // Timer countdown
        statsRef.current.timeLeft = Math.max(0, statsRef.current.timeLeft - delta);
        setTimeLeft(Math.ceil(statsRef.current.timeLeft));
        if (statsRef.current.timeLeft <= 0) {
          clearNotes();
          setPhase('ended');
        } else {
          // Spawn beat notes cleanly
          spawnAcc += delta;
          if (spawnAcc >= cfg.spawnInterval) {
            spawnAcc -= cfg.spawnInterval;
            const lane = Math.floor(Math.random() * 4);
            const mesh = new THREE.Mesh(noteGeo, noteMats[lane]);
            mesh.position.set(LANE_X[lane], 0.14, -26);
            scene.add(mesh);
            activeNotes.push({ lane, z: -26, mesh, hit: false });
          }

          // Advance active notes
          for (let i = activeNotes.length - 1; i >= 0; i--) {
            const n = activeNotes[i];
            n.z += cfg.speed * delta;
            n.mesh.position.z = n.z;
            if (n.z > hitZ + 1.45) {
              scene.remove(n.mesh);
              activeNotes.splice(i, 1);
              statsRef.current.combo = 0;
              statsRef.current.totalJudged += 1;
              setLastJudgment('MISS');
              syncHud();
            }
          }
        }
      }

      // Pad flash decay
      for (let i = 0; i < 4; i++) {
        padFlash[i] = Math.max(0, padFlash[i] - delta * 4.5);
        const mat = padMeshes[i].material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.15 + padFlash[i] * 1.4;
        padMeshes[i].scale.y = 1 - padFlash[i] * 0.35;
      }

      renderer.render(scene, camera);
      if (softGl) {
        setTimeout(() => {
          if (!disposed) rafId = requestAnimationFrame(animate);
        }, 16);
      } else {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      clearNotes();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [playSfx]);

  // Keyboard bindings (D, F, J, K, Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const upper = e.key.toUpperCase();
      const idx = LANE_KEYS.indexOf(upper as (typeof LANE_KEYS)[number]);
      if (idx >= 0 && phaseRef.current === 'playing') {
        e.preventDefault();
        triggerLaneRef.current(idx);
      } else if (e.key === 'Escape' && phaseRef.current === 'playing') {
        setPhase('paused');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const startNewRun = () => {
    resetRunRef.current();
    setPhase('playing');
  };

  const accuracyPct = totalJudged > 0 ? Math.round((hits / totalJudged) * 100) : 100;
  const grade =
    accuracyPct >= 92 && score >= 4500
      ? 'S'
      : accuracyPct >= 82
        ? 'A'
        : accuracyPct >= 65
          ? 'B'
          : 'C';

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-[var(--sm-border)] pb-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-[var(--sm-accent-text)]">
            Interactive 3D Performance Game
          </p>
          <h1 className="font-display text-3xl font-semibold text-[var(--sm-text)] mt-1">
            Beat Stage 3D
          </h1>
          <p className="text-xs text-[var(--sm-text-sec)] mt-1">
            Hit incoming synth notes in time with keys <span className="font-mono font-semibold text-[var(--sm-text)]">D · F · J · K</span> or tap the lane pads below.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap shrink-0"
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          <span>{muted ? 'SFX Muted' : 'Synth SFX On'}</span>
        </button>
      </div>

      {/* Game Stage + Overlay Shell */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-3">
          <div className="relative h-[500px] rounded-2xl border border-[var(--sm-border)] overflow-hidden bg-[#090A0F]">
            <div ref={mountRef} className="w-full h-full" />

            {/* Playing HUD */}
            {(phase === 'playing' || phase === 'paused') && (
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-[#13151C] border border-[#252936] text-[#F2F0EC] font-mono tabular-nums text-xs">
                  <span>
                    SCORE <strong className="text-[#E0A432]">{score.toLocaleString()}</strong>
                  </span>
                  <span>
                    COMBO <strong>{combo}x</strong>
                  </span>
                  <span>
                    ACC <strong>{accuracyPct}%</strong>
                  </span>
                  <span>
                    TIME <strong>{timeLeft}s</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                  {lastJudgment && (
                    <span className="px-2.5 py-1 rounded-lg bg-[#13151C] border border-[#252936] font-mono text-xs font-bold text-[#E0A432]">
                      {lastJudgment}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPhase((p) => (p === 'playing' ? 'paused' : 'playing'))}
                    className="p-2 rounded-xl bg-[#13151C] border border-[#252936] text-[#F2F0EC]"
                    aria-label="Pause game"
                  >
                    <Pause size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Title Screen */}
            {phase === 'title' && (
              <div className="absolute inset-0 bg-[#0B0C10]/92 flex flex-col items-center justify-center p-6 text-center space-y-5">
                <div className="space-y-1.5 max-w-md">
                  <div className="text-xs font-mono uppercase tracking-widest text-[#E0A432]">
                    Soundmark Arcade
                  </div>
                  <h2 className="font-display text-3xl font-bold text-[#F2F0EC]">
                    Beat Stage 3D
                  </h2>
                  <p className="text-xs text-[#A1A6B5]">
                    Strike notes cleanly on the glowing receptor line to build up to a 4x multiplier.
                  </p>
                </div>

                <div className="w-full max-w-xs space-y-3">
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Stage Name"
                    className="w-full rounded-xl bg-[#13151C] border border-[#252936] px-3.5 py-2 text-xs text-[#F2F0EC] text-center focus:outline-none focus:border-[#E0A432]"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    {(['chill', 'studio', 'encore'] as Difficulty[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={`py-2 rounded-xl text-xs font-semibold border ${
                          difficulty === d
                            ? 'bg-[#E0A432] text-[#0B0C10] border-[#E0A432]'
                            : 'bg-[#13151C] text-[#A1A6B5] border-[#252936]'
                        }`}
                      >
                        {DIFFICULTY_CFG[d].label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={startNewRun}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#E0A432] text-[#0B0C10] text-sm font-bold hover:opacity-90"
                  >
                    <Play size={15} />
                    <span>Start 45s Performance</span>
                  </button>
                </div>
              </div>
            )}

            {/* Pause Overlay */}
            {phase === 'paused' && (
              <div className="absolute inset-0 bg-[#0B0C10]/88 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <h2 className="font-display text-2xl font-bold text-[#F2F0EC]">Stage Paused</h2>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPhase('playing')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E0A432] text-[#0B0C10] text-xs font-bold"
                  >
                    <Play size={14} />
                    <span>Resume</span>
                  </button>
                  <button
                    type="button"
                    onClick={startNewRun}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#252936] bg-[#13151C] text-[#F2F0EC] text-xs font-semibold"
                  >
                    <RotateCcw size={14} />
                    <span>Restart</span>
                  </button>
                </div>
              </div>
            )}

            {/* Encore / Game Over Results */}
            {phase === 'ended' && (
              <div className="absolute inset-0 bg-[#0B0C10]/94 flex flex-col items-center justify-center p-6 text-center space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-[#E0A432] text-[#0B0C10] flex items-center justify-center font-display text-2xl font-bold">
                  {grade}
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#F2F0EC]">
                    Encore Complete
                  </h2>
                  <p className="text-xs text-[#A1A6B5] mt-1">
                    {submittingScore
                      ? 'Submitting score to leaderboard…'
                      : scoreSaved
                        ? 'Score recorded on global leaderboard.'
                        : 'Performance finished.'}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 px-5 py-3 rounded-xl bg-[#13151C] border border-[#252936] font-mono tabular-nums">
                  <div>
                    <div className="text-[10px] text-[#A1A6B5]">SCORE</div>
                    <div className="text-base font-bold text-[#E0A432]">{score.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#A1A6B5]">MAX COMBO</div>
                    <div className="text-base font-bold text-[#F2F0EC]">{maxCombo}x</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#A1A6B5]">ACCURACY</div>
                    <div className="text-base font-bold text-[#F2F0EC]">{accuracyPct}%</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={startNewRun}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E0A432] text-[#0B0C10] text-xs font-bold"
                  >
                    <RotateCcw size={14} />
                    <span>Play Again</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase('title')}
                    className="px-4 py-2.5 rounded-xl border border-[#252936] bg-[#13151C] text-xs font-medium text-[#A1A6B5]"
                  >
                    Change Difficulty
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Click / Touch Lane Pads */}
          <div className="grid grid-cols-4 gap-2.5">
            {LANE_KEYS.map((keyLabel, laneIdx) => (
              <button
                key={keyLabel}
                type="button"
                onPointerDown={() => triggerLaneRef.current(laneIdx)}
                className="h-14 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] hover:border-[var(--sm-accent)] active:scale-95 transition-transform flex flex-col items-center justify-center"
              >
                <span
                  className="w-3 h-1 rounded-full mb-1"
                  style={{ backgroundColor: LANE_COLORS[laneIdx] }}
                />
                <span className="font-mono text-sm font-bold text-[var(--sm-text)]">
                  {keyLabel}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Live Cloud SQL Leaderboard */}
        <aside className="lg:col-span-4 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-[var(--sm-accent-text)]" />
              <h2 className="font-display text-lg font-semibold text-[var(--sm-text)]">
                Global Stage Leaderboard
              </h2>
            </div>
            <Award size={15} className="text-[var(--sm-text-muted)]" />
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-xs text-[var(--sm-text-muted)] py-6 text-center">
              No runs recorded yet. Be the first on stage!
            </p>
          ) : (
            <div className="space-y-2 max-h-[470px] overflow-y-auto">
              {leaderboard.map((row, idx) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[var(--sm-bg)] border border-[var(--sm-border)]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-[var(--sm-muted)] text-[var(--sm-text)] font-mono tabular-nums text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--sm-text)] truncate">
                        {row.playerName}
                      </div>
                      <div className="text-[10px] font-mono text-[var(--sm-text-muted)] capitalize">
                        {row.difficulty} · {row.maxCombo}x combo · {row.accuracy}%
                      </div>
                    </div>
                  </div>
                  <div className="font-mono tabular-nums text-xs font-bold text-[var(--sm-accent-text)] shrink-0">
                    {row.score.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
