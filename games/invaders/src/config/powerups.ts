export type PowerupKind = 'revert' | 'fork' | 'rebase' | 'squash' | 'forcepush';

export interface PowerupDef {
  kind: PowerupKind;
  label: string;
  color: string;
}

export const POWERUPS: PowerupDef[] = [
  { kind: 'revert',    label: 'git revert', color: '#3fb950' },
  { kind: 'fork',      label: 'fork',       color: '#58a6ff' },
  { kind: 'rebase',    label: 'rebase',     color: '#d29922' },
  { kind: 'squash',    label: 'squash',     color: '#a371f7' },
  { kind: 'forcepush', label: 'force push', color: '#f85149' },
];
