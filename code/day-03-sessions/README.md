# Day 03 — Sessions from scratch

> Full writeup: [day-03-sessions.md](../../notes/phase-1-foundations/day-03-sessions.md)

Day 2 checked your password and forgot you 3ms later. Today the server **remembers you** — with a random ID, a cookie, and a `Map`. No `express-session`, no libraries.

## Run it

```bash
npm install
node server.js
```

Use a **second terminal** for the commands below. In curl, `-c file` saves the cookies the server sets and `-b file` sends them back, so each file behaves like one browser's cookie storage.

> [!TIP]
> If `npm install bcrypt` fails with a `node-gyp` / Visual Studio error, run `npm install bcryptjs` and change the require line to `require("bcryptjs")`. Identical API.

## Routes

| Route | What it does |
|---|---|
| `POST /register` | Create an account |
| `POST /login` | Check the password, issue a **brand-new** session ID |
| `POST /cart` | Add an item — works as a **guest**, which creates a pre-login session |
| `GET /profile` | Protected — only works with a logged-in session |
| `GET /sessions` | Every device you're logged in on |
| `POST /logout` | Kill this session |
| `POST /logout-all` | Kill every session for this user |
| `GET /debug` | Look inside both stores (never ship this) |

## What to observe

### 1. A cookie being born

```bash
curl -X POST localhost:3000/register -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"mypassword123"}'

curl -i -X POST localhost:3000/login -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"mypassword123"}' -c laptop.txt
```

Find `Set-Cookie: sid=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800` in the headers.

### 2. Remembered — then a stranger

```bash
curl localhost:3000/profile -b laptop.txt    # 200 — no password sent, it still knows you
curl localhost:3000/profile                  # 401 — no cookie, no idea who you are
```

That first line is **Day 1's problem, solved.**

### 3. The store holds hashes, not IDs

```bash
curl localhost:3000/debug
curl localhost:3000/profile -H "Cookie: sid=PASTE_STORED_KEY_HERE"    # 401
```

Compare `storedKey` with the value in `laptop.txt` — completely different. A stolen session table contains no working logins.

### 4. A stolen cookie works — until "log out everywhere"

```bash
curl -X POST localhost:3000/login -H "Content-Type: application/json" -A "Phone/1.0" \
  -d '{"username":"alice","password":"mypassword123"}' -c phone.txt
curl localhost:3000/sessions -b laptop.txt                                # 2 devices

curl localhost:3000/profile -A "EvilBox/6.6" -H "Cookie: sid=PASTE_LAPTOP_COOKIE"   # 200 😱
curl -X POST localhost:3000/logout-all -b phone.txt
curl localhost:3000/profile -H "Cookie: sid=PASTE_LAPTOP_COOKIE"                    # 401 ✅
```

### 5. 🔑 The deactivated key card

```bash
curl -X POST localhost:3000/login -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"mypassword123"}' -c laptop.txt
curl -X POST localhost:3000/logout -b laptop.txt
curl localhost:3000/profile -b laptop.txt     # 401
```

The cookie is **still in `laptop.txt`** and curl still sends it. The server deleted the session, so it opens nothing.

### 6. ⏳ Watch the idle timeout

```bash
IDLE_TIMEOUT_MS=10000 node server.js            # bash / Git Bash
$env:IDLE_TIMEOUT_MS=10000; node server.js      # PowerShell
```

Log in, call `/profile` a few times (200), go quiet for 11 seconds, call it again: **401** — with the cookie still in your jar. The server's clock decides, not the cookie's `Max-Age`.

### 7. 🎭 Session fixation — fixed, then broken on purpose

```bash
curl -X POST localhost:3000/cart -H "Content-Type: application/json" \
  -d '{"item":"bait"}' -c attacker.txt                 # attacker's guest session

curl -i -X POST localhost:3000/login -H "Content-Type: application/json" \
  -H "Cookie: sid=PASTE_ATTACKER_SID" \
  -d '{"username":"alice","password":"mypassword123"}'  # victim logs in carrying it

curl localhost:3000/profile -b attacker.txt            # 401 — the old ID died at login
```

Now in `/login`, replace

```js
const current = getSession(req);
const cart = current ? current.record.cart : [];
if (current) sessions.delete(current.key);
```

with

```js
const current = getSession(req);
if (current) {
  current.record.username = username;    // ❌ promote the old ID
  return sendJSON(res, 200, { message: `Welcome ${username}!` });
}
const cart = [];
```

Restart and repeat: the attacker's last call now returns **alice's profile**. Put the original lines back.

### 8. 💥 Try to crash it

```bash
curl localhost:3000/profile -H "Cookie: sid=constructor"
curl localhost:3000/profile -H "Cookie: sid=__proto__"
curl -X POST localhost:3000/login -H "Content-Type: application/json" -d 'null'
curl localhost:3000/debug          # still alive
```

A first draft that stored sessions in a plain `{}` **died on the first line**. The notes walk through exactly why.

### 9. 🍪 `HttpOnly` in a real browser

Open `http://localhost:3000/profile`, press **F12** → **Console**, and paste:

```js
await fetch("/register", { method: "POST", body: JSON.stringify({ username: "web", password: "mypassword123" }) });
await fetch("/login",    { method: "POST", body: JSON.stringify({ username: "web", password: "mypassword123" }) });
document.cookie
```

`document.cookie` doesn't show `sid` — but the **Application → Cookies** tab does, with `HttpOnly` ticked. Refresh the page and you're logged in.

## Still broken (on purpose)

Restart the server and call `/profile` with your old cookie: **401**. Every session lived in this one process's memory. Run two copies behind a load balancer and they wouldn't know about each other's sessions either. That's the scale problem — and the reason the "store the identity *inside* the token" idea exists. That's Day 4.
