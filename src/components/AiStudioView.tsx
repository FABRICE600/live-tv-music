import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Disc3,
  Download,
  Film,
  Image as ImageIcon,
  Loader2,
  Mic,
  Music,
  Play,
  Save,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { MusicTrack } from '../types/music';

interface AiStudioViewProps {
  initialTab?: 'music' | 'image' | 'video' | 'transcribe';
  onPlayTrack: (track: MusicTrack) => void;
  onSendToAssistant: (prompt: string) => void;
}

interface SavedCreation {
  id: number;
  kind: string;
  title: string;
  prompt: string;
  model: string;
  mediaUrl: string | null;
  metadataJson: string | null;
  createdAt: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected file'));
    reader.readAsDataURL(file);
  });
}

const MUSIC_PRESETS = [
  'Warm late-night Kigali neo-soul with acoustic kora, Rhodes chords, and brushed snare at 92 BPM',
  'Analog modular ambient soundscape with tape saturation, brass swells, and gentle vinyl crackle',
  'Upbeat Afrobeats stadium anthem with talking drums, crisp horn stabs, and deep bassline',
];

const IMAGE_PRESETS = [
  'Minimalist vinyl album cover for a midnight jazz trio in an obsidian listening room, warm amber rim lighting, editorial photography',
  'Brutalist concrete concert hall interior illuminated by warm golden acoustic diffusers, editorial architectural digest style',
];

const VIDEO_PRESETS = [
  'Slow dolly push-in toward a glowing vacuum-tube amplifier and spinning vinyl turntable in a dark mahogany studio, warm dust motes in amber spotlight',
  'Aerial twilight sweep over a packed open-air stadium concert stage with warm golden stage beams and atmospheric mist',
];

