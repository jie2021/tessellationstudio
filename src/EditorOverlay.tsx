import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronUp, Move } from 'lucide-react';

import { renderHexagonControls } from './Hexagon';
import type { PreviewShape, PreviewTransform } from './PatternPreview';
import { renderSquareControls } from './Square';
import { renderTriangleControls } from './Triangle';

interface Point {
  x: number;
  y: number;
}

interface ActivePoint {
  edgeIdx: number;
  pointIdx: number;
}

interface EditorOverlayProps {
  canvasSize: number;
  shapeType: PreviewShape;
  transformType: PreviewTransform;
  colorA: string;
  tilePathData: string;
  baseVertices: Point[];
  currentEdgePaths: Record<number, Point[]>;
  activePoint: ActivePoint | null;
  showGrid: boolean;
  showEditor: boolean;
  useCurve: boolean;
  isPageScrollLocked: boolean;
  onToggleEditor: () => void;
  onPointerDown: (edgeIdx: number, pointIdx: number) => void;
  onPointerMove: (event: React.MouseEvent | React.TouchEvent) => void;
  onPointerUp: () => void;
  onAddPoint: (edgeIdx: number, pointIdx: number, side: 'left' | 'right') => void;
}

const getCurveDisplayPoint = (
  start: Point,
  end: Point,
  controls: Point[],
  pointIdx: number,
  useCurve: boolean,
): Point => {
  if (!useCurve || controls.length === 0) return controls[pointIdx];

  const t = (pointIdx + 1) / (controls.length + 1);
  const inverseT = 1 - t;
  if (controls.length === 1) {
    const control = controls[0];
    return {
      x: inverseT * inverseT * start.x + 2 * inverseT * t * control.x + t * t * end.x,
      y: inverseT * inverseT * start.y + 2 * inverseT * t * control.y + t * t * end.y,
    };
  }

  const firstControl = controls[0];
  const lastControl = controls[controls.length - 1];
  return {
    x: inverseT ** 3 * start.x + 3 * inverseT ** 2 * t * firstControl.x + 3 * inverseT * t ** 2 * lastControl.x + t ** 3 * end.x,
    y: inverseT ** 3 * start.y + 3 * inverseT ** 2 * t * firstControl.y + 3 * inverseT * t ** 2 * lastControl.y + t ** 3 * end.y,
  };
};

const getSquareCurveDisplayPoint = (start: Point, end: Point, controls: Point[], pointIdx: number): Point => {
  if (controls.length === 0) return start;
  if (controls.length === 1) return getCurveDisplayPoint(start, end, controls, 0, true);

  const control = controls[pointIdx];
  const previous = pointIdx === 0 ? start : {
    x: (controls[pointIdx - 1].x + control.x) / 2,
    y: (controls[pointIdx - 1].y + control.y) / 2,
  };
  const next = pointIdx === controls.length - 1 ? end : {
    x: (control.x + controls[pointIdx + 1].x) / 2,
    y: (control.y + controls[pointIdx + 1].y) / 2,
  };
  const t = 0.5;
  const inverseT = 1 - t;
  return {
    x: inverseT * inverseT * previous.x + 2 * inverseT * t * control.x + t * t * next.x,
    y: inverseT * inverseT * previous.y + 2 * inverseT * t * control.y + t * t * next.y,
  };
};

