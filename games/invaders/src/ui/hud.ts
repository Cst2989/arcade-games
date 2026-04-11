import type { Renderer } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import type { HudState } from '../scenes/gameplay-context.js';

export function drawHud(renderer: Renderer, hud: HudState): void {
  const ctx = renderer.main;
  ctx.save();
  ctx.font = '14px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#c9d1d9';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${hud.score}`, 20, 24);
  ctx.fillText(`WAVE ${hud.waveIndex + 1}/${hud.totalWaves}`, 20, 44);
  const hpW = 160;
  ctx.fillStyle = BALANCE.bgAlt;
  ctx.fillRect(BALANCE.viewportWidth - hpW - 20, 16, hpW, 12);
  ctx.fillStyle = BALANCE.accentGreen;
  const r = hud.playerMaxHp > 0 ? hud.playerHp / hud.playerMaxHp : 0;
  ctx.fillRect(BALANCE.viewportWidth - hpW - 20, 16, hpW * r, 12);
  ctx.fillStyle = '#8b949e';
  ctx.textAlign = 'right';
  ctx.fillText(`HP ${hud.playerHp}/${hud.playerMaxHp}`, BALANCE.viewportWidth - 20, 44);

  ctx.font = '12px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = hud.bombsLeft > 0 ? '#f85149' : '#484f58';
  ctx.fillText(`BOMB x${hud.bombsLeft}  [X]`, BALANCE.viewportWidth - 20, 64);

  let chipX = BALANCE.viewportWidth - 20;
  const chipY = 84;
  ctx.font = '11px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'right';
  for (const chip of hud.activePowerups) {
    const w = ctx.measureText(chip.label).width + 14;
    ctx.fillStyle = chip.color;
    ctx.globalAlpha = 0.20;
    ctx.fillRect(chipX - w, chipY - 12, w, 18);
    ctx.globalAlpha = 1;
    ctx.fillStyle = chip.color;
    ctx.fillText(chip.label, chipX - 7, chipY + 1);
    chipX -= w + 6;
  }

  if (hud.combo > 1) {
    ctx.fillStyle = BALANCE.accentYellow;
    ctx.font = 'bold 14px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`×${hud.combo} COMBO`, 150, 44);
  }
  if (hud.chaos) {
    const label = `!! ${hud.chaos.replace(/_/g, ' ')} !!`;
    ctx.font = 'bold 18px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    const chaosCx = 576 + 360 / 2;
    const chaosCy = 462;
    const textW = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
    ctx.fillRect(chaosCx - textW / 2 - 12, chaosCy - 18, textW + 24, 28);
    ctx.strokeStyle = BALANCE.accentRed;
    ctx.lineWidth = 1;
    ctx.strokeRect(chaosCx - textW / 2 - 12, chaosCy - 18, textW + 24, 28);
    ctx.fillStyle = BALANCE.accentRed;
    ctx.fillText(label, chaosCx, chaosCy);
  }
  ctx.restore();
}
