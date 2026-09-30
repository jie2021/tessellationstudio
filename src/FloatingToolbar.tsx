import React from 'react';
import { Grid3X3 } from 'lucide-react';

import type { PreviewShape } from './PatternPreview';

interface FloatingToolbarProps {
  showGrid: boolean;
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  shapeType: PreviewShape;
  demoMode: boolean;
  onStartDemo: () => void;
}

function FloatingToolbar({
  showGrid,
  setShowGrid,
  zoom,
  setZoom,
  shapeType,
  demoMode,
  onStartDemo,
}: FloatingToolbarProps) {
  return (
    <div className="relative z-30 mx-auto mt-2.5 mb-[calc(3rem+5px+env(safe-area-inset-bottom))] flex w-[calc(100vw-20px)] max-w-max flex-wrap items-center justify-center gap-2 rounded-3xl border border-neutral-200/50 bg-white/80 px-3 py-2 shadow-2xl backdrop-blur-xl sm:absolute sm:bottom-10 sm:left-1/2 sm:mb-0 sm:-translate-x-1/2 sm:gap-4 sm:px-6 sm:py-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowGrid((visible) => !visible)}
          className={`rounded-xl p-2.5 transition-all ${showGrid ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-neutral-400 hover:bg-neutral-100'}`}
          title="가이드 라인 토글"
        >
          <Grid3X3 size={20} />
        </button>
      </div>
      <div className="h-8 w-px bg-neutral-200" />
      <div className="flex items-center gap-2 sm:gap-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Zoom</span>
        <input
          aria-label="줌"
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="w-24 accent-indigo-600 sm:w-32"
        />
      </div>
      <div className="h-8 w-px bg-neutral-200" />
      {!demoMode && (
        <button
          onClick={onStartDemo}
          className="rounded-full bg-indigo-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-indigo-700"
          title="설명하기"
        >
          설명하기
        </button>
      )}
      <p className="whitespace-nowrap text-xs font-bold text-neutral-700">
        {shapeType === 'triangle' ? '정삼각형' : shapeType === 'square' ? '정사각형' : '정육각형'} 패턴
      </p>
    </div>
  );
}

export default React.memo(FloatingToolbar);
