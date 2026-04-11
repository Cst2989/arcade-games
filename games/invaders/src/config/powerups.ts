export type PowerupKind = 'revert' | 'fork' | 'rebase' | 'squash' | 'forcepush';

export interface PowerupDef {
  kind: PowerupKind;
  label: string;
  color: string;
  sprite: string;
}

export const POWERUPS: PowerupDef[] = [
  { kind: 'revert',    label: 'revert',     color: '#3fb950', sprite: 'powerupGreen_shield.png' },
  { kind: 'fork',      label: 'fork',       color: '#58a6ff', sprite: 'powerupBlue_bolt.png' },
  { kind: 'rebase',    label: 'rebase',     color: '#d29922', sprite: 'powerupYellow_star.png' },
  { kind: 'squash',    label: 'squash',     color: '#a371f7', sprite: 'powerupRed_bolt.png' },
  { kind: 'forcepush', label: 'force push', color: '#f85149', sprite: 'powerupRed_star.png' },
];
