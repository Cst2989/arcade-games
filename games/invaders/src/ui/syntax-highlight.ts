export type TokenKind = 'plain' | 'keyword' | 'string' | 'comment' | 'number';
export interface Token {
  text: string;
  kind: TokenKind;
}

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'class', 'new', 'this', 'import', 'export', 'from', 'default', 'async', 'await',
  'try', 'catch', 'throw', 'true', 'false', 'null', 'undefined', 'interface', 'type',
  'extends', 'implements', 'public', 'private', 'protected', 'static', 'readonly',
  'def', 'pass', 'lambda', 'None', 'True', 'False', 'elif', 'in', 'not', 'and', 'or',
  'fn', 'struct', 'enum', 'pub', 'impl', 'trait', 'mod', 'use',
  'func', 'package', 'range', 'go', 'chan', 'select', 'case', 'switch', 'break',
]);

function isIdentStart(c: string): boolean {
  return /[A-Za-z_$]/.test(c);
}
function isIdentCont(c: string): boolean {
  return /[A-Za-z0-9_$]/.test(c);
}
function isDigit(c: string): boolean {
  return c >= '0' && c <= '9';
}

export function tokenize(code: string, _lang: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = code.length;
  let buf = '';
  const flush = () => {
    if (buf.length > 0) {
      out.push({ text: buf, kind: 'plain' });
      buf = '';
    }
  };
  while (i < n) {
    const c = code[i]!;
    const c2 = code[i + 1];

    if (c === '/' && c2 === '/') {
      flush();
      let j = i;
      while (j < n && code[j] !== '\n') j++;
      out.push({ text: code.slice(i, j), kind: 'comment' });
      i = j;
      continue;
    }
    if (c === '#') {
      flush();
      let j = i;
      while (j < n && code[j] !== '\n') j++;
      out.push({ text: code.slice(i, j), kind: 'comment' });
      i = j;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      flush();
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (code[j] === '\\') { j += 2; continue; }
        if (code[j] === quote) { j++; break; }
        j++;
      }
      out.push({ text: code.slice(i, j), kind: 'string' });
      i = j;
      continue;
    }

    if (isDigit(c)) {
      flush();
      let j = i;
      while (j < n && (isDigit(code[j]!) || code[j] === '.')) j++;
      out.push({ text: code.slice(i, j), kind: 'number' });
      i = j;
      continue;
    }

    if (isIdentStart(c)) {
      flush();
      let j = i;
      while (j < n && isIdentCont(code[j]!)) j++;
      const word = code.slice(i, j);
      if (KEYWORDS.has(word)) {
        out.push({ text: word, kind: 'keyword' });
      } else {
        out.push({ text: word, kind: 'plain' });
      }
      i = j;
      continue;
    }

    buf += c;
    i++;
  }
  flush();
  return out;
}

export function kindColor(kind: TokenKind): string {
  switch (kind) {
    case 'keyword': return '#ff7b72';
    case 'string': return '#a5d6ff';
    case 'comment': return '#ffffff';
    case 'number': return '#d2a8ff';
    default: return '#c9d1d9';
  }
}
