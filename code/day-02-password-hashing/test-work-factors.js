/**
 * Day 02 — Watch the security / usability trade-off happen in real time.
 *
 *   node test-work-factors.js
 *
 * Every +1 to the cost DOUBLES the work. Every +2 QUADRUPLES it.
 * The numbers you get depend on your CPU — that is exactly the point.
 * You tune the cost to YOUR hardware, not to a number from a blog post.
 */

const bcrypt = require("bcrypt");
const crypto = require("crypto");

const PASSWORD = "mypassword123";

async function main() {
  console.log("\n=== bcrypt: how long does ONE hash take? ===\n");

  for (const cost of [8, 10, 12, 14]) {
    const start = Date.now();
    await bcrypt.hash(PASSWORD, cost);
    const ms = Date.now() - start;
    const perSec = 1000 / ms;

    console.log(
      `cost ${String(cost).padStart(2)} ` +
        `(2^${cost} = ${String(2 ** cost).padStart(5)} rounds)  ` +
        `${String(ms).padStart(5)}ms  →  ~${perSec.toFixed(1)} guesses/sec for an attacker`
    );
  }

  console.log("\n=== SHA-256 for comparison (the WRONG tool for passwords) ===\n");

  const start = Date.now();
  let count = 0;
  while (Date.now() - start < 1000) {
    crypto.createHash("sha256").update(PASSWORD + count).digest();
    count++;
  }
  console.log(`SHA-256: ${count.toLocaleString()} hashes/sec on ONE CPU core.`);
  console.log("A real attacker uses a GPU and gets billions per second.\n");

  console.log("That gap — a few guesses per second vs billions — is the whole");
  console.log("reason bcrypt exists.\n");
}

main();
