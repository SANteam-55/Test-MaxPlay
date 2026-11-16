import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  ChevronRight,
  Clock,
  Disc3,
  Edit3,
  EyeOff,
  Folder,
  FolderPlus,
  Heart,
  Info,
  ListChecks,
  ListMusic,
  ListPlus,
  Mic,
  MoreVertical,
  Music2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Sliders,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { LogoPlaceholder } from '../../components/common/LogoPlaceholder';
import { useMusic } from '../../context/MusicContext';
import {
  MusicAlbum,
  MusicArtist,
  MusicFolder,
  MusicPlaylist,
  MusicSortOption,
  MusicTrack,
} from '../../types/music';
import {
  formatMusicDuration,
  getRainbowGradientForTrack,
  resolvePlaylistFirstSongArtwork,
  searchLocalMusicLibrary,
} from '../../utils/musicUtils';

interface MusicHomeScreenProps {
  onDetailOpenChange?: (isOpen: boolean) => void;
}

type MainSectionTab = 'songs' | 'artists' | 'albums' | 'folders';
type ActiveSubPage =
  | null
  | 'favourites'
  | 'playlists'
  | 'playlist_inner'
  | 'recent'
  | 'album_inner'
  | 'artist_inner'
  | 'folder_inner'
  | 'search';

type FavouritesSubTab = 'songs' | 'artists' | 'albums' | 'discover';

const DEFAULT_MAXPLAY_MUSIC_POSTER =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80';

