import React, { useEffect, useMemo, useState } from 'react';
import { Music2, Pause, Play, SkipForward, X } from 'lucide-react';
import { useMusic } from '../../context/MusicContext';
import { getRainbowGradientForTrack } from '../../utils/musicUtils';

interface MiniMusicPlayerProps {
  hasBottomNav?: boolean;
  activeTab?: string;
}

const PILL_GRADIENTS = [
  'from-[#4E3A6B]/95 via-[#5E4382]/95 to-[#3D2C56]/95 border-purple-400/25',
  'from-[#A66332]/95 via-[#B86E38]/95 to-[#8C5025]/95 border-amber-300/25',
  'from-[#3B5978]/95 via-[#4A6B8C]/95 to-[#2D4661]/95 border-sky-300/25',
  'from-[#6B3B5E]/95 via-[#824672]/95 to-[#522B48]/95 border-pink-300/25',
];

export const MiniMusicPlayer: React.FC<MiniMusicPlayerProps> = ({
  hasBottomNav = true,
  activeTab = 'home',
}) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    isFullScreenPlayerOpen,
    isEqualizerOpen,
    editingSongTrack,
    setIsFullScreenPlayerOpen,
    togglePlayPause,
    playNextTrack,
  } = useMusic();

  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});
  const [temporarilyHidden, setTemporarilyHidden] = useState(false);

  // Re-show capsule when track changes or user enters the Music tab
  useEffect(() => {
    setTemporarilyHidden(false);
  }, [currentTrack?.id]);

  // Temporarily hide capsule when switching to non-music tabs if user opens any sub-view,
  // and always re-enable on the main 'music' tab
  useEffect(() => {
    if (activeTab === 'music') {
      setTemporarilyHidden(false);
    }
  }, [activeTab]);

  const pillGradientClass = useMemo(() => {
    if (!currentTrack) return PILL_GRADIENTS[0];
    let hash = 0;
    for (let i = 0; i < currentTrack.id.length; i++) {
      hash = (hash * 31 + currentTrack.id.charCodeAt(i)) >>> 0;
    }
    return PILL_GRADIENTS[hash % PILL_GRADIENTS.length];
  }, [currentTrack]);

  // Hide when no track, when full-screen player / equaliser / edit info is open,
  // or when ANY non-music Detail Screen is open (!hasBottomNav && activeTab !== 'music')
  // so it NEVER blocks the Movie/Series Detail Screen Download button or detail tabs!
  if (
    !currentTrack ||
    isFullScreenPlayerOpen ||
    isEqualizerOpen ||
    Boolean(editingSongTrack) ||
    temporarilyHidden ||
    (!hasBottomNav && activeTab !== 'music')
  ) {
    return null;
  }

  const progressPct =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const showArt = Boolean(currentTrack.artworkUrl && !imgFailed[currentTrack.id]);
  const rainbowFallback = getRainbowGradientForTrack(currentTrack.id);

  // SVG circle progress math (radius = 15, circumference = 94.25)
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  return (
    <div
      data-testid="mini-music-player"
      className={`fixed left-3 right-3 md:left-[92px] md:right-4 z-[85] transition-all duration-300 select-none ${
        hasBottomNav ? 'bottom-[68px] md:bottom-3' : 'bottom-3'
      }`}
    >
      <div
        onClick={() => setIsFullScreenPlayerOpen(true)}
        className={`relative flex items-center justify-between h-[52px] pl-14 pr-2.5 rounded-full bg-gradient-to-r ${pillGradientClass} backdrop-blur-xl border shadow-[0_10px_30px_rgba(0,0,0,0.65)] cursor-pointer active:scale-[0.99] transition-transform`}
      >
        {/* Left Protruding Vinyl Record Disc with Center Artwork */}
        <div
          className={`absolute -left-1 -top-1 w-[58px] h-[58px] rounded-full bg-zinc-950 border-[3px] border-zinc-800 shadow-[0_4px_16px_rgba(0,0,0,0.85)] flex items-center justify-center overflow-hidden ${
            isPlaying ? 'animate-[spin_9s_linear_infinite]' : ''
          }`}
        >
          {/* Vinyl Grooves Ring */}
          <div className="absolute inset-1 rounded-full border border-white/10 pointer-events-none" />
          <div className="absolute inset-2 rounded-full border border-white/5 pointer-events-none" />

          {/* Center Label / Album Cover (uses vibrant rainbow gradient fallback when no cover art) */}
          <div
            className={`w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br ${rainbowFallback} flex items-center justify-center border border-white/20`}
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
              <Music2 className="w-4 h-4 text-white drop-shadow" />
            )}
          </div>
        </div>

        {/* Song Title & Artist */}
        <div className="min-w-0 flex-1 pl-2 pr-2 text-left">
          <h4 className="text-[14px] font-extrabold text-white truncate leading-tight">
            {currentTrack.title}
          </h4>
          <p className="text-[11px] font-medium text-white/80 truncate mt-0.5">
            {currentTrack.artist}
          </p>
        </div>

        {/* Play/Pause with Circular Progress Ring + Next Track + Quick Hide Button */}
        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={togglePlayPause}
            className="relative w-9 h-9 flex items-center justify-center rounded-full text-white hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.28)"
                strokeWidth="2.2"
              />
              <circle
                cx="18"
                cy="18"
                r={radius}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current relative z-10" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5 relative z-10" />
            )}
          </button>

          <button
            type="button"
            aria-label="Next Track"
            onClick={playNextTrack}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          {activeTab !== 'music' && (
            <button
              type="button"
              aria-label="Hide Music Capsule Temporarily"
              onClick={() => setTemporarilyHidden(true)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer"
              title="Hide capsule temporarily"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
