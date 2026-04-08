const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');

require('dotenv').config({ path: resolve(__dirname, '../.env') });

const MAGIC = Buffer.from(process.env.STORE_MAGIC, 'hex');
const source = resolve(process.argv[2]);

if (!existsSync(source)) {
  process.exit(1);
}

const buf = readFileSync(source);

if (buf.length < MAGIC.length || !buf.subarray(0, MAGIC.length).equals(MAGIC)) {
  process.exit(1);
}

console.log(buf.subarray(MAGIC.length).toString('utf8'));
