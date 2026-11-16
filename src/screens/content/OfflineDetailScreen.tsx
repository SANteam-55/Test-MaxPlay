import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Film,
  Tv,
  ChevronRight,
  HelpCircle,
  X,
  Star,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DownloadedFile, downloadManager } from '../../services/DownloadManager';
import { InlinePlayer } from '../../components/player/InlinePlayer';
import { NativeBanner } from '../../components/ads/NativeBanner';
import { ContentCard } from '../../components/common/ContentCard';
import { useContent } from '../../hooks/useContent';
import { ContentItem } from '../../types';

interface OfflineDetailScreenProps {
  initialFile: DownloadedFile;
  initialBlobUrl?: string;
  allDownloadedEpisodes?: DownloadedFile[];
  onBack: () => void;
  onSelectContent?: (content: ContentItem) => void;
}

const OFFLINE_VIDEO_PROGRESS_KEY = 'maxplay_offline_video_progress_v1';

function getOfflineVideoKey(file: DownloadedFile): string {
  return String(file.storageKey || file.id || file.videoUrl || file.title || 'unknown');
}

function loadOfflineVideoSavedTime(file: DownloadedFile): number {
  try {
    const raw = localStorage.getItem(OFFLINE_VIDEO_PROGRESS_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, { time: number; duration?: number; updatedAt: number }>;
    const key = getOfflineVideoKey(file);
    const entry = map[key];
    if (!entry || typeof entry.time !== 'number' || entry.time < 2) return 0;
    if (entry.duration && entry.duration > 15 && entry.duration - entry.time < 6) {
      return 0;
    }
    return entry.time;
  } catch {
    return 0;
  }
}

function saveOfflineVideoProgress(file: DownloadedFile, timeSec: number, durationSec?: number): void {
  if (!Number.isFinite(timeSec) || timeSec < 1) return;
  try {
    const raw = localStorage.getItem(OFFLINE_VIDEO_PROGRESS_KEY);
    const map: Record<string, { time: number; duration?: number; updatedAt: number }> = raw
      ? JSON.parse(raw)
      : {};
    const key = getOfflineVideoKey(file);
    // If user finished watching (> 97%), reset saved position to 0
    if (durationSec && durationSec > 20 && timeSec / durationSec >= 0.97) {
      delete map[key];
    } else {
      map[key] = {
        time: Math.floor(timeSec),
        duration: durationSec && Number.isFinite(durationSec) ? Math.floor(durationSec) : map[key]?.duration,
        updatedAt: Date.now(),
      };
    }
    localStorage.setItem(OFFLINE_VIDEO_PROGRESS_KEY, JSON.stringify(map));
  } catch {}
}

export const OfflineDetailScreen: React.FC<OfflineDetailScreenProps> = ({
  initialFile,
  initialBlobUrl,
  allDownloadedEpisodes = [],
  onBack,
  onSelectContent,
}) => {
  const { contentList } = useContent();

  const [currentFile, setCurrentFile] = useState<DownloadedFile>(initialFile);
  const [currentBlobUrl, setCurrentBlobUrl] = useState<string | undefined>(initialBlobUrl);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showAllEpisodesDrawer, setShowAllEpisodesDrawer] = useState(false);
  const [showHelpConfirmTooltip, setShowHelpConfirmTooltip] = useState(false);
  const [isRefreshingRecs, setIsRefreshingRecs] = useState(false);
  const [recSeed, setRecSeed] = useState(1);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const savedInitialTime = useMemo(() => loadOfflineVideoSavedTime(currentFile), [currentFile]);

  const isLocalDeviceVideo =
    currentFile.category === 'local' ||
    String(currentFile.id || '').startsWith('dev_vid_') ||
    String(currentFile.storageKey || '').startsWith('dev_vid_');

  // Match catalog content item ONLY if this offline download came from MaxPlay catalog (never for local phone videos)
  const matchedCatalogItem = useMemo(() => {
    if (isLocalDeviceVideo) return null;
    if (!contentList || contentList.length === 0) return null;
    if (currentFile.contentId && !currentFile.contentId.startsWith('dev_vid_')) {
      const byId = contentList.find((c) => c.id === currentFile.contentId);
      if (byId) return byId;
    }
    const cleanTitle = (currentFile.title || '').toLowerCase().trim();
    return contentList.find((c) => (c.title || '').toLowerCase().trim() === cleanTitle) || null;
  }, [contentList, currentFile, isLocalDeviceVideo]);

  useEffect(() => {
    // Pause any background video players in other tabs so Android hardware MediaCodec decoders are freed
    try {
      document.querySelectorAll('video').forEach((v) => {
        try {
          v.pause();
        } catch {}
      });
    } catch {}
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const fetchUrl = async () => {
      try {
        if (currentFile.videoUrl && currentFile.videoUrl.includes('/device-video/')) {
          if (!isCancelled) {
            setCurrentBlobUrl(currentFile.videoUrl);
          }
          return;
        }
        const url = await downloadManager.getOfflineVideoUrl(
          currentFile.id,
          currentFile.episodeId,
          currentFile.episodeIndex
        );
        if (!isCancelled && url) {
          setCurrentBlobUrl(url);
        } else if (!isCancelled && currentFile.videoUrl) {
          setCurrentBlobUrl(currentFile.videoUrl);
        }
      } catch (err) {
        console.warn('Failed to load blobUrl in OfflineDetailScreen:', err);
      }
    };

    fetchUrl();

    return () => {
      isCancelled = true;
    };
  }, [currentFile]);

  // Determine if this item is a single movie vs multi-episode series / multi-video folder
  const isMovie = useMemo(() => {
    if (allDownloadedEpisodes && allDownloadedEpisodes.length > 1) {
      return false;
    }
    return (
      currentFile.category === 'movie' ||
      (!currentFile.episodeId && currentFile.episodeIndex === undefined)
    );
  }, [currentFile, allDownloadedEpisodes]);

  // Extract and sort downloaded episodes in ascending numeric order (1, 2, 3...)
  const sortedEpisodes = useMemo(() => {
    if (!allDownloadedEpisodes || allDownloadedEpisodes.length <= 1) {
      if (!isMovie && allDownloadedEpisodes.length === 1) return allDownloadedEpisodes;
      return [];
    }

    const getEpisodeNumber = (ep: DownloadedFile, idx: number): number => {
      if (ep.episodeIndex !== undefined) return ep.episodeIndex + 1;
      const numMatch = ep.episodeId?.match(/\d+/);
      if (numMatch) return parseInt(numMatch[0], 10);
      const titleMatch =
        ep.subtitle?.match(/episode\s*(\d+)/i) || ep.title?.match(/episode\s*(\d+)/i);
      if (titleMatch) return parseInt(titleMatch[1], 10);
      return idx + 1;
    };

    return [...allDownloadedEpisodes].sort((a, b) => {
      return getEpisodeNumber(a, 0) - getEpisodeNumber(b, 0);
    });
  }, [isMovie, allDownloadedEpisodes]);

  const currentEpIndex = useMemo(() => {
    if (sortedEpisodes.length === 0) return -1;
    return sortedEpisodes.findIndex(
      (e) => e.id === currentFile.id || (e.storageKey && e.storageKey === currentFile.storageKey)
    );
  }, [sortedEpisodes, currentFile]);

  const hasNextEpisode = currentEpIndex >= 0 && currentEpIndex < sortedEpisodes.length - 1;

  const handleSelectEpisode = async (ep: DownloadedFile) => {
    try {
      setCurrentFile(ep);
      if (ep.videoUrl && ep.videoUrl.includes('/device-video/')) {
        setCurrentBlobUrl(ep.videoUrl);
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const url = await downloadManager.getOfflineVideoUrl(ep.id, ep.episodeId, ep.episodeIndex);
      if (url) {
        setCurrentBlobUrl(url);
      } else if (ep.videoUrl) {
        setCurrentBlobUrl(ep.videoUrl);
      }
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.warn('Failed to switch offline episode:', err);
    }
  };

  const handleNextEpisode = () => {
    if (hasNextEpisode) {
      handleSelectEpisode(sortedEpisodes[currentEpIndex + 1]);
    }
  };

  const getEpLabel = (ep: DownloadedFile, idx?: number): string => {
    if (ep.episodeIndex !== undefined) {
      return (ep.episodeIndex + 1).toString().padStart(2, '0');
    }
    const numMatch = ep.episodeId?.match(/\d+/);
    if (numMatch) {
      return parseInt(numMatch[0], 10).toString().padStart(2, '0');
    }
    if (idx !== undefined) {
      return (idx + 1).toString().padStart(2, '0');
    }
    return '01';
  };

  const playerTitle = useMemo(() => {
    if (isMovie || sortedEpisodes.length <= 1) {
      return currentFile.title;
    }
    const epNum = getEpLabel(currentFile, currentEpIndex >= 0 ? currentEpIndex : 0);
    return `${currentFile.title} • Ep ${epNum}`;
  }, [isMovie, currentFile, sortedEpisodes.length, currentEpIndex]);

  // Real Recommendations from catalog for the "For you" section
  const recommendations = useMemo(() => {
    if (!contentList || contentList.length === 0) return [];
    const mockIds = new Set([
      'one-piece-egghead',
      'naruto-shippuden-classic',
      'avatar-way-of-water',
      'dune-part-two',
      'stranger-things-s5',
      'breaking-bad-remastered',
      'solo-leveling-arise',
    ]);
    const pool = contentList.filter(
      (c) =>
        c.id !== currentFile.contentId &&
        !mockIds.has(c.id) &&
        !(c.posterUrl && c.posterUrl.includes('images.unsplash.com'))
    );
    const list = pool.length > 0 ? [...pool] : [...contentList];
    let seed = Math.max(1, recSeed) * 9301 + 49297;
    for (let i = list.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor((seed / 233280) * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list.slice(0, 12);
  }, [contentList, currentFile.contentId, recSeed]);

  const handleRefreshRecs = () => {
    setIsRefreshingRecs(true);
    setTimeout(() => {
      setRecSeed((prev) => prev + 1);
      setIsRefreshingRecs(false);
    }, 350);
  };

  const sizeFormatted =
    currentFile.fileSizeMb >= 1024
      ? `${(currentFile.fileSizeMb / 1024).toFixed(1)} GB`
      : `${Math.round(currentFile.fileSizeMb || 0)} MB`;

  // Only show real rating if it came from a MaxPlay catalog download (never show fake ratings or ratings on local files)
  const realCatalogRating =
    !isLocalDeviceVideo && matchedCatalogItem?.rating && Number(matchedCatalogItem.rating) > 0
      ? String(matchedCatalogItem.rating)
      : null;

  const yearOrSize = !isLocalDeviceVideo && matchedCatalogItem?.year ? matchedCatalogItem.year : sizeFormatted;
  const countryOrFolder =
    !isLocalDeviceVideo && matchedCatalogItem?.country
      ? matchedCatalogItem.country
      : isLocalDeviceVideo
      ? currentFile.language || 'Phone Storage'
      : sizeFormatted;
  const genresText =
    !isLocalDeviceVideo && matchedCatalogItem?.genres && matchedCatalogItem.genres.length > 0
      ? matchedCatalogItem.genres.join(' / ')
      : isLocalDeviceVideo
      ? 'Local Video'
      : isMovie
      ? 'Movie'
      : 'Series';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#09090B] text-white overflow-hidden select-none">
      {/* 1. STICKY TOP VIDEO PLAYER SECTION */}
      <div className="w-full bg-black shrink-0 relative z-30 shadow-2xl">
        <div className="w-full max-w-5xl mx-auto aspect-video max-h-[48vh] sm:max-h-[55vh]">
          <InlinePlayer
            title={playerTitle}
            posterUrl={
              matchedCatalogItem?.backdropUrl ||
              matchedCatalogItem?.posterUrl ||
              (currentFile.posterUrl && !currentFile.posterUrl.includes('/device-video-thumb/')
                ? currentFile.posterUrl
                : undefined)
            }
            videoUrl={currentBlobUrl || currentFile.videoUrl || ''}
            availableLanguages={currentFile.language ? [currentFile.language] : ['Default']}
            activeLanguage={currentFile.language || 'Default'}
            activeQuality={currentFile.quality || 'auto'}
            initialTime={savedInitialTime}
            onProgress={(time, _isFinished, totalDuration) => {
              saveOfflineVideoProgress(currentFile, time, totalDuration);
            }}
            onPause={(time, totalDuration) => {
              saveOfflineVideoProgress(currentFile, time, totalDuration);
            }}
            onBack={onBack}
            autoPlay={true}
            onNext={hasNextEpisode ? handleNextEpisode : undefined}
            streamKey={`offline_${currentFile.id}_${currentFile.storageKey || ''}`}
          />
        </div>
      </div>

      {/* 2. SCROLLABLE DETAILS CONTENT BELOW PLAYER */}
      <div
        ref={scrollContainerRef}
        className="flex-1 w-full overflow-y-auto overflow-x-hidden bg-[#09090B] text-white font-sans scroll-smooth pb-12"
      >
        <div className="w-full max-w-5xl mx-auto px-4 pt-3 pb-6 space-y-3.5 text-left">
          {/* ROW 1: Title (left) & Info > Button (right) */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
              {matchedCatalogItem?.title || currentFile.title}
            </h1>
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="flex items-center gap-0.5 text-xs font-medium text-white/60 hover:text-white shrink-0 transition cursor-pointer py-1"
            >
              <span>Info</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* ROW 2: Single-Line Horizontal Metadata Scroll Row (No fake ratings!) */}
          <div className="flex items-center gap-2 text-xs text-white/70 overflow-x-auto no-scrollbar whitespace-nowrap py-0.5">
            <span className="inline-flex items-center text-white/80 shrink-0">
              {isMovie ? <Film className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
            </span>

            {realCatalogRating && (
              <>
                <span className="text-white/25">|</span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-400 shrink-0">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {realCatalogRating}
                </span>
              </>
            )}

            {currentFile.quality && (
              <>
                <span className="text-white/25">|</span>
                <span className="font-semibold text-emerald-400 uppercase shrink-0">
                  {currentFile.quality.toUpperCase()}
                </span>
              </>
            )}

            <span className="text-white/25">|</span>
            <span className="shrink-0">{yearOrSize}</span>

            {countryOrFolder && countryOrFolder !== yearOrSize && (
              <>
                <span className="text-white/25">|</span>
                <span className="shrink-0">{countryOrFolder}</span>
              </>
            )}

            <span className="text-white/25">|</span>
            <span className="text-white/60 shrink-0">{genresText}</span>
          </div>

          {/* ROW 3: Playback Header (ONLY for MaxPlay downloaded videos, NEVER for Local files) & Episode/Movie Bar */}
          <div className="pt-1 space-y-2.5">
            {!isLocalDeviceVideo && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#8B5CF6] shadow-[0_0_8px_#8B5CF6]" />
                  <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    Playback &amp; Resources
                  </span>
                </div>
                <div className="relative flex items-center gap-1 text-[11px] text-white/50">
                  <span>Uploaded by MaxPlay Admin</span>
                  <button
                    type="button"
                    onClick={() => setShowHelpConfirmTooltip((prev) => !prev)}
                    className="p-0.5 text-white/50 hover:text-purple-400 transition cursor-pointer"
                    title="Need help or want to report an issue?"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>

                  <AnimatePresence>
                    {showHelpConfirmTooltip && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.95 }}
                        transition={{ duration: 0.16 }}
                        className="absolute right-0 top-6 z-50 w-64 rounded-xl bg-[#181820] border border-purple-500/40 p-3 shadow-2xl text-left"
                      >
                        <p className="text-xs font-semibold text-white leading-snug">
                          Facing an issue with this video or audio?
                        </p>
                        <p className="text-[11px] text-white/60 mt-0.5">
                          Tap below to open Feedback &amp; Support and report it directly to Admin.
                        </p>
                        <div className="mt-2.5 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowHelpConfirmTooltip(false)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-white/70 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowHelpConfirmTooltip(false);
                              onBack();
                              window.dispatchEvent(new CustomEvent('MAXPLAY_OPEN_FEEDBACK_SCREEN'));
                            }}
                            className="px-3 py-1 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-[11px] font-bold text-white shadow-md shadow-purple-600/30 cursor-pointer"
                          >
                            Go to Feedback
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Movie Title Bar OR Horizontal Episode Selector Row (No Language/Quality/Season selector boxes) */}
            {isMovie || sortedEpisodes.length <= 1 ? (
              <button
                type="button"
                onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white font-bold text-xs sm:text-sm text-center truncate shadow-lg shadow-purple-900/30 cursor-pointer active:scale-[0.99] transition"
              >
                {currentFile.title}
              </button>
            ) : (
              <div className="flex items-center gap-2 pt-0.5">
                {/* "All" Button on Left */}
                <button
                  type="button"
                  onClick={() => setShowAllEpisodesDrawer(true)}
                  className="h-11 px-3.5 rounded-xl bg-[#18181F] hover:bg-[#22222C] border border-white/10 text-xs font-bold text-white/90 shrink-0 flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  <span>All</span>
                  <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                </button>

                {/* Horizontal Scrollable Row of Numbered Square Episode Boxes */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1">
                  {sortedEpisodes.map((ep, idx) => {
                    const isCurrent =
                      ep.id === currentFile.id ||
                      (ep.storageKey && ep.storageKey === currentFile.storageKey);
                    const epNum = getEpLabel(ep, idx);

                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => handleSelectEpisode(ep)}
                        className={`relative h-11 w-11 shrink-0 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition cursor-pointer border ${
                          isCurrent
                            ? 'bg-[#8B5CF6] border-purple-400 text-white shadow-md shadow-purple-600/30'
                            : 'bg-[#141419] border-white/10 text-white/75 hover:bg-[#1E1E26] hover:text-white'
                        }`}
                      >
                        <span>{epNum}</span>
                        {isCurrent && (
                          <div className="flex items-end gap-0.5 h-2 mt-0.5">
                            <span className="w-0.5 h-1.5 bg-white rounded-full animate-pulse" />
                            <span className="w-0.5 h-2 bg-white rounded-full" />
                            <span className="w-0.5 h-1 bg-white rounded-full animate-pulse" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* NATIVE BANNER AD */}
          <div className="pt-1 pb-1">
            <NativeBanner />
          </div>

          {/* FOR YOU SECTION */}
          {recommendations.length > 0 && (
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">For you</span>
                <button
                  type="button"
                  onClick={handleRefreshRecs}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-white/80 hover:text-white transition cursor-pointer active:scale-95"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingRecs ? 'animate-spin text-purple-400' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                {recommendations.map((recItem) => (
                  <ContentCard
                    key={recItem.id}
                    item={recItem}
                    onPress={(selected) => {
                      if (onSelectContent) {
                        onSelectContent(selected);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SLIDE-UP MODAL 1: INFO SHEET */}
      <AnimatePresence>
        {showInfoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowInfoModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-2xl bg-[#121217] border-t border-white/15 rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto space-y-4 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white">Content Details</h3>
                <button
                  type="button"
                  onClick={() => setShowInfoModal(false)}
                  className="p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-4">
                {matchedCatalogItem?.posterUrl || currentFile.posterUrl ? (
                  <img
                    src={matchedCatalogItem?.posterUrl || currentFile.posterUrl}
                    alt={currentFile.title}
                    className="w-24 h-36 object-cover rounded-xl border border-white/10 shrink-0 bg-black"
                  />
                ) : null}
                <div className="space-y-1.5 min-w-0">
                  <h4 className="text-base font-extrabold text-white">
                    {matchedCatalogItem?.title || currentFile.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                    {realCatalogRating && (
                      <>
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          {realCatalogRating}
                        </span>
                        <span>•</span>
                      </>
                    )}
                    <span>{yearOrSize}</span>
                    {countryOrFolder && countryOrFolder !== yearOrSize && (
                      <>
                        <span>•</span>
                        <span>{countryOrFolder}</span>
                      </>
                    )}
                    {currentFile.quality && (
                      <>
                        <span>•</span>
                        <span className="text-purple-400 font-bold uppercase">{currentFile.quality}</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(matchedCatalogItem?.genres || [genresText]).map((g) => (
                      <span
                        key={g}
                        className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] text-white/80"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-white/50">Synopsis &amp; File Info</h5>
                <p className="text-xs sm:text-sm text-white/80 leading-relaxed whitespace-pre-line">
                  {matchedCatalogItem?.description ||
                    currentFile.subtitle ||
                    `Saved offline in your device storage (${sizeFormatted} • ${currentFile.quality || 'HD'}). Ready for instant zero-data playback.`}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SLIDE-UP MODAL 2: ALL EPISODES DRAWER */}
      <AnimatePresence>
        {showAllEpisodesDrawer && sortedEpisodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowAllEpisodesDrawer(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-2xl bg-[#121217] border-t border-white/15 rounded-t-3xl p-5 max-h-[75vh] overflow-y-auto space-y-4 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-bold text-white">
                  All Videos ({sortedEpisodes.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAllEpisodesDrawer(false)}
                  className="p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-2.5">
                {sortedEpisodes.map((ep, idx) => {
                  const isCurrent =
                    ep.id === currentFile.id ||
                    (ep.storageKey && ep.storageKey === currentFile.storageKey);
                  const epNum = getEpLabel(ep, idx);
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => {
                        handleSelectEpisode(ep);
                        setShowAllEpisodesDrawer(false);
                      }}
                      className={`h-11 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition cursor-pointer border ${
                        isCurrent
                          ? 'bg-[#8B5CF6] border-purple-400 text-white shadow-md shadow-purple-600/30'
                          : 'bg-[#181820] border-white/10 text-white/80 hover:bg-[#22222C]'
                      }`}
                    >
                      <span>{epNum}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
