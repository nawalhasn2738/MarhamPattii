// Prints counts only; never prints credentials or matched bundle contents.
import fs from 'node:fs';
import path from 'node:path';
const secrets = [];
for (const file of ['.env.local', '../ai-service/.env.local']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !match[1].startsWith('NEXT_PUBLIC_')) {
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      if (value.length > 12) secrets.push(value);
    }
  }
}
let files = 0, matches = 0;
function walk(dir) {
  for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = path.join(dir, file.name);
    if (file.isDirectory()) walk(name);
    else { files++; if (secrets.some(value => fs.readFileSync(name, 'utf8').includes(value))) matches++; }
  }
}
walk('.next-foundation/static');
console.log(JSON.stringify({ clientFilesScanned: files, secretValuesMatched: matches }));
if (matches) process.exitCode = 1;
