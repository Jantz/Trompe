// Turns Svelte markup and JSX into plain HTML that parse5 can read, keeping every character at the
// same offset so findings point at the original line and column.
//
// - `name={expr}` becomes `name="<MARK>   "`: the attribute is known to be dynamic and is not validated.
// - `{expr}` in text becomes TEXT characters (it is text, so it still counts as an accessible name), unless it
//   only holds JSX elements or comments, which are kept or blanked.
// - Svelte blocks (`{#if}`, `{:else}`, `{/each}`, `{@html}`) and spreads (`{...props}`) become spaces.
// - In .jsx/.tsx, everything outside JSX is blanked; JSX nested inside expressions
//   (`{items.map((i) => <tr-option …/>)}`) is kept, so parents and children stay connected.
// - A self-closing element that is not a custom element or a void HTML element (`<Icon />`, `<div />`)
//   is blanked: HTML cannot self-close it, and it has no children to check.

export const MARK = '\uE000'; // one character: fits in any `{…}` (3+ chars) with its quotes
/** Fills text that comes from an expression: it counts as text, but its words are unknown. */
export const TEXT = '\uE001';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

export function svelteToHtml(src) {
  return new Scanner(src, 'svelte').markup();
}

export function jsxToHtml(src) {
  return new Scanner(src, 'jsx').js();
}

class Scanner {
  constructor(src, mode) {
    this.src = src;
    this.mode = mode;
    this.out = Array.from(src, (c) => (c === '\n' ? '\n' : ' '));
    this.elements = 0;
  }

  text() {
    return this.out.join('');
  }

  copy(from, to) {
    for (let k = from; k < to; k++) this.out[k] = this.src[k];
  }

  blank(from, to) {
    for (let k = from; k < to; k++) this.out[k] = this.src[k] === '\n' ? '\n' : ' ';
  }

  fill(from, to, ch) {
    for (let k = from; k < to; k++) this.out[k] = this.src[k] === '\n' || this.src[k] === ' ' ? this.src[k] : ch;
  }

  /** Svelte: the whole file is markup, except <script> and <style>. */
  markup() {
    const s = this.src;
    let i = 0;
    while (i < s.length) {
      if (s[i] === '<' && /^<(script|style)\b/i.test(s.slice(i, i + 8))) {
        const tag = /^<(script|style)/i.exec(s.slice(i, i + 8))[1].toLowerCase();
        const e = s.toLowerCase().indexOf(`</${tag}`, i);
        const close = e < 0 ? s.length : s.indexOf('>', e) + 1 || s.length;
        i = close;
        continue;
      }
      if (s[i] === '<' && s[i + 1] === '!' && s.startsWith('<!--', i)) {
        const e = s.indexOf('-->', i);
        const end = e < 0 ? s.length : e + 3;
        this.copy(i, end);
        i = end;
        continue;
      }
      if (s[i] === '<' && /[A-Za-z]/.test(s[i + 1] ?? '')) {
        i = this.element(i);
        continue;
      }
      if (s[i] === '<' && s[i + 1] === '/') {
        const e = s.indexOf('>', i);
        const end = e < 0 ? s.length : e + 1;
        this.copy(i, end);
        i = end;
        continue;
      }
      if (s[i] === '{') {
        i = this.svelteExpr(i);
        continue;
      }
      this.out[i] = s[i];
      i++;
    }
    return this.text();
  }

  /** A Svelte `{…}` in text position. Returns the index after it. */
  svelteExpr(i) {
    const end = this.jsUntilBrace(i + 1, false);
    const inner = this.src.slice(i + 1, end - 1).trim();
    if (/^[#/:@]/.test(inner) || inner.startsWith('...')) this.blank(i, end);
    else this.fill(i, end, TEXT);
    return end;
  }

  /** JSX files: scan JavaScript, entering JSX wherever an element starts. */
  js() {
    this.jsUntilBrace(0, true);
    return this.text();
  }

  /**
   * Scans JavaScript from i until the `}` that closes the current expression (or the end of the file
   * when top is true). JSX elements found on the way are converted. Returns the index after the `}`.
   */
  jsUntilBrace(i, top) {
    const s = this.src;
    let depth = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === '/' && s[i + 1] === '/') {
        const e = s.indexOf('\n', i);
        i = e < 0 ? s.length : e;
      } else if (c === '/' && s[i + 1] === '*') {
        const e = s.indexOf('*/', i + 2);
        i = e < 0 ? s.length : e + 2;
      } else if (c === '"' || c === "'") {
        i = this.skipString(i, c);
      } else if (c === '`') {
        i = this.skipTemplate(i + 1);
      } else if (c === '{') {
        depth++;
        i++;
      } else if (c === '}') {
        if (depth === 0 && !top) return i + 1;
        depth--;
        i++;
      } else if (c === '<' && this.mode === 'jsx' && this.jsxStarts(i)) {
        i = this.element(i);
      } else i++;
    }
    return i;
  }

