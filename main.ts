import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// news-image-20261125 — "THE WORLD TODAY", Wednesday 25 November 2026.
// Copies the pre-rendered entry.png (1024x1024, 167944 bytes) to the output
// directory. Deterministic: byte-identical on every run, no network, no RNG.

const MAX_BYTES = 1048576; // 1 MiB gate
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "entry.png");

// Self-check 1: source exists and is a valid PNG.
if (!existsSync(src)) {
  throw new Error(`entry.png not found next to main.ts: ${src}`);
}
const data = readFileSync(src);
if (!data.subarray(0, 8).equals(PNG_SIGNATURE)) {
  throw new Error("entry.png is not a valid PNG (bad signature)");
}

// Self-check 2: hard 1 MiB gate — fail loudly instead of shipping an invalid entry.
if (data.length > MAX_BYTES) {
  throw new Error(`entry.png is ${data.length} bytes, over the 1 MiB limit`);
}

// Output directory: MAKEFUN_OUTPUT_DIR first, then /output, then ./out next
// to main.ts. Each candidate is tried in order; the first one we can create
// and write to wins.
const candidates = [
  process.env.MAKEFUN_OUTPUT_DIR,
  "/output",
  join(here, "out"),
].filter((d): d is string => Boolean(d));

let written = "";
let lastError: unknown;
for (const dir of candidates) {
  try {
    mkdirSync(dir, { recursive: true });
    const dest = join(dir, "entry.png");
    copyFileSync(src, dest);
    // Self-check 3: the written file must be byte-identical to the source.
    const back = readFileSync(dest);
    if (!back.equals(data)) {
      throw new Error(`written file differs from source in ${dir}`);
    }
    written = dest;
    break;
  } catch (err) {
    lastError = err;
  }
}
if (!written) {
  throw new Error(
    `could not write entry.png to any output directory (${candidates.join(", ")}): ${String(lastError)}`,
  );
}

const size = statSync(written).size;
console.log(`wrote ${written} (${size} bytes, PNG, <=1 MiB OK)`);
