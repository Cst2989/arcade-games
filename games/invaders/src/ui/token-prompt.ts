import { setToken } from '../data/github-client.js';

export interface TokenPromptHandlers {
  onSave: () => void;
  onCancel: () => void;
}

const DIALOG_ID = 'osi-token-dialog';
const STYLE_ID = 'osi-token-dialog-style';

const STYLE_CSS = `
#osi-token-dialog {
  color: #c9d1d9;
  background: #161b22;
  border: 2px solid #f85149;
  padding: 0;
  max-width: 460px;
  width: calc(100% - 48px);
  font-family: ui-monospace, Menlo, monospace;
  box-shadow: 0 0 40px rgba(248, 81, 73, 0.35), 0 10px 60px rgba(0, 0, 0, 0.7);
  animation: osi-dialog-pop 0.18s ease-out;
}
#osi-token-dialog::backdrop {
  background: rgba(13, 17, 23, 0.88);
  backdrop-filter: blur(3px);
}
@keyframes osi-dialog-pop {
  from { opacity: 0; transform: scale(0.94); }
  to { opacity: 1; transform: scale(1); }
}
#osi-token-dialog .osi-header {
  background: linear-gradient(90deg, rgba(248,81,73,0.18), rgba(248,81,73,0));
  padding: 16px 22px 12px;
  border-bottom: 1px solid #30363d;
}
#osi-token-dialog .osi-badge {
  display: inline-block;
  font-size: 10px;
  letter-spacing: 0.8px;
  color: #ffa657;
  background: rgba(255, 166, 87, 0.12);
  border: 1px solid rgba(255, 166, 87, 0.35);
  padding: 3px 8px;
  margin-bottom: 8px;
}
#osi-token-dialog h2 {
  margin: 0;
  font-size: 18px;
  color: #f85149;
  letter-spacing: 0.3px;
}
#osi-token-dialog .osi-body { padding: 18px 22px 20px; }
#osi-token-dialog p {
  margin: 0 0 14px 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: #8b949e;
}
#osi-token-dialog p code {
  background: #0d1117;
  padding: 1px 6px;
  border: 1px solid #30363d;
  color: #79c0ff;
  font-size: 12px;
}
#osi-token-dialog a { color: #58a6ff; text-decoration: none; }
#osi-token-dialog a:hover { text-decoration: underline; }
#osi-token-dialog input {
  width: 100%;
  padding: 10px 12px;
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  box-sizing: border-box;
  font: 13px ui-monospace, Menlo, monospace;
  outline: none;
}
#osi-token-dialog input:focus {
  border-color: #58a6ff;
  box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.25);
}
#osi-token-dialog .osi-row {
  margin-top: 16px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
#osi-token-dialog button {
  font: bold 12px ui-monospace, Menlo, monospace;
  padding: 9px 18px;
  cursor: pointer;
  border: 1px solid;
  letter-spacing: 0.3px;
  transition: transform 0.1s ease;
}
#osi-token-dialog button:hover { transform: translateY(-1px); }
#osi-token-dialog button[data-action="cancel"] {
  background: #21262d; color: #8b949e; border-color: #30363d;
}
#osi-token-dialog button[data-action="save"] {
  background: #238636; color: #ffffff; border-color: #2ea043;
}
#osi-token-dialog .osi-foot {
  margin: 12px 0 0 0; font-size: 10.5px; color: #6e7681;
}
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE_CSS;
  document.head.append(style);
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

export function promptForToken({ onSave, onCancel }: TokenPromptHandlers): void {
  ensureStyle();
  document.getElementById(DIALOG_ID)?.remove();

  const dialog = document.createElement('dialog') as HTMLDialogElement;
  dialog.id = DIALOG_ID;
  dialog.setAttribute('aria-labelledby', 'osi-token-title');
  dialog.setAttribute('aria-describedby', 'osi-token-desc');

  const badge = el('span', { className: 'osi-badge', textContent: '⚠ RATE LIMIT' });
  const title = el('h2', { id: 'osi-token-title', textContent: 'GitHub API limit reached' });
  const header = el('div', { className: 'osi-header' }, [badge, title]);

  const tokenLink = el('a', {
    href: 'https://github.com/settings/tokens/new?scopes=public_repo&description=Open%20Source%20Invaders',
    target: '_blank',
    rel: 'noopener noreferrer',
    textContent: 'personal access token',
  });
  const scopeCode = el('code', { textContent: 'public_repo' });
  const storageCode = el('code', { textContent: 'localStorage' });

  const desc = el('p', { id: 'osi-token-desc' }, [
    "GitHub's unauthenticated API allows only ",
    el('strong', { textContent: '60 requests/hour' }),
    '. Paste a ',
    tokenLink,
    ' (classic, scope ',
    scopeCode,
    ") to continue with real data. Stored only in your browser's ",
    storageCode,
    '.',
  ]);

  const input = el('input', {
    type: 'text',
    placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    autocomplete: 'off',
    spellcheck: false,
  });

  const cancelBtn = el('button', { type: 'button', textContent: 'Play with mock data' });
  cancelBtn.dataset['action'] = 'cancel';
  const saveBtn = el('button', { type: 'button', textContent: 'Save & retry' });
  saveBtn.dataset['action'] = 'save';

  const row = el('div', { className: 'osi-row' }, [cancelBtn, saveBtn]);
  const foot = el('p', { className: 'osi-foot', textContent: 'ESC cancels · ENTER saves' });
  const body = el('div', { className: 'osi-body' }, [desc, input, row, foot]);

  dialog.append(header, body);

  let resolved = false;
  const close = (handler: () => void) => {
    if (resolved) return;
    resolved = true;
    try { dialog.close(); } catch { /* older impls */ }
    dialog.remove();
    handler();
  };

  saveBtn.onclick = () => {
    const val = input.value.trim();
    if (val) setToken(val);
    close(onSave);
  };
  cancelBtn.onclick = () => close(onCancel);

  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close(onCancel);
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close(onCancel);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBtn.click();
    }
  });

  document.body.append(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  setTimeout(() => input.focus(), 0);
}
