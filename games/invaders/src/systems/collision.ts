import type { GameContext } from '../scenes/gameplay-context.js';
import {
  Bullet, Collider, Enemy, Player, Position, Powerup, BossTag, Drone,
} from '../components/index.js';

export interface HitEvent {
  bullet: number;
  target: number;
  targetKind: 'enemy' | 'player' | 'powerup' | 'boss' | 'drone';
}

interface BulletBox { id: number; x: number; y: number; w: number; h: number; fromPlayer: boolean }

function aabb(
  b: BulletBox,
  pos: { x: number; y: number },
  col: { w: number; h: number },
): boolean {
  const ax = pos.x - col.w / 2;
  const ay = pos.y - col.h / 2;
  return b.x < ax + col.w && b.x + b.w > ax && b.y < ay + col.h && b.y + b.h > ay;
}

export function collisionSystem(_dt: number, ctx: GameContext): HitEvent[] {
  const { world } = ctx;
  const hits: HitEvent[] = [];

  const bullets: BulletBox[] = [];
  for (const [id, pos, col, b] of world.query(Position, Collider, Bullet)) {
    bullets.push({ id, x: pos.x - col.w / 2, y: pos.y - col.h / 2, w: col.w, h: col.h, fromPlayer: b.fromPlayer });
  }

  for (const b of bullets) {
    if (b.fromPlayer) {
      for (const [eid, pos, col] of world.query(Position, Collider, Enemy)) {
        if (aabb(b, pos, col)) {
          hits.push({ bullet: b.id, target: eid, targetKind: 'enemy' });
        }
      }
      for (const [eid, pos, col] of world.query(Position, Collider, BossTag)) {
        if (aabb(b, pos, col)) hits.push({ bullet: b.id, target: eid, targetKind: 'boss' });
      }
      for (const [eid, pos, col] of world.query(Position, Collider, Drone)) {
        if (aabb(b, pos, col)) hits.push({ bullet: b.id, target: eid, targetKind: 'drone' });
      }
    } else {
      for (const [eid, pos, col] of world.query(Position, Collider, Player)) {
        if (aabb(b, pos, col)) hits.push({ bullet: b.id, target: eid, targetKind: 'player' });
      }
    }
  }

  for (const [pid, ppos, pcol] of world.query(Position, Collider, Player)) {
    for (const [uid, upos, ucol] of world.query(Position, Collider, Powerup)) {
      if (
        Math.abs(ppos.x - upos.x) < (pcol.w + ucol.w) / 2 &&
        Math.abs(ppos.y - upos.y) < (pcol.h + ucol.h) / 2
      ) {
        hits.push({ bullet: uid, target: pid, targetKind: 'powerup' });
      }
    }
  }

  return hits;
}
