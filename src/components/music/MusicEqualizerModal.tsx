import React, { useCallback, useRef } from 'react';
import { ChevronLeft, Headphones } from 'lucide-react';
import { useMusic } from '../../context/MusicContext';
import {
  EQUALIZER_BAND_LABELS,
  EQUALIZER_PRESET_LIST,
} from '../../utils/musicUtils';

interface RotaryKnobProps {
  label: string;
  value: number; // 0 to 100
  enabled: boolean;
  onChange: (nextVal: number) => void;
}

const RotarySoundKnob: React.FC<RotaryKnobProps> = ({
  label,
  value,
  enabled,
  onChange,
}) => {
  const knobRef = useRef<HTMLDivElement | null>(null);

  const updateFromClientPos = useCallback(
    (clientX: number, clientY: number) => {
      if (!enabled || !knobRef.current) return;
      const rect = knobRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      // Angle in degrees where 0 deg is straight up (12 o'clock), range -130 to +130
      let deg = Math.atan2(dx, -dy) * (180 / Math.PI);
      if (deg < -135) deg = -135;
      if (deg > 135) deg = 135;
      const pct = Math.round(((deg + 135) / 270) * 100);
      onChange(Math.max(0, Math.min(100, pct)));
    },
    [enabled, onChange]
  );

  const totalDots = 25;
  const activeDotIndex = Math.round((value / 100) * (totalDots - 1));
  const rotationDeg = -135 + (value / 100) * 270;

  return (
    <div className="flex flex-col items-center select-none">
      <div
        ref={knobRef}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        tabIndex={0}
        onKeyDown={(e) => {
          if (!enabled) return;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            onChange(Math.min(100, value + 5));
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(Math.max(0, value - 5));
          }
        }}
        onPointerDown={(e) => {
          if (!enabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromClientPos(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!enabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
          updateFromClientPos(e.clientX, e.clientY);
        }}
        className={`relative w-36 h-36 flex items-center justify-center touch-none ${
          enabled ? 'cursor-pointer' : 'opacity-45 cursor-not-allowed'
        }`}
      >
        {/* Outer SVG Dotted Arc matching reference screenshot */}
        <svg viewBox="0 0 140 140" className="absolute inset-0 w-full h-full pointer-events-none">
          {Array.from({ length: totalDots }).map((_, idx) => {
            const angleDeg = -135 + (idx / (totalDots - 1)) * 270;
            const rad = ((angleDeg - 90) * Math.PI) / 180;
            const r = 61;
            const x = 70 + r * Math.cos(rad);
            const y = 70 + r * Math.sin(rad);
            const isStartDot = idx === 0;
            const isLit = enabled && idx <= activeDotIndex;
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r={isStartDot ? 3.8 : 1.9}
                fill={isLit ? '#7C3AED' : '#3F3F46'}
              />
            );
          })}
        </svg>

        {/* Rotary Dial Ring & Rotating Indicator Tick */}
        <div className="relative w-24 h-24 rounded-full border-[5px] border-zinc-700/80 bg-[#121218] shadow-[inset_0_2px_10px_rgba(0,0,0,0.75)] flex items-center justify-center">
          <div
            className="w-full h-full rounded-full relative transition-transform duration-75"
            style={{ transform: `rotate(${rotationDeg}deg)` }}
          >
            <span
              className={`block w-0.5 h-3.5 mx-auto mt-2.5 rounded-full ${
                enabled ? 'bg-[#8B5CF6] shadow-[0_0_8px_#8B5CF6]' : 'bg-zinc-500'
              }`}
            />
          </div>
        </div>
      </div>

      <span className="mt-1 text-xs font-semibold text-zinc-300">{label}</span>
    </div>
  );
};

