/**
 * Day 01 — The Stateless Problem, Naked
 * ─────────────────────────────────────────────────────────────
 * ⚠️  THIS CODE IS INTENTIONALLY BROKEN. Never ship anything like it.
 *
 * It exists so you can FEEL the problem that sessions, cookies and
 * JWTs were invented to solve. Run it, break it, then read the notes:
 *   notes/phase-1-foundations/day-01-what-is-authentication.md
 *
 * Zero dependencies — pure Node.js standard library, so nothing is hidden.
 */

const http = require("http");

// 📌 Day 1 flaw: passwords in plaintext. Day 2 explains why this is
//    unforgivable, and what to do instead.
const USERS = {
  alice: "1234",
  bob: "5678",
};

// 🚨 Our entire "who is logged in" store: one variable, living in RAM.
//    null (not undefined) = "intentionally nobody is logged in right now"
let loggedInUser = null;

const server = http.createServer((req, res) => {
  const { method, url } = req;

  // ─────────────────────────────────────────────
  // 1. LOGIN  →  POST /login
  // ─────────────────────────────────────────────
  if (method === "POST" && url === "/login") {
    let body = "";

    // The body arrives as a STREAM, in chunks — not all at once.
    // Each chunk is a Buffer (raw bytes), so .toString() decodes it.
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    // "end" fires once the final chunk has arrived.
    req.on("end", () => {
      // 📌 Day 1 flaw: no try/catch. Send invalid JSON and this throws,
      //    which takes the whole server down. We fix this properly later.
      const { username, password } = JSON.parse(body);

      // 📌 Day 1 flaw: comparing secrets with === leaks timing information.
      //    Day 2 covers hashing; a later day covers constant-time comparison.
      if (USERS[username] && USERS[username] === password) {
        loggedInUser = username;

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Logged in!" }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Wrong credentials" }));
      }
    });
  }

  // ─────────────────────────────────────────────
  // 2. PROTECTED ROUTE  →  GET /profile
  // ─────────────────────────────────────────────
  else if (method === "GET" && url === "/profile") {
    // 🚨 THE BUG OF THE DAY:
    //    This asks "has ANYONE ever logged in?"
    //    It never asks "is THIS caller that person?"
    if (loggedInUser) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: `Hello ${loggedInUser}` }));
    } else {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Not authenticated" }));
    }
  }

  // ─────────────────────────────────────────────
  // 3. ANYTHING ELSE  →  404
  // ─────────────────────────────────────────────
  else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Not found" }));
  }
});

server.listen(3000, () => {
  console.log("🚀 Pure Node server running on http://localhost:3000");
  console.log("   Try breaking it — see this folder's README.md");
});
