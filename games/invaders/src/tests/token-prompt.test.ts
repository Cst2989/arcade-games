// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { promptForToken } from '../ui/token-prompt.js';
import { setToken, hasToken } from '../data/github-client.js';

const DIALOG_ID = 'osi-token-dialog';

function getDialog(): HTMLDialogElement {
  const el = document.getElementById(DIALOG_ID);
  if (!el) throw new Error('token dialog not in DOM');
  return el as HTMLDialogElement;
}

describe('promptForToken (native <dialog> fallback modal)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    document.head.replaceChildren();
    setToken(null);
    localStorage.clear();
  });

  it('appends a <dialog> with the expected ARIA attributes', () => {
    promptForToken({ onSave: vi.fn(), onCancel: vi.fn() });

    const dialog = getDialog();
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog.getAttribute('aria-labelledby')).toBe('osi-token-title');
    expect(dialog.getAttribute('aria-describedby')).toBe('osi-token-desc');
    expect(dialog.querySelector('#osi-token-title')?.textContent?.toLowerCase()).toContain('limit');
    expect(dialog.querySelector('.osi-badge')?.textContent?.toLowerCase()).toContain('rate limit');
    expect(dialog.querySelector('#osi-token-desc')?.textContent).toContain('60 requests/hour');
  });

  it('includes a save button, cancel button, and text input', () => {
    promptForToken({ onSave: vi.fn(), onCancel: vi.fn() });
    const dialog = getDialog();

    const saveBtn = dialog.querySelector('button[data-action="save"]') as HTMLButtonElement;
    const cancelBtn = dialog.querySelector('button[data-action="cancel"]') as HTMLButtonElement;
    const input = dialog.querySelector('input') as HTMLInputElement;

    expect(saveBtn).toBeTruthy();
    expect(cancelBtn).toBeTruthy();
    expect(input).toBeTruthy();
    expect(input.type).toBe('text');
    expect(input.placeholder).toMatch(/^ghp_/);
  });

  it('save click persists the token, calls onSave, and removes the dialog', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    promptForToken({ onSave, onCancel });

    const dialog = getDialog();
    const input = dialog.querySelector('input') as HTMLInputElement;
    const saveBtn = dialog.querySelector('button[data-action="save"]') as HTMLButtonElement;

    input.value = 'ghp_testtoken1234567890';
    saveBtn.click();

    expect(hasToken()).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(document.getElementById(DIALOG_ID)).toBeNull();
  });

  it('save click with empty input still closes but does not persist a token', () => {
    const onSave = vi.fn();
    promptForToken({ onSave, onCancel: vi.fn() });

    const dialog = getDialog();
    const saveBtn = dialog.querySelector('button[data-action="save"]') as HTMLButtonElement;
    saveBtn.click();

    expect(hasToken()).toBe(false);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(document.getElementById(DIALOG_ID)).toBeNull();
  });

  it('cancel click triggers onCancel (fallback to mock) and removes the dialog', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    promptForToken({ onSave, onCancel });

    const dialog = getDialog();
    const cancelBtn = dialog.querySelector('button[data-action="cancel"]') as HTMLButtonElement;
    cancelBtn.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(hasToken()).toBe(false);
    expect(document.getElementById(DIALOG_ID)).toBeNull();
  });

  it('Enter key in input submits the save flow', () => {
    const onSave = vi.fn();
    promptForToken({ onSave, onCancel: vi.fn() });

    const dialog = getDialog();
    const input = dialog.querySelector('input') as HTMLInputElement;
    input.value = 'ghp_entertoken';

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

    expect(hasToken()).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('the native dialog "cancel" event (Escape key) triggers onCancel', () => {
    const onCancel = vi.fn();
    promptForToken({ onSave: vi.fn(), onCancel });

    const dialog = getDialog();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.getElementById(DIALOG_ID)).toBeNull();
  });

  it('double-clicking save does not call onSave twice', () => {
    const onSave = vi.fn();
    promptForToken({ onSave, onCancel: vi.fn() });

    const dialog = getDialog();
    const input = dialog.querySelector('input') as HTMLInputElement;
    const saveBtn = dialog.querySelector('button[data-action="save"]') as HTMLButtonElement;

    input.value = 'ghp_x';
    saveBtn.click();
    saveBtn.click();

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('reopening after a previous prompt replaces (does not duplicate) the dialog', () => {
    promptForToken({ onSave: vi.fn(), onCancel: vi.fn() });
    promptForToken({ onSave: vi.fn(), onCancel: vi.fn() });

    const all = document.querySelectorAll(`#${DIALOG_ID}`);
    expect(all.length).toBe(1);
  });

  it('token link points at GitHub settings with the public_repo scope pre-filled', () => {
    promptForToken({ onSave: vi.fn(), onCancel: vi.fn() });
    const link = getDialog().querySelector('a') as HTMLAnchorElement;
    expect(link.href).toContain('github.com/settings/tokens/new');
    expect(link.href).toContain('scopes=public_repo');
    expect(link.rel).toContain('noopener');
  });
});