  skipString(i, q) {
    const s = this.src;
    for (i++; i < s.length; i++) {
      if (s[i] === '\\') i++;
      else if (s[i] === q || s[i] === '\n') return i + 1;
    }
    return i;
  }

  skipTemplate(i) {
    const s = this.src;
    for (; i < s.length; i++) {
      if (s[i] === '\\') i++;
      else if (s[i] === '`') return i + 1;
      else if (s[i] === '$' && s[i + 1] === '{') i = this.jsUntilBrace(i + 2, false) - 1;
    }
    return i;
  }

  /** Is the `<` at i the start of a JSX element (not a comparison or a type argument)? */
  jsxStarts(i) {
    const s = this.src;
    const next = s[i + 1];
    if (!(next === '>' || /[A-Za-z]/.test(next ?? ''))) return false;
    let j = i - 1;
    while (j >= 0 && /\s/.test(s[j])) j--;
    if (j < 0) return true;
    const p = s[j];
    if ('(,=:?[{};&|!'.includes(p)) return !(p === '=' && s[j - 1] === '=' && s[j - 2] === '='); // not "a === <"
    if (p === '>' && s[j - 1] === '=') return true; // arrow body
    const word = /([A-Za-z_$]+)$/.exec(s.slice(Math.max(0, j - 10), j + 1))?.[1];
    return word === 'return' || word === 'yield' || word === 'default' || word === 'case';
  }

  /** An element starting at i (`<name …>…</name>`, `<name … />` or a fragment). Returns the index after it. */
  element(i) {
    const s = this.src;
    this.elements++;
    if (s[i + 1] === '>') return this.children(i + 2, ''); // fragment: transparent
    const m = /^<([A-Za-z][\w.:-]*)/.exec(s.slice(i, i + 200));
    const name = m[1];
    const start = i;
    this.copy(i, i + m[0].length);
    i += m[0].length;
    // attributes
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) {
        i++;
      } else if (c === '/' && s[i + 1] === '>') {
        i += 2;
        if (name.includes('-') || VOID.has(name.toLowerCase())) this.copy(i - 2, i);
        else this.blank(start, i);
        return i;
      } else if (c === '>') {
        this.copy(i, i + 1);
        i++;
        if (VOID.has(name.toLowerCase())) return i;
        if (this.mode === 'svelte') return i; // Svelte children are scanned by markup()
        return this.children(i, name);
      } else if (c === '{') {
        i = this.jsUntilBrace(i + 1, false); // spread or shorthand: dropped
      } else {
        const a = /^[^\s=/>{]+/.exec(s.slice(i, i + 200));
        if (!a) {
          i++;
          continue;
        }
        this.copy(i, i + a[0].length);
        i += a[0].length;
        let j = i;
        while (/\s/.test(s[j] ?? '')) j++;
        if (s[j] !== '=') continue;
        this.copy(j, j + 1);
        j++;
        while (/\s/.test(s[j] ?? '')) j++;
        if (s[j] === '"' || s[j] === "'") {
          const e = s.indexOf(s[j], j + 1);
          const end = e < 0 ? s.length : e + 1;
          this.copy(j, end);
          if (this.mode === 'svelte') this.markBraces(j + 1, end - 1);
          i = end;
        } else if (s[j] === '{') {
          const end = this.jsUntilBrace(j + 1, false);
          this.blank(j, end);
          this.out[j] = '"';
          this.out[j + 1] = MARK;
          this.out[end - 1] = '"';
          i = end;
        } else {
          const v = /^[^\s>]+/.exec(s.slice(j, j + 500));
          const end = j + (v ? v[0].length : 0);
          this.copy(j, end);
          i = end;
        }
      }
    }
    return i;
  }

  /** In a quoted Svelte attribute value, `{expr}` parts make it dynamic. */
  markBraces(from, to) {
    const s = this.src;
    for (let k = from; k < to; k++) {
      if (s[k] !== '{') continue;
      const end = Math.min(this.jsUntilBrace(k + 1, false), to);
      this.blank(k, end);
      this.out[k] = MARK;
      k = end - 1;
    }
  }

  /** JSX children up to the closing tag of `name` ('' for a fragment). Returns the index after it. */
  children(i, name) {
    const s = this.src;
    while (i < s.length) {
      const c = s[i];
      if (c === '<' && s[i + 1] === '/') {
        const e = s.indexOf('>', i);
        const end = e < 0 ? s.length : e + 1;
        if (name) this.copy(i, end);
        return end;
      }
      if (c === '<' && (s[i + 1] === '>' || /[A-Za-z]/.test(s[i + 1] ?? ''))) {
        i = this.element(i);
      } else if (c === '{') {
        const before = this.elements;
        const end = this.jsUntilBrace(i + 1, false);
        const produced = this.elements !== before;
        const inner = s.slice(i + 1, end - 1).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').trim();
        if (!produced && inner) this.fill(i, end, TEXT);
        i = end;
      } else {
        this.out[i] = c;
        i++;
      }
    }
    return i;
  }
}
