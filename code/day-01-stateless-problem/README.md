# Day 01 — The Stateless Problem, Naked

> [!WARNING]
> This code is **deliberately broken**. It is a teaching exhibit, not a starting point.
> Full writeup: [day-01-what-is-authentication.md](../../notes/phase-1-foundations/day-01-what-is-authentication.md)

## Run it

```bash
node server.js
```

No `npm install` needed — **zero dependencies**, pure Node standard library.

Valid users: `alice / 1234` and `bob / 5678`.

## Now break it (do all three)

### 💥 Break #1 — two users, one variable

```bash
curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d '{"username":"alice","password":"1234"}'
curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d '{"username":"bob","password":"5678"}'
curl http://localhost:3000/profile
```

**Expected:** `Hello bob`. Alice is gone. One variable, one slot — the second login overwrote the first. In a real app Alice would now be staring at Bob's data.

### 💥 Break #2 — no credentials, full access

```bash
# after anyone has logged in, from a fresh terminal / incognito window:
curl http://localhost:3000/profile
```

**Expected:** `Hello bob` — even though this caller sent no password, no cookie, no token, nothing. The server only asks *"has anyone ever logged in?"*, never *"is this caller that person?"*

**This is the entire point of Day 1.** Authentication isn't checking a password once. It's binding an identity to *every subsequent request*.

### 💥 Break #3 — restart wipes everyone

```bash
# Ctrl+C, then:
node server.js
curl http://localhost:3000/profile
```

**Expected:** `Not authenticated`. Every user on the planet logged out, because state lived in RAM. Now picture 50 servers behind a load balancer — they don't share that variable either.

### 🎁 Bonus — crash the whole server with one request

```bash
curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d 'hello'
```

`JSON.parse()` throws, nothing catches it, the process dies. One malformed request = total outage.
