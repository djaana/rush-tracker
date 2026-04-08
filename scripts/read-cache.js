const { existsSync, readFileSync, writeFileSync } = require('fs');
const { inflateSync } = require('zlib');
const { resolve } = require('path');

require('dotenv').config({ path: resolve(__dirname, '../.env') });

const MAGIC = Buffer.from(process.env.STORE_MAGIC, 'hex');
const source = resolve(process.argv[2]);
const output = resolve(__dirname, 'cache.json');

if (!existsSync(source)) {
  process.exit(1);
}

const buf = readFileSync(source);

if (buf.length < MAGIC.length || !buf.subarray(0, MAGIC.length).equals(MAGIC)) {
  process.exit(1);
}

const games = JSON.parse(inflateSync(buf.subarray(MAGIC.length)).toString('utf8'));

writeFileSync(output, JSON.stringify(games, null, 2), 'utf8');
