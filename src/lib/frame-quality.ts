export function luminanceEdgeScore(data: Uint8ClampedArray, width: number, height: number): number {
  if (width < 2 || height < 2 || data.length < width * height * 4) return 0;
  let total = 0;
  let samples = 0;
  const luminance = (offset: number) => data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
  for (let y = 1; y < height; y += 2) {
    for (let x = 1; x < width; x += 2) {
      const offset = (y * width + x) * 4;
      total += Math.abs(luminance(offset) - luminance(offset - 4));
      total += Math.abs(luminance(offset) - luminance(offset - width * 4));
      samples += 2;
    }
  }
  return samples ? total / samples : 0;
}
