import type { ProductDetection } from "@/lib/types";

export interface LumaFrame {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export interface FrameTranslation {
  dx: number;
  dy: number;
  difference: number;
  confidence: number;
}

export interface CameraCandidateBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rgbaToLuma(rgba: Uint8ClampedArray, width: number, height: number): LumaFrame {
  const pixels = new Uint8Array(width * height);
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 1) {
    pixels[target] = Math.round(rgba[source] * 0.299 + rgba[source + 1] * 0.587 + rgba[source + 2] * 0.114);
  }
  return { width, height, pixels };
}

export function estimateFrameTranslation(
  reference: LumaFrame,
  current: LumaFrame,
  maxShift = 8
): FrameTranslation | null {
  if (reference.width !== current.width || reference.height !== current.height) return null;
  let bestDifference = Number.POSITIVE_INFINITY;
  let bestDx = 0;
  let bestDy = 0;
  let samples = 0;

  for (let dy = -maxShift; dy <= maxShift; dy += 2) {
    for (let dx = -maxShift; dx <= maxShift; dx += 2) {
      let total = 0;
      let count = 0;
      for (let y = maxShift; y < reference.height - maxShift; y += 3) {
        const currentY = y + dy;
        if (currentY < 0 || currentY >= current.height) continue;
        for (let x = maxShift; x < reference.width - maxShift; x += 3) {
          const currentX = x + dx;
          if (currentX < 0 || currentX >= current.width) continue;
          total += Math.abs(
            reference.pixels[y * reference.width + x] - current.pixels[currentY * current.width + currentX]
          );
          count += 1;
        }
      }
      if (!count) continue;
      const difference = total / count;
      if (difference < bestDifference) {
        bestDifference = difference;
        bestDx = dx;
        bestDy = dy;
        samples = count;
      }
    }
  }

  if (!samples || !Number.isFinite(bestDifference)) return null;
  return {
    dx: bestDx / reference.width,
    dy: bestDy / reference.height,
    difference: bestDifference,
    confidence: Math.max(0, Math.min(1, 1 - bestDifference / 42))
  };
}

export function translateDetection(
  detection: ProductDetection,
  translation: Pick<FrameTranslation, "dx" | "dy">
): ProductDetection {
  return {
    ...detection,
    box: {
      ...detection.box,
      x: Math.max(0, Math.min(1 - detection.box.width, detection.box.x + translation.dx)),
      y: Math.max(0, Math.min(1 - detection.box.height, detection.box.y + translation.dy))
    }
  };
}

export function isSameCameraScene(translation: FrameTranslation | null) {
  return Boolean(translation && translation.difference <= 25 && translation.confidence >= 0.38);
}

export function proposeCameraCandidates(frame: LumaFrame, limit = 6): CameraCandidateBox[] {
  const columns = 6;
  const rows = 5;
  const scores: Array<{ column: number; row: number; score: number }> = [];
  const cellWidth = Math.floor(frame.width / columns);
  const cellHeight = Math.floor(frame.height / rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let edges = 0;
      let samples = 0;
      const startX = column * cellWidth;
      const startY = row * cellHeight;
      const endX = column === columns - 1 ? frame.width - 1 : (column + 1) * cellWidth - 1;
      const endY = row === rows - 1 ? frame.height - 1 : (row + 1) * cellHeight - 1;
      for (let y = startY + 1; y < endY; y += 2) {
        for (let x = startX + 1; x < endX; x += 2) {
          const center = frame.pixels[y * frame.width + x];
          edges += Math.abs(center - frame.pixels[y * frame.width + x + 1]);
          edges += Math.abs(center - frame.pixels[(y + 1) * frame.width + x]);
          samples += 2;
        }
      }
      scores.push({ column, row, score: samples ? edges / samples : 0 });
    }
  }

  const sorted = scores.map((entry) => entry.score).sort((a, b) => a - b);
  const threshold = Math.max(13, sorted[Math.floor(sorted.length * 0.68)] || 0);
  return scores
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ column, row }) => ({
      x: Math.max(0, column / columns - 0.012),
      y: Math.max(0, row / rows - 0.015),
      width: Math.min(1 - column / columns, 1 / columns + 0.024),
      height: Math.min(1 - row / rows, 1 / rows + 0.03)
    }));
}
