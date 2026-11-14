import { useState } from 'react';
import {
  Play,
  Pause,
  Heart,
  ListPlus,
  ShoppingBag,
  Plus,
  FileText,
  ExternalLink,
  Check,
  Radio,
} from 'lucide-react';
import type { MusicTrack, UserPlaylist } from '../types/music';
import { formatDuration } from '../utils/formatters';
import { CoverArtwork } from './CoverArtwork';

interface TrackTableProps {
  tracks: MusicTrack[];
  currentTrackId: string | null;
  isPlaying: boolean;
  likedTrackIds: Set<string>;
  userPlaylists: UserPlaylist[];
  onPlayTrack: (track: MusicTrack, contextTracks?: MusicTrack[]) => void;
  onTogglePlayPause: () => void;
  onToggleLike: (track: MusicTrack) => void;
  onAddToPlaylist: (playlistId: string, track: MusicTrack) => void;
  onAddToQueue: (track: MusicTrack) => void;
  onOpenStoreModal: (track: MusicTrack) => void;
  onOpenLyrics: (track: MusicTrack) => void;
  onOpenSpotifyEmbed: (track: MusicTrack) => void;
  onSelectArtist: (artistId: string, artistName?: string) => void;
  onRemoveFromPlaylist?: (trackId: string) => void;
  emptyMessage?: string;
}

