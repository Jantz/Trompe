#!/usr/bin/env node
// trompe CLI: `trompe check` (lint markup, CSS and skins) and `trompe skin` (make, build and
// check skins). Run `trompe check --help` or `trompe skin --help` for options.
import { run, formatText } from '../cli/check/index.mjs';
import { RULES } from '../cli/check/rules.mjs';

const HELP = `Usage: trompe check [files, dirs or globs...] [options]
       trompe skin --help   (make skins from plain language, build and check them)

Checks Trompe markup (.html, .vue, .svelte, Lit html\`\` in .js/.ts), CSS and skin files
(*.skin.json) against the installed Trompe components, tokens and skins.

Options:
  --format text|json   Output format (default: text; json is for agents and CI)
  --fix                Apply unambiguous fixes (typos in element, attribute and enum names)
  --render             Also load each .html page in Chromium: axe-core, contrast, target size,
                       forced colours, paint budget, runtime errors
  --shots <dir>        With --render, save a screenshot of each page to <dir>
  --chromium <path>    Chromium executable for --render
  --manifest <path>    custom-elements.json to use (default: the installed package's)
  --tokens <path>      tokens.json to use
  --skins <path>       skins.json to use
  --rules              List all rules and exit
  -h, --help           Show this help

Exit code: 0 no errors, 1 errors found, 2 the checker itself failed.`;

const argv = process.argv.slice(2);
if (argv[0] === 'skin') {
  argv.shift();
  try {
    const { runSkin } = await import('../cli/skin/index.mjs');
    process.exit(await runSkin(argv));
  } catch (e) {
    console.error(`trompe skin failed: ${e.message ?? e}`);
    process.exit(2);
  }
}
const cmd = argv[0] && !argv[0].startsWith('-') ? argv.shift() : 'check';
if (cmd !== 'check' || argv.includes('-h') || argv.includes('--help')) {
  console.log(HELP);
  process.exit(cmd === 'check' ? 0 : 2);
}
if (argv.includes('--rules')) {
  for (const [id, r] of Object.entries(RULES)) console.log(`${id}  ${r.name.padEnd(20)} ${r.severity.padEnd(8)} ${r.summary}`);
  process.exit(0);
}
const opts = { inputs: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const val = () => argv[++i];
  if (a === '--format') opts.format = val();
  else if (a === '--fix') opts.fix = true;
  else if (a === '--render') opts.render = true;
  else if (a === '--shots') opts.shots = val();
  else if (a === '--chromium') opts.chromium = val();
  else if (a === '--manifest') opts.manifest = val();
  else if (a === '--tokens') opts.tokens = val();
  else if (a === '--skins') opts.skins = val();
  else if (a.startsWith('-')) { console.error(`Unknown option ${a}\n\n${HELP}`); process.exit(2); }
  else opts.inputs.push(a);
}
try {
  const report = await run(opts);
  if (opts.format === 'json') console.log(JSON.stringify(report, null, 2));
  else console.log(formatText(report, { color: process.stdout.isTTY }));
  process.exit(report.summary.errors ? 1 : 0);
} catch (e) {
  if (opts.format === 'json') console.log(JSON.stringify({ tool: 'trompe-check', error: String(e.message ?? e) }));
  else console.error(`trompe check failed: ${e.message ?? e}`);
  process.exit(2);
}
