import { useState, type FormEvent } from 'react';
import {
  Compass,
  Search,
  Users,
  SlidersHorizontal,
  Store,
  Heart,
  Clock,
  ListMusic,
  Plus,
  Sun,
  Moon,
  X,
  Disc3,
  Tv,
  Palette,
  Music2,
} from 'lucide-react';
import type { AccentMode, AppView, SurfaceMode, UserPlaylist } from '../types/music';
import { ACCENT_MODES, SURFACE_MODES } from '../utils/formatters';

interface SidebarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  userPlaylists: UserPlaylist[];
  likedCount: number;
  historyCount: number;
  onCreatePlaylist: (name: string) => void;
  surfaceMode: SurfaceMode;
  accentMode: AccentMode;
  onChangeSurface: (mode: SurfaceMode) => void;
  onChangeAccent: (mode: AccentMode) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeView,
  onNavigate,
  userPlaylists,
  likedCount,
  historyCount,
  onCreatePlaylist,
  surfaceMode,
  accentMode,
  onChangeSurface,
  onChangeAccent,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [colorDrawerOpen, setColorDrawerOpen] = useState(false);

  const activeSurface = SURFACE_MODES.find((s) => s.id === surfaceMode) || SURFACE_MODES[0];
  const activeAccent = ACCENT_MODES.find((a) => a.id === accentMode) || ACCENT_MODES[0];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreatePlaylist(trimmed);
    setNewName('');
    setCreating(false);
  };

  const navItemClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap ${
      active
        ? 'bg-[var(--sm-accent)] text-[var(--sm-on-accent)] font-semibold shadow-xs'
        : 'text-[var(--sm-text-sec)] hover:text-[var(--sm-text)] hover:bg-[var(--sm-muted)]/75'
    }`;

  const content = (
    <aside className="w-[248px] h-full flex flex-col bg-[var(--sm-surface)] border-r border-[var(--sm-border)] select-none">
      {/* Brand header */}
      <div className="h-16 shrink-0 px-5 flex items-center justify-between border-b border-[var(--sm-border)]">
        <button
          type="button"
          onClick={() => {
            onNavigate({ type: 'discover' });
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-[var(--sm-accent)]"
        >
          <span className="w-8 h-8 rounded-full bg-[var(--sm-accent)] text-[var(--sm-on-accent)] flex items-center justify-center shrink-0">
            <Disc3 size={17} strokeWidth={2} />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-[var(--sm-text)] whitespace-nowrap">
            Soundmark
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 rounded-md text-[var(--sm-text-sec)] hover:bg-[var(--sm-muted)]"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation sections */}
      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        <div className="space-y-1">
          <div className="px-3 pb-1.5 text-[11px] font-medium text-[var(--sm-text-muted)]">
            Explore
          </div>
          <button
            type="button"
            onClick={() => {
              onNavigate({ type: 'discover' });
              onCloseMobile();
            }}
            className={navItemClass(activeView.type === 'discover' || activeView.type === 'curated')}
          >
            <span className="flex items-center gap-2.5">
              <Compass size={16} />
              <span>Discover</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate({ type: 'browse' });
              onCloseMobile();
            }}
            className={navItemClass(activeView.type === 'browse')}
          >
            <span className="flex items-center gap-2.5">
              <Search size={16} />
              <span>Browse Catalog</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate({ type: 'artists' });
              onCloseMobile();
            }}
            className={navItemClass(
              activeView.type === 'artists' || activeView.type === 'artist_profile',
            )}
          >
            <span className="flex items-center gap-2.5">
              <Users size={16} />
              <span>Global Artists</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate({ type: 'rwanda' });
              onCloseMobile();
            }}
            className={navItemClass(activeView.type === 'rwanda')}
          >
            <span className="flex items-center gap-2.5">
              <Music2 size={16} />
              <span>Rwanda Music</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate({ type: 'tv' });
              onCloseMobile();
            }}
            className={navItemClass(activeView.type === 'tv')}
          >
            <span className="flex items-center gap-2.5">
              <Tv size={16} />
              <span>World Live TV</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate({ type: 'listening_room' });
              onCloseMobile();
            }}
            className={navItemClass(activeView.type === 'listening_room')}
          >
            <span className="flex items-center gap-2.5">
              <SlidersHorizontal size={16} />
              <span>Listening Room & EQ</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate({ type: 'stores' });
              onCloseMobile();
            }}
            className={navItemClass(activeView.type === 'stores')}
          >
            <span className="flex items-center gap-2.5">
              <Store size={16} />
              <span>Digital Stores</span>
            </span>
          </button>
        </div>

        <div className="space-y-1 pt-2 border-t border-[var(--sm-border)]">
          <div className="px-3 pb-1.5 text-[11px] font-medium text-[var(--sm-text-muted)]">
            Library
          </div>

          <button
            type="button"
            onClick={() => {
              onNavigate({ type: 'liked' });
              onCloseMobile();
            }}
            className={navItemClass(activeView.type === 'liked')}
          >
            <span className="flex items-center gap-2.5">
              <Heart size={16} />
              <span>Liked Tracks</span>
            </span>
            <span className="font-mono tabular-nums text-xs opacity-75">{likedCount}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate({ type: 'history' });
              onCloseMobile();
            }}
            className={navItemClass(activeView.type === 'history')}
          >
            <span className="flex items-center gap-2.5">
              <Clock size={16} />
              <span>History & Insights</span>
            </span>
            <span className="font-mono tabular-nums text-xs opacity-75">{historyCount}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigate({ type: 'playlists' });
              onCloseMobile();
            }}
            className={navItemClass(activeView.type === 'playlists')}
          >
            <span className="flex items-center gap-2.5">
              <ListMusic size={16} />
              <span>All Playlists</span>
            </span>
            <span className="font-mono tabular-nums text-xs opacity-75">{userPlaylists.length}</span>
          </button>
        </div>

        <div className="space-y-1.5 pt-2 border-t border-[var(--sm-border)]">
          <div className="px-3 flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--sm-text-muted)]">
              Your Playlists
            </span>
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              aria-label="Create playlist"
              className="p-1 rounded hover:bg-[var(--sm-muted)] text-[var(--sm-text-sec)]"
            >
              <Plus size={14} />
            </button>
          </div>

          {creating && (
            <form onSubmit={handleSubmit} className="px-2 pb-1 space-y-1.5">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist title..."
                autoFocus
                className="w-full px-2.5 py-1.5 text-xs rounded-md bg-[var(--sm-bg)] border border-[var(--sm-border)] text-[var(--sm-text)] focus:outline-none focus:border-[var(--sm-accent)]"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="submit"
                  className="px-2.5 py-1 text-[11px] font-medium rounded bg-[var(--sm-accent)] text-[var(--sm-on-accent)] hover:opacity-90"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="px-2.5 py-1 text-[11px] text-[var(--sm-text-sec)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {userPlaylists.length === 0 && !creating ? (
            <p className="px-3 py-1 text-xs text-[var(--sm-text-muted)]">No playlists yet.</p>
          ) : (
            <div className="space-y-0.5">
              {userPlaylists.map((pl) => {
                const isSelected =
                  activeView.type === 'custom_playlist' && activeView.playlistId === pl.id;
                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => {
                      onNavigate({ type: 'custom_playlist', playlistId: pl.id });
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-xs transition-colors ${
                      isSelected
                        ? 'bg-[var(--sm-muted)] text-[var(--sm-text)] font-semibold'
                        : 'text-[var(--sm-text-sec)] hover:bg-[var(--sm-muted)]/60'
                    }`}
                  >
                    <span className="truncate">{pl.name}</span>
                    <span className="font-mono tabular-nums text-[11px] text-[var(--sm-text-muted)] shrink-0">
                      {pl.trackIds.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Color Mode Switcher */}
      <div className="p-3 border-t border-[var(--sm-border)] space-y-2">
        {colorDrawerOpen && (
          <div className="p-2.5 rounded-lg bg-[var(--sm-bg)] border border-[var(--sm-border)] space-y-2.5">
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-[var(--sm-text-muted)]">
                Surface Mode
              </div>
              <div className="grid grid-cols-2 gap-1">
                {SURFACE_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeSurface(m.id)}
                    className={`px-2 py-1.5 rounded text-[11px] text-left flex items-center gap-1.5 border transition-colors ${
                      surfaceMode === m.id
                        ? 'border-[var(--sm-accent)] text-[var(--sm-text)] font-semibold bg-[var(--sm-surface)]'
                        : 'border-[var(--sm-border)] text-[var(--sm-text-sec)] hover:text-[var(--sm-text)]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15"
                      style={{ backgroundColor: m.bgPreview }}
                    />
                    <span className="truncate">{m.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-medium text-[var(--sm-text-muted)]">
                Accent Color
              </div>
              <div className="flex items-center justify-between gap-1">
                {ACCENT_MODES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onChangeAccent(a.id)}
                    title={a.label}
                    aria-label={`Accent color ${a.label}`}
                    className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-transform ${
                      accentMode === a.id ? 'border-[var(--sm-text)] scale-105' : 'border-transparent'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: a.swatch }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setColorDrawerOpen((v) => !v)}
            className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[var(--sm-text-sec)] bg-[var(--sm-bg)] border border-[var(--sm-border)] hover:text-[var(--sm-text)] transition-colors min-w-0"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Palette size={14} className="shrink-0 text-[var(--sm-accent-text)]" />
              <span className="truncate">{activeSurface.label}</span>
            </span>
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: activeAccent.swatch }}
            />
          </button>
          <button
            type="button"
            onClick={() => onChangeSurface(activeSurface.isDark ? 'paper' : 'midnight')}
            title={activeSurface.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={activeSurface.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-lg text-[var(--sm-text-sec)] bg-[var(--sm-bg)] border border-[var(--sm-border)] hover:text-[var(--sm-text)] transition-colors shrink-0"
          >
            {activeSurface.isDark ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block shrink-0 h-full">{content}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
