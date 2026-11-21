import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, Disc3, Play, Pause, RotateCcw } from 'lucide-react';
import type { MusicTrack } from '../types/music';

interface Stage3DViewProps {
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  analyser: AnalyserNode | null;
}

type CameraPreset = 'overview' | 'turntable' | 'amp' | 'stage';
type StageMood = 'nocturne' | 'crimson' | 'daylight';

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number]; label: string }
> = {
  overview: { pos: [4.2, 2.7, 5.1], target: [0, 0.75, 0], label: 'Studio Overview' },
  turntable: { pos: [-1.45, 2.0, 2.25], target: [-1.1, 0.75, 0.15], label: 'Turntable Close-Up' },
  amp: { pos: [1.55, 1.55, 2.2], target: [1.1, 0.65, 0.15], label: 'Vacuum Tube Amp' },
  stage: { pos: [0, 1.85, 6.2], target: [0, 1.0, -0.8], label: 'Acoustic Stage' },
};

function isSoftwareGl(renderer: THREE.WebGLRenderer): boolean {
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const r = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  return /SwiftShader|ANGLE \(.*(SwiftShader|Software|llvmpipe)/i.test(r);
}

function createWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3b2416';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) {
    const y = (i / 160) * 512;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(20, 10, 5, 0.35)' : 'rgba(92, 56, 33, 0.25)';
    ctx.lineWidth = 1 + (i % 4);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + Math.sin(i) * 8, 340, y - Math.cos(i) * 8, 512, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createVinylTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0c0d11';
  ctx.fillRect(0, 0, 512, 512);
  for (let r = 88; r < 245; r += 3) {
    ctx.strokeStyle = r % 9 === 0 ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#e0a432';
  ctx.beginPath();
  ctx.arc(256, 256, 74, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#13151c';
  ctx.beginPath();
  ctx.arc(256, 256, 10, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Stage3DView({ currentTrack, isPlaying, analyser }: Stage3DViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [preset, setPreset] = useState<CameraPreset>('overview');
  const [mood, setMood] = useState<StageMood>('nocturne');
  const [spinDemo, setSpinDemo] = useState(true);
  const [explode, setExplode] = useState(0);
  const [intensity, setIntensity] = useState(1);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const presetRef = useRef<CameraPreset>('overview');
  const moodRef = useRef<StageMood>('nocturne');
  const spinDemoRef = useRef(true);
  const explodeRef = useRef(0);
  const intensityRef = useRef(1);
  const isPlayingRef = useRef(isPlaying);
  const analyserRef = useRef(analyser);

  presetRef.current = preset;
  moodRef.current = mood;
  spinDemoRef.current = spinDemo;
  explodeRef.current = explode;
  intensityRef.current = intensity;
  isPlayingRef.current = isPlaying;
  analyserRef.current = analyser;

  const triggerPresetRef = useRef<(p: CameraPreset) => void>(() => {});

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0B0C10');
    scene.fog = new THREE.FogExp2('#0B0C10', 0.045);

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 540;
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 60);
    camera.position.set(...CAMERA_PRESETS.overview.pos);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const softGl = isSoftwareGl(renderer);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, softGl ? 1.5 : 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.72;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 1.8;
    controls.maxDistance = 11.5;
    controls.target.set(...CAMERA_PRESETS.overview.target);

    // Three-point + Hemisphere lighting
    const hemiLight = new THREE.HemisphereLight('#9db4d8', '#1f1812', 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#ffd79a', 2.4);
    keyLight.position.set(4.5, 6.5, 4.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(softGl ? 1024 : 2048, softGl ? 1024 : 2048);
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight('#e0a432', 2.2, 12);
    rimLight.position.set(-3.2, 2.5, -2.5);
    scene.add(rimLight);

    // Materials & Textures
    const woodTex = createWoodTexture();
    const vinylTex = createVinylTexture();

    const disposables: Array<{ dispose: () => void }> = [woodTex, vinylTex, envTarget];
    const trackDisposable = <T extends { dispose: () => void }>(d: T): T => {
      disposables.push(d);
      return d;
    };

    const walnutMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        roughness: 0.42,
        metalness: 0.08,
      }),
    );
    const obsidianMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: '#141720',
        roughness: 0.32,
        metalness: 0.65,
      }),
    );
    const brushedAluminumMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: '#c7ccd4',
        roughness: 0.28,
        metalness: 0.88,
      }),
    );
    const brassMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: '#e0a432',
        roughness: 0.24,
        metalness: 0.92,
      }),
    );
    const vinylMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        map: vinylTex,
        roughness: 0.22,
        metalness: 0.12,
      }),
    );
    const tubeGlassMat = trackDisposable(
      new THREE.MeshPhysicalMaterial({
        color: '#ffe6c2',
        roughness: 0.08,
        metalness: 0.05,
        transmission: 0.72,
        transparent: true,
        opacity: 0.85,
      }),
    );
    const filamentMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: '#ff9429',
        emissive: '#ff7714',
        emissiveIntensity: 2.2,
        roughness: 0.3,
      }),
    );

    // Stage floor & Credenza Console
    const floorGeo = trackDisposable(new THREE.CircleGeometry(9, 64));
    const floorMat = trackDisposable(
      new THREE.MeshStandardMaterial({ color: '#101218', roughness: 0.85, metalness: 0.1 }),
    );
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const plinthGroup = new THREE.Group();
    const consoleDeck = new THREE.Mesh(
      trackDisposable(new THREE.BoxGeometry(4.4, 0.24, 1.8)),
      walnutMat,
    );
    consoleDeck.position.y = 0.48;
    consoleDeck.castShadow = true;
    consoleDeck.receiveShadow = true;
    plinthGroup.add(consoleDeck);

    const legGeo = trackDisposable(new THREE.CylinderGeometry(0.05, 0.035, 0.36, 16));
    [
      [-1.9, -0.7],
      [1.9, -0.7],
      [-1.9, 0.7],
      [1.9, 0.7],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, brassMat);
      leg.position.set(lx, 0.18, lz);
      leg.castShadow = true;
      plinthGroup.add(leg);
    });
    scene.add(plinthGroup);

    // Composite 1: Boutique Hi-Fi Turntable (7 parts)
    const turntableGroup = new THREE.Group();
    turntableGroup.position.set(-1.1, 0.6, 0.1);

    const ttPlinth = new THREE.Mesh(
      trackDisposable(new THREE.BoxGeometry(1.55, 0.14, 1.25)),
      obsidianMat,
    );
    ttPlinth.position.y = 0.07;
    ttPlinth.castShadow = true;
    ttPlinth.receiveShadow = true;
    turntableGroup.add(ttPlinth);

    const platterGroup = new THREE.Group();
    platterGroup.position.set(-0.12, 0.17, 0);
    const platterMesh = new THREE.Mesh(
      trackDisposable(new THREE.CylinderGeometry(0.5, 0.51, 0.06, 48)),
      brushedAluminumMat,
    );
    platterMesh.castShadow = true;
    platterGroup.add(platterMesh);

    const vinylDisc = new THREE.Mesh(
      trackDisposable(new THREE.CylinderGeometry(0.48, 0.48, 0.015, 48)),
      vinylMat,
    );
    vinylDisc.position.y = 0.04;
    vinylDisc.castShadow = true;
    platterGroup.add(vinylDisc);

    const spindle = new THREE.Mesh(
      trackDisposable(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 16)),
      brassMat,
    );
    spindle.position.y = 0.06;
    platterGroup.add(spindle);
    turntableGroup.add(platterGroup);

    // Tonearm Assembly
    const tonearmPivot = new THREE.Group();
    tonearmPivot.position.set(0.52, 0.19, -0.36);
    const gimbalBase = new THREE.Mesh(
      trackDisposable(new THREE.CylinderGeometry(0.08, 0.095, 0.07, 24)),
      brassMat,
    );
    tonearmPivot.add(gimbalBase);

    const armWand = new THREE.Mesh(
      trackDisposable(new THREE.CylinderGeometry(0.013, 0.013, 0.62, 12)),
      brushedAluminumMat,
    );
    armWand.rotation.x = Math.PI / 2;
    armWand.rotation.z = 0.34;
    armWand.position.set(-0.1, 0.04, 0.28);
    tonearmPivot.add(armWand);

    const cartridge = new THREE.Mesh(
      trackDisposable(new THREE.BoxGeometry(0.06, 0.04, 0.1)),
      brassMat,
    );
    cartridge.position.set(-0.2, 0.025, 0.55);
    tonearmPivot.add(cartridge);
    turntableGroup.add(tonearmPivot);

    scene.add(turntableGroup);

    // Composite 2: Vacuum Tube Stereo Amplifier (10+ parts)
    const ampGroup = new THREE.Group();
    ampGroup.position.set(1.05, 0.6, 0.1);

    const ampChassis = new THREE.Mesh(
      trackDisposable(new THREE.BoxGeometry(1.45, 0.18, 1.15)),
      obsidianMat,
    );
    ampChassis.position.y = 0.09;
    ampChassis.castShadow = true;
    ampChassis.receiveShadow = true;
    ampGroup.add(ampChassis);

    const transformerGeo = trackDisposable(new THREE.BoxGeometry(0.32, 0.24, 0.32));
    [-0.4, 0, 0.4].forEach((tx) => {
      const xfmr = new THREE.Mesh(transformerGeo, brushedAluminumMat);
      xfmr.position.set(tx, 0.28, -0.32);
      xfmr.castShadow = true;
      ampGroup.add(xfmr);
    });

    const tubeGeo = trackDisposable(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 20));
    const coreGeo = trackDisposable(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 12));
    [-0.42, -0.14, 0.14, 0.42].forEach((vx) => {
      const tube = new THREE.Mesh(tubeGeo, tubeGlassMat);
      tube.position.set(vx, 0.28, 0.14);
      ampGroup.add(tube);

      const core = new THREE.Mesh(coreGeo, filamentMat);
      core.position.set(vx, 0.26, 0.14);
      ampGroup.add(core);
    });

    const knobGeo = trackDisposable(new THREE.CylinderGeometry(0.065, 0.065, 0.06, 24));
    [-0.45, 0.45].forEach((kx) => {
      const knob = new THREE.Mesh(knobGeo, brassMat);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(kx, 0.09, 0.59);
      ampGroup.add(knob);
    });
    scene.add(ampGroup);

    // Composite 3: Dual Reference Studio Monitor Towers
    const speakerGeo = trackDisposable(new THREE.BoxGeometry(0.75, 1.85, 0.75));
    const wooferGeo = trackDisposable(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 32));
    const tweeterGeo = trackDisposable(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 24));

    const woofers: THREE.Mesh[] = [];
    const phasePlugs: THREE.Mesh[] = [];

    [-2.85, 2.85].forEach((sx) => {
      const tower = new THREE.Group();
      tower.position.set(sx, 0.925, -0.35);

      const cabinet = new THREE.Mesh(speakerGeo, walnutMat);
      cabinet.castShadow = true;
      cabinet.receiveShadow = true;
      tower.add(cabinet);

      const woofer = new THREE.Mesh(wooferGeo, obsidianMat);
      woofer.rotation.x = Math.PI / 2;
      woofer.position.set(0, -0.15, 0.37);
      tower.add(woofer);
      woofers.push(woofer);

      const phasePlug = new THREE.Mesh(
        trackDisposable(new THREE.SphereGeometry(0.065, 16, 16)),
        brassMat,
      );
      phasePlug.position.set(0, -0.15, 0.39);
      tower.add(phasePlug);
      phasePlugs.push(phasePlug);

      const tweeter = new THREE.Mesh(tweeterGeo, brushedAluminumMat);
      tweeter.rotation.x = Math.PI / 2;
      tweeter.position.set(0, 0.45, 0.37);
      tower.add(tweeter);

      scene.add(tower);
    });

    // Composite 4: 12-Band Reactive Stage EQ Columns
    const eqBars: THREE.Mesh[] = [];
    const barGeo = trackDisposable(new THREE.BoxGeometry(0.18, 1, 0.14));
    const barMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: '#e0a432',
        emissive: '#a66d0f',
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.7,
      }),
    );

    for (let i = 0; i < 12; i++) {
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(-1.65 + i * 0.3, 0.5, -1.65);
      bar.castShadow = true;
      scene.add(bar);
      eqBars.push(bar);
    }

    const freqData = new Uint8Array(64);
    let smoothPos = new THREE.Vector3(...CAMERA_PRESETS.overview.pos);
    let smoothTarget = new THREE.Vector3(...CAMERA_PRESETS.overview.target);
    let transitioning = false;

    triggerPresetRef.current = (nextPreset: CameraPreset) => {
      smoothPos.set(...CAMERA_PRESETS[nextPreset].pos);
      smoothTarget.set(...CAMERA_PRESETS[nextPreset].target);
      transitioning = true;
    };

    const clock = new THREE.Clock();
    let rafId = 0;
    let disposed = false;

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 540;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      if (disposed) return;
      if (document.hidden) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      // Lighting mood smoothly adjusts
      const targetBg =
        moodRef.current === 'daylight'
          ? new THREE.Color('#E6EBF3')
          : moodRef.current === 'crimson'
            ? new THREE.Color('#130A0E')
            : new THREE.Color('#0B0C10');
      (scene.background as THREE.Color).lerp(targetBg, 0.08);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(scene.background as THREE.Color);
      }
      rimLight.color.set(
        moodRef.current === 'crimson'
          ? '#ff5a36'
          : moodRef.current === 'daylight'
            ? '#60a5fa'
            : '#e0a432',
      );

      // Exploded turntable parts & rotation
      const exp = explodeRef.current;
      vinylDisc.position.y = THREE.MathUtils.damp(vinylDisc.position.y, 0.04 + exp * 0.42, 6, delta);
      platterMesh.position.y = THREE.MathUtils.damp(platterMesh.position.y, exp * 0.16, 6, delta);
      tonearmPivot.position.y = THREE.MathUtils.damp(tonearmPivot.position.y, 0.19 + exp * 0.25, 6, delta);

      if (isPlayingRef.current || spinDemoRef.current) {
        platterGroup.rotation.y -= delta * 1.15;
      }

      // Reactive EQ towers, speaker excursion & stage lighting scaled by visualizer intensity
      const visIntensity = intensityRef.current;
      const hasLiveAudio = Boolean(analyserRef.current && isPlayingRef.current);
      if (hasLiveAudio && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(freqData);
      }

      let totalReactive = 0;
      for (let i = 0; i < eqBars.length; i++) {
        let drive = 0.06 + 0.08 * (0.5 + 0.5 * Math.sin(elapsed * 2.2 + i * 0.65));
        if (hasLiveAudio) {
          const binIndex = Math.min(i * 3, freqData.length - 1);
          drive = (freqData[binIndex] / 255) * 1.85;
        } else if (spinDemoRef.current) {
          drive = 0.18 + Math.abs(Math.sin(elapsed * 3.1 + i * 0.55)) * 0.95;
        }
        const scaledDrive = drive * visIntensity;
        totalReactive += scaledDrive;

        const targetHeight = Math.max(0.16, 0.16 + scaledDrive);
        const bar = eqBars[i];
        bar.scale.y = THREE.MathUtils.damp(bar.scale.y, targetHeight, 8, delta);
        bar.position.y = bar.scale.y * 0.5;
      }

      const avgReactive = totalReactive / eqBars.length;
      const bassSignal = hasLiveAudio
        ? ((freqData[1] + freqData[2]) / 510) * visIntensity
        : spinDemoRef.current
          ? (0.5 + 0.5 * Math.sin(elapsed * 4.2)) * 0.45 * visIntensity
          : 0;

      const excursion = Math.min(bassSignal, 2.2) * 0.028;
      for (let i = 0; i < woofers.length; i++) {
        woofers[i].position.z = THREE.MathUtils.damp(woofers[i].position.z, 0.37 + excursion, 14, delta);
        phasePlugs[i].position.z = THREE.MathUtils.damp(
          phasePlugs[i].position.z,
          0.39 + excursion,
          14,
          delta,
        );
      }

      barMat.emissiveIntensity = THREE.MathUtils.damp(
        barMat.emissiveIntensity,
        0.42 + Math.min(avgReactive, 3.0) * 0.55,
        8,
        delta,
      );
      rimLight.intensity = THREE.MathUtils.damp(
        rimLight.intensity,
        1.75 + Math.min(avgReactive, 3.0) * 0.85,
        8,
        delta,
      );
      filamentMat.emissiveIntensity = THREE.MathUtils.damp(
        filamentMat.emissiveIntensity,
        1.9 + Math.min(avgReactive, 3.0) * 0.5,
        8,
        delta,
      );

      // Smooth damped camera preset transitions (stops once user drags controls)
      if (transitioning) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, smoothPos.x, 5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, smoothPos.y, 5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, smoothPos.z, 5, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, smoothTarget.x, 5, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, smoothTarget.y, 5, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, smoothTarget.z, 5, delta);
        if (camera.position.distanceTo(smoothPos) < 0.04) {
          transitioning = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (softGl) {
        setTimeout(() => {
          if (!disposed) rafId = requestAnimationFrame(animate);
        }, 16);
      } else {
        rafId = requestAnimationFrame(animate);
      }
    };

    const onPointerDown = () => {
      transitioning = false;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    rafId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleSelectPreset = (next: CameraPreset) => {
    setPreset(next);
    triggerPresetRef.current(next);
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-[var(--sm-border)] pb-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-[var(--sm-accent-text)]">
            Interactive WebGL Listening Sanctuary
          </p>
          <h1 className="font-display text-3xl font-semibold text-[var(--sm-text)] mt-1">
            3D Hi-Fi Stage
          </h1>
          <p className="text-xs text-[var(--sm-text-sec)] mt-1">
            Drag to orbit, scroll to zoom, inspect the exploded turntable platter, or watch the acoustic towers react to live playback.
          </p>
        </div>

        {currentTrack && (
          <div className="rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] px-3.5 py-2 flex items-center gap-2.5 text-xs">
            <Disc3 size={15} className="text-[var(--sm-accent-text)] shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-[var(--sm-text)] truncate max-w-[200px]">
                {currentTrack.title}
              </div>
              <div className="text-[11px] text-[var(--sm-text-muted)] truncate max-w-[200px]">
                {currentTrack.artist}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Viewport with isolated WebGL mount & collapsible bottom dock (no backdrop-blur over WebGL) */}
      <div className="relative h-[520px] lg:h-[600px] w-full rounded-2xl border border-[var(--sm-border)] overflow-hidden bg-[#0B0C10]">
        <div ref={mountRef} className="w-full h-full" />

        {/* Collapsible Bottom Control Dock (solid opaque dark card, zero blur over canvas) */}
        <div className="absolute bottom-3 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-auto sm:max-w-[92%] rounded-xl border border-[#252936] bg-[#13151C] text-[#F2F0EC] shadow-2xl">
          <div className="flex items-center justify-between gap-4 px-3.5 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSpinDemo((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E0A432] text-[#0B0C10] text-xs font-semibold whitespace-nowrap"
              >
                {spinDemo || isPlaying ? <Pause size={12} /> : <Play size={12} />}
                <span>{spinDemo || isPlaying ? 'Stage Active' : 'Paused'}</span>
              </button>

              {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectPreset(key)}
                  className={`hidden md:inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap ${
                    preset === key
                      ? 'border-[#E0A432] bg-[#1B1E28] text-[#F2F0EC]'
                      : 'border-[#252936] text-[#A1A6B5] hover:text-[#F2F0EC]'
                  }`}
                >
                  {CAMERA_PRESETS[key].label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              aria-label="Toggle stage controls"
              className="inline-flex items-center gap-1 text-xs text-[#A1A6B5] hover:text-[#F2F0EC] whitespace-nowrap"
            >
              <span>Controls</span>
              {dockCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {!dockCollapsed && (
            <div className="px-3.5 pb-3 pt-2 border-t border-[#252936] flex flex-wrap items-center gap-4 text-xs">
              <div className="flex md:hidden flex-wrap gap-1.5 w-full">
                {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectPreset(key)}
                    className={`px-2 py-1 rounded text-[11px] border ${
                      preset === key
                        ? 'border-[#E0A432] bg-[#1B1E28] text-[#F2F0EC]'
                        : 'border-[#252936] text-[#A1A6B5]'
                    }`}
                  >
                    {CAMERA_PRESETS[key].label}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2.5 min-w-[190px]">
                <span className="text-[#A1A6B5] whitespace-nowrap">Explode Platter</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={explode}
                  onChange={(e) => setExplode(Number(e.target.value))}
                  className="soundmark-range w-28"
                />
              </label>

              <label className="flex items-center gap-2.5 min-w-[225px]">
                <span className="text-[#A1A6B5] whitespace-nowrap">Visualizer Intensity</span>
                <input
                  type="range"
                  min={0}
                  max={2.5}
                  step={0.05}
                  value={intensity}
                  aria-label="Visualizer Intensity"
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  className="soundmark-range w-24"
                />
                <span className="text-[11px] font-mono tabular-nums text-[#E0A432] w-10 text-right">
                  {intensity.toFixed(2)}x
                </span>
              </label>

              <div className="flex items-center gap-1.5">
                <span className="text-[#A1A6B5] mr-1">Lighting:</span>
                {(['nocturne', 'crimson', 'daylight'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={`px-2.5 py-1 rounded-md border capitalize ${
                      mood === m
                        ? 'border-[#E0A432] bg-[#1B1E28] text-[#F2F0EC]'
                        : 'border-[#252936] text-[#A1A6B5]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setExplode(0);
                  setIntensity(1);
                  setMood('nocturne');
                  handleSelectPreset('overview');
                }}
                className="inline-flex items-center gap-1 text-[#A1A6B5] hover:text-[#F2F0EC] ml-auto"
              >
                <RotateCcw size={12} />
                <span>Reset View</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
