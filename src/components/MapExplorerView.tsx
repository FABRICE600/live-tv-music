import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Bookmark,
  Compass,
  Loader2,
  MapPin,
  Music,
  Search,
  Sparkles,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface MapExplorerViewProps {
  onAskMapsAssistant: (prompt: string) => void;
}

interface VenuePin {
  id: string;
  placeId: string;
  name: string;
  address: string;
  category: 'Music Venue' | 'Stadium' | 'Studio';
  lat: number;
  lng: number;
  notes?: string;
}

interface SavedVenueRow {
  id: number;
  placeId: string;
  name: string;
  address: string;
  category: string;
  lat: string;
  lng: string;
}

interface PlacePredictionLike {
  placeId: string;
  text: { text: string };
  mainText?: { text: string } | null;
  secondaryText?: { text: string } | null;
  toPlace: () => {
    id?: string;
    displayName?: string | null;
    formattedAddress?: string | null;
    location?: { lat: () => number; lng: () => number } | null;
    types?: string[];
    fetchFields: (opts: { fields: string[] }) => Promise<unknown>;
  };
}

interface AutocompleteItem {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  prediction: PlacePredictionLike;
}

const FEATURED_VENUES: VenuePin[] = [
  {
    id: 'bk-arena',
    placeId: 'ChIJ_bk_arena_kigali',
    name: 'BK Arena',
    address: 'KG 17 Ave, Remera, Kigali, Rwanda',
    category: 'Music Venue',
    lat: -1.9531,
    lng: 30.1149,
    notes: 'Premier 10,000-seat East African concert & basketball arena.',
  },
  {
    id: 'amahoro-stadium',
    placeId: 'ChIJ_amahoro_kigali',
    name: 'Amahoro National Stadium',
    address: 'Remera, Kigali, Rwanda',
    category: 'Stadium',
    lat: -1.9553,
    lng: 30.114,
    notes: '45,000-capacity national football stadium and live festival grounds.',
  },
  {
    id: 'kcc',
    placeId: 'ChIJ_kcc_kigali',
    name: 'Kigali Convention Centre',
    address: 'KG 2 Roundabout, Kimihurura, Kigali',
    category: 'Music Venue',
    lat: -1.9546,
    lng: 30.0939,
    notes: 'Iconic dome auditorium hosting symphonic galas & jazz nights.',
  },
  {
    id: 'wembley',
    placeId: 'ChIJ_wembley_london',
    name: 'Wembley Stadium',
    address: 'London HA9 0WS, United Kingdom',
    category: 'Stadium',
    lat: 51.556,
    lng: -0.2795,
    notes: 'Global football final venue and historic stadium concert stage.',
  },
  {
    id: 'abbey-road',
    placeId: 'ChIJ_abbey_road_london',
    name: 'Abbey Road Studios',
    address: '3 Abbey Rd, London NW8 9AY, UK',
    category: 'Studio',
    lat: 51.5319,
    lng: -0.1774,
    notes: 'Legendary analog mastering & orchestral recording sanctuary.',
  },
  {
    id: 'msg',
    placeId: 'ChIJ_msg_nyc',
    name: 'Madison Square Garden',
    address: '4 Pennsylvania Plaza, New York, NY',
    category: 'Music Venue',
    lat: 40.7505,
    lng: -73.9934,
    notes: 'World-famous live touring arena and championship court.',
  },
];

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('Quota')
  );
}

