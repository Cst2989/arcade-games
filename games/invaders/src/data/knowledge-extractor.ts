import { marked, type Tokens } from 'marked';

export type Chunk =
  | { kind: 'FEATURE'; text: string; source: string }
  | { kind: 'CODE'; lang: string; code: string; source: string }
  | { kind: 'CONCEPT'; heading: string; body: string; source: string }
  | { kind: 'QUOTE'; text: string; source: string }
  | { kind: 'FACT'; text: string; source: string };

const CODE_LANGS = new Set(['ts', 'typescript', 'js', 'javascript', 'py', 'python', 'rust', 'rs', 'go', 'java', 'cpp', 'c++', 'sh', 'bash']);
const SKIP_HEADING_RE = /^(install|installation|license|table of contents|toc|badges)$/i;

export function extractChunks(markdown: string, source: string): Chunk[] {
  const tokens = marked.lexer(markdown);
  const chunks: Chunk[] = [];
  let currentHeading: string | null = null;
  let underFeatures = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.type === 'heading') {
      const h = t as Tokens.Heading;
      currentHeading = h.text.trim();
      underFeatures = /^features?$/i.test(currentHeading);
      if (SKIP_HEADING_RE.test(currentHeading)) {
        currentHeading = null;
        continue;
      }
      const next = tokens[i + 1];
      if (next && next.type === 'paragraph') {
        const body = (next as Tokens.Paragraph).text.trim();
        if (body.length > 0) {
          chunks.push({ kind: 'CONCEPT', heading: currentHeading, body, source });
        }
      }
    } else if (t.type === 'code') {
      const c = t as Tokens.Code;
      const lang = (c.lang ?? '').toLowerCase();
      if (CODE_LANGS.has(lang) || CODE_LANGS.has(lang.split(' ')[0]!)) {
        chunks.push({ kind: 'CODE', lang, code: c.text, source });
      }
    } else if (t.type === 'blockquote') {
      const bq = t as Tokens.Blockquote;
      const text = bq.tokens
        ?.map((tok) => (tok.type === 'paragraph' ? (tok as Tokens.Paragraph).text : ''))
        .join(' ')
        .trim() ?? '';
      if (text.length > 0) chunks.push({ kind: 'QUOTE', text, source });
    } else if (t.type === 'list' && underFeatures) {
      const l = t as Tokens.List;
      for (const item of l.items) {
        chunks.push({ kind: 'FEATURE', text: item.text.trim(), source });
      }
    } else if (t.type === 'paragraph') {
      const p = t as Tokens.Paragraph;
      const boldRe = /\*\*([^*]+)\*\*/g;
      for (const m of p.text.matchAll(boldRe)) {
        chunks.push({ kind: 'FACT', text: m[1]!, source });
      }
    }
  }

  return chunks;
}

function seededRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PREFERRED: Chunk['kind'][] = ['QUOTE', 'FEATURE', 'CONCEPT', 'CODE', 'QUOTE'];

export function selectArc(chunks: Chunk[], repoFullName: string): Chunk[] {
  const rng = seededRng(repoFullName);
  const out: Chunk[] = [];
  const used = new Set<number>();
  for (let level = 0; level < 5; level++) {
    const preferred = PREFERRED[level]!;
    const candidates = chunks
      .map((c, idx) => ({ c, idx }))
      .filter(({ c, idx }) => c.kind === preferred && !used.has(idx));
    let chosen: { c: Chunk; idx: number } | undefined;
    if (candidates.length > 0) {
      chosen = candidates[Math.floor(rng() * candidates.length)];
    } else {
      const any = chunks
        .map((c, idx) => ({ c, idx }))
        .filter(({ idx }) => !used.has(idx));
      if (any.length === 0) {
        out.push({ kind: 'FACT', text: 'Open source is forever.', source: 'fallback' });
        continue;
      }
      chosen = any[Math.floor(rng() * any.length)];
    }
    used.add(chosen!.idx);
    out.push(chosen!.c);
  }
  return out;
}
