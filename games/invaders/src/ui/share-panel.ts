export interface ShareContributor {
  login: string;
  avatarImage?: HTMLImageElement;
  totalCommits: number;
}

export interface SharePanelOptions {
  repoName: string;
  contributors: ShareContributor[];
  finalScore: number;
  pageUrl?: string;
  onReplay: () => void;
}

const PANEL_ID = 'osi-share-panel';
const STYLE_ID = 'osi-share-panel-style';

const STYLE_CSS = `
#osi-share-panel {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(13, 17, 23, 0.82);
  backdrop-filter: blur(4px);
  font-family: ui-monospace, Menlo, monospace;
  color: #c9d1d9;
  animation: osi-share-fade 0.25s ease-out;
}
@keyframes osi-share-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
#osi-share-panel .osi-share-card {
  background: #161b22;
  border: 2px solid #2ea043;
  box-shadow: 0 0 40px rgba(57, 211, 83, 0.28), 0 20px 60px rgba(0, 0, 0, 0.7);
  width: 100%;
  max-width: 720px;
  max-height: 92vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
#osi-share-panel .osi-share-header {
  padding: 14px 20px;
  background: linear-gradient(90deg, rgba(57,211,83,0.18), rgba(57,211,83,0));
  border-bottom: 1px solid #30363d;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
#osi-share-panel h2 {
  margin: 0;
  font-size: 16px;
  color: #39d353;
  letter-spacing: 0.3px;
}
#osi-share-panel .osi-share-close {
  background: transparent;
  color: #8b949e;
  border: 1px solid #30363d;
  padding: 4px 10px;
  font: bold 11px ui-monospace, Menlo, monospace;
  cursor: pointer;
}
#osi-share-panel .osi-share-close:hover { color: #c9d1d9; border-color: #58a6ff; }
#osi-share-panel .osi-share-body {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
#osi-share-panel .osi-share-preview {
  background: #0d1117;
  border: 1px solid #30363d;
  display: flex;
  justify-content: center;
  padding: 10px;
}
#osi-share-panel .osi-share-preview img {
  max-width: 100%;
  height: auto;
  display: block;
}
#osi-share-panel .osi-share-msg {
  font-size: 12px;
  color: #8b949e;
  line-height: 1.5;
  margin: 0;
  padding: 10px 12px;
  background: #0d1117;
  border: 1px solid #30363d;
  white-space: pre-wrap;
}
#osi-share-panel .osi-share-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
#osi-share-panel .osi-share-buttons button,
#osi-share-panel .osi-share-buttons a {
  font: bold 11px ui-monospace, Menlo, monospace;
  text-decoration: none;
  text-align: center;
  padding: 10px 8px;
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  cursor: pointer;
  letter-spacing: 0.3px;
  transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;
}
#osi-share-panel .osi-share-buttons button:hover,
#osi-share-panel .osi-share-buttons a:hover {
  border-color: #58a6ff;
  background: #30363d;
  transform: translateY(-1px);
}
#osi-share-panel .osi-share-buttons .osi-btn-primary {
  background: #238636;
  color: #ffffff;
  border-color: #2ea043;
}
#osi-share-panel .osi-share-buttons .osi-btn-primary:hover {
  background: #2ea043;
  border-color: #3fb950;
}
#osi-share-panel .osi-share-actions {
  display: flex;
  gap: 8px;
  justify-content: space-between;
  align-items: center;
  margin-top: 2px;
  flex-wrap: wrap;
}
#osi-share-panel .osi-share-replay {
  flex: 1;
  min-width: 160px;
  font: bold 13px ui-monospace, Menlo, monospace;
  padding: 12px 16px;
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  cursor: pointer;
}
#osi-share-panel .osi-share-replay:hover { border-color: #58a6ff; color: #ffffff; }
#osi-share-panel .osi-share-follow {
  flex: 1.3;
  min-width: 220px;
  font: bold 13px ui-monospace, Menlo, monospace;
  padding: 12px 16px;
  background: #238636;
  color: #ffffff;
  text-decoration: none;
  border: 1px solid #2ea043;
  text-align: center;
  animation: osi-share-pulse 2.4s ease-in-out infinite;
}
#osi-share-panel .osi-share-follow:hover { background: #2ea043; }
@keyframes osi-share-pulse {
  0%, 100% { box-shadow: 0 0 12px rgba(57, 211, 83, 0.25); }
  50%      { box-shadow: 0 0 22px rgba(57, 211, 83, 0.55); }
}
#osi-share-panel .osi-share-toast {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  background: #0d1117;
  color: #39d353;
  border: 1px solid #2ea043;
  padding: 8px 14px;
  font: bold 11px ui-monospace, Menlo, monospace;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
#osi-share-panel .osi-share-toast.visible { opacity: 1; }
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = STYLE_CSS;
  document.head.append(s);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

function drawCircleImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  radius: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const size = radius * 2;
  ctx.drawImage(img, cx - radius, cy - radius, size, size);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#39d353';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawFallbackAvatar(
  ctx: CanvasRenderingContext2D,
  login: string,
  cx: number,
  cy: number,
  radius: number,
): void {
  ctx.save();
  ctx.fillStyle = '#21262d';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#39d353';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#c9d1d9';
  ctx.font = `bold ${Math.floor(radius * 0.9)}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((login[0] ?? '?').toUpperCase(), cx, cy + 2);
  ctx.restore();
}

