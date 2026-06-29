"use client";

import { useRef } from "react";

/**
 * A thin vertical drag handle for resizing an adjacent panel. Calls `onDrag`
 * with the horizontal pixel delta since the last move event. Uses pointer
 * capture so the drag keeps tracking even if the cursor outruns the handle.
 */
export function ResizeHandle({
  onDrag,
  className = "",
}: {
  onDrag: (deltaX: number) => void;
  className?: string;
}) {
  const last = useRef(0);
  const dragging = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    last.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - last.current;
    last.current = e.clientX;
    if (dx !== 0) onDrag(dx);
  };

  const end = (e: React.PointerEvent) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      className={`group relative w-1.5 shrink-0 cursor-col-resize touch-none ${className}`}
    >
      {/* the visible 1px rule, brightening to amber on hover/drag */}
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line transition-colors group-hover:bg-amber group-active:bg-amber" />
      {/* grip dots, centered */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="h-0.5 w-0.5 bg-amber" />
        <span className="h-0.5 w-0.5 bg-amber" />
        <span className="h-0.5 w-0.5 bg-amber" />
      </div>
    </div>
  );
}
