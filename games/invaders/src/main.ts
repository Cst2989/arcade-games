import { ENGINE_VERSION } from '@osi/engine';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.fillStyle = '#58a6ff';
ctx.font = '20px ui-monospace, Menlo, monospace';
ctx.fillText(`Open Source Invaders — engine v${ENGINE_VERSION}`, 20, 40);