function renderShareImage(opts: SharePanelOptions): HTMLCanvasElement {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, W, H);

  const shades = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
  const cell = 14;
  const gap = 3;
  ctx.globalAlpha = 0.22;
  for (let y = 0; y < H; y += cell + gap) {
    for (let x = 0; x < W; x += cell + gap) {
      const i = Math.floor(Math.random() * 6);
      const color = i < 5 ? shades[i]! : '#161b22';
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cell, cell);
    }
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(13, 17, 23, 0.68)';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#2ea043';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, W - 36, H - 36);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#39d353';
  ctx.font = 'bold 56px ui-monospace, Menlo, monospace';
  ctx.fillText('MAIN BRANCH GREEN', W / 2, 110);

  ctx.fillStyle = '#c9d1d9';
  ctx.font = 'bold 26px ui-monospace, Menlo, monospace';
  ctx.fillText(`I defeated ${opts.repoName}`, W / 2, 158);

  const totalCommits = opts.contributors.reduce((n, c) => n + c.totalCommits, 0);
  ctx.fillStyle = '#8b949e';
  ctx.font = '22px ui-monospace, Menlo, monospace';
  ctx.fillText(
    `${totalCommits.toLocaleString()} contributions in the past year`,
    W / 2,
    196,
  );

  const rowY = 320;
  const count = opts.contributors.length;
  const spacing = 180;
  const totalW = (count - 1) * spacing;
  const startX = W / 2 - totalW / 2;
  const radius = 62;

  for (let i = 0; i < count; i++) {
    const c = opts.contributors[i]!;
    const cx = startX + i * spacing;
    if (c.avatarImage && c.avatarImage.complete && c.avatarImage.naturalWidth > 0) {
      try { drawCircleImage(ctx, c.avatarImage, cx, rowY, radius); }
      catch { drawFallbackAvatar(ctx, c.login, cx, rowY, radius); }
    } else {
      drawFallbackAvatar(ctx, c.login, cx, rowY, radius);
    }
    const rank = count - i;
    ctx.fillStyle = '#ffa657';
    ctx.font = 'bold 14px ui-monospace, Menlo, monospace';
    ctx.fillText(`#${rank}`, cx, rowY - radius - 12);
    ctx.fillStyle = '#c9d1d9';
    ctx.font = 'bold 16px ui-monospace, Menlo, monospace';
    const label = c.login.length > 14 ? c.login.slice(0, 13) + '…' : c.login;
    ctx.fillText(label, cx, rowY + radius + 26);
    ctx.fillStyle = '#8b949e';
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.fillText(`${c.totalCommits} commits`, cx, rowY + radius + 46);
  }

  ctx.fillStyle = '#6e7681';
  ctx.font = '14px ui-monospace, Menlo, monospace';
  ctx.fillText('FINAL SCORE', W / 2, 508);
  ctx.fillStyle = '#39d353';
  ctx.font = 'bold 52px ui-monospace, Menlo, monospace';
  ctx.fillText(opts.finalScore.toLocaleString(), W / 2, 562);

  ctx.fillStyle = '#8b949e';
  ctx.font = 'bold 16px ui-monospace, Menlo, monospace';
  ctx.fillText('OPEN SOURCE INVADERS · play any repo', W / 2, H - 34);

  return canvas;
}

function buildShareText(opts: SharePanelOptions): string {
  const totalCommits = opts.contributors.reduce((n, c) => n + c.totalCommits, 0);
  return (
    `I just beat ${opts.repoName} on Open Source Invaders 🎮\n` +
    `Defeated ${totalCommits.toLocaleString()} contributions in the past year — ` +
    `score ${opts.finalScore.toLocaleString()}.\n` +
    `Turn any GitHub repo into a retro arcade game:`
  );
}

function buildIntentUrls(
  opts: SharePanelOptions,
  pageUrl: string,
): { twitter: string; bluesky: string; linkedin: string } {
  const text = buildShareText(opts);
  const twitter =
    'https://twitter.com/intent/tweet' +
    `?text=${encodeURIComponent(text)}` +
    `&url=${encodeURIComponent(pageUrl)}`;
  const bluesky =
    'https://bsky.app/intent/compose' +
    `?text=${encodeURIComponent(text + ' ' + pageUrl)}`;
  const linkedin =
    'https://www.linkedin.com/sharing/share-offsite/' +
    `?url=${encodeURIComponent(pageUrl)}`;
  return { twitter, bluesky, linkedin };
}

