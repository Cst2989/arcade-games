import { expect, test } from 'vitest';
import { extractChunks, selectArc } from '../data/knowledge-extractor.js';

const readme = `
# My Project

> A small, fast tool for parsing things.

## Features

- Fast lexing
- Zero deps

## How it works

The parser walks tokens and builds a tree. It is **deterministic** and streaming.

## Usage

\`\`\`ts
const ast = parse('1 + 2');
\`\`\`
`;

test('extractChunks tags QUOTE, FEATURE, CONCEPT, CODE, FACT', () => {
  const chunks = extractChunks(readme, 'README.md');
  const kinds = new Set(chunks.map((c) => c.kind));
  expect(kinds.has('QUOTE')).toBe(true);
  expect(kinds.has('FEATURE')).toBe(true);
  expect(kinds.has('CONCEPT')).toBe(true);
  expect(kinds.has('CODE')).toBe(true);
  expect(kinds.has('FACT')).toBe(true);
});

test('selectArc returns 5 deterministically-picked chunks', () => {
  const chunks = extractChunks(readme, 'README.md');
  const arc1 = selectArc(chunks, 'owner/repo');
  const arc2 = selectArc(chunks, 'owner/repo');
  expect(arc1.length).toBe(5);
  expect(arc1.map((c) => c.kind)).toEqual(arc2.map((c) => c.kind));
});

test('selectArc respects preferred kinds per level when available', () => {
  const chunks = extractChunks(readme, 'README.md');
  const arc = selectArc(chunks, 'owner/repo');
  expect(arc[1]!.kind).toBe('FEATURE');
  expect(arc[3]!.kind).toBe('CODE');
});
