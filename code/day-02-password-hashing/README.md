# Day 02 — Proper Password Hashing with bcrypt

> Full writeup: [day-02-password-hashing.md](../../notes/phase-1-foundations/day-02-password-hashing.md)

Day 1 stored `"1234"` as a literal string and compared it with `===`. Both are fixed here.

## Run it

```bash
npm install
node server.js
```

Pre-seeded account: `legacy_user` / `oldpassword123` — hashed at the **old cost of 10**, so you can watch it upgrade itself.

> [!TIP]
> If `npm install bcrypt` fails with a `node-gyp` / Visual Studio error, swap to the pure-JS version:
> `npm install bcryptjs` and change the require line to `require("bcryptjs")`. Identical API.

## What to observe

### 1. No plaintext password is stored anywhere

```bash
curl -X POST localhost:3000/register -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"mypassword123"}'

curl localhost:3000/debug-db
```

The response splits the stored string into its parts — version, cost, 22-char salt, 31-char hash. `mypassword123` appears nowhere.

### 2. Same password, totally different rows

```bash
curl -X POST localhost:3000/register -H "Content-Type: application/json" \
  -d '{"username":"bob","password":"mypassword123"}'

curl localhost:3000/debug-db
```

Alice and Bob chose the **same password**. Compare their stored strings — nothing in common. That's salting.

### 3. Wrong password vs wrong username

```bash
curl -X POST localhost:3000/login -H "Content-Type: application/json" -d '{"username":"alice","password":"wrongpassword"}'
curl -X POST localhost:3000/login -H "Content-Type: application/json" -d '{"username":"ghost","password":"wrongpassword"}'
```

Identical message **and** near-identical response time. Both matter — see the enumeration section in the notes.

### 4. 🔧 Watch a work-factor upgrade happen live

```bash
curl localhost:3000/debug-db     # legacy_user shows cost 10

curl -X POST localhost:3000/login -H "Content-Type: application/json" \
  -d '{"username":"legacy_user","password":"oldpassword123"}'

curl localhost:3000/debug-db     # now cost 12
```

Server log prints `[UPGRADE] legacy_user: cost 10 → 12`. The user never noticed.

### 5. Feel the cost dial

```bash
node test-work-factors.js
```

Your numbers will differ from mine — that's the point. Tune to *your* hardware.

### 6. The 72-byte limit is enforced, not silently truncated

```bash
curl -X POST localhost:3000/register -H "Content-Type: application/json" \
  -d '{"username":"carol","password":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}'
```

Rejected with a clear 400. Without this guard, bcrypt would have ignored everything past byte 72 — meaning a *different* password could unlock the account.

### 7. Garbage no longer kills the server

Every one of these bypasses a browser completely — which is exactly how a real attacker reaches you:

```bash
curl -X POST localhost:3000/login -H "Content-Type: application/json" -d 'hello'

curl -X POST localhost:3000/login                    # no body at all

curl -X POST localhost:3000/register -H "Content-Type: application/json" \
  -d '{"username": "hacker", "password": '           # cut off mid-sentence

curl localhost:3000/debug-db                         # still alive
```

All return a clean `400 {"error":"Invalid JSON"}`. **Day 1's server died on the first one** — a single malformed string took the whole process down.

### 8. 🪤 Valid JSON is still not safe JSON

```bash
curl -X POST localhost:3000/register -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"longenough123","username":"admin"}'

curl localhost:3000/debug-db
```

Duplicate key — and it's **perfectly valid JSON**, so `JSON.parse` accepts it happily. JavaScript keeps the *last* value. You asked to create `alice`; look in the database and you created **`admin`**.

`try/catch` only answers "can this be parsed". Validating what's *inside* is a separate job — and the one that actually protects you.

## Still broken (on purpose)

Login works — and the **next request still has no idea who you are.** The stateless problem from Day 1 is completely untouched. That's Day 3.
