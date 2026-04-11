export const ENGINE_VERSION = '0.1.0';

// util
export { clamp, lerp, randRange } from './util/math.js';
export { Vec2 } from './util/vec2.js';
export { Rect } from './util/rect.js';
export { perlin1 } from './util/perlin.js';

// core
export { World, defineComponent } from './core/world.js';
export type { Entity, Component } from './core/world.js';
export { GameLoop } from './core/gameloop.js';
export { EventBus } from './core/events.js';

// scene
export { Scene } from './scene/scene.js';
export { SceneManager } from './scene/scene-manager.js';

// input
export { Keyboard } from './input/keyboard.js';
export { Pointer } from './input/pointer.js';
export { InputMap } from './input/input-map.js';

// render
export { Renderer } from './render/renderer.js';
export type { LayerConfig, LayerName } from './render/renderer.js';
export { SpriteAtlas, parseAtlasXml } from './render/sprite-atlas.js';
export type { AtlasFrame } from './render/sprite-atlas.js';
export { Camera } from './render/camera.js';

// fx
export { ParticleEmitter } from './fx/particles.js';
export type { ParticleSpawn, ParticleConfig } from './fx/particles.js';
export { Tween, Easing } from './fx/tween.js';
export { ScreenShake } from './fx/screen-shake.js';

// audio
export { AudioBus } from './audio/audio-bus.js';
export { Sfx } from './audio/sfx.js';
export { AmbientMusic } from './audio/ambient-music.js';
export type { AmbientMode } from './audio/ambient-music.js';
