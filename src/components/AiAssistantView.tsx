import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Compass,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';

interface AiAssistantViewProps {
  initialMode?: 'chat' | 'search' | 'maps';
  initialPrompt?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  mode: 'chat' | 'search' | 'maps';
  model?: string;
  searchSources?: Array<{ title: string; uri: string }>;
  mapPlaces?: Array<{
    title: string;
    uri: string;
    placeId?: string;
    reviewSnippets: string[];
  }>;
}

const PERSONAS = [
  {
    id: 'general',
    label: 'Music & Listening Concierge',
    instruction:
      'You are the Soundmark Studio Concierge. Help users explore global music history, East African & Rwandan artists, acoustic setups, and concert culture concisely.',
  },
  {
    id: 'engineer',
    label: '5-Band EQ & Mastering Engineer',
    instruction:
      'You are an experienced mastering & hi-fi acoustics engineer. Recommend specific 60Hz, 230Hz, 910Hz, 3.6kHz, and 14kHz dB EQ curves and crossfade settings tailored to headphones or studio monitors.',
  },
  {
    id: 'sports',
    label: 'Live Match Tactician',
    instruction:
      'You are a crisp football & global sports analyst. Summarize match momentum, tactical formations, upcoming fixtures, and key players cleanly.',
  },
];

const QUICK_PROMPTS: Record<'chat' | 'search' | 'maps', string[]> = {
  chat: [
    'Give me a 5-band parametric EQ curve (60Hz–14kHz) for late-night acoustic jazz on open-back headphones.',
    'Explain the musical heritage connecting Kigali acoustic folk and modern Afrobeats percussion.',
  ],
  search: [
    'What major global music festivals or album releases are happening this month?',
    'Who are the top-scoring teams in the UEFA Champions League this season?',
  ],
  maps: [
    'Live jazz clubs, vinyl listening bars, and acoustic concert halls near my location',
    'Major sports stadiums and live music arenas in Kigali or nearby',
  ],
};

