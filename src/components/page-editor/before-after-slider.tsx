'use client';

import { useState, useRef, useCallback } from 'react';

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = 'Antes',
  afterLabel = 'Depois',
  className = '',
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const getPositionFromEvent = useCallback(
    (clientX: number): number => {
      const container = containerRef.current;
      if (!container) return 50;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      return Math.min(100, Math.max(0, (x / rect.width) * 100));
    },
    []
  );

  // Mouse events
  const handleMouseDown = () => setDragging(true);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      setPosition(getPositionFromEvent(e.clientX));
    },
    [dragging, getPositionFromEvent]
  );

  const handleMouseUp = () => setDragging(false);

  // Touch events
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      setPosition(getPositionFromEvent(e.touches[0].clientX));
    },
    [getPositionFromEvent]
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-square overflow-hidden rounded-xl select-none cursor-col-resize ${className}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Before image (base layer) */}
      <img
        src={beforeImage}
        alt={beforeLabel}
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* After image (clipped to reveal only the right portion) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={afterImage}
          alt={afterLabel}
          className="absolute inset-0 h-full object-cover"
          style={{ width: `${100 / (position / 100)}%`, maxWidth: 'none' }}
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
        style={{ left: `${position}%` }}
      />

      {/* Drag handle */}
      <div
        className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
        style={{ left: `${position}%` }}
        onMouseDown={handleMouseDown}
        onTouchMove={handleTouchMove}
        onTouchStart={() => setDragging(true)}
        onTouchEnd={() => setDragging(false)}
      >
        <div
          className={`w-10 h-10 rounded-full bg-white shadow-lg border-2 border-white flex items-center justify-center gap-0.5 transition-transform ${dragging ? 'scale-110' : 'hover:scale-105'}`}
        >
          {/* Left arrow */}
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M7 1L1 7L7 13" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {/* Right arrow */}
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M1 1L7 7L1 13" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <span className="absolute bottom-3 left-3 bg-black/50 text-white text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm z-10">
        {beforeLabel}
      </span>
      <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm z-10">
        {afterLabel}
      </span>
    </div>
  );
}
