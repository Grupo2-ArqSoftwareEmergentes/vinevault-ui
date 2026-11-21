import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTemplate } from '@angular/compiler';
import ts from 'typescript';

const root = fileURLToPath(new URL('../src/app/', import.meta.url));
const keys = new Set();
for (const language of ['es', 'en']) {
  const file = path.join(root, 'core/i18n/locales', language + '.ts');
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  function collect(node) {
    if (ts.isPropertyAssignment(node) && (ts.isStringLiteral(node.name) || ts.isIdentifier(node.name))) {
      keys.add(node.name.text);
    }
    ts.forEachChild(node, collect);
  }
  collect(source);
}

// Product names, physical units, file formats, example identifiers/names and text
// identical in both supported languages are deliberately not translated.
const invariant = new Set([
  'VineVault',
  'VineVault Premium',
  'Business',
  'Collector',
  'Pro',
  'Pro:',
  'Plan',
  'No',
  'CVV',
  'MM/YY',
  'Excel (.xlsx)',
  'PDF (.pdf)',
  'Google',
  'S/',
  'dBM',
  'dBm',
  'm',
  'i',
  'inventory',
  'AB45-F3B1',
  'VINE-A001',
  'Juan Pérez',
  'sommelier1',
  'tu@correo.com',
  'you@example.com',
  '✦ Sommelier',
]);
const problems = [];
function check(value, file, span) {
  const text = value.trim();
  if (!/\p{L}/u.test(text) || invariant.has(text)) return;
  problems.push(`${file}:${span.start.line + 1}: literal interface text: ${JSON.stringify(text)}`);
}
function walk(node, file, skip = false) {
  skip ||= ['mat-icon', 'svg', 'style'].includes(node.name);
  if (!skip) {
    if (node.constructor.name === 'Text') check(node.value, file, node.sourceSpan);
    if (node.constructor.name === 'BoundText') {
      for (const text of node.value.ast.strings ?? []) check(text, file, node.sourceSpan);
    }
    if (!node.name?.startsWith('app-')) {
      for (const attribute of node.attributes ?? []) {
        if (['aria-label', 'title', 'placeholder', 'alt'].includes(attribute.name)) {
          check(attribute.value, file, attribute.sourceSpan);
        }
      }
    }
    function inspectExpression(expression) {
      if (!expression || typeof expression !== 'object') return;
      if (expression.name === 't' && typeof expression.exp?.value === 'string') {
        const key = expression.exp.value.trim();
        if (!keys.has(key) && /\p{L}/u.test(key) && !invariant.has(key)) {
          problems.push(
            `${file}:${node.sourceSpan.start.line + 1}: missing translation key: ${JSON.stringify(key)}`,
          );
        }
      }
      for (const [property, value] of Object.entries(expression)) {
        if (['sourceSpan', 'span', 'absoluteSourceSpan'].includes(property)) continue;
        if (Array.isArray(value)) value.forEach(inspectExpression);
        else if (value && typeof value === 'object') inspectExpression(value);
      }
    }
    inspectExpression(node.value?.ast);
    for (const input of node.inputs ?? []) inspectExpression(input.value?.ast);
  }
  for (const child of node.children ?? []) walk(child, file, skip);
  for (const child of node.branches ?? []) walk(child, file, skip);
  for (const child of node.cases ?? []) walk(child, file, skip);
  if (node.empty) walk(node.empty, file, skip);
}

const files = fs.readdirSync(root, { recursive: true }).filter((file) => file.endsWith('.html'));
for (const file of files) {
  const parsed = parseTemplate(fs.readFileSync(path.join(root, file), 'utf8'), file);
  if (parsed.errors?.length) problems.push(...parsed.errors.map((error) => `${file}: ${error}`));
  for (const node of parsed.nodes) walk(node, file);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `i18n: ${files.length} templates checked; ${keys.size} source-message keys available.`,
  );
