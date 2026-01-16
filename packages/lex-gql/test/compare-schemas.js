#!/usr/bin/env node
// compare-schemas.js - Compare generated schema against oracle

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { printSchema } from 'graphql';
import { buildSchema, parseLexicon } from '../src/lex-gql.js';

// Load all lexicon files recursively
function loadLexicons(dir) {
  const lexicons = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      lexicons.push(...loadLexicons(fullPath));
    } else if (entry.endsWith('.json')) {
      const content = JSON.parse(readFileSync(fullPath, 'utf-8'));
      lexicons.push({ path: fullPath, content });
    }
  }
  return lexicons;
}

// Parse type definitions from SDL
function parseTypes(sdl) {
  const types = {};
  const typeRegex =
    /(?:type|input|enum|union|interface)\s+(\w+)(?:\s+implements\s+\w+)?\s*\{([^}]*)\}/g;
  let match = typeRegex.exec(sdl);
  while (match !== null) {
    const [, typeName, body] = match;
    const fields = body
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('"'))
      .map((line) => {
        const fieldMatch = line.match(/^(\w+)(?:\([^)]*\))?:\s*(.+)$/);
        if (fieldMatch) {
          return {
            name: fieldMatch[1],
            type: fieldMatch[2].replace(/"/g, '').trim(),
          };
        }
        return null;
      })
      .filter(Boolean);
    types[typeName] = fields;
    match = typeRegex.exec(sdl);
  }
  return types;
}

// Main comparison
console.log('Loading lexicons...');
const lexicons = loadLexicons('./lexicons');
console.log(`Loaded ${lexicons.length} lexicons`);

console.log('\nParsing lexicons...');
const parsedLexicons = lexicons.map((l) => parseLexicon(l.content));

console.log('Building schema...');
const schema = buildSchema(parsedLexicons);
const generatedSdl = printSchema(schema);

console.log('Loading oracle schema...');
const oracleSdl = readFileSync('./schema.graphql', 'utf-8');

// Write generated schema for manual comparison
writeFileSync('./generated-schema.graphql', generatedSdl);
console.log('Written generated-schema.graphql');

// Parse types
const oracleTypes = parseTypes(oracleSdl);
const generatedTypes = parseTypes(generatedSdl);

// Compare
console.log('\n=== TYPE COMPARISON ===');
console.log(`Oracle types: ${Object.keys(oracleTypes).length}`);
console.log(`Generated types: ${Object.keys(generatedTypes).length}`);

const matching = [];
const missingFromGenerated = [];
const extraInGenerated = [];

for (const typeName of Object.keys(oracleTypes)) {
  if (generatedTypes[typeName]) {
    matching.push(typeName);
  } else {
    missingFromGenerated.push(typeName);
  }
}

for (const typeName of Object.keys(generatedTypes)) {
  if (!oracleTypes[typeName]) {
    extraInGenerated.push(typeName);
  }
}

console.log(`\nMatching types: ${matching.length}`);
console.log(`Missing from generated: ${missingFromGenerated.length}`);
console.log(`Extra in generated: ${extraInGenerated.length}`);

if (missingFromGenerated.length > 0) {
  console.log('\n--- Missing from Generated ---');
  for (const t of missingFromGenerated) {
    console.log(`  - ${t}`);
  }
}

if (extraInGenerated.length > 0) {
  console.log('\n--- Extra in Generated ---');
  for (const t of extraInGenerated) {
    console.log(`  - ${t}`);
  }
}

// Compare fields for matching types
console.log('\n=== FIELD COMPARISON (matching types) ===');
for (const typeName of matching.slice(0, 5)) {
  const oracleFields = oracleTypes[typeName];
  const generatedFields = generatedTypes[typeName];

  const oracleFieldNames = new Set(oracleFields.map((f) => f.name));
  const generatedFieldNames = new Set(generatedFields.map((f) => f.name));

  const missingFields = [...oracleFieldNames].filter((f) => !generatedFieldNames.has(f));
  const extraFields = [...generatedFieldNames].filter((f) => !oracleFieldNames.has(f));

  if (missingFields.length > 0 || extraFields.length > 0) {
    console.log(`\n${typeName}:`);
    if (missingFields.length > 0) {
      console.log(`  Missing: ${missingFields.join(', ')}`);
    }
    if (extraFields.length > 0) {
      console.log(`  Extra: ${extraFields.join(', ')}`);
    }
  }
}

console.log('\n=== Done ===');
console.log('Run: diff generated-schema.graphql schema.graphql | head -100');
