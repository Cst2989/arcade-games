import type { Renderer } from '@osi/engine';
import { BALANCE } from '../config/balance.js';
import type { HudState } from '../scenes/gameplay-context.js';
import { isTouchDevice } from './touch-detect.js';
import { drawInvaderLogo } from './brand.js';

export function drawHud(renderer: Renderer, hud: HudState): void {
  const ctx = renderer.main;
  const mobile = isTouchDevice();
  ctx.save();

  const W = BALANCE.viewportWidth;

  ctx.font = mobile ? '12px ui-monospace, Menlo, monospace' : '14px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#c9d1d9';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${hud.score}`, 20, 24);
  if (!mobile) ctx.fillText(`WAVE ${hud.waveIndex + 1}/${hud.totalWaves}`, 20, 44);

  if (hud.repoName) {
    const repoY = mobile ? 40 : 64;
    drawInvaderLogo(ctx, 30, repoY - 4, 2);
    ctx.fillStyle = '#39d353';
    ctx.font = mobile ? '10px ui-monospace, Menlo, monospace' : '12px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(hud.repoName, 44, repoY);
  }

  const hpW = mobile ? 100 : 160;
  ctx.fillStyle = BALANCE.bgAlt;
  ctx.fillRect(W - hpW - 20, 16, hpW, mobile ? 8 : 12);
  ctx.fillStyle = BALANCE.accentGreen;
  const r = hud.playerMaxHp > 0 ? hud.playerHp / hud.playerMaxHp : 0;
  ctx.fillRect(W - hpW - 20, 16, hpW * r, mobile ? 8 : 12);
  ctx.fillStyle = '#8b949e';
  ctx.textAlign = 'right';
  ctx.font = mobile ? '10px ui-monospace, Menlo, monospace' : '14px ui-monospace, Menlo, monospace';
  ctx.fillText(`HP ${hud.playerHp}/${hud.playerMaxHp}`, W - 20, mobile ? 38 : 44);

  if (!mobile) {
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = hud.bombsLeft > 0 ? '#f85149' : '#484f58';
    ctx.fillText(`BOMB x${hud.bombsLeft}  [X]`, W - 20, 64);

    let chipX = W - 20;
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
  }

  if (hud.combo > 1) {
    ctx.fillStyle = BALANCE.accentYellow;
    ctx.font = mobile ? 'bold 12px ui-monospace, Menlo, monospace' : 'bold 14px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`×${hud.combo} COMBO`, mobile ? 120 : 150, mobile ? 24 : 44);
  }
  if (hud.chaos) {
    const label = `!! ${hud.chaos.replace(/_/g, ' ')} !!`;
    ctx.font = mobile ? 'bold 14px ui-monospace, Menlo, monospace' : 'bold 18px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    const chaosCx = mobile ? W / 2 : 576 + 360 / 2;
    const chaosCy = mobile ? 56 : 462;
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
