import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const sourcePath = join(process.cwd(), 'src/main.js');
const source = await readFile(sourcePath, 'utf8');

function extractBalanced(startIndex, openChar, closeChar) {
  let depth = 0;
  let quote = '';
  let escaping = false;

  for (let i = startIndex; i < source.length; i += 1) {
    const char = source[i];

    if (quote) {
      if (escaping) {
        escaping = false;
      } else if (char === '\\') {
        escaping = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) depth -= 1;
    if (depth === 0) return source.slice(startIndex, i + 1);
  }

  throw new Error(`Could not find matching ${closeChar}`);
}

function evaluateLiteral(literal) {
  return Function(`"use strict"; return (${literal});`)();
}

function extractConstLiteral(name, openChar, closeChar) {
  const constStart = source.indexOf(`const ${name} = `);
  if (constStart === -1) throw new Error(`Missing const ${name}`);
  const literalStart = source.indexOf(openChar, constStart);
  return evaluateLiteral(extractBalanced(literalStart, openChar, closeChar));
}

function extractSetLiteral(name) {
  const constStart = source.indexOf(`const ${name} = new Set(`);
  if (constStart === -1) throw new Error(`Missing set ${name}`);
  const literalStart = source.indexOf('[', constStart);
  return new Set(evaluateLiteral(extractBalanced(literalStart, '[', ']')));
}

const partsData = extractConstLiteral('partsData', '[', ']');
const bricklinkColors = extractConstLiteral('bricklinkColors', '{', '}');
const imagePartNumberAliases = extractConstLiteral('imagePartNumberAliases', '{', '}');
const forceFallbackFirstPartNumbers = extractSetLiteral('forceFallbackFirstPartNumbers');

function imagePartNumber(part) {
  return imagePartNumberAliases[part.part_number] || part.part_number;
}

function bricklinkImageUrl(part) {
  const colorId = bricklinkColors[part.color];
  if (colorId === undefined) return '';
  return `https://img.bricklink.com/ItemImage/PN/${colorId}/${encodeURIComponent(imagePartNumber(part))}.png`;
}

async function isReachable(url) {
  try {
    let response = await fetch(url, { method: 'HEAD' });
    if (response.ok) return true;

    response = await fetch(url, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  await Promise.all(Array.from({ length: limit }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }));

  return results;
}

const failures = [];
const missingColorMappings = [];

await mapLimit(partsData, 12, async (part) => {
  const url = bricklinkImageUrl(part);
  if (!url) {
    missingColorMappings.push({
      part_id: part.part_id,
      color: part.color,
      part_number: part.part_number,
    });
    return;
  }

  const reachable = await isReachable(url);
  if (!reachable) {
    failures.push({
      part_id: part.part_id,
      part_number: part.part_number,
      color: part.color,
      url,
      forcedFallbackFirst: forceFallbackFirstPartNumbers.has(part.part_number),
    });
  }
});

const forcedFailures = failures.filter(failure => failure.forcedFallbackFirst);

console.log(JSON.stringify({
  totalLots: partsData.length,
  missingColorMappings: missingColorMappings.length,
  fallbackUrlFailures: failures.length,
  forcedFallbackFailures: forcedFailures.length,
}, null, 2));

if (missingColorMappings.length) {
  console.error('Missing BrickLink color mappings:');
  console.error(JSON.stringify(missingColorMappings, null, 2));
}

if (failures.length) {
  console.error('Unreachable fallback URLs:');
  console.error(JSON.stringify(failures, null, 2));
}

if (missingColorMappings.length || failures.length) {
  process.exitCode = 1;
}