export const MusicHomeScreen: React.FC<MusicHomeScreenProps> = ({ onDetailOpenChange }) => {
  const {
    visibleTracks,
    sortedTracks,
    albums,
    artists,
    folders,
    playlists,
    favoriteIds,
    discovery,
    isScanningMusic,
    sortBy,
    setSortBy,
    recentSearches,
    currentTrack,
    isPlaying,
    setIsFullScreenPlayerOpen,
    setIsEqualizerOpen,
    setEditingSongTrack,
    scanDeviceMusic,
    importLocalAudioFiles,
    playTrack,
    playTrackList,
    togglePlayPause,
    playNextInQueue,
    addToQueueEnd,
    shareTrackFile,
    toggleFavorite,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTracksToPlaylist,
    removeTrackFromPlaylist,
    hideSongFromLibrary,
    addRecentSearch,
    clearRecentSearches,
    clearRecentHistory,
    updateSongMetadata,
  } = useMusic();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Main homepage tab state (Songs default, no Videos tab)
  const [mainTab, setMainTab] = useState<MainSectionTab>('songs');
  const [activeSubPage, setActiveSubPage] = useState<ActiveSubPage>(null);
  const [favSubTab, setFavSubTab] = useState<FavouritesSubTab>('songs');

  // Selected entities for inner pages
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<MusicAlbum | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<MusicArtist | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<MusicFolder | null>(null);

  // Search & Voice Mic state
  const [searchQuery, setSearchQuery] = useState('');
  const [isListeningVoice, setIsListeningVoice] = useState(false);

  // Batch Multi-Select Checklist Mode
  const [isBatchSelectMode, setIsBatchSelectMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);

  // Modals & Bottom Sheets
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [activeSongMenuTrack, setActiveSongMenuTrack] = useState<MusicTrack | null>(null);
  const [songDetailsTrack, setSongDetailsTrack] = useState<MusicTrack | null>(null);
  const [playlistPickerTracks, setPlaylistPickerTracks] = useState<MusicTrack[] | null>(null);
  const [isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [renamingPlaylist, setRenamingPlaylist] = useState<MusicPlaylist | null>(null);
  const [renameText, setRenameText] = useState('');
  const [showAddSongsToPlaylistId, setShowAddSongsToPlaylistId] = useState<string | null>(null);
  const [showPlaylistInnerMenu, setShowPlaylistInnerMenu] = useState(false);

  // Cover target track ID for quick cover change
  const [coverTargetTrackId, setCoverTargetTrackId] = useState<string | null>(null);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };

  // Notify parent navigator when a sub-page is open so hardware back button works naturally
  useEffect(() => {
    onDetailOpenChange?.(activeSubPage !== null);
  }, [activeSubPage, onDetailOpenChange]);

  // Listen for hardware back button event on the 'music' tab
  useEffect(() => {
    const handlePopMusicStack = () => {
      if (activeSongMenuTrack) {
        setActiveSongMenuTrack(null);
        return;
      }
      if (showSortSheet) {
        setShowSortSheet(false);
        return;
      }
      if (isBatchSelectMode) {
        setIsBatchSelectMode(false);
        setSelectedTrackIds([]);
        return;
      }
      if (activeSubPage === 'playlist_inner') {
        setActiveSubPage('playlists');
        return;
      }
      if (activeSubPage !== null) {
        setActiveSubPage(null);
      }
    };
    window.addEventListener('MAXPLAY_POP_STACK_MUSIC', handlePopMusicStack);
    return () => window.removeEventListener('MAXPLAY_POP_STACK_MUSIC', handlePopMusicStack);
  }, [activeSubPage, activeSongMenuTrack, showSortSheet, isBatchSelectMode]);

  // Order likedSongs by favoriteIds order so likedSongs[0] is always the most recently favourited song
  const likedSongs = useMemo(() => {
    const trackMap = new Map<string, MusicTrack>();
    visibleTracks.forEach((t) => {
      if (t.isFavorite) trackMap.set(t.id, t);
    });
    const ordered: MusicTrack[] = [];
    for (const id of favoriteIds) {
      const found = trackMap.get(id);
      if (found) {
        ordered.push(found);
        trackMap.delete(id);
      }
    }
    trackMap.forEach((t) => ordered.push(t));
    return ordered;
  }, [visibleTracks, favoriteIds]);

  // Selected Playlist object
  const selectedPlaylist = useMemo(() => {
    if (!selectedPlaylistId) return null;
    if (selectedPlaylistId === '__FAVOURITES_PLAYLIST__') {
      return {
        id: '__FAVOURITES_PLAYLIST__',
        name: 'My favourites',
        trackIds: likedSongs.map((t) => t.id),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as MusicPlaylist;
    }
    return playlists.find((p) => p.id === selectedPlaylistId) || null;
  }, [selectedPlaylistId, playlists, likedSongs]);

  const selectedPlaylistTracks = useMemo(() => {
    if (!selectedPlaylist) return [];
    const map = new Map<string, MusicTrack>();
    visibleTracks.forEach((t) => map.set(t.id, t));
    return selectedPlaylist.trackIds
      .map((id) => map.get(id))
      .filter((t): t is MusicTrack => Boolean(t));
  }, [selectedPlaylist, visibleTracks]);

  // Voice Search (Web Speech API)
  const startVoiceSearch = () => {
    if (activeSubPage !== 'search') {
      setActiveSubPage('search');
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      triggerToast('Voice input active — type or use keyboard microphone');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setIsListeningVoice(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setSearchQuery(transcript);
          addRecentSearch(transcript);
        }
        setIsListeningVoice(false);
      };
      recognition.onerror = () => {
        setIsListeningVoice(false);
      };
      recognition.onend = () => {
        setIsListeningVoice(false);
      };
      recognition.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  // Search results
  const searchResults = useMemo(() => {
    return searchLocalMusicLibrary(
      searchQuery,
      visibleTracks,
      albums,
      artists,
      folders,
      playlists
    );
  }, [searchQuery, visibleTracks, albums, artists, folders, playlists]);

  // Matching song suggestions while typing
  const matchingSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visibleTracks.slice(0, 8);
    return searchResults.songs.slice(0, 12);
  }, [searchQuery, visibleTracks, searchResults.songs]);

  // Shuffle helper
  const handleShufflePlayList = (tracksToPlay: MusicTrack[]) => {
    if (!tracksToPlay.length) {
      triggerToast('No songs available to play');
      return;
    }
    playTrackList(tracksToPlay, true);
  };

  // Toggle batch selection for a track
  const toggleTrackBatchSelection = (trackId: string) => {
    setSelectedTrackIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
  };

  // Render animated 4-bar purple equalizer waveform (matches reference screenshots)
  const renderEqualizerBars = () => (
    <div className="flex items-end gap-[2.5px] h-4 w-4 shrink-0 justify-center">
      <span
        className={`w-[2.5px] rounded-full bg-[#A855F7] transition-all ${
          isPlaying ? 'h-3.5 animate-[pulse_0.55s_ease-in-out_infinite]' : 'h-1.5'
        }`}
      />
      <span
        className={`w-[2.5px] rounded-full bg-[#A855F7] transition-all ${
          isPlaying ? 'h-2 animate-[pulse_0.75s_ease-in-out_infinite]' : 'h-2.5'
        }`}
      />
      <span
        className={`w-[2.5px] rounded-full bg-[#A855F7] transition-all ${
          isPlaying ? 'h-4 animate-[pulse_0.65s_ease-in-out_infinite]' : 'h-1.5'
        }`}
      />
      <span
        className={`w-[2.5px] rounded-full bg-[#A855F7] transition-all ${
          isPlaying ? 'h-2.5 animate-[pulse_0.85s_ease-in-out_infinite]' : 'h-3'
        }`}
      />
    </div>
  );

  // Render song square cover art (or rainbow accent gradient fallback)
  const renderSongThumbnail = (track: MusicTrack, _indexHint = 0) => {
    const grad = getRainbowGradientForTrack(track.id);

    return (
      <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-[#181820] shrink-0 border border-white/10 shadow-sm">
        {track.artworkUrl ? (
          <img
            src={track.artworkUrl}
            alt={track.title}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            className={`h-full w-full bg-gradient-to-br ${grad} flex items-center justify-center relative`}
          >
            <span className="absolute top-1 left-1 text-[8px] text-white/80">♪</span>
            <Music2 className="h-6 w-6 text-white/95 drop-shadow" />
          </div>
        )}
      </div>
    );
  };

  // Render standard song row (tapping any song plays it AND opens Music Details Screen first!)
  const renderSongRow = (
    track: MusicTrack,
    idx: number,
    listContext: MusicTrack[],
    options?: {
      numbered?: boolean;
      showThumbnailWithNumber?: boolean;
      playlistIdForRemoval?: string;
    }
  ) => {
    const isCurrent = currentTrack?.id === track.id;
    const isSelected = selectedTrackIds.includes(track.id);
    const numStr = String(idx + 1).padStart(2, '0');

    return (
      <div
        key={`${track.id}-${idx}`}
        onClick={() => {
          if (isBatchSelectMode) {
            toggleTrackBatchSelection(track.id);
            return;
          }
          if (!isCurrent) {
            playTrack(track, listContext);
          } else if (!isPlaying) {
            togglePlayPause();
          }
          setIsFullScreenPlayerOpen(true);
        }}
        className={`group flex items-center justify-between gap-3 py-2.5 px-1 rounded-xl transition cursor-pointer ${
          isCurrent ? 'bg-purple-500/[0.07]' : 'hover:bg-white/[0.04]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isBatchSelectMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleTrackBatchSelection(track.id);
              }}
              className={`h-5 w-5 rounded-md flex items-center justify-center border transition shrink-0 ${
                isSelected
                  ? 'bg-[#9333EA] border-[#A855F7] text-white'
                  : 'border-white/25 bg-white/5 text-transparent'
              }`}
            >
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            </button>
          )}

          {/* Left Number or Thumbnail */}
          {options?.numbered ? (
            <div className="w-6 flex items-center justify-center shrink-0">
              {isCurrent ? (
                renderEqualizerBars()
              ) : (
                <span className="text-xs font-semibold text-[#71717A] tabular-nums">
                  {numStr}
                </span>
              )}
            </div>
          ) : null}

          {(!options?.numbered || options?.showThumbnailWithNumber) &&
            renderSongThumbnail(track, idx)}

          {/* Song Title & Artist | Album */}
          <div className="flex flex-col min-w-0 flex-1">
            <span
              className={`text-[15px] leading-snug truncate ${
                isCurrent ? 'font-bold text-[#A855F7]' : 'font-medium text-white'
              }`}
            >
              {track.title}
            </span>
            <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center justify-center h-3.5 px-1 rounded-[3px] border border-[#52525B] text-[8px] font-bold text-[#A1A1AA] leading-none shrink-0">
                -
              </span>
              <span className="text-xs text-[#A1A1AA] truncate">
                {track.artist} | {track.album}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Equalizer bars (on unnumbered homepage list) + 3-dot Menu */}
        <div className="flex items-center gap-2 shrink-0">
          {!options?.numbered && isCurrent && renderEqualizerBars()}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveSongMenuTrack(track);
            }}
            className="p-1.5 rounded-full text-[#A1A1AA] hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Song options"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // SUB-PAGE 1: DEDICATED MUSIC SEARCH SCREEN (with Voice Mic & Recently Searched)
  // ============================================================================
  const renderSearchPage = () => (
    <div className="flex flex-col h-full w-full bg-[#0A0A0A] px-4 pt-3 pb-28 overflow-y-auto scrollbar-none">
      {/* Top Search Header */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            setActiveSubPage(null);
          }}
          className="p-2 -ml-1 rounded-full text-white hover:bg-white/10 transition cursor-pointer shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex-1 flex items-center gap-2 rounded-full bg-[#16161D] border border-white/15 px-3.5 py-2 focus-within:border-[#A855F7]">
          <Search className="h-4 w-4 text-[#A1A1AA] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            autoFocus
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                addRecentSearch(searchQuery.trim());
              }
            }}
            placeholder="Search songs, playlists, and artists"
            className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-[#71717A] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-0.5 text-[#A1A1AA] hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="h-4 w-[1px] bg-white/15 shrink-0" />
          <button
            type="button"
            onClick={startVoiceSearch}
            className={`p-1 rounded-full transition cursor-pointer ${
              isListeningVoice
                ? 'bg-[#9333EA] text-white animate-pulse'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
            title="Voice search"
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Voice Listening Indicator */}
      {isListeningVoice && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-purple-500/15 border border-purple-500/40 py-2.5 px-4 text-xs font-semibold text-purple-300">
          <Mic className="h-4 w-4 animate-bounce text-[#A855F7]" />
          <span>Listening... Speak a song, artist, or album name</span>
        </div>
      )}

      {/* Recently Searched Chips */}
      {recentSearches.length > 0 && !searchQuery.trim() && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
              Recently Searched
            </span>
            <button
              type="button"
              onClick={clearRecentSearches}
              className="text-xs font-semibold text-[#A1A1AA] hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setSearchQuery(term)}
                className="flex items-center gap-1.5 rounded-full bg-[#16161E] hover:bg-[#1F1F2B] border border-white/10 px-3 py-1.5 text-xs text-zinc-200 transition cursor-pointer"
              >
                <Clock className="h-3 w-3 text-[#A855F7]" />
                <span>{term}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Song Recommendations / Search Matches */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA]">
            {searchQuery.trim()
              ? `Matching Songs (${searchResults.songs.length})`
              : 'Recommended Songs From Your Library'}
          </span>
        </div>

        {matchingSuggestions.length > 0 ? (
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {matchingSuggestions.map((track, idx) =>
              renderSongRow(track, idx, matchingSuggestions)
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-[#71717A]">
            No matching songs found for "{searchQuery}"
          </div>
        )}
      </div>

      {/* Matching Artists & Albums when searching */}
      {searchQuery.trim() && searchResults.artists.length > 0 && (
        <div className="mt-6">
          <span className="text-xs font-bold uppercase tracking-wider text-[#A1A1AA] block mb-2">
            Artists ({searchResults.artists.length})
          </span>
          <div className="flex flex-col gap-2">
            {searchResults.artists.map((artist) => (
              <button
                key={artist.name}
                type="button"
                onClick={() => {
                  addRecentSearch(searchQuery.trim());
                  setSelectedArtist(artist);
                  setActiveSubPage('artist_inner');
                }}
                className="flex items-center justify-between rounded-xl bg-[#14141C] p-2.5 border border-white/5 hover:border-purple-500/30 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center text-[#A855F7] font-bold text-sm shrink-0">
                    {artist.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{artist.name}</p>
                    <p className="text-xs text-[#A1A1AA]">{artist.tracks.length} songs</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[#71717A]" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // SUB-PAGE 2: FAVOURITES PAGE (Matches `favourite_page.jpg`)
  // ============================================================================
  const renderFavouritesPage = () => {
    const likedTracks = likedSongs;
    const favArtists = artists.filter((ar) =>
      ar.tracks.some((t) => t.isFavorite)
    );
    const favAlbums = albums.filter((al) =>
      al.tracks.some((t) => t.isFavorite)
    );

    return (
      <div className="flex flex-col h-full w-full bg-[#0A0A0A] px-4 pt-3 pb-28 overflow-y-auto scrollbar-none">
        {/* Top Bar */}
        <div className="relative flex items-center justify-center py-2">
          <button
            type="button"
            onClick={() => setActiveSubPage(null)}
            className="absolute left-0 p-1.5 rounded-full text-white hover:bg-white/10 transition cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-extrabold text-white tracking-tight">Favourites</h2>
        </div>

        {/* Sub-Tabs Row: Songs | Artists | Albums | Discover */}
        <div className="mt-3 flex items-center justify-between border-b border-white/10 px-2">
          {(
            [
              { id: 'songs', label: 'Songs', count: likedTracks.length },
              { id: 'artists', label: 'Artists', count: favArtists.length },
              { id: 'albums', label: 'Albums', count: favAlbums.length },
              { id: 'discover', label: 'Discover', count: 0 },
            ] as const
          ).map((tab) => {
            const active = favSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFavSubTab(tab.id)}
                className="relative pb-2.5 pt-1 flex flex-col items-center cursor-pointer"
              >
                <span
                  className={`text-sm transition ${
                    active ? 'font-extrabold text-white' : 'font-medium text-[#A1A1AA]'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <sup className="ml-0.5 text-[10px] font-bold text-[#A855F7]">
                      {tab.count}
                    </sup>
                  )}
                </span>
                {active && (
                  <span className="absolute bottom-0 h-1 w-5 rounded-full bg-[#A855F7]" />
                )}
              </button>
            );
          })}
        </div>

        {favSubTab === 'songs' && (
          <>
            {/* Shuffle Playback Pill + Right Action Icons */}
            <div className="mt-4 mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleShufflePlayList(likedTracks)}
                className="flex items-center gap-2 rounded-full bg-[#9333EA]/85 hover:bg-[#9333EA] px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-purple-950/50 active:scale-95 transition cursor-pointer"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#9333EA]">
                  <Play className="h-3 w-3 fill-current ml-0.5" />
                </span>
                <span>Shuffle playback</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchSelectMode((prev) => !prev);
                    setSelectedTrackIds([]);
                  }}
                  className={`p-2 rounded-full transition cursor-pointer ${
                    isBatchSelectMode
                      ? 'bg-[#9333EA] text-white'
                      : 'text-[#D4D4D8] hover:bg-white/10'
                  }`}
                  title="Select songs"
                >
                  <ListChecks className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowSortSheet(true)}
                  className="p-2 rounded-full text-[#D4D4D8] hover:bg-white/10 transition cursor-pointer"
                  title="Sort songs"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Numbered Favourites Song List */}
            {likedTracks.length > 0 ? (
              <div className="flex flex-col divide-y divide-white/[0.04]">
                {likedTracks.map((track, idx) =>
                  renderSongRow(track, idx, likedTracks, { numbered: true })
                )}
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <Star className="h-10 w-10 text-[#A855F7]/50 mb-2" />
                <p className="text-sm font-bold text-white">No favourite songs yet</p>
                <p className="text-xs text-[#71717A] mt-1">
                  Tap the heart icon on any song to add it to your Favourites.
                </p>
              </div>
            )}
          </>
        )}

        {favSubTab === 'artists' && (
          <div className="mt-4 flex flex-col gap-2">
            {favArtists.length > 0 ? (
              favArtists.map((artist) => (
                <button
                  key={artist.name}
                  type="button"
                  onClick={() => {
                    setSelectedArtist(artist);
                    setActiveSubPage('artist_inner');
                  }}
                  className="flex items-center justify-between rounded-xl bg-[#14141C] p-3 border border-white/5 hover:border-purple-500/30 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-full bg-purple-500/20 flex items-center justify-center text-[#A855F7] font-bold">
                      {artist.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{artist.name}</p>
                      <p className="text-xs text-[#A1A1AA]">{artist.tracks.length} songs</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#71717A]" />
                </button>
              ))
            ) : (
              <div className="py-16 text-center text-xs text-[#71717A]">
                No favourite artists yet
              </div>
            )}
          </div>
        )}

        {favSubTab === 'albums' && (
          <div className="mt-4 flex flex-col gap-2">
            {favAlbums.length > 0 ? (
              favAlbums.map((album) => (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => {
                    setSelectedAlbum(album);
                    setActiveSubPage('album_inner');
                  }}
                  className="flex items-center justify-between rounded-xl bg-[#14141C] p-3 border border-white/5 hover:border-purple-500/30 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 rounded-xl overflow-hidden bg-[#1F1F2B] shrink-0">
                      {album.artworkUrl ? (
                        <img
                          src={album.artworkUrl}
                          alt={album.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[#A855F7]">
                          <Disc3 className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{album.name}</p>
                      <p className="text-xs text-[#A1A1AA] truncate">{album.artist}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#71717A]" />
                </button>
              ))
            ) : (
              <div className="py-16 text-center text-xs text-[#71717A]">
                No favourite albums yet
              </div>
            )}
          </div>
        )}

        {favSubTab === 'discover' && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded-2xl bg-gradient-to-r from-[#2E1065] to-[#1E1B4B] p-4 border border-purple-500/30">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-300">
                Most Played Smart Mix
              </p>
              <p className="text-xs text-zinc-300 mt-0.5">
                Your top played tracks automatically curated
              </p>
            </div>
            <div className="flex flex-col divide-y divide-white/[0.04]">
              {discovery.mostPlayed.map((track, idx) =>
                renderSongRow(track, idx, discovery.mostPlayed, { numbered: true })
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // SUB-PAGE 3: PLAYLISTS GRID PAGE (Matches `playlist_page.jpg`)
  // ============================================================================
  const renderPlaylistsPage = () => {
    const allPlaylistCards: MusicPlaylist[] = [
      {
        id: '__FAVOURITES_PLAYLIST__',
        name: 'My favourites',
        trackIds: likedSongs.map((t) => t.id),
        createdAt: 0,
        updatedAt: 0,
      },
      ...playlists,
    ];

    return (
      <div className="flex flex-col h-full w-full bg-[#0A0A0A] px-4 pt-3 pb-28 overflow-y-auto scrollbar-none">
        {/* Header */}
        <div className="relative flex items-center justify-center py-2">
          <button
            type="button"
            onClick={() => setActiveSubPage(null)}
            className="absolute left-0 p-1.5 rounded-full text-white hover:bg-white/10 transition cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-extrabold text-white tracking-tight">Playlists</h2>
        </div>

        {/* Action Row: Shuffle Playback on Left, Add Playlist Icon on Right */}
        <div className="mt-3 mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleShufflePlayList(visibleTracks)}
            className="flex items-center gap-2.5 text-sm font-bold text-white hover:opacity-90 active:scale-95 transition cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9333EA] text-white shadow-md shadow-purple-900/50">
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
            </span>
            <span>Shuffle playback</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewPlaylistName('');
              setIsCreatePlaylistModalOpen(true);
            }}
            className="p-2 rounded-full text-white hover:bg-white/10 transition cursor-pointer"
            title="Create new playlist"
          >
            <ListPlus className="h-5 w-5" />
          </button>
        </div>

        {/* 2-Column Square Playlist Cards Grid */}
        <div className="grid grid-cols-2 gap-4">
          {allPlaylistCards.map((pl, idx) => {
            const plTracks = pl.trackIds
              .map((id) => visibleTracks.find((t) => t.id === id))
              .filter((t): t is MusicTrack => Boolean(t));
            const firstSongArt = resolvePlaylistFirstSongArtwork(plTracks);
            const fallbackSong = plTracks[0];

            return (
              <div
                key={pl.id}
                onClick={() => {
                  setSelectedPlaylistId(pl.id);
                  setActiveSubPage('playlist_inner');
                }}
                className="group flex flex-col cursor-pointer"
              >
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#181822] border border-white/10 shadow-md">
                  {firstSongArt ? (
                    <img
                      src={firstSongArt}
                      alt={pl.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : idx % 2 === 0 ? (
                    /* Geometric diagonal stripe pattern fallback matching `playlist_page.jpg` */
                    <div
                      className="h-full w-full flex items-center justify-center relative"
                      style={{
                        background:
                          'repeating-linear-gradient(135deg, #F59E0B 0px, #F59E0B 14px, #10B981 14px, #10B981 28px, #EC4899 28px, #EC4899 42px, #3B82F6 42px, #3B82F6 56px)',
                      }}
                    >
                      <div className="absolute inset-0 bg-black/20" />
                      {fallbackSong && (
                        <Music2 className="relative z-10 h-10 w-10 text-white/90 drop-shadow-md" />
                      )}
                    </div>
                  ) : (
                    /* Vibrant honeycomb / mosaic geometric fallback matching `playlist_page.jpg` */
                    <div
                      className="h-full w-full flex items-center justify-center relative"
                      style={{
                        background:
                          'radial-gradient(circle at 25% 25%, #EC4899 0%, #8B5CF6 35%, #06B6D4 70%, #10B981 100%)',
                      }}
                    >
                      <div className="absolute inset-0 bg-black/15" />
                      <ListMusic className="relative z-10 h-10 w-10 text-white/90 drop-shadow-md" />
                    </div>
                  )}

                  {/* Bottom-Right White Circular Play Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (plTracks.length > 0) {
                        playTrackList(plTracks, false);
                      } else {
                        setSelectedPlaylistId(pl.id);
                        setActiveSubPage('playlist_inner');
                      }
                    }}
                    className="absolute bottom-2.5 right-2.5 h-9 w-9 rounded-full bg-white text-[#121216] flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer"
                    aria-label={`Play ${pl.name}`}
                  >
                    <Play className="h-4 w-4 fill-current ml-0.5" />
                  </button>
                </div>

                <span className="mt-2 text-sm font-bold text-white truncate">
                  {pl.name}
                </span>
                <span className="text-xs text-[#A1A1AA]">
                  Total {pl.trackIds.length} songs
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================================
  // SUB-PAGE 4: PLAYLIST INNER PAGE UI (Matches `playlist_inner_page_UI.jpg`)
  // ============================================================================
  const renderPlaylistInnerPage = () => {
    if (!selectedPlaylist) return null;
    const firstPoster =
      resolvePlaylistFirstSongArtwork(selectedPlaylistTracks) ||
      DEFAULT_MAXPLAY_MUSIC_POSTER;

    return (
      <div className="relative flex flex-col h-full w-full bg-[#0A0A0A] pb-28 overflow-y-auto scrollbar-none">
        {/* Ambient Poster Top Fade (like MaxPlay's Networks page fade) */}
        <div className="relative w-full overflow-hidden pb-6">
          <div
            className="absolute inset-0 bg-cover bg-center scale-125 blur-2xl opacity-45 pointer-events-none"
            style={{ backgroundImage: `url(${firstPoster})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#0A0A0A]/75 to-[#0A0A0A] pointer-events-none" />

          {/* Top Navigation Row */}
          <div className="relative z-10 flex items-center justify-between px-4 pt-3">
            <button
              type="button"
              onClick={() => setActiveSubPage('playlists')}
              className="p-2 rounded-full text-white hover:bg-white/10 transition cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            {selectedPlaylist.id !== '__FAVOURITES_PLAYLIST__' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPlaylistInnerMenu((prev) => !prev)}
                  className="p-2 rounded-full text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                {showPlaylistInnerMenu && (
                  <div className="absolute right-0 mt-1 w-44 rounded-2xl bg-[#181822] border border-white/15 shadow-2xl py-1.5 z-30">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlaylistInnerMenu(false);
                        setShowAddSongsToPlaylistId(selectedPlaylist.id);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-white hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="h-4 w-4 text-[#A855F7]" />
                      <span>Add songs</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlaylistInnerMenu(false);
                        setRenamingPlaylist(selectedPlaylist);
                        setRenameText(selectedPlaylist.name);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-white hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                    >
                      <Edit3 className="h-4 w-4 text-cyan-400" />
                      <span>Rename playlist</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlaylistInnerMenu(false);
                        deletePlaylist(selectedPlaylist.id);
                        setActiveSubPage('playlists');
                        triggerToast('Playlist deleted');
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-400 hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete playlist</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Centered Square First-Song Poster + Playlist Name + 3 Action Buttons */}
          <div className="relative z-10 mt-3 flex flex-col items-center px-6 text-center">
            <div className="h-36 w-36 rounded-2xl overflow-hidden border border-white/15 shadow-[0_14px_35px_rgba(0,0,0,0.75)] bg-[#181822]">
              <img
                src={firstPoster}
                alt={selectedPlaylist.name}
                className="h-full w-full object-cover"
              />
            </div>

            <h1 className="mt-4 text-lg font-extrabold text-white tracking-tight">
              {selectedPlaylist.name}
            </h1>
            <span className="mt-0.5 text-xs text-[#A1A1AA]">
              {selectedPlaylistTracks.length}{' '}
              {selectedPlaylistTracks.length === 1 ? 'song' : 'songs'}
            </span>

            {/* 3 Action Buttons Row: Add Songs (Left), Large Purple Play Button (Center), Sort (Right) */}
            <div className="mt-5 flex items-center justify-center gap-10">
              <button
                type="button"
                onClick={() => {
                  if (selectedPlaylist.id === '__FAVOURITES_PLAYLIST__') {
                    triggerToast('Tap the heart icon on any song to add to Favourites');
                  } else {
                    setShowAddSongsToPlaylistId(selectedPlaylist.id);
                  }
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/15 text-white border border-white/10 transition cursor-pointer"
                title="Add songs to playlist"
              >
                <ListPlus className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedPlaylistTracks.length > 0) {
                    playTrackList(selectedPlaylistTracks, false);
                  } else {
                    triggerToast('Add songs to start playing this playlist');
                  }
                }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#9333EA] hover:bg-[#A855F7] text-white shadow-[0_0_25px_rgba(147,51,234,0.6)] active:scale-95 transition cursor-pointer"
                aria-label="Play playlist"
              >
                <Play className="h-6 w-6 fill-current ml-0.5" />
              </button>

              <button
                type="button"
                onClick={() => setShowSortSheet(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/15 text-white border border-white/10 transition cursor-pointer"
                title="Sort songs"
              >
                <ArrowUpDown className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Numbered Songs List with Thumbnail (`01` + cover + Title + Artist) */}
        <div className="px-4 flex flex-col divide-y divide-white/[0.04]">
          {selectedPlaylistTracks.length > 0 ? (
            selectedPlaylistTracks.map((track, idx) =>
              renderSongRow(track, idx, selectedPlaylistTracks, {
                numbered: true,
                showThumbnailWithNumber: true,
                playlistIdForRemoval:
                  selectedPlaylist.id !== '__FAVOURITES_PLAYLIST__'
                    ? selectedPlaylist.id
                    : undefined,
              })
            )
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Music2 className="h-10 w-10 text-purple-400/50 mb-2" />
              <p className="text-sm font-bold text-white">This playlist is empty</p>
              {selectedPlaylist.id !== '__FAVOURITES_PLAYLIST__' && (
                <button
                  type="button"
                  onClick={() => setShowAddSongsToPlaylistId(selectedPlaylist.id)}
                  className="mt-3 rounded-full bg-[#9333EA] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  + Add Songs
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // SUB-PAGE 5: RECENT PAGE (Matches `recent_page.jpg`)
  // ============================================================================
  const renderRecentPage = () => {
    const recentTracks =
      discovery.recentlyPlayed.length > 0
        ? discovery.recentlyPlayed
        : discovery.recentlyAdded;

    return (
      <div className="flex flex-col h-full w-full bg-[#0A0A0A] px-4 pt-3 pb-28 overflow-y-auto scrollbar-none">
        {/* Top Bar */}
        <div className="relative flex items-center justify-center py-2">
          <button
            type="button"
            onClick={() => setActiveSubPage(null)}
            className="absolute left-0 p-1.5 rounded-full text-white hover:bg-white/10 transition cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-extrabold text-white tracking-tight">Recent</h2>
        </div>

        {/* Action Row: Purple Shuffle Playback Pill on Left, Trash Clear Button on Right */}
        <div className="mt-3 mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleShufflePlayList(recentTracks)}
            className="flex items-center gap-2 rounded-full bg-[#9333EA]/85 hover:bg-[#9333EA] px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-purple-950/50 active:scale-95 transition cursor-pointer"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#9333EA]">
              <Play className="h-3 w-3 fill-current ml-0.5" />
            </span>
            <span>Shuffle playback</span>
          </button>

          <button
            type="button"
            onClick={() => {
              clearRecentHistory();
              triggerToast('Recent playback history cleared');
            }}
            className="p-2 rounded-full text-[#A1A1AA] hover:text-rose-400 hover:bg-white/10 transition cursor-pointer"
            title="Clear recent history"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Numbered Recent Song List */}
        {recentTracks.length > 0 ? (
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {recentTracks.map((track, idx) =>
              renderSongRow(track, idx, recentTracks, { numbered: true })
            )}
          </div>
        ) : (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <Clock className="h-10 w-10 text-[#A855F7]/50 mb-2" />
            <p className="text-sm font-bold text-white">No recently played songs</p>
            <p className="text-xs text-[#71717A] mt-1">
              Songs you play will appear here in chronological order.
            </p>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // SUB-PAGE 6: ALBUM / ARTIST / FOLDER INNER PAGES
  // ============================================================================
  const renderCollectionInnerPage = (
    title: string,
    subtitle: string,
    posterUrl: string | undefined,
    tracks: MusicTrack[]
  ) => {
    const backdropImg = posterUrl || DEFAULT_MAXPLAY_MUSIC_POSTER;
    return (
      <div className="relative flex flex-col h-full w-full bg-[#0A0A0A] pb-28 overflow-y-auto scrollbar-none">
        <div className="relative w-full overflow-hidden pb-5">
          <div
            className="absolute inset-0 bg-cover bg-center scale-125 blur-2xl opacity-40 pointer-events-none"
            style={{ backgroundImage: `url(${backdropImg})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#0A0A0A]/80 to-[#0A0A0A] pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between px-4 pt-3">
            <button
              type="button"
              onClick={() => setActiveSubPage(null)}
              className="p-2 rounded-full text-white hover:bg-white/10 transition cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowSortSheet(true)}
              className="p-2 rounded-full text-white hover:bg-white/10 transition cursor-pointer"
            >
              <ArrowUpDown className="h-5 w-5" />
            </button>
          </div>

          <div className="relative z-10 mt-2 flex flex-col items-center px-6 text-center">
            <div className="h-32 w-32 rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-[#181822]">
              <img src={backdropImg} alt={title} className="h-full w-full object-cover" />
            </div>
            <h1 className="mt-3.5 text-lg font-extrabold text-white tracking-tight line-clamp-1">
              {title}
            </h1>
            <p className="mt-0.5 text-xs text-[#A1A1AA] line-clamp-1">{subtitle}</p>

            <button
              type="button"
              onClick={() => handleShufflePlayList(tracks)}
              className="mt-4 flex items-center gap-2 rounded-full bg-[#9333EA] hover:bg-[#A855F7] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-purple-900/50 active:scale-95 transition cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Shuffle playback ({tracks.length})</span>
            </button>
          </div>
        </div>

        <div className="px-4 flex flex-col divide-y divide-white/[0.04]">
          {tracks.map((track, idx) =>
            renderSongRow(track, idx, tracks, {
              numbered: true,
              showThumbnailWithNumber: true,
            })
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN MUSIC HOMEPAGE (Matches `music_main_homepage.jpg`, `albums_section.jpg`, `folders_section.jpg`)
  // ============================================================================
  const latestRecentCover =
    discovery.recentlyPlayed[0]?.artworkUrl ||
    visibleTracks.find((t) => Boolean(t.artworkUrl))?.artworkUrl ||
    DEFAULT_MAXPLAY_MUSIC_POSTER;

  const latestFavouriteCover =
    likedSongs.find((t) => Boolean(t.artworkUrl))?.artworkUrl ||
    (likedSongs.length > 0 ? DEFAULT_MAXPLAY_MUSIC_POSTER : null);

  return (
    <div className="relative h-full w-full bg-[#0A0A0A] text-white select-none overflow-hidden">
      {/* Hidden File Input for Importing Local Audio Files */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.opus"
        multiple
        className="hidden"
        onChange={async (e) => {
          if (e.target.files && e.target.files.length > 0) {
            await importLocalAudioFiles(e.target.files);
            triggerToast(`Imported ${e.target.files.length} audio file(s)`);
            e.target.value = '';
          }
        }}
      />

      {/* Hidden File Input for Updating Song Cover Art */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && coverTargetTrackId) {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                updateSongMetadata(coverTargetTrackId, { artworkUrl: reader.result });
                triggerToast('Album cover updated');
              }
            };
            reader.readAsDataURL(file);
          }
          e.target.value = '';
        }}
      />

      {/* Render Active Sub-Page or Main Music Homepage */}
      {activeSubPage === 'search' ? (
        renderSearchPage()
      ) : activeSubPage === 'favourites' ? (
        renderFavouritesPage()
      ) : activeSubPage === 'playlists' ? (
        renderPlaylistsPage()
      ) : activeSubPage === 'playlist_inner' ? (
        renderPlaylistInnerPage()
      ) : activeSubPage === 'recent' ? (
        renderRecentPage()
      ) : activeSubPage === 'album_inner' && selectedAlbum ? (
        renderCollectionInnerPage(
          selectedAlbum.name,
          `${selectedAlbum.artist} • ${selectedAlbum.tracks.length} songs`,
          selectedAlbum.artworkUrl,
          selectedAlbum.tracks
        )
      ) : activeSubPage === 'artist_inner' && selectedArtist ? (
        renderCollectionInnerPage(
          selectedArtist.name,
          `${selectedArtist.tracks.length} songs • ${selectedArtist.albums.length} albums`,
          selectedArtist.artworkUrl,
          selectedArtist.tracks
        )
      ) : activeSubPage === 'folder_inner' && selectedFolder ? (
        renderCollectionInnerPage(
          selectedFolder.name,
          `${selectedFolder.tracks.length} songs | ${selectedFolder.path}`,
          undefined,
          selectedFolder.tracks
        )
      ) : (
        <div className="flex flex-col h-full w-full px-4 pt-3 pb-32 overflow-y-auto scrollbar-none">
          {/* TOP HEADER: MaxPlay Logo on Left + Rounded Pill Search Bar with Mic on Right */}
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <LogoPlaceholder size="sm" />
            </div>

            <div
              onClick={() => setActiveSubPage('search')}
              className="flex-1 flex items-center justify-between gap-2 rounded-full bg-[#16161E] hover:bg-[#1C1C26] border border-white/10 px-3.5 py-2.5 cursor-pointer transition shadow-inner"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Search className="h-4 w-4 text-[#A1A1AA] shrink-0" />
                <span className="text-xs sm:text-sm text-[#8E8E93] truncate">
                  Search songs, playlists, and artists
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="h-3.5 w-[1px] bg-white/15" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startVoiceSearch();
                  }}
                  className="text-[#A1A1AA] hover:text-white transition cursor-pointer"
                  aria-label="Voice search"
                >
                  <Mic className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 3 FEATURE BOXES ROW: Favourites | Playlists | Recent */}
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {/* Box 1: Favourites (Purple Gradient + Latest Favourited Song Poster Fade + White Star Icon) */}
            <button
              type="button"
              onClick={() => {
                setFavSubTab('songs');
                setActiveSubPage('favourites');
              }}
              className="relative h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-[#7C3AED] via-[#8B5CF6] to-[#5B21B6] p-3 flex flex-col justify-between text-left shadow-lg shadow-purple-950/40 active:scale-95 transition cursor-pointer group"
            >
              {latestFavouriteCover && (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-35 mix-blend-overlay pointer-events-none transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${latestFavouriteCover})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#4C1D95]/90 via-[#6D28D9]/45 to-transparent pointer-events-none" />
                </>
              )}
              {/* Subtle Play Watermark */}
              <Play className="absolute -right-2 -bottom-2 h-16 w-16 text-white/15 rotate-[-12deg] pointer-events-none" />
              <Star className="h-6 w-6 text-white fill-white drop-shadow relative z-10" />
              <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight relative z-10">
                Favourites
              </span>
            </button>

            {/* Box 2: Playlists (Deep Emerald/Teal Green + Circular Music Note Icon) */}
            <button
              type="button"
              onClick={() => setActiveSubPage('playlists')}
              className="relative h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-[#34786C] via-[#2B685D] to-[#205047] p-3 flex flex-col justify-between text-left shadow-lg shadow-emerald-950/40 active:scale-95 transition cursor-pointer group"
            >
              <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center text-[#2B685D] shadow">
                <Music2 className="h-3.5 w-3.5 stroke-[2.6]" />
              </div>
              <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight relative z-10">
                Playlists
              </span>
            </button>

            {/* Box 3: Recent (Warm Amber/Ochre with Latest Played Cover Overlay + White Clock Icon) */}
            <button
              type="button"
              onClick={() => setActiveSubPage('recent')}
              className="relative h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-[#C87D20] via-[#B46914] to-[#8C4F0B] p-3 flex flex-col justify-between text-left shadow-lg shadow-amber-950/40 active:scale-95 transition cursor-pointer group"
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-overlay pointer-events-none"
                style={{ backgroundImage: `url(${latestRecentCover})` }}
              />
              <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center text-[#B46914] shadow relative z-10">
                <Clock className="h-3.5 w-3.5 stroke-[2.6]" />
              </div>
              <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight relative z-10">
                Recent
              </span>
            </button>
          </div>

          {/* SECTION TABS ROW: Songs | Artists | Albums | Folders (No Videos tab) */}
          <div className="mt-5 flex items-center justify-between border-b border-white/[0.08] px-1">
            {(
              [
                { id: 'songs', label: 'Songs' },
                { id: 'artists', label: 'Artists' },
                { id: 'albums', label: 'Albums' },
                { id: 'folders', label: 'Folders' },
              ] as const
            ).map((tab) => {
              const isActive = mainTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMainTab(tab.id);
                    setIsBatchSelectMode(false);
                    setSelectedTrackIds([]);
                  }}
                  className="relative pb-2.5 pt-1 flex flex-col items-center cursor-pointer"
                >
                  <span
                    className={`transition-all ${
                      isActive
                        ? 'text-lg font-extrabold text-white'
                        : 'text-sm font-medium text-[#8E8E93] hover:text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 h-1 w-5 rounded-full bg-[#A855F7]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ================================================================= */}
          {/* TAB 1: SONGS SECTION (Default)                                    */}
          {/* ================================================================= */}
          {mainTab === 'songs' && (
            <div className="mt-3.5 flex flex-col">
              {/* Shuffle Playback & Sort / Checklist Controls Row */}
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleShufflePlayList(sortedTracks)}
                  className="flex items-center gap-2.5 text-sm font-bold text-white hover:opacity-90 active:scale-95 transition cursor-pointer"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9333EA] text-white shadow-md shadow-purple-900/50">
                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                  </span>
                  <span>Shuffle playback</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowSortSheet(true)}
                    className="p-2 rounded-full text-[#D4D4D8] hover:text-white hover:bg-white/10 transition cursor-pointer"
                    title="Sort songs"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBatchSelectMode((prev) => !prev);
                      setSelectedTrackIds([]);
                    }}
                    className={`p-2 rounded-full transition cursor-pointer ${
                      isBatchSelectMode
                        ? 'bg-[#9333EA] text-white'
                        : 'text-[#D4D4D8] hover:text-white hover:bg-white/10'
                    }`}
                    title="Batch select songs"
                  >
                    <ListChecks className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Multi-Select Batch Action Bar */}
              {isBatchSelectMode && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-[#181824] border border-purple-500/40 px-3.5 py-2.5">
                  <span className="text-xs font-bold text-purple-200">
                    {selectedTrackIds.length} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedTrackIds.length === sortedTracks.length) {
                          setSelectedTrackIds([]);
                        } else {
                          setSelectedTrackIds(sortedTracks.map((t) => t.id));
                        }
                      }}
                      className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                    >
                      {selectedTrackIds.length === sortedTracks.length ? 'None' : 'Select All'}
                    </button>
                    <button
                      type="button"
                      disabled={selectedTrackIds.length === 0}
                      onClick={() => {
                        const chosen = sortedTracks.filter((t) =>
                          selectedTrackIds.includes(t.id)
                        );
                        setPlaylistPickerTracks(chosen);
                        setIsBatchSelectMode(false);
                        setSelectedTrackIds([]);
                      }}
                      className="rounded-lg bg-[#9333EA] px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-40 cursor-pointer"
                    >
                      + Playlist
                    </button>
                  </div>
                </div>
              )}

              {/* Songs List */}
              {sortedTracks.length > 0 ? (
                <div className="flex flex-col divide-y divide-white/[0.04]">
                  {sortedTracks.map((track, idx) =>
                    renderSongRow(track, idx, sortedTracks)
                  )}
                </div>
              ) : (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <Music2 className="h-10 w-10 text-[#A855F7]/60 mb-2" />
                  <p className="text-sm font-bold text-white">No songs found yet</p>
                  <p className="text-xs text-[#71717A] mt-1 max-w-xs">
                    Scan your phone storage or pick local MP3/FLAC/WAV audio files to listen offline.
                  </p>
                  <div className="mt-4 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => scanDeviceMusic(true)}
                      className="rounded-full bg-[#9333EA] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      Scan Phone Audio
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full bg-white/10 border border-white/15 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      Pick Audio Files
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: ARTISTS SECTION                                            */}
          {/* ================================================================= */}
          {mainTab === 'artists' && (
            <div className="mt-3.5 flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleShufflePlayList(visibleTracks)}
                  className="flex items-center gap-2.5 text-sm font-bold text-white hover:opacity-90 active:scale-95 transition cursor-pointer"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9333EA] text-white shadow-md shadow-purple-900/50">
                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                  </span>
                  <span>Shuffle playback</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSortSheet(true)}
                  className="p-2 rounded-full text-[#D4D4D8] hover:bg-white/10 transition cursor-pointer"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col divide-y divide-white/[0.04]">
                {artists.map((artist) => (
                  <button
                    key={artist.name}
                    type="button"
                    onClick={() => {
                      setSelectedArtist(artist);
                      setActiveSubPage('artist_inner');
                    }}
                    className="flex items-center justify-between gap-3 py-3 px-1 hover:bg-white/[0.04] rounded-xl transition text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="h-12 w-12 rounded-full overflow-hidden bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-white font-bold text-base shrink-0 border border-white/10">
                        {artist.artworkUrl ? (
                          <img
                            src={artist.artworkUrl}
                            alt={artist.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          artist.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-white truncate">
                          {artist.name}
                        </p>
                        <p className="text-xs text-[#A1A1AA] mt-0.5">
                          {artist.tracks.length}{' '}
                          {artist.tracks.length === 1 ? 'song' : 'songs'} •{' '}
                          {artist.albums.length}{' '}
                          {artist.albums.length === 1 ? 'album' : 'albums'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#71717A] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: ALBUMS SECTION (Matches `albums_section.jpg` Vinyl Peek)   */}
          {/* ================================================================= */}
          {mainTab === 'albums' && (
            <div className="mt-3.5 flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleShufflePlayList(visibleTracks)}
                  className="flex items-center gap-2.5 text-sm font-bold text-white hover:opacity-90 active:scale-95 transition cursor-pointer"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9333EA] text-white shadow-md shadow-purple-900/50">
                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                  </span>
                  <span>Shuffle playback</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSortSheet(true)}
                  className="p-2 rounded-full text-[#D4D4D8] hover:bg-white/10 transition cursor-pointer"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col divide-y divide-white/[0.04]">
                {albums.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => {
                      setSelectedAlbum(album);
                      setActiveSubPage('album_inner');
                    }}
                    className="flex items-center justify-between gap-3 py-3 px-1 hover:bg-white/[0.04] rounded-xl transition text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Album Cover with Peeking Black Vinyl Disc on Right */}
                      <div className="relative h-[52px] w-[66px] shrink-0 flex items-center">
                        {/* Peeking Vinyl Disc */}
                        <div className="absolute right-0 h-[48px] w-[48px] rounded-full bg-gradient-to-tr from-[#09090B] via-[#27272A] to-[#09090B] border border-white/20 shadow-md flex items-center justify-center">
                          <div className="h-4 w-4 rounded-full bg-[#18181B] border border-white/25" />
                        </div>
                        {/* Square Album Cover */}
                        <div className="relative z-10 h-[52px] w-[52px] rounded-xl overflow-hidden bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#EC4899] border border-white/15 shadow-md flex items-center justify-center">
                          {album.artworkUrl ? (
                            <img
                              src={album.artworkUrl}
                              alt={album.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Music2 className="h-6 w-6 text-white/95" />
                          )}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-white truncate group-hover:text-[#A855F7] transition">
                          {album.name}
                        </p>
                        <p className="text-xs text-[#A1A1AA] truncate mt-0.5">
                          {album.artist}
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-[#71717A] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: FOLDERS SECTION (Matches `folders_section.jpg`)            */}
          {/* ================================================================= */}
          {mainTab === 'folders' && (
            <div className="mt-3.5 flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleShufflePlayList(visibleTracks)}
                  className="flex items-center gap-2.5 text-sm font-bold text-white hover:opacity-90 active:scale-95 transition cursor-pointer"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9333EA] text-white shadow-md shadow-purple-900/50">
                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                  </span>
                  <span>Shuffle playback</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-purple-300 hover:bg-white/15 cursor-pointer"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span>Add Audio</span>
                </button>
              </div>

              <div className="flex flex-col divide-y divide-white/[0.04]">
                {folders.map((folder) => (
                  <button
                    key={folder.path}
                    type="button"
                    onClick={() => {
                      setSelectedFolder(folder);
                      setActiveSubPage('folder_inner');
                    }}
                    className="flex items-center justify-between gap-3 py-3 px-1 hover:bg-white/[0.04] rounded-xl transition text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Folder className="h-9 w-9 text-[#A855F7] fill-[#A855F7]/85" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-white truncate group-hover:text-[#A855F7] transition">
                          {folder.name}
                        </p>
                        <p className="text-xs text-[#A1A1AA] truncate mt-0.5">
                          {folder.tracks.length}{' '}
                          {folder.tracks.length === 1 ? 'song' : 'songs'} |{' '}
                          {folder.path}
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-[#71717A] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SORT BY BOTTOM SHEET (By name, By adding time, By times played)       */}
      {/* ===================================================================== */}
      {showSortSheet && (
        <div
          onClick={() => setShowSortSheet(false)}
          className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-sm flex items-end justify-center p-3"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#16161F] border border-white/15 p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-extrabold text-white">Sort Songs By</h3>
              <button
                type="button"
                onClick={() => setShowSortSheet(false)}
                className="p-1 rounded-full text-[#A1A1AA] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  { id: 'name', label: 'By song name (A - Z)' },
                  { id: 'recently_added', label: 'By adding time (Newest first)' },
                  { id: 'most_played', label: 'By number of times played' },
                  { id: 'artist', label: 'By artist name' },
                  { id: 'duration', label: 'By song duration' },
                ] as Array<{ id: MusicSortOption; label: string }>
              ).map((opt) => {
                const active = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortBy(opt.id);
                      setShowSortSheet(false);
                      triggerToast(`Sorted: ${opt.label}`);
                    }}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left text-xs sm:text-sm font-semibold transition cursor-pointer ${
                      active
                        ? 'bg-[#9333EA]/25 border border-[#A855F7]/50 text-[#C084FC]'
                        : 'bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {active && <Check className="h-4 w-4 text-[#A855F7]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SONG 3-DOT OPTIONS MENU SHEET                                         */}
      {/* ===================================================================== */}
      {activeSongMenuTrack && (
        <div
          onClick={() => setActiveSongMenuTrack(null)}
          className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-sm flex items-end justify-center p-3"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#16161F] border border-white/15 p-5 shadow-2xl"
          >
            <div className="flex items-center gap-3 pb-3.5 border-b border-white/10">
              {renderSongThumbnail(activeSongMenuTrack, 0)}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">
                  {activeSongMenuTrack.title}
                </p>
                <p className="text-xs text-[#A1A1AA] truncate">
                  {activeSongMenuTrack.artist} • {activeSongMenuTrack.album}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  toggleFavorite(activeSongMenuTrack.id);
                  setActiveSongMenuTrack(null);
                }}
                className="p-2 rounded-full bg-white/5 text-white cursor-pointer"
              >
                <Heart
                  className={`h-5 w-5 ${
                    activeSongMenuTrack.isFavorite
                      ? 'fill-[#A855F7] text-[#A855F7]'
                      : 'text-white'
                  }`}
                />
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  playNextInQueue(activeSongMenuTrack);
                  setActiveSongMenuTrack(null);
                  triggerToast('Playing next in queue');
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 cursor-pointer"
              >
                <Play className="h-4 w-4 text-[#A855F7]" />
                <span>Play next</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPlaylistPickerTracks([activeSongMenuTrack]);
                  setActiveSongMenuTrack(null);
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 cursor-pointer"
              >
                <ListPlus className="h-4 w-4 text-[#A855F7]" />
                <span>Add to playlist</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  addToQueueEnd(activeSongMenuTrack);
                  setActiveSongMenuTrack(null);
                  triggerToast('Added to queue');
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 cursor-pointer"
              >
                <ListMusic className="h-4 w-4 text-cyan-400" />
                <span>Add to queue</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = activeSongMenuTrack;
                  setActiveSongMenuTrack(null);
                  setEditingSongTrack(target);
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 cursor-pointer"
              >
                <Edit3 className="h-4 w-4 text-emerald-400" />
                <span>Edit song info</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const target = activeSongMenuTrack;
                  setActiveSongMenuTrack(null);
                  await shareTrackFile(target);
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 cursor-pointer"
              >
                <Share2 className="h-4 w-4 text-pink-400" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCoverTargetTrackId(activeSongMenuTrack.id);
                  setActiveSongMenuTrack(null);
                  coverInputRef.current?.click();
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 cursor-pointer"
              >
                <Disc3 className="h-4 w-4 text-amber-400" />
                <span>Change album cover</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSongMenuTrack(null);
                  setIsEqualizerOpen(true);
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 cursor-pointer"
              >
                <Sliders className="h-4 w-4 text-purple-400" />
                <span>Equaliser</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSongDetailsTrack(activeSongMenuTrack);
                  setActiveSongMenuTrack(null);
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 cursor-pointer"
              >
                <Info className="h-4 w-4 text-sky-400" />
                <span>Song file info</span>
              </button>

              {activeSubPage === 'playlist_inner' &&
                selectedPlaylist &&
                selectedPlaylist.id !== '__FAVOURITES_PLAYLIST__' && (
                  <button
                    type="button"
                    onClick={() => {
                      removeTrackFromPlaylist(selectedPlaylist.id, activeSongMenuTrack.id);
                      setActiveSongMenuTrack(null);
                      triggerToast('Removed from playlist');
                    }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-amber-400 hover:bg-white/10 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Remove from this playlist</span>
                  </button>
                )}

              <button
                type="button"
                onClick={() => {
                  hideSongFromLibrary(activeSongMenuTrack.id);
                  setActiveSongMenuTrack(null);
                  triggerToast('Song hidden from library');
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-rose-400 hover:bg-white/10 cursor-pointer"
              >
                <EyeOff className="h-4 w-4" />
                <span>Hide from library</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ADD TO PLAYLIST PICKER MODAL                                          */}
      {/* ===================================================================== */}
      {playlistPickerTracks && (
        <div
          onClick={() => setPlaylistPickerTracks(null)}
          className="fixed inset-0 z-[160] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#16161F] border border-white/15 p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-extrabold text-white">Add to Playlist</h3>
              <button
                type="button"
                onClick={() => setPlaylistPickerTracks(null)}
                className="p-1 text-[#A1A1AA] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setNewPlaylistName('');
                setIsCreatePlaylistModalOpen(true);
              }}
              className="w-full mb-3 flex items-center justify-center gap-2 rounded-2xl bg-[#9333EA] py-2.5 text-xs font-bold text-white cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Playlist</span>
            </button>

            <div className="max-h-60 overflow-y-auto flex flex-col gap-1.5">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => {
                    addTracksToPlaylist(
                      pl.id,
                      playlistPickerTracks.map((t) => t.id)
                    );
                    setPlaylistPickerTracks(null);
                    triggerToast(`Added to "${pl.name}"`);
                  }}
                  className="flex items-center justify-between rounded-xl bg-white/[0.04] hover:bg-white/[0.08] px-3.5 py-2.5 text-left cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-white">{pl.name}</p>
                    <p className="text-[11px] text-[#A1A1AA]">{pl.trackIds.length} songs</p>
                  </div>
                  <Plus className="h-4 w-4 text-[#A855F7]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CREATE PLAYLIST MODAL                                                 */}
      {/* ===================================================================== */}
      {isCreatePlaylistModalOpen && (
        <div
          onClick={() => setIsCreatePlaylistModalOpen(false)}
          className="fixed inset-0 z-[170] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#16161F] border border-white/15 p-5 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-white">New Playlist</h3>
            <input
              type="text"
              value={newPlaylistName}
              autoFocus
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Enter playlist name"
              className="mt-3 w-full rounded-xl bg-black/50 border border-white/15 px-3.5 py-2.5 text-sm text-white focus:border-[#A855F7] focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatePlaylistModalOpen(false)}
                className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = newPlaylistName.trim() || `Playlist ${playlists.length + 1}`;
                  createPlaylist(
                    name,
                    playlistPickerTracks ? playlistPickerTracks.map((t) => t.id) : []
                  );
                  setIsCreatePlaylistModalOpen(false);
                  setPlaylistPickerTracks(null);
                  triggerToast(`Created playlist "${name}"`);
                }}
                className="rounded-xl bg-[#9333EA] px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* RENAME PLAYLIST MODAL                                                 */}
      {/* ===================================================================== */}
      {renamingPlaylist && (
        <div
          onClick={() => setRenamingPlaylist(null)}
          className="fixed inset-0 z-[170] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#16161F] border border-white/15 p-5 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-white">Rename Playlist</h3>
            <input
              type="text"
              value={renameText}
              autoFocus
              onChange={(e) => setRenameText(e.target.value)}
              className="mt-3 w-full rounded-xl bg-black/50 border border-white/15 px-3.5 py-2.5 text-sm text-white focus:border-[#A855F7] focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingPlaylist(null)}
                className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (renameText.trim()) {
                    renamePlaylist(renamingPlaylist.id, renameText.trim());
                    triggerToast('Playlist renamed');
                  }
                  setRenamingPlaylist(null);
                }}
                className="rounded-xl bg-[#9333EA] px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ADD SONGS TO SPECIFIC PLAYLIST MODAL                                  */}
      {/* ===================================================================== */}
      {showAddSongsToPlaylistId && (
        <div
          onClick={() => setShowAddSongsToPlaylistId(null)}
          className="fixed inset-0 z-[170] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#16161F] border border-white/15 p-5 shadow-2xl max-h-[80vh] flex flex-col"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-extrabold text-white">Add Songs to Playlist</h3>
              <button
                type="button"
                onClick={() => setShowAddSongsToPlaylistId(null)}
                className="p-1 text-[#A1A1AA] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col divide-y divide-white/[0.05]">
              {visibleTracks.map((track) => {
                const targetPl = playlists.find((p) => p.id === showAddSongsToPlaylistId);
                const alreadyIn = targetPl?.trackIds.includes(track.id);
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => {
                      addTracksToPlaylist(showAddSongsToPlaylistId, [track.id]);
                      triggerToast(`Added "${track.title}"`);
                    }}
                    className="flex items-center justify-between py-2.5 px-2 hover:bg-white/5 text-left cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-white truncate">{track.title}</p>
                      <p className="text-[11px] text-[#A1A1AA] truncate">
                        {track.artist} • {track.album}
                      </p>
                    </div>
                    {alreadyIn ? (
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Plus className="h-4 w-4 text-[#A855F7] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SONG FILE INFO MODAL                                                  */}
      {/* ===================================================================== */}
      {songDetailsTrack && (
        <div
          onClick={() => setSongDetailsTrack(null)}
          className="fixed inset-0 z-[170] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#16161F] border border-white/15 p-5 shadow-2xl space-y-2.5 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Song Details</h3>
              <button
                type="button"
                onClick={() => setSongDetailsTrack(null)}
                className="p-1 text-[#A1A1AA] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-zinc-300">
              <strong className="text-white">Title:</strong> {songDetailsTrack.title}
            </p>
            <p className="text-zinc-300">
              <strong className="text-white">Artist:</strong> {songDetailsTrack.artist}
            </p>
            <p className="text-zinc-300">
              <strong className="text-white">Album:</strong> {songDetailsTrack.album}
            </p>
            <p className="text-zinc-300">
              <strong className="text-white">Duration:</strong>{' '}
              {formatMusicDuration(songDetailsTrack.durationSec)}
            </p>
            <p className="text-zinc-300">
              <strong className="text-white">Size:</strong> {songDetailsTrack.sizeMb.toFixed(2)} MB
            </p>
            <p className="text-zinc-300 break-all">
              <strong className="text-white">Folder:</strong> {songDetailsTrack.folderPath}
            </p>
          </div>
        </div>
      )}

      {/* Toast Notification Pill */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] rounded-full bg-[#1C1C26]/95 border border-purple-500/40 px-4 py-2 text-xs font-bold text-white shadow-2xl pointer-events-none">
          {toastMsg}
        </div>
      )}
    </div>
  );
};
