export interface BrandHeaderOptions {
  cx: number;
  topY: number;
  elapsed: number;
  compact?: boolean;
  tagline?: string | null;
}

export function drawInvaderLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  pixelSize = 4,
): void {
  const p = pixelSize;
  const pattern = [
    '  #    #  ',
    '   #  #   ',
    '  ######  ',
    ' ## ## ## ',
    '##########',
    '# ###### #',
    '# #    # #',
    '   ## ##  ',
  ];
  const h = pattern.length;
  const w = pattern[0]!.length;
  const ox = cx - (w * p) / 2;
  const oy = cy - (h * p) / 2;
  ctx.fillStyle = '#39d353';
  for (let y = 0; y < h; y++) {
    const row = pattern[y]!;
    for (let x = 0; x < w; x++) {
      if (row[x] === '#') ctx.fillRect(ox + x * p, oy + y * p, p, p);
    }
  }
}

export function drawBrandHeader(
  ctx: CanvasRenderingContext2D,
  { cx, topY, elapsed, compact = false, tagline = null }: BrandHeaderOptions,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2);
  const bob = Math.sin(elapsed * 1.6) * 2;

  const pixelSize = compact ? 3 : 4;
  const logoHalfH = compact ? 12 : 16;
  const logoCy = topY + logoHalfH + bob;
  drawInvaderLogo(ctx, cx, logoCy, pixelSize);

  const titleFontSize = compact ? 28 : 38;
  const titleGap = compact ? 22 : 42;
  const titleY = topY + logoHalfH * 2 + titleGap;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = `rgba(57, 211, 83, ${0.85 + 0.15 * pulse})`;
  ctx.font = `bold ${titleFontSize}px ui-monospace, Menlo, monospace`;
  ctx.fillText('OPEN SOURCE INVADERS', cx, titleY);

  ctx.shadowColor = 'rgba(57, 211, 83, 0.4)';
  ctx.shadowBlur = compact ? 8 : 12;
  ctx.fillText('OPEN SOURCE INVADERS', cx, titleY);
  ctx.shadowBlur = 0;

  if (tagline) {
    ctx.fillStyle = '#8b949e';
    ctx.font = `${compact ? 11 : 13}px ui-monospace, Menlo, monospace`;
    ctx.fillText(tagline, cx, titleY + (compact ? 18 : 24));
  }
  ctx.restore();
}
