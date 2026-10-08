import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSchemaSql } from '../src/server/db/migrate';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target = path.join(root, 'database', 'schema.sql');
writeFileSync(target, renderSchemaSql(), 'utf8');
console.log(`Schema gravado em ${target}`);