export const MusicEqualizerModal: React.FC = () => {
  const {
    isEqualizerOpen,
    setIsEqualizerOpen,
    equalizer,
    setEqualizerEnabled,
    setEqualizerPreset,
    setEqualizerBand,
    setEqualizerBass,
    setEqualizerImmersive,
  } = useMusic();

  if (!isEqualizerOpen) return null;

  return (
    <div
      data-testid="music-equalizer-screen"
      className="fixed inset-0 z-[120] bg-[#0A0A0C] text-white flex flex-col overflow-hidden select-none"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 shrink-0">
        <button
          type="button"
          aria-label="Close Equaliser"
          onClick={() => setIsEqualizerOpen(false)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-200 hover:bg-white/10 active:scale-95 transition cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <h2 className="text-lg font-extrabold tracking-tight text-white">Equaliser</h2>

        {/* Purple Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={equalizer.enabled}
          aria-label="Toggle Equaliser"
          onClick={() => setEqualizerEnabled(!equalizer.enabled)}
          className={`relative w-12 h-7 rounded-full transition-colors duration-200 p-0.5 cursor-pointer ${
            equalizer.enabled ? 'bg-[#7C3AED]' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`block w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
              equalizer.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Scrollable Equaliser Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-14 scrollbar-none max-w-2xl mx-auto w-full">
        {/* Section 1: Recommended presets */}
        <div>
          <h3 className="text-lg font-extrabold text-white mb-3.5">Recommended presets</h3>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {EQUALIZER_PRESET_LIST.map((preset) => {
              const isSelected = equalizer.preset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={!equalizer.enabled}
                  onClick={() => setEqualizerPreset(preset)}
                  className={`h-14 rounded-2xl text-sm font-semibold transition flex items-center justify-center px-2 cursor-pointer ${
                    !equalizer.enabled ? 'opacity-45 cursor-not-allowed ' : ''
                  }${
                    isSelected
                      ? 'bg-gradient-to-b from-[#9D4EDD] to-[#7C3AED] text-white shadow-lg shadow-purple-700/35 font-bold'
                      : 'bg-[#15151C] text-zinc-200 border border-white/5 hover:border-white/15'
                  }`}
                >
                  <span className="truncate">{preset}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Manual adjustment (5 vertical sliders: 60Hz, 230Hz, 910Hz, 3.6kHz, 14.0kHz) */}
        <div className="mt-8">
          <h3 className="text-lg font-extrabold text-white mb-5">Manual adjustment</h3>
          <div className="grid grid-cols-5 gap-2 items-center justify-items-center py-2">
            {EQUALIZER_BAND_LABELS.map((freqLabel, idx) => {
              const dbVal = equalizer.bands[idx] || 0;
              // Convert -12..+12 dB to 0..100% height from bottom
              const fillPct = Math.max(0, Math.min(100, ((dbVal + 12) / 24) * 100));
              return (
                <div key={freqLabel} className="flex flex-col items-center w-full">
                  <div className="relative h-48 w-10 flex items-center justify-center">
                    {/* Vertical Background Track */}
                    <div className="w-1 h-full bg-zinc-800 rounded-full relative overflow-visible">
                      {/* Purple Filled Portion from Bottom */}
                      <div
                        className={`absolute bottom-0 left-0 right-0 rounded-full ${
                          equalizer.enabled ? 'bg-[#7C3AED]' : 'bg-zinc-600'
                        }`}
                        style={{ height: `${fillPct}%` }}
                      />
                      {/* Purple Thumb Circle */}
                      <div
                        className={`absolute left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-5 rounded-full shadow-md pointer-events-none ${
                          equalizer.enabled
                            ? 'bg-[#7C3AED] shadow-purple-600/50'
                            : 'bg-zinc-500'
                        }`}
                        style={{ bottom: `${fillPct}%` }}
                      />
                    </div>

                    {/* Interactive Vertical Range Input */}
                    <input
                      type="range"
                      aria-label={`Equaliser ${freqLabel}`}
                      min={-12}
                      max={12}
                      step={1}
                      disabled={!equalizer.enabled}
                      value={dbVal}
                      onChange={(e) => setEqualizerBand(idx, Number(e.target.value))}
                      className="absolute w-48 h-10 -rotate-90 opacity-0 cursor-pointer z-10"
                    />
                  </div>

                  <span className="mt-3 text-xs font-medium text-zinc-400">{freqLabel}</span>
                  <span className="mt-0.5 text-xs font-bold text-white tabular-nums">
                    {dbVal > 0 ? `+${dbVal}` : dbVal}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Enhance sound (Bass & Immersive audio rotary knobs) */}
        <div className="mt-8">
          <h3 className="text-lg font-extrabold text-white">Enhance sound</h3>
          <p className="mt-1 text-xs text-zinc-400 flex items-center gap-1.5">
            <Headphones className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>Put in earphones before adjusting sound effects</span>
          </p>

          <div className="mt-5 grid grid-cols-2 gap-4 justify-items-center">
            <RotarySoundKnob
              label="Bass"
              value={equalizer.bassLevel}
              enabled={equalizer.enabled}
              onChange={setEqualizerBass}
            />
            <RotarySoundKnob
              label="Immersive audio"
              value={equalizer.immersiveLevel}
              enabled={equalizer.enabled}
              onChange={setEqualizerImmersive}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
