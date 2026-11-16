import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bell,
  Camera,
  Check,
  ChevronDown,
  Clock,
  Disc3,
  Edit3,
  FastForward,
  FileText,
  Heart,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  ListMusic,
  ListPlus,
  MinusCircle,
  MoreVertical,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Scissors,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Star,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { useMusic } from '../../context/MusicContext';
import { SleepTimerMode } from '../../types/music';
import {
  formatMusicDuration,
  getRainbowGradientForTrack,
} from '../../utils/musicUtils';
import { NativeBridgeService } from '../../services/nativeBridgeService';

type ActivePlayerModal =
  | null
  | 'three_dot_menu'
  | 'queue'
  | 'sleep_timer'
  | 'speed'
  | 'add_to_playlist'
  | 'ringtone_editor'
  | 'album_cover'
  | 'home_widget'
  | 'song_info'
  | 'lyrics_viewer';

export const FullScreenMusicPlayer: React.FC = () => {
  const {
    allRawTracks,
    currentTrack,
    queue,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    repeatMode,
    isShuffle,
    volumeBoostPct,
    cycleVolumeBoost,
    isFullScreenPlayerOpen,
    setIsFullScreenPlayerOpen,
    setIsEqualizerOpen,
    editingSongTrack,
    setEditingSongTrack,
    equalizer,
    sleepTimerMode,
    sleepTimerRemainingSec,
    activeQueueSourceLabel,
    playlists,
    togglePlayPause,
    playNextTrack,
    playPreviousTrack,
    seekTo,
    setPlaybackSpeed,
    cyclePlayModeThreeWay,
    setSleepTimer,
    shareTrackFile,
    toggleFavorite,
    updateSongMetadata,
    removeFromQueueIndex,
    moveQueueItem,
    clearQueue,
    jumpToQueueIndex,
    createPlaylist,
    addTracksToPlaylist,
  } = useMusic();

  const [activeModal, setActiveModal] = useState<ActivePlayerModal>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});
  const [toastText, setToastText] = useState<string | null>(null);
  const [showPosterEditOverlay, setShowPosterEditOverlay] = useState(false);

  // Full-Screen "Edit song info" form states (matching `edit song info screen.jpg`)
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editArtworkUrl, setEditArtworkUrl] = useState('');
  const [editLyrics, setEditLyrics] = useState('');

  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const lyricsFileInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const artistInputRef = useRef<HTMLInputElement | null>(null);
  const albumInputRef = useRef<HTMLInputElement | null>(null);

  // Ringtone Editor states
  const [ringStartSec, setRingStartSec] = useState(0);
  const [ringEndSec, setRingEndSec] = useState(30);

  const showToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => setToastText(null), 2400);
  };

  // Sync Edit Song Info fields whenever editingSongTrack opens (always resolving latest edited fields from allRawTracks)
  useEffect(() => {
    if (editingSongTrack) {
      const latest =
        allRawTracks.find(
          (t) =>
            t.id === editingSongTrack.id ||
            (t.mediaId && editingSongTrack.mediaId && t.mediaId === editingSongTrack.mediaId)
        ) || editingSongTrack;
      setEditTitle(latest.title || '');
      setEditArtist(latest.artist || '');
      setEditAlbum(latest.album || '');
      setEditArtworkUrl(latest.artworkUrl || '');
      setEditLyrics(latest.lyrics || '');
    }
  }, [editingSongTrack?.id]);

  useEffect(() => {
    if (currentTrack) {
      const dur = Math.max(10, Math.floor(duration || currentTrack.durationSec || 30));
      setRingStartSec(0);
      setRingEndSec(Math.min(30, dur));
      setShowPosterEditOverlay(false);
    }
  }, [currentTrack?.id, duration]);

  // Listen to Android hardware back button when Edit Song Info or FullScreenMusicPlayer is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingSongTrack) {
          setEditingSongTrack(null);
        } else if (activeModal) {
          setActiveModal(null);
        } else if (isFullScreenPlayerOpen) {
          setIsFullScreenPlayerOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingSongTrack, activeModal, isFullScreenPlayerOpen, setEditingSongTrack, setIsFullScreenPlayerOpen]);

  const compressCoverFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const fallbackRead = () => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      };
      try {
        const objUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          try {
            const maxDim = 480;
            let w = img.naturalWidth || img.width || maxDim;
            let h = img.naturalHeight || img.height || maxDim;
            if (w > maxDim || h > maxDim) {
              if (w >= h) {
                h = Math.max(1, Math.round((h * maxDim) / w));
                w = maxDim;
              } else {
                w = Math.max(1, Math.round((w * maxDim) / h));
                h = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              const compressed = canvas.toDataURL('image/jpeg', 0.82);
              URL.revokeObjectURL(objUrl);
              if (compressed && compressed.startsWith('data:image/')) {
                resolve(compressed);
                return;
              }
            }
          } catch {}
          URL.revokeObjectURL(objUrl);
          fallbackRead();
        };
        img.onerror = () => {
          URL.revokeObjectURL(objUrl);
          fallbackRead();
        };
        img.src = objUrl;
      } catch {
        fallbackRead();
      }
    });
  };

  const handleCoverFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const dataUrl = await compressCoverFileToDataUrl(file);
    if (dataUrl) {
      setEditArtworkUrl(dataUrl);
      const targetId = editingSongTrack?.id || currentTrack?.id;
      if (targetId) {
        setImgFailed((prev) => ({ ...prev, [targetId]: false }));
        if (!editingSongTrack && currentTrack) {
          updateSongMetadata(currentTrack.id, { artworkUrl: dataUrl });
          showToast('Album cover updated!');
        }
      }
    }
  };

  const handleLyricsFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditLyrics(reader.result);
        showToast('Lyrics file loaded!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const focusInputAtEnd = (inputEl: HTMLInputElement | null) => {
    if (!inputEl) return;
    inputEl.focus();
    try {
      const len = inputEl.value.length;
      inputEl.setSelectionRange(len, len);
    } catch {}
  };

  const handleSaveEditSongInfo = () => {
    if (!editingSongTrack) return;
    const finalTitle = editTitle.trim() || editingSongTrack.title;
    const finalArtist = editArtist.trim() || editingSongTrack.artist;
    const finalAlbum = editAlbum.trim() || editingSongTrack.album;
    const finalArtwork = editArtworkUrl || editingSongTrack.artworkUrl;
    const finalLyrics = editLyrics.trim();

    updateSongMetadata(editingSongTrack.id, {
      title: finalTitle,
      artist: finalArtist,
      album: finalAlbum,
      artworkUrl: finalArtwork,
      lyrics: finalLyrics,
    });
    setImgFailed((prev) => ({ ...prev, [editingSongTrack.id]: false }));
    setEditingSongTrack(null);
    showToast('Song info saved!');
  };

  // ============================================================================
  // DEDICATED FULL-SCREEN "EDIT SONG INFO" PAGE (Matching `edit song info screen.jpg`)
  // ============================================================================
  if (editingSongTrack) {
    const hasEditCover = Boolean(editArtworkUrl && !imgFailed[editingSongTrack.id]);
    const rainbowGrad = getRainbowGradientForTrack(editingSongTrack.id);

    return (
      <div
        data-testid="edit-song-info-screen"
        className="fixed inset-0 z-[180] bg-[#0B0B0F] text-white flex flex-col overflow-hidden select-none"
      >
        {/* Hidden Inputs for Cover Image & Local Lyrics File */}
        <input
          ref={coverFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleCoverFilePick}
        />
        <input
          ref={lyricsFileInputRef}
          type="file"
          accept=".lrc,.txt,text/plain"
          className="hidden"
          onChange={handleLyricsFilePick}
        />

        {/* Top Header: < Back on Left | "Edit song info" Center | ✓ Checkmark on Right */}
        <div className="relative flex items-center justify-between px-4 py-3.5 border-b border-white/[0.07]">
          <button
            type="button"
            aria-label="Back from Edit song info"
            onClick={() => setEditingSongTrack(null)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h2 className="text-[17px] font-extrabold text-white tracking-tight">
            Edit song info
          </h2>

          <button
            type="button"
            aria-label="Save song info"
            onClick={handleSaveEditSongInfo}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition cursor-pointer"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-12 space-y-6 max-w-xl mx-auto w-full scrollbar-none">
          {/* Section 1: Album cover + Camera Icon on Right */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-extrabold text-white">Album cover</h3>
              <button
                type="button"
                aria-label="Pick Album Cover"
                onClick={() => coverFileInputRef.current?.click()}
                className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            <div
              onClick={() => coverFileInputRef.current?.click()}
              className="relative w-full aspect-square max-w-[330px] mx-auto rounded-[26px] overflow-hidden border border-white/15 shadow-2xl cursor-pointer group"
            >
              {hasEditCover ? (
                <img
                  src={editArtworkUrl}
                  alt={editTitle || editingSongTrack.title}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-300"
                  onError={() =>
                    setImgFailed((prev) => ({ ...prev, [editingSongTrack.id]: true }))
                  }
                />
              ) : (
                <div
                  className={`w-full h-full bg-gradient-to-br ${rainbowGrad} flex flex-col items-center justify-center p-6 text-center`}
                >
                  <div className="w-20 h-20 rounded-full bg-black/25 backdrop-blur-md border border-white/30 flex items-center justify-center mb-3 shadow-lg">
                    <Music2 className="w-10 h-10 text-white drop-shadow" />
                  </div>
                  <span className="text-sm font-extrabold text-white drop-shadow">
                    Tap to choose album cover
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Song / Artist / Album Editable Rows with Right Pencil-in-Square Icon */}
          <div className="divide-y divide-white/[0.08] border-t border-b border-white/[0.08]">
            {/* Row 1: Song */}
            <div
              onClick={() => focusInputAtEnd(titleInputRef.current)}
              className="flex items-center justify-between gap-3 py-3.5 cursor-text"
            >
              <span className="w-16 text-[15px] font-semibold text-zinc-300 shrink-0">
                Song
              </span>
              <input
                ref={titleInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter song name"
                className="flex-1 min-w-0 bg-transparent text-[15px] text-zinc-100 placeholder-zinc-500 focus:text-white focus:outline-none"
              />
              <button
                type="button"
                aria-label="Edit Song Name"
                onClick={(e) => {
                  e.stopPropagation();
                  focusInputAtEnd(titleInputRef.current);
                }}
                className="p-1.5 text-zinc-400 hover:text-white cursor-pointer shrink-0"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {/* Row 2: Artist */}
            <div
              onClick={() => focusInputAtEnd(artistInputRef.current)}
              className="flex items-center justify-between gap-3 py-3.5 cursor-text"
            >
              <span className="w-16 text-[15px] font-semibold text-zinc-300 shrink-0">
                Artist
              </span>
              <input
                ref={artistInputRef}
                type="text"
                value={editArtist}
                onChange={(e) => setEditArtist(e.target.value)}
                placeholder="Enter artist name"
                className="flex-1 min-w-0 bg-transparent text-[15px] text-zinc-100 placeholder-zinc-500 focus:text-white focus:outline-none"
              />
              <button
                type="button"
                aria-label="Edit Artist Name"
                onClick={(e) => {
                  e.stopPropagation();
                  focusInputAtEnd(artistInputRef.current);
                }}
                className="p-1.5 text-zinc-400 hover:text-white cursor-pointer shrink-0"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {/* Row 3: Album */}
            <div
              onClick={() => focusInputAtEnd(albumInputRef.current)}
              className="flex items-center justify-between gap-3 py-3.5 cursor-text"
            >
              <span className="w-16 text-[15px] font-semibold text-zinc-300 shrink-0">
                Album
              </span>
              <input
                ref={albumInputRef}
                type="text"
                value={editAlbum}
                onChange={(e) => setEditAlbum(e.target.value)}
                placeholder="Enter album name"
                className="flex-1 min-w-0 bg-transparent text-[15px] text-zinc-100 placeholder-zinc-500 focus:text-white focus:outline-none"
              />
              <button
                type="button"
                aria-label="Edit Album Name"
                onClick={(e) => {
                  e.stopPropagation();
                  focusInputAtEnd(albumInputRef.current);
                }}
                className="p-1.5 text-zinc-400 hover:text-white cursor-pointer shrink-0"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Section 3: Lyrics Header + Large Lyrics Box with "Select local lyrics file" */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-extrabold text-white">Lyrics</h3>
              <button
                type="button"
                aria-label="Select local lyrics file"
                onClick={() => lyricsFileInputRef.current?.click()}
                className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <FileText className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#16161E] border border-white/10 p-4 flex flex-col justify-between min-h-[190px]">
              <textarea
                value={editLyrics}
                onChange={(e) => setEditLyrics(e.target.value)}
                placeholder="Paste or type song lyrics here..."
                rows={5}
                className="w-full bg-transparent text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed"
              />
              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => lyricsFileInputRef.current?.click()}
                  className="text-xs sm:text-sm font-semibold text-zinc-400 hover:text-white transition cursor-pointer py-1"
                >
                  Select local lyrics file
                </button>
              </div>
            </div>
          </div>

          {/* Save Button at Bottom for Easy 1-Tap Save on All Phones */}
          <button
            type="button"
            onClick={handleSaveEditSongInfo}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#8E2DE2] to-[#4A00E0] text-white font-extrabold text-sm shadow-lg shadow-[#8E2DE2]/25 active:scale-[0.99] transition cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  if (!isFullScreenPlayerOpen || !currentTrack) return null;

  const effectiveDuration = duration > 0 ? duration : currentTrack.durationSec || 0;
  const progressPct =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))
      : 0;
  const showArt = Boolean(currentTrack.artworkUrl && !imgFailed[currentTrack.id]);
  const rainbowFallbackGradient = getRainbowGradientForTrack(currentTrack.id);

  const sleepOptions: { mode: SleepTimerMode; label: string }[] = [
    { mode: 'off', label: 'Off' },
    { mode: '5', label: '5 minutes' },
    { mode: '10', label: '10 minutes' },
    { mode: '15', label: '15 minutes' },
    { mode: '30', label: '30 minutes' },
    { mode: '45', label: '45 minutes' },
    { mode: '60', label: '60 minutes' },
    { mode: 'end_of_song', label: 'End of current track' },
  ];

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  const handleShareSongFile = async () => {
    setActiveModal(null);
    const shared = await shareTrackFile(currentTrack);
    if (!shared) {
      showToast('Sharing song...');
    }
  };

  const handleThreeWayModeClick = () => {
    if (isShuffle) {
      cyclePlayModeThreeWay();
      showToast('Repeat all songs');
    } else if (repeatMode === 'all' || repeatMode === 'off') {
      cyclePlayModeThreeWay();
      showToast('Repeat current song');
    } else {
      cyclePlayModeThreeWay();
      showToast('Shuffle playback');
    }
  };

  return (
    <div
      data-testid="fullscreen-music-player"
      className="fixed inset-0 z-[105] bg-[#0B0B10] text-white flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Hidden Cover File Picker */}
      <input
        ref={coverFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverFilePick}
      />

      {/* Soft Ambient Atmospheric Glow */}
      <div className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[440px] h-[440px] rounded-full bg-gradient-to-b from-[#7C3AED]/30 via-[#9333EA]/12 to-transparent blur-3xl" />

      {/* Toast Notice */}
      {toastText && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[160] px-4 py-2 rounded-full bg-[#7C3AED] text-white text-xs font-bold shadow-xl">
          {toastText}
        </div>
      )}

      {/* ========================================================================
          TOP BAR (Matching `music details screen.jpg`:
          - Left: Minimize ChevronDown
          - Center: Perfectly centered "NOW PLAYING" + Volume Boost (100% / 200% / 300%)
          - Right: Equaliser Icon + 3-Dot Menu (T-Shirt icon completely removed!)
      ======================================================================== */}
      <div className="relative z-10 grid grid-cols-3 items-center px-4 pt-4 pb-2">
        {/* Left: Minimize Button */}
        <div className="flex items-center justify-start">
          <button
            type="button"
            aria-label="Minimize Player"
            onClick={() => setIsFullScreenPlayerOpen(false)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>

        {/* Center: Perfectly Centered "NOW PLAYING" + Volume Boost Pill (100% / 200% / 300%) */}
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-xs font-extrabold tracking-wider uppercase text-white">
            NOW PLAYING
          </span>
          <button
            type="button"
            aria-label="Volume Boost"
            onClick={() => {
              cycleVolumeBoost();
              const nextBoost =
                volumeBoostPct === 100 ? 200 : volumeBoostPct === 200 ? 300 : 100;
              showToast(`Volume Boost: ${nextBoost}%`);
            }}
            className={`mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide border transition cursor-pointer ${
              volumeBoostPct > 100
                ? 'bg-[#9333EA]/30 border-[#A855F7] text-[#E9D5FF] shadow-[0_0_12px_rgba(168,85,247,0.45)]'
                : 'bg-white/[0.07] border-white/15 text-zinc-300 hover:text-white'
            }`}
            title="Tap to boost volume (100% / 200% / 300%)"
          >
            <Volume2 className="w-3 h-3 text-[#A855F7]" />
            <span>{volumeBoostPct}%</span>
          </button>
        </div>

        {/* Right: Equaliser Sliders + 3-Dot Menu (No T-Shirt Icon) */}
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            aria-label="Open Equaliser"
            onClick={() => setIsEqualizerOpen(true)}
            className={`w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition cursor-pointer ${
              equalizer.enabled ? 'text-[#B517FF]' : 'text-zinc-200'
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>

          <button
            type="button"
            aria-label="Track Options"
            onClick={() => setActiveModal('three_dot_menu')}
            className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ========================================================================
          CENTER LARGE ALBUM ARTWORK
          - Tapping the artwork toggles a dimmed overlay with an "Add / Edit" button
            that opens the full-screen Edit song info page!
          - Uses vibrant rainbow/accent gradient fallback when no cover is set.
      ======================================================================== */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-2 min-h-0">
        <div
          onClick={() => setShowPosterEditOverlay((prev) => !prev)}
          className="relative w-full max-w-[330px] aspect-square rounded-[28px] overflow-hidden border border-white/15 shadow-[0_24px_64px_rgba(0,0,0,0.75)] flex items-center justify-center cursor-pointer group"
        >
          {showArt ? (
            <img
              src={currentTrack.artworkUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={() =>
                setImgFailed((prev) => ({ ...prev, [currentTrack.id]: true }))
              }
            />
          ) : (
            <div
              className={`w-full h-full bg-gradient-to-br ${rainbowFallbackGradient} flex flex-col items-center justify-center text-center p-6`}
            >
              <div className="w-24 h-24 rounded-full bg-black/25 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl mb-4">
                <Disc3
                  className={`w-12 h-12 text-white ${
                    isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''
                  }`}
                />
              </div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-white drop-shadow">
                MaxPlay Music
              </span>
              <span className="text-[11px] font-medium text-white/85 mt-1 drop-shadow">
                {currentTrack.format || 'MP3'} • Tap cover to edit info
              </span>
            </div>
          )}

          {/* Dimmed Overlay on Tap -> Shows "+ Add" / Edit Song Info Button */}
          {showPosterEditOverlay && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setShowPosterEditOverlay(false);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-[3px] flex flex-col items-center justify-center gap-2 transition-opacity"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPosterEditOverlay(false);
                  setEditingSongTrack(currentTrack);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 hover:bg-white/30 border border-white/40 text-white text-sm font-extrabold shadow-2xl active:scale-95 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.8]" />
                <span>Add</span>
              </button>
              <span className="text-[11px] font-medium text-white/80">
                Edit cover, song title &amp; lyrics
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================
          BOTTOM SPACIOUS CONTROLS AREA (Matching `music details screen.jpg`)
      ======================================================================== */}
      <div className="relative z-10 px-6 pb-9 pt-2 flex flex-col gap-5 max-w-xl mx-auto w-full">
        {/* Song Title, Artist, Lyrics Row ("No lyrics [ Add ]") & Favourite Star/Heart */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white truncate leading-tight">
              {currentTrack.title}
            </h2>
            <p className="text-sm text-[#A0A0AB] truncate mt-1">
              {currentTrack.artist}
            </p>

            {/* Lyrics Status Row matching `music details screen.jpg` */}
            <div className="mt-2.5 flex items-center gap-2.5">
              {currentTrack.lyrics && currentTrack.lyrics.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveModal('lyrics_viewer')}
                  className="flex items-center gap-2 text-xs text-purple-300 hover:text-white truncate max-w-[260px] cursor-pointer"
                >
                  <span className="truncate">
                    {currentTrack.lyrics.trim().split('\n')[0]}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full border border-purple-400/40 bg-purple-500/15 text-[11px] font-bold text-purple-200 shrink-0">
                    Lyrics
                  </span>
                </button>
              ) : (
                <>
                  <span className="text-xs font-medium text-[#71717A]">
                    No lyrics
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingSongTrack(currentTrack)}
                    className="px-3 py-0.5 rounded-full border border-white/25 bg-white/[0.04] hover:bg-white/10 text-xs font-semibold text-zinc-200 active:scale-95 transition cursor-pointer"
                  >
                    Add
                  </button>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            aria-label="Toggle Favorite"
            onClick={() => toggleFavorite(currentTrack.id)}
            className="mt-1 w-11 h-11 rounded-full flex items-center justify-center text-zinc-300 hover:text-white active:scale-90 transition cursor-pointer shrink-0"
          >
            <Star
              className={`w-6 h-6 transition ${
                currentTrack.isFavorite
                  ? 'fill-[#A855F7] text-[#A855F7] drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]'
                  : 'text-zinc-400'
              }`}
            />
          </button>
        </div>

        {/* Interactive Seek Bar */}
        <div className="flex flex-col gap-2">
          <div className="relative w-full h-6 flex items-center">
            <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#7C3AED] via-[#9333EA] to-[#B517FF] rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <input
              type="range"
              aria-label="Seek Audio Position"
              min={0}
              max={effectiveDuration || 100}
              step={0.5}
              value={Math.min(currentTime, effectiveDuration || 100)}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div
              className="pointer-events-none absolute w-3.5 h-3.5 rounded-full bg-[#A855F7] shadow-[0_0_10px_#B517FF] border-2 border-white"
              style={{ left: `calc(${progressPct}% - 7px)` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs font-medium text-[#A0A0AB] tabular-nums">
            <span>{formatMusicDuration(currentTime)}</span>
            <span>{formatMusicDuration(effectiveDuration)}</span>
          </div>
        </div>

        {/* ====================================================================
            SPACIOUS 5-BUTTON TRANSPORT ROW (Matching `music details screen.jpg`):
            1. Left: 1-Button 3-Mode Cycle (Repeat All -> Repeat One -> Shuffle)
            2. Previous Track
            3. Center Large Play/Pause Circle
            4. Next Track
            5. Right: Playing Queue Button (`ListMusic`)
        ==================================================================== */}
        <div className="flex items-center justify-between px-2 pt-1">
          {/* 1. Leftmost: 1-Button 3-Mode Cycle (Repeat All / Repeat One / Shuffle) */}
          <button
            type="button"
            aria-label="Cycle Play Mode (Repeat All / Repeat One / Shuffle)"
            onClick={handleThreeWayModeClick}
            className="w-12 h-12 rounded-full flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 active:scale-90 transition cursor-pointer"
            title={
              isShuffle
                ? 'Shuffle playback'
                : repeatMode === 'one'
                ? 'Repeat current song'
                : 'Repeat all songs'
            }
          >
            {isShuffle ? (
              <Shuffle className="w-6 h-6 text-[#B517FF]" />
            ) : repeatMode === 'one' ? (
              <Repeat1 className="w-6 h-6 text-[#B517FF]" />
            ) : (
              <Repeat className="w-6 h-6 text-zinc-200" />
            )}
          </button>

          {/* 2. Previous Track */}
          <button
            type="button"
            aria-label="Previous Track"
            onClick={playPreviousTrack}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-90 transition cursor-pointer"
          >
            <SkipBack className="w-7 h-7 fill-current" />
          </button>

          {/* 3. Center Play / Pause */}
          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={togglePlayPause}
            className="w-[70px] h-[70px] rounded-full bg-gradient-to-tr from-[#6A11CB] via-[#8E2DE2] to-[#B517FF] text-white flex items-center justify-center shadow-[0_0_34px_rgba(142,45,226,0.65)] hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>

          {/* 4. Next Track */}
          <button
            type="button"
            aria-label="Next Track"
            onClick={playNextTrack}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-90 transition cursor-pointer"
          >
            <SkipForward className="w-7 h-7 fill-current" />
          </button>

          {/* 5. Rightmost: Queue Button (replaces old repeat button) */}
          <button
            type="button"
            aria-label="Open Playing Queue"
            onClick={() => setActiveModal('queue')}
            className="relative w-12 h-12 rounded-full flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 active:scale-90 transition cursor-pointer"
            title="Playing Queue"
          >
            <ListMusic className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* ========================================================================
          MODAL 1: 3-DOT SETTINGS SHEET (Contains Equaliser, Sleep Timer, Speed,
          Edit Song Info, Share Song File, Song File Info, etc.)
      ======================================================================== */}
      {activeModal === 'three_dot_menu' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[82vh] overflow-y-auto rounded-t-[28px] bg-[#16161D] border-t border-white/15 px-5 pt-4 pb-8 flex flex-col gap-1 shadow-2xl scrollbar-none"
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2" />

            <button
              type="button"
              onClick={() => setActiveModal('add_to_playlist')}
              className="flex items-center gap-4 px-3 py-3 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <ListPlus className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Add to playlist</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveModal(null);
                setIsEqualizerOpen(true);
              }}
              className="flex items-center justify-between px-3 py-3 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <SlidersHorizontal className="w-5 h-5 text-[#B517FF] shrink-0" />
                <span className="text-[15px] font-semibold text-white">Equaliser</span>
              </div>
              <span className="text-xs font-bold text-[#B517FF]">
                {equalizer.enabled ? equalizer.preset : 'Off'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('sleep_timer')}
              className="flex items-center justify-between px-3 py-3 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <Clock className="w-5 h-5 text-zinc-200 shrink-0" />
                <span className="text-[15px] font-semibold text-white">Sleep timer</span>
              </div>
              {sleepTimerMode !== 'off' && (
                <span className="text-xs font-bold text-[#B517FF]">
                  {sleepTimerMode === 'end_of_song'
                    ? 'End of song'
                    : sleepTimerRemainingSec !== null
                    ? formatMusicDuration(sleepTimerRemainingSec)
                    : `${sleepTimerMode}m`}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('speed')}
              className="flex items-center justify-between px-3 py-3 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <FastForward className="w-5 h-5 text-zinc-200 shrink-0" />
                <span className="text-[15px] font-semibold text-white">Playback speed</span>
              </div>
              <span className="text-xs font-bold text-zinc-400 tabular-nums">
                {playbackSpeed}x
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('ringtone_editor')}
              className="flex items-center gap-4 px-3 py-3 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <Bell className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Ringtone editor</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveModal(null);
                setEditingSongTrack(currentTrack);
              }}
              className="flex items-center gap-4 px-3 py-3 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <Pencil className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Edit song info</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('album_cover')}
              className="flex items-center gap-4 px-3 py-3 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <ImageIcon className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Current album cover</span>
            </button>

            <button
              type="button"
              onClick={handleShareSongFile}
              className="flex items-center gap-4 px-3 py-3 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <Share2 className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Share</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('song_info')}
              className="flex items-center gap-4 px-3 py-3 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <Info className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">About / Song info</span>
            </button>

            <button
              type="button"
              onClick={() => {
                removeFromQueueIndex(currentIndex);
                setActiveModal(null);
                showToast('Removed from queue');
              }}
              className="flex items-center gap-4 px-3 py-3 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <MinusCircle className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Remove from queue</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('home_widget')}
              className="flex items-center gap-4 px-3 py-3 rounded-2xl hover:bg-white/5 text-left transition cursor-pointer"
            >
              <LayoutGrid className="w-5 h-5 text-zinc-200 shrink-0" />
              <span className="text-[15px] font-semibold text-white">Home screen widget</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 2: LYRICS VIEWER
      ======================================================================== */}
      {activeModal === 'lyrics_viewer' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[75vh] rounded-t-3xl bg-[#16161D] border-t border-white/15 p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Lyrics</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setEditingSongTrack(currentTrack);
                  }}
                  className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-purple-300 hover:bg-white/15 cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto whitespace-pre-line text-sm text-zinc-200 leading-relaxed py-2">
              {currentTrack.lyrics || 'No lyrics added yet.'}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 3: RINGTONE EDITOR
      ======================================================================== */}
      {activeModal === 'ringtone_editor' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#16161D] border-t border-white/15 p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-[#B517FF]" />
                <h3 className="text-base font-extrabold text-white">Ringtone editor</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Select the start and end range for{' '}
              <strong className="text-white">{currentTrack.title}</strong> to preview and save as a
              ringtone clip.
            </p>

            <div className="rounded-2xl bg-black/40 border border-white/10 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-bold text-purple-300 tabular-nums">
                <span>Start: {formatMusicDuration(ringStartSec)}</span>
                <span>Clip Length: {Math.max(1, ringEndSec - ringStartSec)}s</span>
                <span>End: {formatMusicDuration(ringEndSec)}</span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] text-zinc-400">Start Time</label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, (effectiveDuration || 60) - 5)}
                  value={ringStartSec}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setRingStartSec(v);
                    if (ringEndSec <= v) setRingEndSec(Math.min(effectiveDuration || 60, v + 15));
                  }}
                  className="w-full accent-[#8B5CF6]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] text-zinc-400">End Time</label>
                <input
                  type="range"
                  min={ringStartSec + 5}
                  max={Math.max(ringStartSec + 5, effectiveDuration || 60)}
                  value={ringEndSec}
                  onChange={(e) => setRingEndSec(Number(e.target.value))}
                  className="w-full accent-[#8B5CF6]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  seekTo(ringStartSec);
                  if (!isPlaying) togglePlayPause();
                }}
                className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition cursor-pointer"
              >
                Preview Clip
              </button>
              <button
                type="button"
                onClick={() => {
                  showToast(
                    `Ringtone saved (${formatMusicDuration(ringStartSec)} - ${formatMusicDuration(ringEndSec)})!`
                  );
                  setActiveModal(null);
                }}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white text-xs font-bold shadow-lg shadow-purple-700/30 transition cursor-pointer"
              >
                Save Ringtone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 4: CURRENT ALBUM COVER
      ======================================================================== */}
      {activeModal === 'album_cover' && (
        <div
          className="fixed inset-0 z-[115] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#16161D] border border-white/15 p-5 flex flex-col items-center gap-4"
          >
            <div className="w-full flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Current album cover</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`w-60 h-60 rounded-2xl overflow-hidden bg-gradient-to-br ${rainbowFallbackGradient} border border-white/15 flex items-center justify-center`}
            >
              {showArt ? (
                <img
                  src={currentTrack.artworkUrl}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc3 className="w-20 h-20 text-white/90" />
              )}
            </div>

            <button
              type="button"
              onClick={() => coverFileInputRef.current?.click()}
              className="w-full py-3 rounded-2xl bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D28D9] transition cursor-pointer"
            >
              Choose New Album Cover from Device
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 5: HOME SCREEN & NOTIFICATION WIDGET PREVIEW
      ======================================================================== */}
      {activeModal === 'home_widget' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#16161D] border-t border-white/15 p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">
                Notification &amp; Lock-Screen Widget
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              MaxPlay displays 5 controls on your Android Lock Screen &amp; Notification Shade:
              Repeat/Shuffle cycle on the left, Previous, Play/Pause, Next, and Favourite Heart on
              the right.
            </p>

            {/* Live Interactive Android Notification Shade Preview Card */}
            <div className="rounded-2xl bg-gradient-to-r from-[#281845] via-[#1E1633] to-[#161426] border border-purple-400/30 p-4 shadow-xl flex flex-col gap-3">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br ${rainbowFallbackGradient} shrink-0 flex items-center justify-center border border-white/15`}
                >
                  {showArt ? (
                    <img
                      src={currentTrack.artworkUrl}
                      alt={currentTrack.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Disc3 className="w-7 h-7 text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
                    MaxPlay Music • Lock Screen &amp; Notification
                  </span>
                  <p className="text-sm font-extrabold text-white truncate">
                    {currentTrack.title}
                  </p>
                  <p className="text-xs text-zinc-300 truncate">{currentTrack.artist}</p>
                </div>
              </div>

              {/* 5 Controls Preview: Repeat/Shuffle (Left) | Prev | Play/Pause | Next | Favourite (Right) */}
              <div className="flex items-center justify-between px-2 pt-1 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleThreeWayModeClick}
                  className="p-2 rounded-full bg-white/10 text-white cursor-pointer"
                  title="Repeat / Shuffle Cycle"
                >
                  {isShuffle ? (
                    <Shuffle className="w-4 h-4 text-[#B517FF]" />
                  ) : repeatMode === 'one' ? (
                    <Repeat1 className="w-4 h-4 text-[#B517FF]" />
                  ) : (
                    <Repeat className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={playPreviousTrack}
                  className="p-2 rounded-full bg-white/10 text-white cursor-pointer"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="p-2.5 rounded-full bg-white text-black cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={playNextTrack}
                  className="p-2 rounded-full bg-white/10 text-white cursor-pointer"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(currentTrack.id)}
                  className="p-2 rounded-full bg-white/10 text-white cursor-pointer"
                  title="Favourite"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      currentTrack.isFavorite ? 'fill-[#B517FF] text-[#B517FF]' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                NativeBridgeService.requestBackgroundDownloadAndNotificationPermissions();
                NativeBridgeService.updateMusicNotificationNative({
                  title: currentTrack.title,
                  artist: currentTrack.artist,
                  album: currentTrack.album,
                  isPlaying,
                  artworkUrl: currentTrack.artworkUrl,
                  durationSec: effectiveDuration,
                  positionSec: currentTime,
                  isFavorite: Boolean(currentTrack.isFavorite),
                  playMode: isShuffle
                    ? 'shuffle'
                    : repeatMode === 'one'
                    ? 'repeat_one'
                    : 'repeat_all',
                });
                showToast('Notification & Lock-Screen Widget synced!');
                setActiveModal(null);
              }}
              className="w-full py-3 rounded-2xl bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D28D9] transition cursor-pointer"
            >
              Sync Android Notification &amp; Lock-Screen Widget Now
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 6: UP NEXT QUEUE
      ======================================================================== */}
      {activeModal === 'queue' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[78vh] rounded-t-3xl bg-[#141418] border-t border-white/15 p-5 flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-extrabold text-white">Playing Queue</h3>
                <p className="text-xs text-[#A0A0AB]">
                  {queue.length} songs • {activeQueueSourceLabel}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {queue.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearQueue();
                      setActiveModal(null);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/15 text-red-300 text-xs font-semibold hover:bg-red-500/25 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-1.5 scrollbar-none">
              {queue.map((item, idx) => {
                const isCurrent = idx === currentIndex;
                return (
                  <div
                    key={`${item.id}-${idx}`}
                    onClick={() => jumpToQueueIndex(idx)}
                    className={`flex items-center justify-between gap-2.5 p-2.5 rounded-2xl border transition cursor-pointer ${
                      isCurrent
                        ? 'bg-[#8E2DE2]/20 border-[#B517FF]/50'
                        : 'bg-[#1C1C22]/70 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-bold truncate ${
                          isCurrent ? 'text-[#B517FF]' : 'text-white'
                        }`}
                      >
                        {idx + 1}. {item.title}
                      </p>
                      <p className="text-[11px] text-[#A0A0AB] truncate">
                        {item.artist} • {formatMusicDuration(item.durationSec)}
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {idx > 0 && (
                        <button
                          type="button"
                          aria-label="Move Up"
                          onClick={() => moveQueueItem(idx, idx - 1)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {idx < queue.length - 1 && (
                        <button
                          type="button"
                          aria-label="Move Down"
                          onClick={() => moveQueueItem(idx, idx + 1)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="Remove from Queue"
                        onClick={() => removeFromQueueIndex(idx)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-white/10 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 7: SLEEP TIMER
      ======================================================================== */}
      {activeModal === 'sleep_timer' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#141418] border-t border-white/15 p-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Sleep Timer</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {sleepOptions.map((opt) => (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => {
                    setSleepTimer(opt.mode);
                    setActiveModal(null);
                  }}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-2xl border text-xs font-bold transition cursor-pointer ${
                    sleepTimerMode === opt.mode
                      ? 'bg-[#8E2DE2]/25 border-[#B517FF] text-white'
                      : 'bg-[#1C1C22] border-white/5 text-zinc-300 hover:border-white/15'
                  }`}
                >
                  <span>{opt.label}</span>
                  {sleepTimerMode === opt.mode && <Check className="w-4 h-4 text-[#B517FF]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 8: PLAYBACK SPEED
      ======================================================================== */}
      {activeModal === 'speed' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#141418] border-t border-white/15 p-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Playback Speed</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5 mt-4">
              {speedOptions.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => {
                    setPlaybackSpeed(sp);
                    setActiveModal(null);
                  }}
                  className={`py-3 rounded-2xl border text-xs font-bold transition cursor-pointer tabular-nums ${
                    playbackSpeed === sp
                      ? 'bg-[#8E2DE2]/25 border-[#B517FF] text-white'
                      : 'bg-[#1C1C22] border-white/5 text-zinc-300 hover:border-white/15'
                  }`}
                >
                  {sp}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 9: ADD TO PLAYLIST
      ======================================================================== */}
      {activeModal === 'add_to_playlist' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#141418] border-t border-white/15 p-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Add to Playlist</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <input
                type="text"
                placeholder="New playlist name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="flex-1 bg-[#1C1C22] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#B517FF]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newPlaylistName.trim()) return;
                  createPlaylist(newPlaylistName, [currentTrack.id]);
                  setNewPlaylistName('');
                  setActiveModal(null);
                  showToast('Added to new playlist!');
                }}
                className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#6A11CB] to-[#8E2DE2] text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create</span>
              </button>
            </div>

            <div className="mt-3 max-h-56 overflow-y-auto space-y-1.5 scrollbar-none">
              {playlists.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">
                  No custom playlists yet. Create one above.
                </p>
              ) : (
                playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => {
                      addTracksToPlaylist(pl.id, [currentTrack.id]);
                      setActiveModal(null);
                      showToast(`Added to "${pl.name}"`);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-[#1C1C22] hover:bg-white/10 border border-white/5 text-left transition cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{pl.name}</p>
                      <p className="text-[10px] text-[#A0A0AB]">{pl.trackIds.length} songs</p>
                    </div>
                    {pl.trackIds.includes(currentTrack.id) && (
                      <Check className="w-4 h-4 text-[#B517FF]" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 10: SONG TECHNICAL INFO
      ======================================================================== */}
      {activeModal === 'song_info' && (
        <div
          className="fixed inset-0 z-[115] bg-black/75 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-[#141418] border-t border-white/15 p-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-extrabold text-white">Song Information</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A0A0AB]">Title</span>
                <span className="text-white font-semibold text-right truncate">
                  {currentTrack.title}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A0A0AB]">Artist</span>
                <span className="text-white font-semibold text-right truncate">
                  {currentTrack.artist}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A0A0AB]">Album</span>
                <span className="text-white font-semibold text-right truncate">
                  {currentTrack.album}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A0A0AB]">Duration</span>
                <span className="text-white font-semibold tabular-nums">
                  {formatMusicDuration(effectiveDuration)}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
                <span className="text-[#A0A0AB]">Format &amp; Size</span>
                <span className="text-white font-semibold tabular-nums">
                  {currentTrack.format} • {currentTrack.sizeMb} MB
                </span>
              </div>
              <div className="flex flex-col gap-1 py-1.5">
                <span className="text-[#A0A0AB]">Folder Path</span>
                <span className="text-zinc-300 font-mono text-[11px] break-all">
                  {currentTrack.folderPath}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