export function AiStudioView({
  initialTab = 'music',
  onPlayTrack,
  onSendToAssistant,
}: AiStudioViewProps) {
  const { user, getIdToken, signInWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<'music' | 'image' | 'video' | 'transcribe'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Saved creations (Cloud SQL)
  const [vault, setVault] = useState<SavedCreation[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);

  const loadVault = useCallback(async () => {
    if (!user) {
      setVault([]);
      return;
    }
    setVaultLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch('/api/sql/creations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { creations?: SavedCreation[] };
        setVault(data.creations || []);
      }
    } catch {
      // Ignore transient load error
    } finally {
      setVaultLoading(false);
    }
  }, [user, getIdToken]);

  useEffect(() => {
    void loadVault();
  }, [loadVault]);

  const saveToVault = useCallback(
    async (payload: {
      kind: 'music' | 'image' | 'video' | 'transcript';
      title: string;
      prompt: string;
      model: string;
      mediaUrl?: string;
      metadataJson?: string;
    }) => {
      if (!user) {
        await signInWithGoogle();
        return;
      }
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch('/api/sql/creations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await loadVault();
      }
    },
    [user, getIdToken, loadVault, signInWithGoogle],
  );

  const deleteCreation = useCallback(
    async (id: number) => {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch(`/api/sql/creations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setVault((prev) => prev.filter((item) => item.id !== id));
      }
    },
    [getIdToken],
  );

  // ---------------- MUSIC TAB ----------------
  const [musicPrompt, setMusicPrompt] = useState(MUSIC_PRESETS[0]);
  const [musicModel, setMusicModel] = useState<'lyria-3-clip-preview' | 'lyria-3-pro-preview'>(
    'lyria-3-clip-preview',
  );
  const [musicRefImage, setMusicRefImage] = useState<string>('');
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [musicResult, setMusicResult] = useState<{
    audioDataUrl: string;
    lyrics: string;
    model: string;
    prompt: string;
  } | null>(null);

  const handleGenerateMusic = async () => {
    if (!musicPrompt.trim() || musicLoading) return;
    setMusicLoading(true);
    setMusicError(null);
    try {
      const res = await fetch('/api/ai/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: musicPrompt,
          model: musicModel,
          referenceImageBase64: musicRefImage || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Music generation failed');
      setMusicResult({
        audioDataUrl: data.audioDataUrl,
        lyrics: data.lyrics || '',
        model: data.model || musicModel,
        prompt: musicPrompt,
      });
    } catch (err) {
      setMusicError(err instanceof Error ? err.message : 'Unable to generate track');
    } finally {
      setMusicLoading(false);
    }
  };

  // ---------------- IMAGE TAB ----------------
  const [imagePrompt, setImagePrompt] = useState(IMAGE_PRESETS[0]);
  const [imageAspect, setImageAspect] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
  const [imageSize, setImageSize] = useState<'1K' | '2K'>('1K');
  const [imageRefDataUrl, setImageRefDataUrl] = useState<string>('');
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<{
    imageDataUrl: string;
    notes: string;
    prompt: string;
  } | null>(null);

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim() || imageLoading) return;
    setImageLoading(true);
    setImageError(null);
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          aspectRatio: imageAspect,
          imageSize,
          referenceImageBase64: imageRefDataUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image generation failed');
      setImageResult({
        imageDataUrl: data.imageDataUrl,
        notes: data.notes || '',
        prompt: imagePrompt,
      });
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Unable to generate image');
    } finally {
      setImageLoading(false);
    }
  };

  // ---------------- VIDEO TAB ----------------
  const [videoPrompt, setVideoPrompt] = useState(VIDEO_PRESETS[0]);
  const [videoAspect, setVideoAspect] = useState<'16:9' | '9:16'>('16:9');
  const [videoStartFrame, setVideoStartFrame] = useState<string>('');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoResult, setVideoResult] = useState<{
    videoDataUrl: string;
    prompt: string;
  } | null>(null);

  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim() || videoLoading) return;
    setVideoLoading(true);
    setVideoError(null);
    try {
      const res = await fetch('/api/ai/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          aspectRatio: videoAspect,
          startingImageBase64: videoStartFrame || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Video generation failed');
      setVideoResult({
        videoDataUrl: data.videoDataUrl,
        prompt: videoPrompt,
      });
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Unable to generate video');
    } finally {
      setVideoLoading(false);
    }
  };

  // ---------------- TRANSCRIBE TAB ----------------
  const [isRecording, setIsRecording] = useState(false);
  const [transcribeAudioUrl, setTranscribeAudioUrl] = useState<string>('');
  const [transcribeMime, setTranscribeMime] = useState<string>('audio/webm');
  const [transcribeInstruction, setTranscribeInstruction] = useState(
    'Transcribe spoken lyrics or speech accurately with clean punctuation.',
  );
  const [transcribeLoading, setTranscribeLoading] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const handleStartRecording = async () => {
    setTranscribeError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setTranscribeMime(blob.type || 'audio/webm');
        const reader = new FileReader();
        reader.onload = () => {
          setTranscribeAudioUrl(String(reader.result || ''));
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setTranscribeError('Microphone access was denied or unavailable in this browser.');
    }
  };

  const handleStopRecording = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleAudioFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTranscribeError(null);
    const dataUrl = await readFileAsDataUrl(file);
    setTranscribeAudioUrl(dataUrl);
    setTranscribeMime(file.type || 'audio/mpeg');
  };

  const handleTranscribe = async () => {
    if (!transcribeAudioUrl || transcribeLoading) return;
    setTranscribeLoading(true);
    setTranscribeError(null);
    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: transcribeAudioUrl,
          mimeType: transcribeMime,
          prompt: transcribeInstruction,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription failed');
      setTranscriptText(data.transcript || '');
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Unable to transcribe audio');
    } finally {
      setTranscribeLoading(false);
    }
  };

  const handlePlayGeneratedInDeck = () => {
    if (!musicResult) return;
    const track: MusicTrack = {
      id: `lyria-${Date.now()}`,
      title: musicResult.prompt.slice(0, 48),
      artist: 'Soundmark Lyria Studio',
      album: musicResult.model === 'lyria-3-pro-preview' ? 'Lyria 3 Pro Master' : 'Lyria 3 Clip',
      genre: 'AI Composition',
      country: 'Studio',
      durationSec: musicModel === 'lyria-3-pro-preview' ? 120 : 30,
      audioUrl: musicResult.audioDataUrl,
      coverUrl: imageResult?.imageDataUrl || '/src/assets/images/cover_electronic_sessions_1794641732983.jpg',
      license: 'Studio Generated',
      sourceLabel: 'Lyria 3',
      storeLinks: [],
    };
    onPlayTrack(track);
  };

  const tabs: Array<{ id: 'music' | 'image' | 'video' | 'transcribe'; label: string; icon: typeof Music }> = [
    { id: 'music', label: 'Compose Music', icon: Music },
    { id: 'image', label: 'Cover & Image Studio', icon: ImageIcon },
    { id: 'video', label: 'Cinema Video', icon: Film },
    { id: 'transcribe', label: 'Audio Transcriber', icon: Mic },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--sm-border)] pb-6">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-[var(--sm-accent-text)]">
            Soundmark Production Suite
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--sm-text)] mt-1">
            Creative Studio
          </h1>
          <p className="text-sm text-[var(--sm-text-sec)] mt-1.5 max-w-2xl">
            Compose original audio stems and full songs with Lyria 3, craft or edit album art with Nano Banana 2.1, animate frames into 720p cinema video, and transcribe vocal takes.
          </p>
        </div>

        {!user && (
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-90"
          >
            <Save size={14} />
            <span>Sign in to save creations</span>
          </button>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[var(--sm-accent)] text-[var(--sm-on-accent)] border-[var(--sm-accent)]'
                  : 'bg-[var(--sm-surface)] text-[var(--sm-text-sec)] border-[var(--sm-border)] hover:text-[var(--sm-text)]'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MUSIC GENERATION */}
      {activeTab === 'music' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-[var(--sm-text)]">
                Lyria 3 Music Generator
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMusicModel('lyria-3-clip-preview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap ${
                    musicModel === 'lyria-3-clip-preview'
                      ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-text)]'
                      : 'border-[var(--sm-border)] text-[var(--sm-text-sec)]'
                  }`}
                >
                  Clip (30s)
                </button>
                <button
                  type="button"
                  onClick={() => setMusicModel('lyria-3-pro-preview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap ${
                    musicModel === 'lyria-3-pro-preview'
                      ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-text)]'
                      : 'border-[var(--sm-border)] text-[var(--sm-text-sec)]'
                  }`}
                >
                  Pro Full Track
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[var(--sm-text-sec)]">
                Musical Direction, Instrumentation &amp; Tempo
              </label>
              <textarea
                rows={4}
                value={musicPrompt}
                onChange={(e) => setMusicPrompt(e.target.value)}
                placeholder="Describe genre, instruments, vocal style, mood, and BPM..."
                className="w-full rounded-xl bg-[var(--sm-bg)] border border-[var(--sm-border)] p-3.5 text-sm text-[var(--sm-text)] focus:outline-none focus:border-[var(--sm-accent)]"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {MUSIC_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMusicPrompt(preset)}
                    className="text-left text-[11px] px-2.5 py-1.5 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] hover:border-[var(--sm-accent)]"
                  >
                    Preset {idx + 1}: {preset.slice(0, 42)}…
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--sm-border)]">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-bg)] text-xs font-medium text-[var(--sm-text-sec)] cursor-pointer hover:text-[var(--sm-text)]">
                <Upload size={14} />
                <span>{musicRefImage ? 'Mood image attached' : 'Optional mood image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setMusicRefImage(await readFileAsDataUrl(f));
                  }}
                />
              </label>

              <button
                type="button"
                disabled={musicLoading || !musicPrompt.trim()}
                onClick={handleGenerateMusic}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-90 disabled:opacity-50"
              >
                {musicLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>{musicLoading ? 'Composing Audio…' : 'Generate Track'}</span>
              </button>
            </div>

            {musicError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">
                {musicError}
              </p>
            )}
          </section>

          <section className="lg:col-span-5 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-[var(--sm-text)]">
                Studio Master Output
              </h3>
              <p className="text-xs text-[var(--sm-text-muted)] mt-0.5">
                Stream directly or send to the main Soundmark Listening Deck.
              </p>
            </div>

            {musicResult ? (
              <div className="space-y-4">
                <audio controls src={musicResult.audioDataUrl} className="w-full" />
                {musicResult.lyrics && (
                  <div className="rounded-xl bg-[var(--sm-bg)] border border-[var(--sm-border)] p-3.5 max-h-48 overflow-y-auto text-xs text-[var(--sm-text-sec)] whitespace-pre-wrap">
                    {musicResult.lyrics}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePlayGeneratedInDeck}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-semibold whitespace-nowrap"
                  >
                    <Play size={13} />
                    <span>Load in Main Deck</span>
                  </button>
                  <a
                    href={musicResult.audioDataUrl}
                    download="soundmark-lyria-track.mp3"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap"
                  >
                    <Download size={13} />
                    <span>Download MP3</span>
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      void saveToVault({
                        kind: 'music',
                        title: musicResult.prompt.slice(0, 64),
                        prompt: musicResult.prompt,
                        model: musicResult.model,
                        mediaUrl: musicResult.audioDataUrl,
                        metadataJson: JSON.stringify({ lyrics: musicResult.lyrics }),
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sm-accent)] text-xs font-semibold text-[var(--sm-accent-text)] whitespace-nowrap"
                  >
                    <Save size={13} />
                    <span>Save to Vault</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-44 rounded-xl border border-dashed border-[var(--sm-border)] flex flex-col items-center justify-center text-center p-6 text-[var(--sm-text-muted)]">
                <Disc3 size={28} className="mb-2 opacity-60" />
                <p className="text-xs">Generated audio stems and lyrics appear here.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: IMAGE STUDIO */}
      {activeTab === 'image' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-6 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-5 sm:p-6 space-y-5">
            <h2 className="font-display text-xl font-semibold text-[var(--sm-text)]">
              Create &amp; Edit Album Artwork
            </h2>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[var(--sm-text-sec)]">
                Artwork Prompt or Edit Instruction
              </label>
              <textarea
                rows={4}
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Describe cover artwork or how to edit the uploaded image..."
                className="w-full rounded-xl bg-[var(--sm-bg)] border border-[var(--sm-border)] p-3.5 text-sm text-[var(--sm-text)] focus:outline-none focus:border-[var(--sm-accent)]"
              />
              <div className="flex flex-wrap gap-2">
                {IMAGE_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setImagePrompt(preset)}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
                  >
                    Idea {i + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[var(--sm-text-muted)] mb-1.5">
                  Aspect Ratio
                </label>
                <select
                  value={imageAspect}
                  onChange={(e) =>
                    setImageAspect(e.target.value as '1:1' | '16:9' | '9:16' | '4:3' | '3:4')
                  }
                  className="w-full rounded-xl bg-[var(--sm-bg)] border border-[var(--sm-border)] px-3 py-2 text-xs text-[var(--sm-text)]"
                >
                  <option value="1:1">1:1 Album Square</option>
                  <option value="16:9">16:9 Widescreen</option>
                  <option value="9:16">9:16 Vertical Poster</option>
                  <option value="4:3">4:3 Editorial</option>
                  <option value="3:4">3:4 Portrait</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--sm-text-muted)] mb-1.5">
                  Resolution
                </label>
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value as '1K' | '2K')}
                  className="w-full rounded-xl bg-[var(--sm-bg)] border border-[var(--sm-border)] px-3 py-2 text-xs text-[var(--sm-text)]"
                >
                  <option value="1K">1K Standard</option>
                  <option value="2K">2K High-Res</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--sm-border)]">
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-bg)] text-xs font-medium text-[var(--sm-text-sec)] cursor-pointer hover:text-[var(--sm-text)]">
                  <Upload size={14} />
                  <span>{imageRefDataUrl ? 'Source attached (Edit mode)' : 'Upload image to edit'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setImageRefDataUrl(await readFileAsDataUrl(f));
                    }}
                  />
                </label>
                {imageRefDataUrl && (
                  <button
                    type="button"
                    onClick={() => setImageRefDataUrl('')}
                    className="text-xs text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]"
                  >
                    Clear
                  </button>
                )}
              </div>

              <button
                type="button"
                disabled={imageLoading || !imagePrompt.trim()}
                onClick={handleGenerateImage}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-90 disabled:opacity-50"
              >
                {imageLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                <span>
                  {imageLoading
                    ? 'Rendering…'
                    : imageRefDataUrl
                      ? 'Apply Edit'
                      : 'Generate Artwork'}
                </span>
              </button>
            </div>

            {imageError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">
                {imageError}
              </p>
            )}
          </section>

          <section className="lg:col-span-6 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-5 sm:p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold text-[var(--sm-text)]">
              Rendered Canvas
            </h3>

            {imageResult ? (
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden border border-[var(--sm-border)] bg-[var(--sm-bg)]">
                  <img
                    src={imageResult.imageDataUrl}
                    alt={imageResult.prompt}
                    className="w-full max-h-96 object-contain mx-auto"
                  />
                </div>
                {imageResult.notes && (
                  <p className="text-xs text-[var(--sm-text-sec)]">{imageResult.notes}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoStartFrame(imageResult.imageDataUrl);
                      setVideoPrompt(`Subtle cinematic camera drift and atmospheric motion: ${imageResult.prompt}`);
                      setActiveTab('video');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-semibold whitespace-nowrap"
                  >
                    <Film size={13} />
                    <span>Animate to Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageRefDataUrl(imageResult.imageDataUrl)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap"
                  >
                    <Wand2 size={13} />
                    <span>Iterate / Edit</span>
                  </button>
                  <a
                    href={imageResult.imageDataUrl}
                    download="soundmark-artwork.png"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap"
                  >
                    <Download size={13} />
                    <span>Download PNG</span>
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      void saveToVault({
                        kind: 'image',
                        title: imageResult.prompt.slice(0, 64),
                        prompt: imageResult.prompt,
                        model: 'gemini-nano-banana-2.1',
                        mediaUrl: imageResult.imageDataUrl,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sm-accent)] text-xs font-semibold text-[var(--sm-accent-text)] whitespace-nowrap"
                  >
                    <Save size={13} />
                    <span>Save to Vault</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-h-64 rounded-xl border border-dashed border-[var(--sm-border)] flex flex-col items-center justify-center text-center p-6 text-[var(--sm-text-muted)]">
                <ImageIcon size={28} className="mb-2 opacity-60" />
                <p className="text-xs">Generated or edited images appear here.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: CINEMA VIDEO (TEXT-TO-VIDEO & IMAGE-TO-VIDEO) */}
      {activeTab === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-6 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-[var(--sm-text)]">
                Text &amp; Image-to-Video Studio
              </h2>
              <div className="flex items-center gap-1.5">
                {(['16:9', '9:16'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setVideoAspect(ratio)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono border ${
                      videoAspect === ratio
                        ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-text)]'
                        : 'border-[var(--sm-border)] text-[var(--sm-text-sec)]'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[var(--sm-text-sec)]">
                Scene Motion &amp; Camera Direction
              </label>
              <textarea
                rows={4}
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                placeholder="Describe camera movement, lighting changes, and action..."
                className="w-full rounded-xl bg-[var(--sm-bg)] border border-[var(--sm-border)] p-3.5 text-sm text-[var(--sm-text)] focus:outline-none focus:border-[var(--sm-accent)]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--sm-border)]">
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-bg)] text-xs font-medium text-[var(--sm-text-sec)] cursor-pointer hover:text-[var(--sm-text)]">
                  <Upload size={14} />
                  <span>
                    {videoStartFrame ? 'Starting frame attached' : 'Animate starting image (optional)'}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setVideoStartFrame(await readFileAsDataUrl(f));
                    }}
                  />
                </label>
                {videoStartFrame && (
                  <button
                    type="button"
                    onClick={() => setVideoStartFrame('')}
                    className="text-xs text-[var(--sm-text-muted)] hover:text-[var(--sm-text)]"
                  >
                    Remove frame
                  </button>
                )}
              </div>

              <button
                type="button"
                disabled={videoLoading || !videoPrompt.trim()}
                onClick={handleGenerateVideo}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-90 disabled:opacity-50"
              >
                {videoLoading ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
                <span>
                  {videoLoading
                    ? 'Rendering 10s Video…'
                    : videoStartFrame
                      ? 'Animate Image'
                      : 'Generate Video'}
                </span>
              </button>
            </div>

            {videoStartFrame && (
              <div className="rounded-xl border border-[var(--sm-border)] bg-[var(--sm-bg)] p-2.5 flex items-center gap-3">
                <img
                  src={videoStartFrame}
                  alt="Starting keyframe"
                  className="w-20 h-14 object-cover rounded-lg border border-[var(--sm-border)]"
                />
                <span className="text-xs text-[var(--sm-text-sec)]">
                  Image-to-Video keyframe ready for 720p animation.
                </span>
              </div>
            )}

            {videoError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">
                {videoError}
              </p>
            )}
          </section>

          <section className="lg:col-span-6 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-5 sm:p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold text-[var(--sm-text)]">
              Cinema Render Output
            </h3>
            {videoResult ? (
              <div className="space-y-4">
                <video
                  controls
                  playsInline
                  src={videoResult.videoDataUrl}
                  className="w-full rounded-xl border border-[var(--sm-border)] bg-[#0B0C10]"
                />
                <div className="flex flex-wrap gap-2">
                  <a
                    href={videoResult.videoDataUrl}
                    download="soundmark-cinema.mp4"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
                  >
                    <Download size={13} />
                    <span>Download MP4</span>
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      void saveToVault({
                        kind: 'video',
                        title: videoResult.prompt.slice(0, 64),
                        prompt: videoResult.prompt,
                        model: 'gemini-omni-1.2-flash',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sm-accent)] text-xs font-semibold text-[var(--sm-accent-text)]"
                  >
                    <Save size={13} />
                    <span>Save Log to Vault</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-h-64 rounded-xl border border-dashed border-[var(--sm-border)] flex flex-col items-center justify-center text-center p-6 text-[var(--sm-text-muted)]">
                <Film size={28} className="mb-2 opacity-60" />
                <p className="text-xs">720p generated or animated video clips play here.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 4: TRANSCRIBE AUDIO */}
      {activeTab === 'transcribe' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-6 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-5 sm:p-6 space-y-5">
            <h2 className="font-display text-xl font-semibold text-[var(--sm-text)]">
              Audio &amp; Lyric Transcriber
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={() => void handleStartRecording()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold whitespace-nowrap"
                >
                  <Mic size={14} />
                  <span>Record Microphone</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold whitespace-nowrap"
                >
                  <Square size={13} />
                  <span>Stop Recording</span>
                </button>
              )}

              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-bg)] text-xs font-medium text-[var(--sm-text-sec)] cursor-pointer hover:text-[var(--sm-text)]">
                <Upload size={14} />
                <span>Upload Audio File</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleAudioFileUpload}
                />
              </label>
            </div>

            {transcribeAudioUrl && (
              <div className="rounded-xl border border-[var(--sm-border)] bg-[var(--sm-bg)] p-3.5 space-y-2">
                <div className="text-[11px] font-mono text-[var(--sm-text-muted)]">
                  Ready · {transcribeMime}
                </div>
                <audio controls src={transcribeAudioUrl} className="w-full" />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--sm-text-sec)]">
                Transcription Guidance
              </label>
              <input
                type="text"
                value={transcribeInstruction}
                onChange={(e) => setTranscribeInstruction(e.target.value)}
                className="w-full rounded-xl bg-[var(--sm-bg)] border border-[var(--sm-border)] px-3.5 py-2.5 text-xs text-[var(--sm-text)] focus:outline-none focus:border-[var(--sm-accent)]"
              />
            </div>

            <button
              type="button"
              disabled={!transcribeAudioUrl || transcribeLoading}
              onClick={handleTranscribe}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-semibold whitespace-nowrap disabled:opacity-50"
            >
              {transcribeLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>{transcribeLoading ? 'Transcribing…' : 'Transcribe Audio'}</span>
            </button>

            {transcribeError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2.5">
                {transcribeError}
              </p>
            )}
          </section>

          <section className="lg:col-span-6 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-5 sm:p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold text-[var(--sm-text)]">
              Transcript
            </h3>
            {transcriptText ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--sm-border)] bg-[var(--sm-bg)] p-4 text-sm text-[var(--sm-text)] whitespace-pre-wrap leading-relaxed min-h-40">
                  {transcriptText}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMusicPrompt(transcriptText);
                      setActiveTab('music');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
                  >
                    <Music size={13} />
                    <span>Turn into Music Prompt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendToAssistant(transcriptText)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
                  >
                    <Sparkles size={13} />
                    <span>Discuss with Assistant</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void saveToVault({
                        kind: 'transcript',
                        title: transcriptText.slice(0, 64),
                        prompt: transcribeInstruction,
                        model: 'gemini-3.5-transcribe',
                        metadataJson: JSON.stringify({ transcript: transcriptText }),
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sm-accent)] text-xs font-semibold text-[var(--sm-accent-text)]"
                  >
                    <Save size={13} />
                    <span>Save Transcript</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-h-48 rounded-xl border border-dashed border-[var(--sm-border)] flex flex-col items-center justify-center text-center p-6 text-[var(--sm-text-muted)]">
                <Mic size={28} className="mb-2 opacity-60" />
                <p className="text-xs">Record voice notes or upload audio to transcribe.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Saved Studio Creations Vault (Cloud SQL) */}
      {user && (
        <section className="rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--sm-text)]">
                Your Saved Studio Vault
              </h2>
              <p className="text-xs text-[var(--sm-text-muted)]">
                Synced to your Soundmark account across devices.
              </p>
            </div>
            {vaultLoading && <Loader2 size={16} className="animate-spin text-[var(--sm-text-muted)]" />}
          </div>

          {vault.length === 0 ? (
            <p className="text-xs text-[var(--sm-text-muted)] py-4">
              No saved creations yet. Generate music, artwork, video logs, or transcripts above and click Save to Vault.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vault.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[var(--sm-border)] bg-[var(--sm-bg)] p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[var(--sm-accent-text)] uppercase">
                      <span>{item.kind}</span>
                      <button
                        type="button"
                        onClick={() => void deleteCreation(item.id)}
                        aria-label="Delete creation"
                        className="text-[var(--sm-text-muted)] hover:text-red-400 p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--sm-text)] line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[var(--sm-text-sec)] line-clamp-2">{item.prompt}</p>
                    {item.kind === 'image' && item.mediaUrl && (
                      <img
                        src={item.mediaUrl}
                        alt={item.title}
                        className="w-full h-36 object-cover rounded-lg border border-[var(--sm-border)]"
                      />
                    )}
                    {item.kind === 'music' && item.mediaUrl && (
                      <audio controls src={item.mediaUrl} className="w-full h-9" />
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--sm-text-muted)]">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
