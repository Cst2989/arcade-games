export abstract class Scene {
  onEnter(): void {}
  onExit(): void {}
  update(_dt: number): void {}
  render(_alpha: number): void {}
  onResume(): void {}
  onPause(): void {}
}
