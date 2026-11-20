/**
 * Day 03 — Sessions from scratch
 * ─────────────────────────────────────────────────────────────
 * Day 2 could check a password, and then forgot you 3ms later.
 * Today the server finally REMEMBERS you, using nothing but a random
 * number, a cookie, and a Map. No express-session. No libraries.
 *
 * Full writeup:
 *   notes/phase-1-foundations/day-03-sessions.md
 *
 * Still unsolved (on purpose): every session lives in THIS process's
 * memory. Restart the server and everyone is logged out. Run two copies
 * and they don't know about each other. That's the scale problem.
 */

const http = require("http");
const crypto = require("crypto"); // built into Node: secure randomness + SHA-256
const bcrypt = require("bcrypt");

// ─── Settings ──────────────────────────────────────────────────────────────
const PORT = 3000;
const SALT_ROUNDS = 12;
const MAX_PASSWORD_BYTES = 72;

const COOKIE_NAME = "sid";

// Two different clocks. A session dies when EITHER one runs out.
//   idle     → no activity for this long   (you walked away from the screen)
//   absolute → this long since login, even if you were busy the whole time
// You can shrink them from the terminal to watch expiry happen:
//   IDLE_TIMEOUT_MS=10000 node server.js
const IDLE_TIMEOUT_MS = Number(process.env.IDLE_TIMEOUT_MS) || 15 * 60 * 1000; // 15 min
const ABSOLUTE_TIMEOUT_MS = Number(process.env.ABSOLUTE_TIMEOUT_MS) || 8 * 60 * 60 * 1000; // 8 h

// What a real session ID looks like: exactly 64 hex characters (32 bytes).
// Anything else is rejected before we even look it up.
const SESSION_ID_FORMAT = /^[0-9a-f]{64}$/;

// ─── In-memory stores ──────────────────────────────────────────────────────
// Map, NOT a plain {}. A plain object already has keys like "constructor"
// and "__proto__" built in, and an attacker can send those as a cookie.
// The notes show the crash that happens if you use {} here.
const users = new Map(); //    username        → { passwordHash }
const sessions = new Map(); // sha256(sessionId) → { username, cart, createdAt, lastSeenAt, userAgent }

// Same decoy as Day 2: an unknown username must cost the same bcrypt time.
// Generated at startup, so it always matches SALT_ROUNDS.
const DUMMY_HASH = bcrypt.hashSync("a-password-nobody-will-ever-use", SALT_ROUNDS);

// ─── Errors we throw on purpose ────────────────────────────────────────────
// A normal Error, plus a statusCode. The central catch block checks for it:
// statusCode present  → the CLIENT sent something wrong, tell them what
// statusCode missing  → WE broke, log everything, tell them nothing
function clientError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// ─── Session helpers ───────────────────────────────────────────────────────

// The browser holds the real ID. Our store only ever holds its SHA-256.
// A leaked store (backup, log, debug endpoint) can't be used to log in.
function hashId(sessionId) {
  return crypto.createHash("sha256").update(sessionId).digest("hex");
}

// "sid=3f9a...; theme=dark"  →  Map { "sid" → "3f9a...", "theme" → "dark" }
function parseCookies(req) {
  const cookies = new Map();
  const header = req.headers.cookie;
  if (!header) return cookies;

  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue; // not a name=value pair, ignore it
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!cookies.has(name)) cookies.set(name, value); // first one wins
  }
  return cookies;
}

function isExpired(record, now) {
  return (
    now - record.lastSeenAt > IDLE_TIMEOUT_MS ||
    now - record.createdAt > ABSOLUTE_TIMEOUT_MS
  );
}

// Find the session this request belongs to, or null.
function getSession(req) {
  const sessionId = parseCookies(req).get(COOKIE_NAME);
  if (!sessionId || !SESSION_ID_FORMAT.test(sessionId)) return null;

  const key = hashId(sessionId);
  const record = sessions.get(key);
  if (!record) return null;

  const now = Date.now();
  if (isExpired(record, now)) {
    sessions.delete(key); // the server decides it's over, not the cookie
    return null;
  }

  record.lastSeenAt = now; // activity resets the idle clock
  return { key, record };
}