export function TrackTable({
  tracks,
  currentTrackId,
  isPlaying,
  likedTrackIds,
  userPlaylists,
  onPlayTrack,
  onTogglePlayPause,
  onToggleLike,
  onAddToPlaylist,
  onAddToQueue,
  onOpenStoreModal,
  onOpenLyrics,
  onOpenSpotifyEmbed,
  onSelectArtist,
  onRemoveFromPlaylist,
  emptyMessage = 'No tracks match your current filter.',
}: TrackTableProps) {
  const [openMenuTrackId, setOpenMenuTrackId] = useState<string | null>(null);
  const [queuedFlashId, setQueuedFlashId] = useState<string | null>(null);

  if (tracks.length === 0) {
    return (
      <div className="py-12 px-6 text-center border border-[var(--sm-border)] rounded-xl bg-[var(--sm-surface)]">
        <p className="text-sm text-[var(--sm-text-sec)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="border border-[var(--sm-border)] rounded-2xl bg-[var(--sm-surface)] divide-y divide-[var(--sm-border)] overflow-hidden">
      {tracks.map((track, idx) => {
        const isActive = currentTrackId === track.id;
        const isLiked = likedTrackIds.has(track.id);
        const menuOpen = openMenuTrackId === track.id;

        return (
          <div
            key={track.id}
            className={`group flex items-center gap-3 sm:gap-4 px-3.5 sm:px-5 py-3 transition-colors ${
              isActive
                ? 'bg-[var(--sm-muted)]/85'
                : 'hover:bg-[var(--sm-muted)]/45'
            }`}
          >
            {/* Index / Play button */}
            <button
              type="button"
              onClick={() => (isActive ? onTogglePlayPause() : onPlayTrack(track, tracks))}
              aria-label={isActive && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
              className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-[var(--sm-accent)] ${
                isActive
                  ? 'bg-[var(--sm-accent)] text-[var(--sm-on-accent)]'
                  : 'text-[var(--sm-text-muted)] hover:bg-[var(--sm-muted)] hover:text-[var(--sm-text)]'
              }`}
            >
              {isActive && isPlaying ? (
                <Pause size={14} fill="currentColor" />
              ) : isActive ? (
                <Play size={14} fill="currentColor" className="ml-0.5" />
              ) : (
                <>
                  <span className="font-mono tabular-nums text-xs group-hover:hidden">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <Play size={14} fill="currentColor" className="hidden group-hover:block ml-0.5" />
                </>
              )}
            </button>

            {/* Cover + Title + Artist + Unboxed Metadata */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 shrink-0 overflow-hidden rounded-md border border-[var(--sm-border)]">
                <CoverArtwork src={track.coverUrl} alt={`${track.title} cover`} roundedClassName="rounded-none" sizeIcon={16} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => (isActive ? onTogglePlayPause() : onPlayTrack(track, tracks))}
                    className={`text-sm font-medium truncate text-left hover:underline ${
                      isActive
                        ? 'text-[var(--sm-accent-text)]'
                        : 'text-[var(--sm-text)]'
                    }`}
                  >
                    {track.title}
                  </button>
                  {track.isLive && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-[#15803D] dark:text-emerald-400 shrink-0">
                      <Radio size={11} />
                      LIVE
                    </span>
                  )}
                </div>

                {/* Unboxed metadata line per Zero-Pill Discipline */}
                <div className="flex items-center gap-1.5 text-xs text-[var(--sm-text-sec)] truncate">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectArtist(
                        track.artistId || `artist-${encodeURIComponent(track.artist)}`,
                        track.artist,
                      )
                    }
                    className="hover:text-[var(--sm-text)] hover:underline truncate max-w-[180px]"
                  >
                    {track.artist}
                  </button>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{track.genre}</span>
                  <span aria-hidden="true" className="hidden md:inline">·</span>
                  <span className="hidden md:inline truncate">{track.sourceLabel}</span>
                  {track.country && track.country !== 'Global' && (
                    <>
                      <span aria-hidden="true" className="hidden lg:inline">·</span>
                      <span className="hidden lg:inline truncate">{track.country}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Duration */}
            <div className="hidden sm:block text-xs font-mono tabular-nums text-[var(--sm-text-muted)] w-12 text-right shrink-0">
              {formatDuration(track.durationSec, track.isLive)}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 relative">
              <button
                type="button"
                onClick={() => onToggleLike(track)}
                title={isLiked ? 'Remove from Liked' : 'Save to Liked'}
                aria-label={isLiked ? 'Remove from Liked' : 'Save to Liked'}
                className={`p-2 rounded-md transition-colors ${
                  isLiked
                    ? 'text-[var(--sm-accent-text)]'
                    : 'text-[var(--sm-text-muted)] hover:text-[var(--sm-text)] hover:bg-[var(--sm-muted)]'
                }`}
              >
                <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
              </button>

              <button
                type="button"
                onClick={() => {
                  onAddToQueue(track);
                  setQueuedFlashId(track.id);
                  setTimeout(() => setQueuedFlashId(null), 1200);
                }}
                title="Add to queue"
                aria-label="Add to queue"
                className="p-2 rounded-md text-[var(--sm-text-muted)] hover:text-[var(--sm-text)] hover:bg-[var(--sm-muted)] transition-colors"
              >
                {queuedFlashId === track.id ? (
                  <Check size={15} className="text-[#15803D] dark:text-emerald-400" />
                ) : (
                  <ListPlus size={15} />
                )}
              </button>

              <button
                type="button"
                onClick={() => onOpenLyrics(track)}
                title="Lyrics & Liner Notes"
                aria-label="Lyrics and liner notes"
                className="hidden sm:inline-flex p-2 rounded-md text-[var(--sm-text-muted)] hover:text-[var(--sm-text)] hover:bg-[var(--sm-muted)] transition-colors"
              >
                <FileText size={15} />
              </button>

              {track.spotifyEmbedUrl && (
                <button
                  type="button"
                  onClick={() => onOpenSpotifyEmbed(track)}
                  title="Open Spotify Embed"
                  aria-label="Open Spotify Embed"
                  className="hidden md:inline-flex p-2 rounded-md text-[var(--sm-text-muted)] hover:text-[var(--sm-text)] hover:bg-[var(--sm-muted)] transition-colors"
                >
                  <ExternalLink size={15} />
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenStoreModal(track)}
                title="Digital Stores & Lossless Links"
                aria-label="Open digital store links"
                className="p-2 rounded-md text-[var(--sm-text-muted)] hover:text-[var(--sm-text)] hover:bg-[var(--sm-muted)] transition-colors"
              >
                <ShoppingBag size={15} />
              </button>

              {onRemoveFromPlaylist ? (
                <button
                  type="button"
                  onClick={() => onRemoveFromPlaylist(track.id)}
                  className="px-2 py-1 text-xs text-[var(--sm-text-muted)] hover:text-[var(--sm-accent-text)] transition-colors whitespace-nowrap"
                >
                  Remove
                </button>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenuTrackId(menuOpen ? null : track.id)}
                    title="Add to playlist"
                    aria-label="Add to playlist"
                    className="p-2 rounded-md text-[var(--sm-text-muted)] hover:text-[var(--sm-text)] hover:bg-[var(--sm-muted)] transition-colors"
                  >
                    <Plus size={15} />
                  </button>

                  {menuOpen && (
                    <div
                      onMouseLeave={() => setOpenMenuTrackId(null)}
                      className="absolute right-0 top-9 z-30 w-52 rounded-lg border border-[var(--sm-border)] bg-[var(--sm-surface)] shadow-lg py-1.5"
                    >
                      <div className="px-3 py-1 text-[11px] font-medium text-[var(--sm-text-muted)]">
                        Add to playlist
                      </div>
                      {userPlaylists.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-[var(--sm-text-sec)]">
                          Create a playlist in the sidebar first.
                        </div>
                      ) : (
                        userPlaylists.map((pl) => {
                          const alreadyIn = pl.trackIds.includes(track.id);
                          return (
                            <button
                              key={pl.id}
                              type="button"
                              onClick={() => {
                                onAddToPlaylist(pl.id, track);
                                setOpenMenuTrackId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs flex items-center justify-between text-[var(--sm-text)] hover:bg-[var(--sm-muted)] transition-colors"
                            >
                              <span className="truncate">{pl.name}</span>
                              {alreadyIn && (
                                <Check size={13} className="text-[var(--sm-accent-text)] shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