function PlacesAutocompleteBar({
  onSelectVenue,
}: {
  onSelectVenue: (venue: VenuePin) => void;
}) {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [searching, setSearching] = useState(false);
  const tokenRef = useRef<unknown>(null);

  useEffect(() => {
    if (!placesLib) return;
    if (!tokenRef.current) {
      tokenRef.current = new placesLib.AutocompleteSessionToken();
    }
  }, [placesLib]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!placesLib || trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        if (!tokenRef.current) {
          tokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const placesApi = placesLib as unknown as {
          AutocompleteSessionToken: new () => unknown;
          AutocompleteSuggestion: {
            fetchAutocompleteSuggestions: (req: {
              input: string;
              sessionToken?: unknown;
            }) => Promise<{ suggestions: Array<{ placePrediction?: PlacePredictionLike | null }> }>;
          };
        };
        const { suggestions: raw } =
          await placesApi.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: trimmed,
            sessionToken: tokenRef.current,
          });
        const items: AutocompleteItem[] = raw
          .filter((s): s is { placePrediction: PlacePredictionLike } => Boolean(s.placePrediction))
          .slice(0, 6)
          .map((s) => {
            const pred = s.placePrediction;
            return {
              placeId: pred.placeId,
              primaryText: pred.mainText?.text || pred.text.text,
              secondaryText: pred.secondaryText?.text || '',
              prediction: pred,
            };
          });
        setSuggestions(items);
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [placesLib, query]);

  const handleChooseSuggestion = async (item: AutocompleteItem) => {
    try {
      const place = item.prediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'types', 'id'],
      });
      const loc = place.location;
      if (loc) {
        const types = place.types || [];
        const category: VenuePin['category'] = types.includes('stadium')
          ? 'Stadium'
          : 'Music Venue';
        onSelectVenue({
          id: place.id || item.placeId,
          placeId: place.id || item.placeId,
          name: place.displayName || item.primaryText,
          address: place.formattedAddress || item.secondaryText,
          category,
          lat: loc.lat(),
          lng: loc.lng(),
        });
      }
      if (placesLib) {
        tokenRef.current = new placesLib.AutocompleteSessionToken();
      }
      setSuggestions([]);
      setQuery(item.primaryText);
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    }
  };

  return (
    <div className="relative flex-1 min-w-[240px]">
      <div className="flex items-center gap-2 px-3.5 h-10 rounded-xl bg-[var(--sm-bg)] border border-[var(--sm-border)] focus-within:border-[var(--sm-accent)]">
        <Search size={14} className="text-[var(--sm-text-muted)] shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search concert halls, jazz clubs, or stadiums…"
          className="flex-1 min-w-0 bg-transparent text-xs text-[var(--sm-text)] placeholder:text-[var(--sm-text-muted)] focus:outline-none"
        />
        {searching && <Loader2 size={13} className="animate-spin text-[var(--sm-text-muted)]" />}
      </div>

      {suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-30 rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] shadow-xl overflow-hidden">
          {suggestions.map((item) => (
            <button
              key={item.placeId}
              type="button"
              onClick={() => void handleChooseSuggestion(item)}
              className="w-full text-left px-3.5 py-2.5 hover:bg-[var(--sm-muted)]/70 border-b last:border-b-0 border-[var(--sm-border)] flex items-start gap-2.5"
            >
              <MapPin size={14} className="text-[var(--sm-accent-text)] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--sm-text)] truncate">
                  {item.primaryText}
                </div>
                {item.secondaryText && (
                  <div className="text-[11px] text-[var(--sm-text-muted)] truncate">
                    {item.secondaryText}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MapExplorerView({ onAskMapsAssistant }: MapExplorerViewProps) {
  const { user, getIdToken, signInWithGoogle } = useAuth();
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  );
  const [keyLoading, setKeyLoading] = useState(!import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const [venues, setVenues] = useState<VenuePin[]>(FEATURED_VENUES);
  const [selectedVenue, setSelectedVenue] = useState<VenuePin>(FEATURED_VENUES[0]);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: FEATURED_VENUES[0].lat,
    lng: FEATURED_VENUES[0].lng,
  });
  const [mapZoom, setMapZoom] = useState(13);
  const [infoOpen, setInfoOpen] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Music Venue' | 'Stadium' | 'Studio'>('All');
  const [savedVenues, setSavedVenues] = useState<SavedVenueRow[]>([]);
  const [savingVenue, setSavingVenue] = useState(false);

  useEffect(() => {
    if (mapsApiKey) {
      setKeyLoading(false);
      return;
    }
    fetch('/api/config/public')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.mapsApiKey) setMapsApiKey(String(data.mapsApiKey));
      })
      .catch(() => {})
      .finally(() => setKeyLoading(false));
  }, [mapsApiKey]);

  const loadSavedVenues = useCallback(async () => {
    if (!user) {
      setSavedVenues([]);
      return;
    }
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch('/api/sql/venues', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { venues?: SavedVenueRow[] };
        setSavedVenues(data.venues || []);
      }
    } catch {
      // Ignore
    }
  }, [user, getIdToken]);

  useEffect(() => {
    void loadSavedVenues();
  }, [loadSavedVenues]);

  const handleFocusVenue = (venue: VenuePin) => {
    setSelectedVenue(venue);
    setMapCenter({ lat: venue.lat, lng: venue.lng });
    setMapZoom(14);
    setInfoOpen(true);
  };

  const handleSelectAutocompleteVenue = (venue: VenuePin) => {
    setVenues((prev) =>
      prev.some((v) => v.placeId === venue.placeId) ? prev : [venue, ...prev],
    );
    handleFocusVenue(venue);
  };

  const handleSaveSelectedVenue = async () => {
    if (!user) {
      await signInWithGoogle();
      return;
    }
    setSavingVenue(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch('/api/sql/venues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          placeId: selectedVenue.placeId,
          name: selectedVenue.name,
          address: selectedVenue.address,
          category: selectedVenue.category,
          lat: String(selectedVenue.lat),
          lng: String(selectedVenue.lng),
        }),
      });
      if (res.ok) {
        await loadSavedVenues();
      }
    } finally {
      setSavingVenue(false);
    }
  };

  const handleDeleteSavedVenue = async (id: number) => {
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch(`/api/sql/venues/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setSavedVenues((prev) => prev.filter((v) => v.id !== id));
    }
  };

  const visibleVenues =
    categoryFilter === 'All'
      ? venues
      : venues.filter((v) => v.category === categoryFilter);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--sm-border)] pb-5">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-[var(--sm-accent-text)]">
            Interactive Venue &amp; Stadium Atlas
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--sm-text)] mt-1">
            Venue &amp; Stadium Map
          </h1>
          <p className="text-sm text-[var(--sm-text-sec)] mt-1">
            Explore global concert arenas, iconic studios, and matchday stadiums or search live places with autocomplete.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onAskMapsAssistant(
              `Tell me about live music concerts, acoustics, and upcoming events near ${selectedVenue.name}, ${selectedVenue.address}`,
            )
          }
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--sm-accent)] text-[var(--sm-on-accent)] text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-90"
        >
          <Sparkles size={14} />
          <span>Ask Maps Assistant</span>
        </button>
      </div>

      {keyLoading ? (
        <div className="h-[520px] rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] flex items-center justify-center text-xs text-[var(--sm-text-muted)]">
          <Loader2 size={18} className="animate-spin mr-2" />
          <span>Loading Google Maps configuration…</span>
        </div>
      ) : !mapsApiKey ? (
        <div className="rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-8 text-center space-y-2">
          <MapPin size={26} className="mx-auto text-[var(--sm-accent-text)]" />
          <h2 className="font-display text-lg font-semibold text-[var(--sm-text)]">
            Google Maps Key Pending
          </h2>
          <p className="text-xs text-[var(--sm-text-sec)] max-w-md mx-auto">
            Restart the server environment so your provisioned Maps API key is injected cleanly.
          </p>
        </div>
      ) : (
        <APIProvider apiKey={mapsApiKey} libraries={['places', 'marker']}>
          {/* Search + Category Controls */}
          <div className="rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-4 flex flex-wrap items-center gap-3">
            <PlacesAutocompleteBar onSelectVenue={handleSelectAutocompleteVenue} />

            <div className="flex flex-wrap items-center gap-1.5">
              {(['All', 'Music Venue', 'Stadium', 'Studio'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap ${
                    categoryFilter === cat
                      ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)] text-[var(--sm-text)]'
                      : 'border-[var(--sm-border)] text-[var(--sm-text-sec)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Map + Venue Directory Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 rounded-2xl border border-[var(--sm-border)] overflow-hidden bg-[var(--sm-surface)]">
              <div className="h-[480px] lg:h-[560px] w-full">
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  center={mapCenter}
                  zoom={mapZoom}
                  onCenterChanged={(ev) => {
                    if (ev.detail.center) setMapCenter(ev.detail.center);
                  }}
                  onZoomChanged={(ev) => {
                    if (typeof ev.detail.zoom === 'number') setMapZoom(ev.detail.zoom);
                  }}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                >
                  {visibleVenues.map((venue) => {
                    const isSelected = selectedVenue.placeId === venue.placeId;
                    return (
                      <AdvancedMarker
                        key={venue.placeId}
                        position={{ lat: venue.lat, lng: venue.lng }}
                        title={venue.name}
                        onClick={() => handleFocusVenue(venue)}
                      >
                        <Pin
                          background={isSelected ? '#E0A432' : '#1B1E28'}
                          borderColor="#F2F0EC"
                          glyphColor={isSelected ? '#0B0C10' : '#E0A432'}
                        />
                      </AdvancedMarker>
                    );
                  })}

                  {infoOpen && selectedVenue && (
                    <InfoWindow
                      position={{ lat: selectedVenue.lat, lng: selectedVenue.lng }}
                      onCloseClick={() => setInfoOpen(false)}
                    >
                      <div className="text-[#141413] max-w-xs space-y-1.5 p-1">
                        <div className="text-xs font-bold">{selectedVenue.name}</div>
                        <div className="text-[11px] text-[#52514B]">{selectedVenue.address}</div>
                        {selectedVenue.notes && (
                          <p className="text-[11px] text-[#52514B]">{selectedVenue.notes}</p>
                        )}
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </div>
            </div>

            {/* Right Column: Selected Detail + Directory + Saved Venues */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-mono uppercase text-[var(--sm-accent-text)]">
                      {selectedVenue.category}
                    </div>
                    <h2 className="font-display text-lg font-semibold text-[var(--sm-text)]">
                      {selectedVenue.name}
                    </h2>
                    <p className="text-xs text-[var(--sm-text-sec)] mt-0.5">
                      {selectedVenue.address}
                    </p>
                  </div>
                </div>
                {selectedVenue.notes && (
                  <p className="text-xs text-[var(--sm-text-muted)]">{selectedVenue.notes}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={savingVenue}
                    onClick={() => void handleSaveSelectedVenue()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--sm-contrast-bg)] text-[var(--sm-contrast-text)] text-xs font-semibold whitespace-nowrap"
                  >
                    <Bookmark size={13} />
                    <span>{user ? 'Save Venue' : 'Sign in to Save'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMapCenter({ lat: selectedVenue.lat, lng: selectedVenue.lng });
                      setMapZoom(15);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--sm-border)] text-xs font-medium text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] whitespace-nowrap"
                  >
                    <Compass size={13} />
                    <span>Re-center</span>
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-4 space-y-2.5 max-h-[260px] overflow-y-auto">
                <div className="text-xs font-semibold text-[var(--sm-text)]">
                  Featured Stages &amp; Stadiums
                </div>
                {visibleVenues.map((v) => {
                  const active = v.placeId === selectedVenue.placeId;
                  return (
                    <button
                      key={v.placeId}
                      type="button"
                      onClick={() => handleFocusVenue(v)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-colors flex items-start gap-2.5 ${
                        active
                          ? 'border-[var(--sm-accent)] bg-[var(--sm-accent-soft)]'
                          : 'border-[var(--sm-border)] bg-[var(--sm-bg)] hover:border-[var(--sm-text-muted)]'
                      }`}
                    >
                      {v.category === 'Stadium' ? (
                        <Trophy size={14} className="text-[var(--sm-accent-text)] mt-0.5 shrink-0" />
                      ) : (
                        <Music size={14} className="text-[var(--sm-accent-text)] mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[var(--sm-text)] truncate">
                          {v.name}
                        </div>
                        <div className="text-[11px] text-[var(--sm-text-muted)] truncate">
                          {v.address}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {user && (
                <div className="rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-4 space-y-2.5">
                  <div className="text-xs font-semibold text-[var(--sm-text)]">
                    Saved Venues ({savedVenues.length})
                  </div>
                  {savedVenues.length === 0 ? (
                    <p className="text-xs text-[var(--sm-text-muted)]">
                      Click Save Venue on any concert hall or stadium to bookmark it.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {savedVenues.map((sv) => (
                        <div
                          key={sv.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--sm-bg)] border border-[var(--sm-border)]"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleFocusVenue({
                                id: sv.placeId,
                                placeId: sv.placeId,
                                name: sv.name,
                                address: sv.address,
                                category:
                                  sv.category === 'Stadium'
                                    ? 'Stadium'
                                    : sv.category === 'Studio'
                                      ? 'Studio'
                                      : 'Music Venue',
                                lat: Number(sv.lat) || -1.9531,
                                lng: Number(sv.lng) || 30.1149,
                              })
                            }
                            className="text-left min-w-0 flex-1"
                          >
                            <div className="text-xs font-medium text-[var(--sm-text)] truncate">
                              {sv.name}
                            </div>
                            <div className="text-[10px] text-[var(--sm-text-muted)] truncate">
                              {sv.address}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteSavedVenue(sv.id)}
                            aria-label="Remove venue"
                            className="p-1 text-[var(--sm-text-muted)] hover:text-red-400 shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </APIProvider>
      )}
    </div>
  );
}