function setSessionCookie(res, sessionId) {
  res.setHeader(
    "Set-Cookie",
    [
      `${COOKIE_NAME}=${sessionId}`,
      "HttpOnly", //  page JavaScript can't read it     → XSS can't steal it
      "Secure", //    only ever sent over HTTPS         → no sniffing on open Wi-Fi
      "SameSite=Lax", // not sent on other sites' POSTs → basic CSRF protection
      "Path=/", //    sent to every route on this site
      `Max-Age=${Math.floor(ABSOLUTE_TIMEOUT_MS / 1000)}`, // browser forgets it after this
    ].join("; ")
  );
}

function clearSessionCookie(res) {
  // Same name + same Path, with Max-Age=0: "delete this cookie now".
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
}

// Create a brand-new session and hand its ID to the browser.
function startSession(req, res, { username, cart }) {
  const sessionId = crypto.randomBytes(32).toString("hex"); // 256 bits from the OS
  const key = hashId(sessionId);
  const now = Date.now();
  const record = {
    username, // null = a guest (not logged in yet)
    cart,
    createdAt: now,
    lastSeenAt: now,
    userAgent: req.headers["user-agent"] || "unknown",
  };

  sessions.set(key, record);
  setSessionCookie(res, sessionId);
  return { sessionId, key, record };
}

// Log the first 8 characters only. A full session ID in a log file
// is a working login for anyone who can read that log.
function short(id) {
  return id.slice(0, 8) + "…";
}

// ─── Request helpers (same as Day 2, errors upgraded) ──────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        // No (err) on purpose: we replace JSON.parse's message with our own.
        return reject(clientError(400, "Invalid JSON"));
      }
      // `null`, `42` and `[1,2]` are all valid JSON, but none is the object we need.
      if (data === null || typeof data !== "object" || Array.isArray(data)) {
        return reject(clientError(400, "Expected a JSON object"));
      }
      resolve(data);
    });
    req.on("error", reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

// ─── Routes ────────────────────────────────────────────────────────────────
async function route(req, res) {
  const { method, url } = req;

  // ══ REGISTER ═════════════════════════════════════════════════════════════
  if (method === "POST" && url === "/register") {
    const { username, password } = await parseBody(req);

    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      throw clientError(400, "Username and password required");
    }
    if (password.length < 8) {
      throw clientError(400, "Password must be at least 8 characters");
    }
    if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
      throw clientError(400, `Password must be at most ${MAX_PASSWORD_BYTES} bytes`);
    }
    if (users.has(username)) {
      // A username has to be unique, so we must say so. The notes cover
      // when this is fine and when it leaks something it shouldn't.
      throw clientError(409, "Username is already taken");
    }

    users.set(username, { passwordHash: await bcrypt.hash(password, SALT_ROUNDS) });
    console.log(`[REGISTER] ${username}`);
    return sendJSON(res, 201, { message: "Registered. Now log in." });
  }

  // ══ LOGIN ════════════════════════════════════════════════════════════════
  if (method === "POST" && url === "/login") {
    const { username, password } = await parseBody(req);

    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      throw clientError(400, "Username and password required");
    }

    // Day 2's timing-safe check, unchanged.
    const user = users.get(username);
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) {
      throw clientError(401, "Invalid credentials");
    }

    // ★ SESSION FIXATION DEFENCE
    // If this browser already had a session (a guest cart, an old login),
    // we NEVER promote that ID to "logged in". Whoever else might know that
    // ID must not become this user. Copy the useful data, kill the old ID,
    // and issue a brand-new one.
    const current = getSession(req);
    const cart = current ? current.record.cart : [];
    if (current) sessions.delete(current.key);

    const { sessionId } = startSession(req, res, { username, cart });
    console.log(`[LOGIN] ${username} → new session ${short(sessionId)}` +
      (current ? " (old session destroyed)" : ""));

    return sendJSON(res, 200, { message: `Welcome ${username}!`, cart });
  }

  // ══ CART — works for guests too (this is why pre-login sessions exist) ══
  if (method === "POST" && url === "/cart") {
    const { item } = await parseBody(req);
    if (typeof item !== "string" || !item) throw clientError(400, "item required");

    // A guest with no session yet gets an anonymous one, right here.
    const current = getSession(req) || startSession(req, res, { username: null, cart: [] });
    current.record.cart.push(item);

    return sendJSON(res, 200, {
      cart: current.record.cart,
      loggedInAs: current.record.username, // null for a guest
    });
  }

  // ══ PROFILE — protected ══════════════════════════════════════════════════
  if (method === "GET" && url === "/profile") {
    const current = getSession(req);
    if (!current || !current.record.username) {
      throw clientError(401, "Not logged in");
    }
    const s = current.record;
    return sendJSON(res, 200, {
      user: s.username,
      cart: s.cart,
      loggedInAt: new Date(s.createdAt).toISOString(),
      idleLogoutAt: new Date(s.lastSeenAt + IDLE_TIMEOUT_MS).toISOString(),
      hardLogoutAt: new Date(s.createdAt + ABSOLUTE_TIMEOUT_MS).toISOString(),
    });
  }

  // ══ MY DEVICES — every place you're logged in right now ═════════════════
  if (method === "GET" && url === "/sessions") {
    const current = getSession(req);
    if (!current || !current.record.username) throw clientError(401, "Not logged in");

    const mine = [];
    for (const [key, s] of sessions) {
      if (s.username !== current.record.username) continue;
      mine.push({
        device: s.userAgent,
        loggedInAt: new Date(s.createdAt).toISOString(),
        lastSeenAt: new Date(s.lastSeenAt).toISOString(),
        thisDevice: key === current.key,
      });
    }
    return sendJSON(res, 200, { sessions: mine });
  }

  // ══ LOGOUT — this device ═════════════════════════════════════════════════
  if (method === "POST" && url === "/logout") {
    const current = getSession(req);
    if (current) {
      sessions.delete(current.key); // ★ the ID is now dead, everywhere, instantly
      console.log(`[LOGOUT] ${current.record.username ?? "guest"}`);
    }
    clearSessionCookie(res); // tidy-up for the browser; the line above is the real logout
    return sendJSON(res, 200, { message: "Logged out" });
  }

  // ══ LOGOUT EVERYWHERE — "I think my account was stolen" ═════════════════
  if (method === "POST" && url === "/logout-all") {
    const current = getSession(req);
    if (!current || !current.record.username) throw clientError(401, "Not logged in");

    const username = current.record.username;
    let killed = 0;
    for (const [key, s] of sessions) {
      if (s.username === username) {
        sessions.delete(key);
        killed++;
      }
    }
    clearSessionCookie(res);
    console.log(`[LOGOUT-ALL] ${username}: ${killed} session(s) destroyed`);
    return sendJSON(res, 200, { message: `Logged out of ${killed} session(s)` });
  }

  // ══ DEBUG — look inside both stores ══════════════════════════════════════
  // Never ship this. It exists so you can SEE that the store keeps only
  // hashes: no passwords, and no usable session IDs either.
  if (method === "GET" && url === "/debug") {
    return sendJSON(res, 200, {
      users: [...users].map(([name, u]) => ({ username: name, passwordHash: u.passwordHash })),
      sessions: [...sessions].map(([key, s]) => ({
        storedKey: key,
        username: s.username,
        cart: s.cart,
      })),
    });
  }

  throw clientError(404, "Route not found");
}

