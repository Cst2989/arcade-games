import type { ContributorStats, DailyCommitCount } from './contributor-stats.js';

export interface MockRepo {
  full_name: string;
  description: string;
  default_branch: string;
}

export interface MockRepoData {
  repo: MockRepo;
  contributors: ContributorStats[];
  readme: string;
}

// Deterministic LCG so the same repo name produces the same game each time.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeDaily(rng: () => number, seed: number): DailyCommitCount[] {
  const out: DailyCommitCount[] = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    // Shape the distribution: bursts + quiet stretches, with ~18% hard squares (>=10 commits).
    // seed modulates activity level across contributors.
    const roll = rng();
    let count = 0;
    if (roll > 0.55) {
      // Active day
      const intensity = rng();
      if (intensity > 0.92) count = 10 + Math.floor(rng() * 18);      // hard square
      else if (intensity > 0.75) count = 7 + Math.floor(rng() * 3);   // green-3
      else if (intensity > 0.45) count = 4 + Math.floor(rng() * 3);   // green-2
      else count = 1 + Math.floor(rng() * 3);                          // green-1
    }
    // Modulate by contributor seed so each has a distinct rhythm
    if (seed % 3 === 0 && i % 7 === 0 && count > 0) count += 2;
    out.push({ date: iso, count });
  }
  return out;
}

const FAKE_CONTRIBUTORS = [
  { login: 'octocat',          avatar: 'https://avatars.githubusercontent.com/u/583231?v=4' },
  { login: 'defunkt',          avatar: 'https://avatars.githubusercontent.com/u/2?v=4' },
  { login: 'mojombo',          avatar: 'https://avatars.githubusercontent.com/u/1?v=4' },
  { login: 'pjhyett',          avatar: 'https://avatars.githubusercontent.com/u/3?v=4' },
  { login: 'wycats',           avatar: 'https://avatars.githubusercontent.com/u/4?v=4' },
];

const FAKE_README = `# Sample Project

> A small, fast tool for shipping open source like nobody's watching.

## Features

- **Streaming** markdown parser with zero dependencies
- Drop-in replacement for three legacy packages
- Deterministic output across Node, Deno, and Bun
- First-class TypeScript types in the published bundle
- Incremental re-parsing for editor integrations

## How it works

The lexer walks the source once, emitting tagged tokens into a streaming channel. A consumer builds the AST on demand, which means you only pay for what you use. The design is **deterministic** end-to-end — the same input always produces the same tree.

## Architecture

Everything lives behind a single entry point. Internally, the project is split into a lexer, a parser, and a renderer — each is **independently testable** and can be swapped for an alternative implementation.

## Usage

\`\`\`ts
import { parse } from 'sample-project';

const ast = parse('# hello');
for (const node of ast.walk()) {
  console.log(node.kind, node.text);
}
\`\`\`

## Philosophy

Libraries should be boring. Boring libraries let you build interesting applications. We **aggressively** refuse features that are not core to the stated mission.

## Contributing

\`\`\`sh
git clone https://github.com/example/sample-project
cd sample-project
pnpm install
pnpm test
\`\`\`
`;

export function getMockRepoData(repoFullName: string): MockRepoData {
  const seed = hashString(repoFullName || 'facebook/react');
  const rng = lcg(seed);

  const contributors: ContributorStats[] = FAKE_CONTRIBUTORS.map((fc, idx) => {
    const localRng = lcg(seed + idx * 7919);
    const daily = makeDaily(localRng, seed + idx);
    const total = daily.reduce((acc, d) => acc + d.count, 0);
    return {
      login: fc.login,
      avatarUrl: fc.avatar,
      totalCommits: total,
      daily,
    };
  });

  // Sort by total descending so top contributor becomes the boss
  contributors.sort((a, b) => b.totalCommits - a.totalCommits);

  const repo: MockRepo = {
    full_name: repoFullName || 'example/sample-project',
    description: 'A small, fast tool for shipping open source like nobody\'s watching.',
    default_branch: 'main',
  };

  // consume rng once to silence unused-var warnings from tooling
  void rng;

  return { repo, contributors, readme: FAKE_README };
}
