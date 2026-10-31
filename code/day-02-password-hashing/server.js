/**
 * Day 02 — Proper Password Hashing with bcrypt
 * ─────────────────────────────────────────────────────────────
 * Day 1 stored the password as the literal string "1234" and compared it
 * with ===. Both of those are catastrophic. This fixes them.
 *
 * Full writeup:
 *   notes/phase-1-foundations/day-02-password-hashing.md
 *
 * Still unsolved (on purpose): the stateless problem from Day 1.
 * Login works, but the NEXT request still has no idea who you are.
 * That's Day 3.
 */

const http = require("http");
const bcrypt = require("bcrypt");

// The work factor. bcrypt runs 2^12 = 4096 internal rounds.
// Measured on a 2024-era laptop: ~244ms per hash. That is the point.
const SALT_ROUNDS = 12;

// bcrypt silently ignores everything past 72 BYTES of the password.
// We reject instead of silently truncating. See the notes for why this matters.
const MAX_PASSWORD_BYTES = 72;

// In-memory "database". Structure: { username: { hash } }
const usersDB = {};

// ★ TIMING-SAFETY DECOY
// If an unknown username returns instantly while a real one takes 244ms,
// an attacker can time your responses to discover which accounts exist.
// We compare against this throwaway hash so BOTH paths cost the same.
const DUMMY_HASH = bcrypt.hashSync("a-password-nobody-will-ever-use", SALT_ROUNDS);

// A pre-seeded "legacy" account hashed at the OLD cost of 10, so you can
// watch the automatic upgrade-on-login happen. Password: oldpassword123
usersDB["legacy_user"] = { hash: bcrypt.hashSync("oldpassword123", 10) };

// ─── Helper: collect and parse the JSON body ───────────────────────────────
// Day 1 did this inline with req.on("data") / req.on("end").
// Same mechanics, now wrapped in a Promise so we can `await` it.
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        // Day 1's server CRASHED here. Now it's caught.
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

// ─── Helper: send a JSON response ──────────────────────────────────────────
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// ─── Server ────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  // ══ REGISTER ═════════════════════════════════════════════════════════════
  if (method === "POST" && url === "/register") {
    try {
      const { username, password } = await parseBody(req);

      if (!username || !password) {
        return sendJSON(res, 400, { error: "Username and password required" });
      }
      if (password.length < 8) {
        return sendJSON(res, 400, { error: "Password must be at least 8 characters" });
      }
      // Byte length, not character length — one emoji can be 4 bytes.
      if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
        return sendJSON(res, 400, {
          error: `Password must be at most ${MAX_PASSWORD_BYTES} bytes`,
        });
      }
      if (usersDB[username]) {
        // ⚠️ This leaks which usernames exist. Unavoidable at registration
        //    unless you move to email-verification signup. Noted in the writeup.
        return sendJSON(res, 409, { error: "User already exists" });
      }

      // ★ THE CORE OF DAY 2
      // bcrypt.hash internally:
      //   1. generates 16 random bytes of salt
      //   2. mixes salt + password
      //   3. runs 2^12 = 4096 rounds of the Blowfish key schedule
      //   4. returns ONE 60-char string holding version + cost + salt + hash
      const hash = await bcrypt.hash(password, SALT_ROUNDS);

      usersDB[username] = { hash };

      console.log(`[REGISTER] ${username}`);
      console.log(`[REGISTER] stored: ${hash}`);
      console.log(`           └─ $2b$ = version | 12$ = cost | next 22 = salt | last 31 = hash`);

      return sendJSON(res, 201, { message: "User registered successfully" });
    } catch (err) {
      // Two audiences, two different answers:
      //   400 = "YOU sent something wrong"  (the caller can fix it)
      //   500 = "WE broke"                  (the caller can do nothing)
      if (err.message === "Invalid JSON") {
        return sendJSON(res, 400, { error: "Invalid JSON" });
      }
      // ★ Log the FULL error for us, send a vague one to them.
      //   Never catch an error and stay silent — you throw away the only
      //   evidence you'll ever have. And never ship the raw message to the
      //   client: it hands an attacker a map of your infrastructure.
      console.error("[ERROR] /register failed:", err);
      return sendJSON(res, 500, { error: "Internal server error" });
    }
  }

  // ══ LOGIN ════════════════════════════════════════════════════════════════
  else if (method === "POST" && url === "/login") {
    try {
      const { username, password } = await parseBody(req);

      if (!username || !password) {
        return sendJSON(res, 400, { error: "Username and password required" });
      }

      const user = usersDB[username];

      // ★ TIMING-SAFE UNKNOWN USER
      // Do NOT `return` early here. Burn the same ~244ms a real user costs,
      // then fail. Identical message AND identical duration = nothing leaks.
      if (!user) {
        await bcrypt.compare(password, DUMMY_HASH);
        return sendJSON(res, 401, { error: "Invalid credentials" });
      }

      // ★ bcrypt.compare does all of this for you:
      //   1. reads the cost and the 22-char salt out of the stored string
      //   2. re-runs the exact same math on the password you just typed
      //   3. compares the two 31-char results in CONSTANT TIME
      // It never decrypts anything, because there is nothing to decrypt.
      const ok = await bcrypt.compare(password, user.hash);

      if (!ok) {
        return sendJSON(res, 401, { error: "Invalid credentials" });
      }

      // ★ UPGRADE-ON-LOGIN
      // This is the only moment the server ever holds the plaintext password,
      // so it is the only moment it can re-hash at a stronger cost.
      const storedCost = bcrypt.getRounds(user.hash);
      if (storedCost < SALT_ROUNDS) {
        user.hash = await bcrypt.hash(password, SALT_ROUNDS);
        console.log(`[UPGRADE] ${username}: cost ${storedCost} → ${SALT_ROUNDS}`);
      }

      // ★ And here is Day 1's problem, still completely unsolved.
      // We know who this is RIGHT NOW. The next request won't.
      return sendJSON(res, 200, {
        message: `Welcome ${username}! Password verified.`,
        note: "The next request still won't know who you are. That's Day 3.",
      });
    } catch (err) {
      if (err.message === "Invalid JSON") {
        return sendJSON(res, 400, { error: "Invalid JSON" });
      }
      console.error("[ERROR] /login failed:", err);
      return sendJSON(res, 500, { error: "Internal server error" });
    }
  }

  // ══ DEBUG — look inside the "database" ═══════════════════════════════════
  // Never do this in production. It exists so you can SEE that no plaintext
  // password is stored anywhere.
  else if (method === "GET" && url === "/debug-db") {
    const view = {};
    for (const [name, rec] of Object.entries(usersDB)) {
      view[name] = {
        storedValue: rec.hash,
        version: rec.hash.slice(0, 4),
        cost: bcrypt.getRounds(rec.hash),
        salt: rec.hash.slice(7, 29),
        hash: rec.hash.slice(29),
      };
    }
    return sendJSON(res, 200, { database: view });
  }

  // ══ 404 ══════════════════════════════════════════════════════════════════
  else {
    return sendJSON(res, 404, { error: "Route not found" });
  }
});

server.listen(3000, () => {
  console.log("🔐 Day 2 server running on http://localhost:3000");
  console.log("   POST /register | POST /login | GET /debug-db");
  console.log(`   Work factor: ${SALT_ROUNDS}  (2^${SALT_ROUNDS} = ${2 ** SALT_ROUNDS} rounds)`);
  console.log("   Seeded legacy_user / oldpassword123 at cost 10 — log in to watch it upgrade");
});
