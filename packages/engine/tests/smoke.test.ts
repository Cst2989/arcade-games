import { expect, test } from 'vitest';
import { ENGINE_VERSION } from '../src/index.js';

test('engine version is exported', () => {
  expect(ENGINE_VERSION).toBe('0.1.0');
});
