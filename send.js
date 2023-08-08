// Send a file.
// Usage: node send.js [-n 100] <filename>

const crypto = require('crypto');
const fs = require('fs').promises;
const qrcode = require('qrcode-terminal');

function shasum(str) {
  const hasher = crypto.createHash('sha256');
  hasher.update(str);
  return hasher.digest('hex');
}

async function main(args) {
  const files = [];
  let perChunk = 200;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-n') {
      perChunk = Number(args[++i]);
    } else if (arg.startsWith('-n')) {
      perChunk = Number(arg.substring(2));
    } else {
      files.push(arg);
    }
  }
  for (const filename of files) {
    // TODO - handle binary?
    const contents = String(await fs.readFile(filename));
    const sha = shasum(contents).substring(0, 8);
    // encode the contents in chunks of PER_CHUNK bytes per chunk.
    // contents are json:
    //   {sha: string, i: number, n: number, f: string, c: string}
    // fields:
    //   i - index of current chunk
    //   n - total number of chunks
    //   f - name of file (sent in first chunk)
    //   c - contents of chunk (may be omitted from first chunk)
    const chunks = [];
    const header = {sha, i: 0, n: 1, f: filename, c: ''};
    let pos = 0;
    while (pos < contents.length) {
      const space = perChunk - JSON.stringify(header).length;
      chunks.push({
        ...header,
        i: chunks.length,
        c: contents.substring(pos, pos + space),
      });
      pos += space;
      delete header.f;
    }
    for (const c of chunks) {
      c.n = chunks.length;
    }
    for (const c of chunks) {
      qrcode.generate(JSON.stringify(c));
      console.log(`${c.sha}: ${c.i + 1} of ${c.n}\n\n`);
    }
  }
}

main(process.argv.slice(2));
