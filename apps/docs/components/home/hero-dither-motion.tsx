"use client";

import { useEffect, useRef } from "react";

const cellSize = 5;
const pixelSize = 3.5;
const maxCells = 1_600;

type DisplacedCell = {
  column: number;
  row: number;
  bornAt: number;
  lifetime: number;
  pushX: number;
  pushY: number;
};

function noise(column: number, row: number) {
  const value = Math.sin(column * 127.1 + row * 311.7) * 43_758.5453;
  return value - Math.floor(value);
}

function smoothstep(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

export function HeroDitherMotion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = canvas?.closest<HTMLElement>(".home-hero");
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !hero || !context) return;

    const baseCanvas = document.createElement("canvas");
    const baseContext = baseCanvas.getContext("2d", { alpha: true });
    if (!baseContext) return;

    const canTrackPointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const displaced = new Map<number, DisplacedCell>();
    let width = 0;
    let height = 0;
    let columns = 0;
    let rows = 0;
    let frame = 0;
    let resizeFrame = 0;
    let previousPointer: { x: number; y: number; time: number } | null = null;
    let emerald = "#087f68";
    let burntOrange = "#cc4822";

    const readPalette = () => {
      const styles = getComputedStyle(hero);
      emerald = styles.getPropertyValue("--home-pixel-emerald").trim() || "#087f68";
      burntOrange =
        styles.getPropertyValue("--home-pixel-orange").trim() || "#cc4822";
    };

    const cellOpacity = (column: number) => {
      const x = column * cellSize;
      return 0.08 + smoothstep((x - width * 0.37) / (width * 0.5)) * 0.92;
    };

    const cellColor = (column: number, row: number) =>
      (column + row) % 2 === 0 ? emerald : burntOrange;

    const paintBase = () => {
      baseContext.clearRect(0, 0, width, height);
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const opacity = cellOpacity(column);
          if (opacity <= 0) continue;
          baseContext.globalAlpha = opacity * (cellColor(column, row) === emerald ? 0.98 : 0.82);
          baseContext.fillStyle = cellColor(column, row);
          baseContext.fillRect(column * cellSize, row * cellSize, pixelSize, pixelSize);
        }
      }
      baseContext.globalAlpha = 1;
    };

    const draw = (time: number) => {
      frame = 0;
      context.clearRect(0, 0, width, height);
      context.drawImage(baseCanvas, 0, 0, baseCanvas.width, baseCanvas.height, 0, 0, width, height);

      for (const [key, cell] of displaced) {
        const progress = Math.min(1, (time - cell.bornAt) / cell.lifetime);
        if (progress >= 1) {
          displaced.delete(key);
          continue;
        }

        const baseX = cell.column * cellSize;
        const baseY = cell.row * cellSize;
        const settle = (1 - progress) ** 3;
        const x = baseX + cell.pushX * settle;
        const y = baseY + cell.pushY * settle;
        const opacity = cellOpacity(cell.column);

        context.clearRect(baseX - 1, baseY - 1, pixelSize + 2, pixelSize + 2);
        context.globalAlpha = opacity * (cellColor(cell.column, cell.row) === emerald ? 0.98 : 0.82);
        context.fillStyle = cellColor(cell.column, cell.row);
        context.fillRect(Math.round(x), Math.round(y), pixelSize, pixelSize);
      }

      context.globalAlpha = 1;
      if (displaced.size) frame = window.requestAnimationFrame(draw);
    };

    const resize = () => {
      const bounds = hero.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      columns = Math.ceil(width / cellSize);
      rows = Math.ceil(height / cellSize);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      baseCanvas.width = canvas.width;
      baseCanvas.height = canvas.height;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      baseContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.imageSmoothingEnabled = false;
      baseContext.imageSmoothingEnabled = false;
      displaced.clear();
      readPalette();
      paintBase();
      draw(performance.now());
    };

    const requestDraw = () => {
      if (!frame) frame = window.requestAnimationFrame(draw);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = hero.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const time = performance.now();
      const elapsed = Math.max(8, time - (previousPointer?.time ?? time));
      const velocityX = previousPointer ? (x - previousPointer.x) / elapsed : 0;
      const velocityY = previousPointer ? (y - previousPointer.y) / elapsed : 0;
      const speed = Math.hypot(velocityX, velocityY);
      previousPointer = { x, y, time };

      const intensity = Math.min(1, 0.2 + speed / 1.9);
      const radius = 54 + intensity * 72;
      const minColumn = Math.max(0, Math.floor((x - radius) / cellSize));
      const maxColumn = Math.min(columns - 1, Math.ceil((x + radius) / cellSize));
      const minRow = Math.max(0, Math.floor((y - radius) / cellSize));
      const maxRow = Math.min(rows - 1, Math.ceil((y + radius) / cellSize));

      for (let row = minRow; row <= maxRow; row += 1) {
        for (let column = minColumn; column <= maxColumn; column += 1) {
          if (cellOpacity(column) <= 0.02) continue;
          const cellX = column * cellSize + pixelSize / 2;
          const cellY = row * cellSize + pixelSize / 2;
          const deltaX = cellX - x;
          const deltaY = cellY - y;
          const distance = Math.hypot(deltaX, deltaY);
          const cellNoise = noise(column, row);
          if (distance > radius * (0.76 + cellNoise * 0.3)) continue;

          const length = Math.max(1, distance);
          const push = 7 + intensity * 21 * (0.76 + cellNoise * 0.38);
          const key = row * 10_000 + column;
          displaced.set(key, {
            column,
            row,
            bornAt: time,
            lifetime: 380 + cellNoise * 300,
            pushX: (deltaX / length) * push + velocityX * 8,
            pushY: (deltaY / length) * push + velocityY * 8,
          });
        }
      }

      if (displaced.size > maxCells) {
        const overflow = displaced.size - maxCells;
        for (const key of Array.from(displaced.keys()).slice(0, overflow)) displaced.delete(key);
      }
      requestDraw();
    };

    const handlePointerLeave = () => {
      previousPointer = null;
      requestDraw();
    };

    const scheduleResize = () => {
      if (resizeFrame) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        resize();
      });
    };

    resize();
    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(hero);
    const themeObserver = new MutationObserver(() => {
      readPalette();
      paintBase();
      draw(performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const syncPointerTracking = () => {
      hero.removeEventListener("pointermove", handlePointerMove);
      hero.removeEventListener("pointerleave", handlePointerLeave);
      if (canTrackPointer.matches && !reducedMotion.matches) {
        hero.addEventListener("pointermove", handlePointerMove, { passive: true });
        hero.addEventListener("pointerleave", handlePointerLeave);
        return;
      }
      previousPointer = null;
      displaced.clear();
      requestDraw();
    };

    syncPointerTracking();
    reducedMotion.addEventListener("change", syncPointerTracking);
    canTrackPointer.addEventListener("change", syncPointerTracking);

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      reducedMotion.removeEventListener("change", syncPointerTracking);
      canTrackPointer.removeEventListener("change", syncPointerTracking);
      hero.removeEventListener("pointermove", handlePointerMove);
      hero.removeEventListener("pointerleave", handlePointerLeave);
      if (frame) window.cancelAnimationFrame(frame);
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
    };
  }, []);

  return <canvas ref={canvasRef} className="home-hero-dither-motion" aria-hidden="true" />;
}