export function AiAssistantView({
  initialMode = 'chat',
  initialPrompt = '',
}: AiAssistantViewProps) {
  const [mode, setMode] = useState<'chat' | 'search' | 'maps'>(initialMode);
  const [model, setModel] = useState<
    'gemini-4-hydrogen' | 'gemini-4-argon' | 'gemini-4-carbon' | 'gemini-3.1-flash-lite'
  >('gemini-4-hydrogen');
  const [personaId, setPersonaId] = useState('general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoLabel, setGeoLabel] = useState<string>('Location not shared');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (initialPrompt) setInput(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoLabel('Browser geolocation unavailable');
      return;
    }
    setGeoLabel('Locating…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setGeoLabel(`${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`);
      },
      () => {
        setUserCoords({ latitude: -1.9441, longitude: 30.0619 });
        setGeoLabel('Using Kigali reference (-1.944, 30.062)');
      },
      { timeout: 6000 },
    );
  };

  const sendMessage = async (textOverride?: string) => {
    const promptText = (textOverride ?? input).trim();
    if (!promptText || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: promptText,
      mode,
    };

    const nextHistory = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    if (!textOverride) setInput('');
    setLoading(true);
    setError(null);

    try {
      const persona = PERSONAS.find((p) => p.id === personaId) || PERSONAS[0];
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          history: nextHistory,
          mode,
          model,
          systemInstruction: persona.instruction,
          latLng: mode === 'maps' ? userCoords ?? undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assistant request failed');

      const botMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        text: data.text || 'No response returned.',
        mode: data.mode || mode,
        model: data.model,
        searchSources: Array.isArray(data.searchSources) ? data.searchSources : [],
        mapPlaces: Array.isArray(data.mapPlaces) ? data.mapPlaces : [],
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach assistant');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--sm-border)] pb-5">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-[var(--sm-accent-text)]">
            Grounded Intelligence
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--sm-text)] mt-1">
            Soundmark Assistant
          </h1>
          <p className="text-sm text-[var(--sm-text-sec)] mt-1">
            Multi-turn studio chat, real-time Google Search research, and location-aware Google Maps venue discovery.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setMessages([]);
            setError(null);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap shrink-0"
        >
          <RotateCcw size={13} />
          <span>New Thread</span>
        </button>
      </div>

      {/* Controls Bar */}
      <div className="rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('chat')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              mode === 'chat'
                ? 'bg-[var(--sm-accent)] text-[var(--sm-on-accent)] border-[var(--sm-accent)]'
                : 'bg-[var(--sm-bg)] text-[var(--sm-text-sec)] border-[var(--sm-border)]'
            }`}
          >
            <MessageSquare size={13} />
            <span>Studio Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('search')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              mode === 'search'
                ? 'bg-[var(--sm-accent)] text-[var(--sm-on-accent)] border-[var(--sm-accent)]'
                : 'bg-[var(--sm-bg)] text-[var(--sm-text-sec)] border-[var(--sm-border)]'
            }`}
          >
            <Globe size={13} />
            <span>Google Search Grounding</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('maps');
              if (!userCoords) requestLocation();
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              mode === 'maps'
                ? 'bg-[var(--sm-accent)] text-[var(--sm-on-accent)] border-[var(--sm-accent)]'
                : 'bg-[var(--sm-bg)] text-[var(--sm-text-sec)] border-[var(--sm-border)]'
            }`}
          >
            <MapPin size={13} />
            <span>Google Maps Places</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'maps' && (
            <button
              type="button"
              onClick={requestLocation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)] text-[11px] font-mono text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]"
            >
              <Compass size={12} />
              <span>{geoLabel}</span>
            </button>
          )}

          <select
            aria-label="Assistant Persona"
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
            className="rounded-lg bg-[var(--sm-bg)] border border-[var(--sm-border)] px-2.5 py-1.5 text-xs text-[var(--sm-text)]"
          >
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          {mode === 'chat' && (
            <select
              aria-label="Chat Model"
              value={model}
              onChange={(e) =>
                setModel(
                  e.target.value as
                    | 'gemini-4-hydrogen'
                    | 'gemini-4-argon'
                    | 'gemini-4-carbon'
                    | 'gemini-3.1-flash-lite',
                )
              }
              className="rounded-lg bg-[var(--sm-bg)] border border-[var(--sm-border)] px-2.5 py-1.5 text-xs text-[var(--sm-text)]"
            >
              <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Fast)</option>
              <option value="gemini-4-argon">Gemini 4 Argon (Pro)</option>
              <option value="gemini-4-carbon">Gemini 4 Carbon (Flagship)</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite</option>
            </select>
          )}
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] flex flex-col min-h-[440px] max-h-[62vh]">
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-[var(--sm-accent-soft)] text-[var(--sm-accent-text)] flex items-center justify-center">
                <Sparkles size={22} />
              </div>
              <div className="space-y-1 max-w-md">
                <h2 className="font-display text-lg font-semibold text-[var(--sm-text)]">
                  Ask anything about music, acoustics, live matches, or nearby venues
                </h2>
                <p className="text-xs text-[var(--sm-text-sec)]">
                  Switch between conversational reasoning, live Google Search citations, or verified Google Maps places.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
                {QUICK_PROMPTS[mode].map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void sendMessage(q)}
                    className="text-left text-xs px-3.5 py-2 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-bg)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] hover:border-[var(--sm-accent)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[var(--sm-accent)] text-[var(--sm-on-accent)] font-medium'
                      : 'bg-[var(--sm-bg)] border border-[var(--sm-border)] text-[var(--sm-text)]'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Google Search Grounding Sources */}
                {msg.searchSources && msg.searchSources.length > 0 && (
                  <div className="mt-2.5 max-w-3xl w-full space-y-1.5">
                    <div className="text-[11px] font-mono uppercase tracking-wide text-[var(--sm-text-muted)]">
                      Google Search Sources
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {msg.searchSources.map((src, i) => (
                        <a
                          key={i}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-bg)] text-xs text-[var(--sm-accent-text)] hover:border-[var(--sm-accent)]"
                        >
                          <Globe size={12} />
                          <span className="truncate max-w-[220px]">{src.title}</span>
                          <ExternalLink size={11} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Google Maps Grounding Places & Review Snippets */}
                {msg.mapPlaces && msg.mapPlaces.length > 0 && (
                  <div className="mt-2.5 max-w-3xl w-full space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wide text-[var(--sm-text-muted)]">
                      Verified Google Maps Places
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {msg.mapPlaces.map((place, idx) => (
                        <a
                          key={idx}
                          href={place.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-[var(--sm-border)] bg-[var(--sm-bg)] p-3 hover:border-[var(--sm-accent)] transition-colors space-y-1.5 block"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--sm-text)]">
                            <span className="inline-flex items-center gap-1.5 truncate">
                              <MapPin size={13} className="text-[var(--sm-accent-text)] shrink-0" />
                              <span className="truncate">{place.title}</span>
                            </span>
                            <ExternalLink size={12} className="shrink-0 text-[var(--sm-text-muted)]" />
                          </div>
                          {place.reviewSnippets.slice(0, 2).map((snip, sIdx) => (
                            <p
                              key={sIdx}
                              className="text-[11px] text-[var(--sm-text-sec)] line-clamp-2 italic"
                            >
                              “{snip}”
                            </p>
                          ))}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-[var(--sm-text-muted)]">
              <Loader2 size={14} className="animate-spin" />
              <span>
                {mode === 'search'
                  ? 'Searching the web…'
                  : mode === 'maps'
                    ? 'Querying Google Maps places…'
                    : 'Composing response…'}
              </span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <div className="mx-5 mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="p-3.5 border-t border-[var(--sm-border)] flex items-center gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'search'
                ? 'Ask a live question grounded in Google Search…'
                : mode === 'maps'
                  ? 'Find concert venues, vinyl bars, or stadiums…'
                  : 'Message Soundmark Assistant…'
            }
            className="flex-1 min-w-0 rounded-xl bg-[var(--sm-bg)] border border-[var(--sm-border)] px-4 py-2.5 text-sm text-[var(--sm-text)] placeholder:text-[var(--sm-text-muted)] focus:outline-none focus:border-[var(--sm-accent)]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-90 disabled:opacity-50"
          >
            <Send size={14} />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
