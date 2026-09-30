import React from 'react';

import HexagonShape from './Hexagon';
import SquareShape from './Square';
import TriangleShape from './Triangle';

export type PreviewShape = 'triangle' | 'square' | 'hexagon';
export type PreviewTransform = 'rotate90' | 'rotate120' | 'translate' | 'glide' | 'free';

interface ViewBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface PatternPreviewProps {
  tilePathData: string;
  shapeType: PreviewShape;
  transformType: PreviewTransform;
  colorA: string;
  colorB: string;
  radius: number;
  center: number;
  offset: { x: number; y: number };
  zoom: number;
  viewBounds: ViewBounds;
  demoMode: boolean;
  demoStep: number;
  demoCenters: { cx: number; cy: number }[];
  squareDemoMode: boolean;
  squareDemoTiles: React.ReactNode;
}

function PatternPreview({
  tilePathData,
  shapeType,
  transformType,
  colorA,
  colorB,
  radius,
  center,
  offset,
  zoom,
  viewBounds,
  demoMode,
  demoStep,
  demoCenters,
  squareDemoMode,
  squareDemoTiles,
}: PatternPreviewProps) {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-neutral-50">
      <svg id="tessellation-svg" className="h-full w-full transition-opacity duration-500">
        <defs>
          <path id="tessellation-tile" d={tilePathData} />
        </defs>
        <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
          {shapeType === 'square' && (
            squareDemoMode ? squareDemoTiles : (
              <SquareShape
                colorA={colorA}
                colorB={colorB}
                RADIUS={radius}
                CENTER={center}
                triSymmetry="cw"
                transformType={transformType as 'rotate90' | 'translate' | 'glide'}
                viewBounds={viewBounds}
              />
            )
          )}
          {shapeType === 'hexagon' && (
            <HexagonShape
              colorA={colorA}
              colorB={colorB}
              RADIUS={radius}
              CENTER={center}
              transformType={transformType as 'rotate120' | 'translate' | 'glide' | 'free'}
              demoMode={demoMode}
              demoStep={demoStep}
              demoCenters={demoCenters}
              viewBounds={viewBounds}
            />
          )}
          {shapeType === 'triangle' && (
            <TriangleShape
              colorA={colorA}
              colorB={colorB}
              RADIUS={radius}
              CENTER={center}
              triSymmetry="cw"
              demoMode={demoMode}
              demoStep={demoStep}
              demoCenters={demoCenters}
              viewBounds={viewBounds}
            />
          )}
        </g>
      </svg>
    </div>
  );
}

export default React.memo(PatternPreview);
