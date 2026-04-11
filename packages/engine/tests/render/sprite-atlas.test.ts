import { expect, test } from 'vitest';
import { parseAtlasXml } from '../../src/render/sprite-atlas.js';

const xml = `<?xml version="1.0"?>
<TextureAtlas imagePath="sheet.png">
  <SubTexture name="playerShip1_blue.png" x="0" y="0" width="99" height="75"/>
  <SubTexture name="laserBlue01.png" x="100" y="0" width="9" height="54"/>
</TextureAtlas>`;

test('parseAtlasXml returns sub-rects keyed by name', () => {
  const frames = parseAtlasXml(xml);
  expect(frames.get('playerShip1_blue.png')).toEqual({ x: 0, y: 0, w: 99, h: 75 });
  expect(frames.get('laserBlue01.png')).toEqual({ x: 100, y: 0, w: 9, h: 54 });
});
