const IN_GAME_CLASS = 'osi-in-game';

export function setInGame(inGame: boolean): void {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle(IN_GAME_CLASS, inGame);
}
