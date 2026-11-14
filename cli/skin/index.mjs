// `trompe skin`: make skins from plain language, compile them to CSS, and list the vocabulary.
// Uses the same trompe/skin module as the Studio and the package build.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Loads trompe/skin: the built dist when installed, else bundles src/ on the fly (repo checkouts). */
export async function loadSkinModule() {
  const built = resolve(PKG_ROOT, 'dist/skin/index.js');
  if (existsSync(built)) return import(pathToFileURL(built).href);
  const { buildSync } = await import('esbuild');
  const out = buildSync({ entryPoints: [resolve(PKG_ROOT, 'src/skin/index.ts')], bundle: true, format: 'cjs', platform: 'neutral', write: false, logLevel: 'warning' });
  const mod = { exports: {} };
  new Function('module', 'exports', out.outputFiles[0].text)(mod, mod.exports);
  return mod.exports;
}

export const SKIN_HELP = `Usage:
  trompe skin "<description>" [--name <name>] [--out <file.skin.json>] [--css <file.css>] [--format text|json]
  trompe skin build <file.skin.json> [--out <file.css>]
  trompe skin check <file.skin.json> [--fix] [--format text|json]
  trompe skin vocab [--format text|json]

Make a complete, contrast-checked skin from plain language:

  trompe skin "walnut panels with brushed brass controls, amber accent, low evening light" \\
    --name library --out skins/library.skin.json

The description can name materials (walnut, oak, leather, linen, felt, concrete, terrazzo,
carbon fibre, brass, copper, gold, chrome, titanium, aluminium, ceramic, lacquer, glass, ...),
colours (amber accent, navy, sage, ...), a scheme (dark, light), light (morning, evening,
dramatic, from the left), realism (flat, subtle, tactile, realistic), shape (sharp, rounded,
pill), type (serif, mono, geometric, rounded) and motion (snappy, calm, bouncy, heavy), or a
whole look (retro, luxury, industrial, scandinavian, clinical, cyberpunk, editorial, ...).
Run "trompe skin vocab" for every word it understands.

Options:
  --name <name>        Skin name (data-tr-skin value). Default: derived from the description
  --out <file>         Write the skin JSON (or, for build, the CSS) here instead of stdout
  --css <file>         Also write the compiled CSS
  --fix                With check: apply automatic contrast fixes and write the file back
  --format text|json   json prints {skin, notes, findings} for agents
  -h, --help           Show this help

Exit code: 0 ok, 1 the skin has errors, 2 the command failed.`;

const write = (file, text) => {
  mkdirSync(dirname(resolve(file)), { recursive: true });
  writeFileSync(file, text);
};

export async function runSkin(argv) {
  const opts = { args: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    if (a === '--name') opts.name = val();
    else if (a === '--out' || a === '-o') opts.out = val();
    else if (a === '--css') opts.css = val();
    else if (a === '--format') opts.format = val();
    else if (a === '--fix') opts.fix = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else opts.args.push(a);
  }
  if (opts.help || !opts.args.length) {
    console.log(SKIN_HELP);
    return opts.help ? 0 : 2;
  }
  const S = await loadSkinModule();
  const json = opts.format === 'json';
  const [sub, ...rest] = opts.args;

  if (sub === 'vocab') {
    if (json) console.log(JSON.stringify(S.describeVocabulary, null, 2));
    else for (const [k, words] of Object.entries(S.describeVocabulary)) console.log(`${k}:\n  ${[...new Set(words)].join(', ')}\n`);
    return 0;
  }

  if (sub === 'build' || sub === 'check') {
    const file = rest[0];
    if (!file) throw new Error(`trompe skin ${sub} needs a .skin.json file`);
    let skin = JSON.parse(readFileSync(file, 'utf8'));
    if (sub === 'check' && opts.fix) {
      const fixed = S.fixContrast(skin);
      skin = fixed.skin;
      if (fixed.changed.length) write(file, JSON.stringify(skin, null, 2) + '\n');
      if (!json) for (const c of fixed.changed) console.error(`fixed ${c}`);
    }
    const findings = S.validateSkin(skin);
    const errors = findings.filter((f) => f.severity === 'error');
    if (sub === 'build') {
      if (errors.length) {
        for (const f of errors) console.error(`error ${f.path}: ${f.message}`);
        return 1;
      }
      const css = S.compileSkin(skin);
      if (opts.out) write(opts.out, css);
      else process.stdout.write(css);
      return 0;
    }
    if (json) console.log(JSON.stringify({ file, findings }, null, 2));
    else if (!findings.length) console.log(`${file}: ok`);
    else for (const f of findings) console.log(`${f.severity.padEnd(7)} ${f.path}: ${f.message}${f.fix ? `  (fix: ${f.fix.value})` : ''}`);
    return errors.length ? 1 : 0;
  }

  // Default: plain language -> skin.
  const text = opts.args.join(' ');
  const { skin, notes } = S.skinFromDescription(text, opts.name ? { name: opts.name } : {});
  const findings = S.validateSkin(skin);
  const out = JSON.stringify(skin, null, 2) + '\n';
  if (opts.out) write(opts.out, out);
  if (opts.css) write(opts.css, S.compileSkin(skin));
  if (json) console.log(JSON.stringify({ skin, notes, findings }, null, 2));
  else {
    if (!opts.out) process.stdout.write(out);
    for (const n of notes) console.error(`  · ${n}`);
    if (opts.out) console.error(`wrote ${opts.out}${opts.css ? ` and ${opts.css}` : ''}`);
    for (const f of findings) console.error(`${f.severity} ${f.path}: ${f.message}`);
  }
  return findings.some((f) => f.severity === 'error') ? 1 : 0;
}