function EditorOverlay({
  canvasSize,
  shapeType,
  transformType,
  colorA,
  tilePathData,
  baseVertices,
  currentEdgePaths,
  activePoint,
  showGrid,
  showEditor,
  useCurve,
  isPageScrollLocked,
  onToggleEditor,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onAddPoint,
}: EditorOverlayProps) {
  const [pointMenu, setPointMenu] = React.useState<{ edgeIdx: number; pointIdx: number; x: number; y: number } | null>(null);

  const handlePointContextMenu = (edgeIdx: number, pointIdx: number, clientX: number, clientY: number, event?: React.SyntheticEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    onPointerDown(edgeIdx, pointIdx);
    setPointMenu({ edgeIdx, pointIdx, x: clientX, y: clientY });
  };

  const addPoint = (side: 'left' | 'right') => {
    if (!pointMenu) return;
    onAddPoint(pointMenu.edgeIdx, pointMenu.pointIdx, side);
    setPointMenu(null);
  };

  return (
    <div className={`relative z-10 flex flex-none items-center justify-center p-2.5 sm:p-8 lg:flex-1 lg:pointer-events-none ${isPageScrollLocked ? 'touch-none' : ''}`}>
      <div className="pointer-events-auto relative w-[calc(100vw-20px)] max-w-[464px] sm:w-auto">
        <AnimatePresence mode="wait">
          {showEditor && (
            <motion.div
              key={shapeType}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
              className="w-full rounded-[40px] border border-white/50 bg-white/10 p-2.5 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] backdrop-blur-xl sm:p-8"
            >
              <svg
                id="editor-svg"
                width={canvasSize}
                height={canvasSize}
                className="h-auto w-full cursor-crosshair overflow-visible"
                style={{
                  touchAction: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none',
                }}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setPointMenu(null);
                }}
              >
                {showGrid && (
                  <g className="stroke-neutral-200 stroke-1">
                    {baseVertices.map((vertex, index) => {
                      const nextVertex = baseVertices[(index + 1) % baseVertices.length];
                      return <line key={index} x1={vertex.x} y1={vertex.y} x2={nextVertex.x} y2={nextVertex.y} strokeDasharray="8 8" />;
                    })}
                  </g>
                )}

                <path
                  d={tilePathData}
                  fill={colorA}
                  fillOpacity="0.15"
                  stroke={colorA}
                  strokeWidth="4"
                  strokeLinejoin="round"
                  className="transition-colors duration-300"
                />

                {Object.entries(currentEdgePaths).map(([edgeIdx, points]) => {
                  const edgeIndex = Number(edgeIdx);
                  const edgeStart = baseVertices[edgeIndex];
                  const edgeEnd = baseVertices[(edgeIndex + 1) % baseVertices.length];
                  const displayPoints = points.map((_, pointIdx) => {
                    if (shapeType === 'square' && transformType === 'rotate90' && useCurve) {
                      return getSquareCurveDisplayPoint(edgeStart, edgeEnd, points, pointIdx);
                    }
                    return getCurveDisplayPoint(edgeStart, edgeEnd, points, pointIdx, useCurve);
                  });

                  if (shapeType === 'triangle') {
                    return renderTriangleControls({ ei: edgeIndex, points, displayPoints, activePoint, triSymmetry: 'cw', handleMouseDown: onPointerDown });
                  }

                  if (shapeType === 'square') {
                    return renderSquareControls({
                      ei: edgeIndex,
                      points,
                      displayPoints,
                      activePoint,
                      triSymmetry: 'cw',
                      transformType: transformType as 'rotate90' | 'translate' | 'glide',
                      handleMouseDown: onPointerDown,
                      useCurve,
                      baseVertices,
                      onPointContextMenu: transformType === 'rotate90' ? handlePointContextMenu : undefined,
                    });
                  }

                  return renderHexagonControls({
                    ei: edgeIndex,
                    points,
                    displayPoints,
                    activePoint,
                    transformType: transformType as 'rotate120' | 'translate' | 'glide' | 'free',
                    handleMouseDown: onPointerDown,
                    baseVertices,
                    onPointContextMenu: transformType === 'free' ? handlePointContextMenu : undefined,
                  });
                })}

                {baseVertices.map((vertex, index) => (
                  <rect
                    key={index}
                    x={vertex.x - 5}
                    y={vertex.y - 5}
                    width={10}
                    height={10}
                    rx={2}
                    className="fill-neutral-300"
                  />
                ))}
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {pointMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onMouseDown={() => setPointMenu(null)}
              onContextMenu={(event) => {
                event.preventDefault();
                setPointMenu(null);
              }}
            />
            <div
              role="menu"
              aria-label="점 추가"
              className="fixed z-50 min-w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-2xl"
              style={{ left: pointMenu.x, top: pointMenu.y }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-indigo-50 hover:text-indigo-700"
                onClick={() => addPoint('left')}
              >
                왼쪽에 점 추가
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-indigo-50 hover:text-indigo-700"
                onClick={() => addPoint('right')}
              >
                오른쪽에 점 추가
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onToggleEditor}
          aria-expanded={showEditor}
          aria-label={showEditor ? '기본 도형 편집기 접기' : '기본 도형 편집기 펼치기'}
          className="absolute -top-14 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-neutral-100 bg-white px-5 py-2.5 text-[12px] font-black uppercase tracking-[0.2em] text-neutral-400 shadow-xl transition-colors hover:text-indigo-600"
        >
          <Move size={12} className="text-indigo-600" />
          기본 도형 편집기
          {showEditor ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
    </div>
  );
}

export default React.memo(EditorOverlay);