function showToast(root: HTMLElement, message: string): void {
  const toast = el('div', { className: 'osi-share-toast', textContent: message });
  root.append(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 250);
  }, 1600);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

export function mountSharePanel(opts: SharePanelOptions): void {
  ensureStyle();
  document.getElementById(PANEL_ID)?.remove();

  const pageUrl = opts.pageUrl ?? `https://os-invaders.com?repo=${encodeURIComponent(opts.repoName)}`;
  const intents = buildIntentUrls(opts, pageUrl);
  const shareText = buildShareText(opts);

  const canvas = renderShareImage(opts);
  const dataUrl = (() => {
    try { return canvas.toDataURL('image/png'); } catch { return ''; }
  })();

  const preview = el('div', { className: 'osi-share-preview' });
  const previewImg = el('img', {
    alt: 'Open Source Invaders victory card',
  }) as HTMLImageElement;
  if (dataUrl) previewImg.src = dataUrl;
  preview.append(previewImg);

  const msg = el('p', { className: 'osi-share-msg', textContent: shareText });

  const twitterLink = el('a', {
    href: intents.twitter,
    target: '_blank',
    rel: 'noopener noreferrer',
    textContent: 'TWEET  →',
  });
  twitterLink.classList.add('osi-btn-primary');

  const blueskyLink = el('a', {
    href: intents.bluesky,
    target: '_blank',
    rel: 'noopener noreferrer',
    textContent: 'BLUESKY  →',
  });
  const linkedinLink = el('a', {
    href: intents.linkedin,
    target: '_blank',
    rel: 'noopener noreferrer',
    textContent: 'LINKEDIN  →',
  });

  const downloadBtn = el('button', { type: 'button', textContent: 'DOWNLOAD PNG' });
  const copyImgBtn = el('button', { type: 'button', textContent: 'COPY IMAGE' });
  const copyLinkBtn = el('button', { type: 'button', textContent: 'COPY LINK' });

  const row1 = el('div', { className: 'osi-share-buttons' }, [twitterLink, blueskyLink, linkedinLink]);
  const row2 = el('div', { className: 'osi-share-buttons' }, [downloadBtn, copyImgBtn, copyLinkBtn]);

  const replayBtn = el('button', {
    type: 'button',
    className: 'osi-share-replay',
    textContent: '↻  PLAY ANOTHER REPO',
  });
  const followLink = el('a', {
    href: 'https://neciudan.dev/subscribe',
    target: '_blank',
    rel: 'noopener noreferrer',
    className: 'osi-share-follow',
    textContent: '♥  LIKE THIS? FOLLOW NECIUDAN.DEV  →',
  });
  const actions = el('div', { className: 'osi-share-actions' }, [replayBtn, followLink]);

  const closeBtn = el('button', { type: 'button', className: 'osi-share-close', textContent: '✕ CLOSE' });
  const header = el('div', { className: 'osi-share-header' }, [
    el('h2', { textContent: '★ SHARE YOUR VICTORY ★' }),
    closeBtn,
  ]);
  const body = el('div', { className: 'osi-share-body' }, [
    preview, msg, row1, row2, actions,
  ]);
  const card = el('div', { className: 'osi-share-card' }, [header, body]);
  const root = el('div', { id: PANEL_ID }, [card]);

  downloadBtn.onclick = async () => {
    const blob = await canvasToBlob(canvas);
    const href = blob ? URL.createObjectURL(blob) : dataUrl;
    if (!href) return;
    const a = el('a', {
      href,
      download: `open-source-invaders-${opts.repoName.replace(/\//g, '-')}.png`,
    });
    document.body.append(a);
    a.click();
    a.remove();
    if (blob) setTimeout(() => URL.revokeObjectURL(href), 2000);
    showToast(root, 'DOWNLOADED');
  };

  copyImgBtn.onclick = async () => {
    try {
      const blob = await canvasToBlob(canvas);
      if (!blob) throw new Error('no blob');
      const ClipboardItemCtor = (window as unknown as { ClipboardItem?: typeof ClipboardItem })
        .ClipboardItem;
      if (!ClipboardItemCtor || !navigator.clipboard?.write) throw new Error('no clipboard');
      await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
      showToast(root, 'IMAGE COPIED');
    } catch {
      showToast(root, 'COPY NOT SUPPORTED — USE DOWNLOAD');
    }
  };

  copyLinkBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${pageUrl}`);
      showToast(root, 'LINK COPIED');
    } catch {
      showToast(root, 'COPY FAILED');
    }
  };

  const close = () => {
    root.remove();
  };
  closeBtn.onclick = close;
  replayBtn.onclick = () => {
    close();
    opts.onReplay();
  };
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });

  document.body.append(root);
}

export function unmountSharePanel(): void {
  document.getElementById(PANEL_ID)?.remove();
}