// ─── Server — one place that catches every error ───────────────────────────
const server = http.createServer(async (req, res) => {
  // A short label for THIS request, so a user's error report can be matched
  // to the exact log line. It is not a secret, so 4 random bytes is plenty.
  const requestId = crypto.randomBytes(4).toString("hex");
  res.setHeader("X-Request-Id", requestId);

  try {
    await route(req, res);
  } catch (err) {
    if (err.statusCode) {
      // An error we threw on purpose: safe to tell the client what it was.
      return sendJSON(res, err.statusCode, { error: err.message });
    }
    // Anything else is OUR bug. Full detail to our terminal, nothing to them.
    console.error(`[req-${requestId}] ${req.method} ${req.url} failed:`, err);
    return sendJSON(res, 500, { error: "Internal server error", requestId });
  }
});

// ─── Housekeeping: sweep out sessions nobody came back for ─────────────────
// getSession only deletes an expired session when someone USES it. A user who
// closes the tab and never returns would sit in memory forever without this.
setInterval(() => {
  const now = Date.now();
  for (const [key, s] of sessions) {
    if (isExpired(s, now)) sessions.delete(key);
  }
}, 60 * 1000).unref(); // unref: this timer alone shouldn't keep Node running

server.listen(PORT, () => {
  console.log(`🍪 Day 3 server running on http://localhost:${PORT}`);
  console.log("   POST /register  POST /login  POST /cart  GET /profile");
  console.log("   GET /sessions   POST /logout POST /logout-all   GET /debug");
  console.log(`   Idle timeout ${IDLE_TIMEOUT_MS / 1000}s · absolute timeout ${ABSOLUTE_TIMEOUT_MS / 1000}s`);
});
