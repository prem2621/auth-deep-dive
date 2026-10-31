<div align="center">

# Day 02 — The Password Problem

### How do you verify a password without ever storing it?

![Phase](https://img.shields.io/badge/Phase%201-Foundations-6f42c1?style=flat-square)
![Level](https://img.shields.io/badge/Level-Absolute%20Beginner%20Friendly-2ea043?style=flat-square)
![Time](https://img.shields.io/badge/Read%20time-~30%20min-blue?style=flat-square)
![Code](https://img.shields.io/badge/Code-Node.js%20%2B%20bcrypt-339933?style=flat-square)

</div>

---

### 📖 How to read this page

| Marker | What it means |
|---|---|
| **📜 CASE FILE** | Real-world history. Context and stories — step outside the code for a minute. |
| **🧪 PROVEN ON MY MACHINE** | Actual measured output. Not a claim from a blog post — numbers I ran myself. |
| **🙋 WAIT —** | A question you're probably already asking. Answered immediately, not later. |
| `> [!NOTE]` boxes | Short asides that matter but don't break the flow. |

---

> [!TIP]
> **Day 1 left a bomb in the code.** We wrote `password === "1234"` and moved on. Today we find out why those seven characters are the most dangerous thing in the whole file — and why the fix is one of the most beautiful ideas in computer science.

---

## 🎯 What you'll walk away with

- [ ] Why storing a password *at all* is the original sin
- [ ] What hashing is, and **why it genuinely cannot be reversed** (with a proof you can do in your head)
- [ ] Why hashing alone is still broken — rainbow tables
- [ ] What salt is, and why two users with the same password look completely different
- [ ] Why bcrypt is **deliberately slow**, and how to read all 60 characters of a bcrypt string
- [ ] Why a GPU — the attacker's favourite weapon — chokes on bcrypt
- [ ] How to raise your work factor years later **without breaking a single login**
- [ ] Two silent killers most tutorials never mention: **timing-based username enumeration** and **bcrypt's 72-byte truncation**

---

## 💣 First — look at what we wrote yesterday

```js
if (USERS[username] && USERS[username] === password) {
```

`USERS` was a plain object holding `"1234"`. In a real app, that object is your **database**. Which means your database contains the literal string `1234`, sitting there in a column, readable by anyone who gets in.

So ask the only question that matters:

> ### What happens when — not if — someone reads your database?

Every developer thinks "my database is secure, it's behind a firewall." Backups get copied to laptops. Staging servers get exposed. A junior runs a query in the wrong terminal. An SQL injection slips through. A cloud bucket gets set to public.

**Assume the attacker will read your database.** Design so that it doesn't matter.

---

> ### 📜 CASE FILE — Adobe, October 2013
>
> *Real-world history. The breach the industry still teaches from.*
>
> Adobe announced a breach affecting **2.9 million** customers. Security researchers then found a compromised backup server, and the file that eventually circulated online held **153 million account records**.
>
> **What was in it:**
> - Internal IDs, usernames, email addresses
> - Passwords protected with **reversible encryption**, not hashing
> - **Password hints stored in plaintext** — literally the user's own words describing their password
> - Proprietary source code for Acrobat, ColdFusion and Photoshop
>
> **Here's the part that makes it legendary.** Adobe didn't hash. They encrypted with **3DES in ECB mode**. Encryption is a locked box — with the key, everything opens. Worse, ECB mode encrypts each 8-byte block *independently* with no salt, which means:
>
> > **identical passwords produced identical ciphertext.**
>
> Researchers never needed the key. They just lined the records up and looked:
>
> - Everyone whose encrypted blob matched *this* pattern shared a password
> - One of them had left a plaintext hint like `"name of my dog"`
> - Another in the same group: `"rhymes with assword"`
>
> Match the duplicates, read the hints, and the password falls out. People cracked millions of passwords with **a text editor and patience**. xkcd #1286 turned the whole thing into a crossword puzzle — that's how mechanical it was.
>
> **How did the world learn Adobe's method?** Pure reverse-engineering. Every encrypted value was an exact multiple of 8 bytes — the block size of DES. That one structural fingerprint gave the algorithm away. Nobody at Adobe had to confess.

> [!IMPORTANT]
> **Clearing up a common mix-up:** Adobe used **neither hashing nor JWTs**. JWTs are session tokens handed out *after* login — they have nothing to do with how a password is stored. And what Adobe did was encryption (reversible), which is the exact opposite of hashing (irreversible). The whole disaster is a story about choosing the wrong primitive.

---

## 🤯 The paradox

So we can't store the password. But we have to check it on every login.

> **How do you verify something is correct without knowing what it is?**

That sounds impossible. It isn't — and the answer is hashing.

---

## 🥩 What hashing actually is

Picture a meat grinder. Put a whole chicken in. Ground meat comes out.

Two things are true about that grinder:

1. **Same chicken in → same mince out.** Every single time. It's deterministic.
2. **You cannot run it backwards.** No amount of staring at the mince reconstructs the chicken.

A hash function is exactly that, for data. Feed it any string, get back a fixed-length fingerprint.

> 🧪 **PROVEN ON MY MACHINE** — real SHA-256 output
>
> ```txt
> "1234"  →  03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4
> "1235"  →  310ced37200b1a0dae25edb263fe52c491f6e467268acab0ffec06666e2ed959
> "1234"  →  03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4   ← identical again
> ```
>
> One character changed and **the entire output is unrecognisable.** That's called the avalanche effect. And `"1234"` gives the same answer every time, forever, on every machine on Earth.

So here's the trick that solves the paradox:

```mermaid
flowchart LR
    subgraph REG["🆕 REGISTRATION"]
      direction TB
      A1["User types<br/><b>1234</b>"] --> A2["hash it"] --> A3["store <b>03ac67...</b><br/>in the database"]
      A4["the password itself<br/>is thrown away 🗑️"]
    end

    subgraph LOG["🔑 LOGIN"]
      direction TB
      B1["User types<br/><b>1234</b>"] --> B2["hash it"] --> B3["03ac67..."]
      B3 --> B4{"same as<br/>what's stored?"}
      B4 -->|yes| B5["✅ correct password"]
      B4 -->|no| B6["❌ wrong password"]
    end
```

The database never contains the password. The server itself **does not know your password** and has no way to find out. If an attacker steals the whole table, they get `03ac67...`, which unlocks nothing.

---

> ### 🙋 WAIT — if the server can recreate the hash, why can't a hacker recreate the password?
>
> This is *the* question. Everyone arrives at it, and it's the right instinct.
>
> You're correct about one half: **password + salt + algorithm → always the same hash.** That's precisely how login works.
>
> But that arrow only points one way. You can go `password → hash`. You can never go `hash → password`.
>
> **Here's a hash function simple enough to prove it by hand:** *add up the digits, keep the last digit.*
>
> ```txt
> 567  →  5+6+7 = 18  →  hash is 8
> 990  →  9+9+0 = 18  →  hash is 8
> 125  →  1+2+5 =  8  →  hash is 8
> 44   →  4+4   =  8  →  hash is 8
> ```
>
> Now I hand you the hash `8` and ask for the original number. **You can't.** Not because you aren't clever enough — because the information is *physically gone*. Four different inputs produced it. So did millions of others.
>
> That's the whole thing. Hashing **destroys information on purpose**. Encryption preserves it (that was Adobe's mistake). A real hash squeezes inputs of any length into a fixed 256 bits — infinitely many inputs, finitely many outputs. The original cannot be recovered because it is no longer there.
>
> So what *can* an attacker do? Only one thing: **guess.** Take a guess, hash it, see if it matches. Guess again. Forever. The entire remainder of this page is about making that guessing as miserable as possible.

---

## 💥 But plain hashing is already broken: rainbow tables

Attackers aren't stupid. They thought:

> *"I can't reverse a hash. But hashes are deterministic and public. What if I just pre-compute the hash of every common password, once, and keep the lookup table?"*

```txt
"password"   →  5f4dcc3b5aa765d61d8327deb882cf99
"123456"     →  e10adc3949ba59abbe56e057f20f883e
"1234"       →  03ac674216f3e15c761ee1a5e255f067...
"qwerty"     →  d8578edf8458ce06fbc5bb76a58c5ca4
...billions more
```

That's a **rainbow table**. Build it once, use it against every breached database forever. They're downloadable right now, for free, covering essentially every password a human would plausibly invent.

> [!CAUTION]
> Against a rainbow table, plain `SHA-256(password)` offers **almost no protection at all**. Steal the database, run the lookup, done. Milliseconds per account.

---

## 🧂 The fix: salt

A **salt** is a random string mixed into the password *before* hashing.

```txt
password         "1234"
random salt      "xK9#mP2"
combined         "1234xK9#mP2"
hash of that  →  a7f3b2...        ← nothing like the hash of "1234"
```

You store the salt right alongside the hash. It is **not a secret** — and it doesn't need to be.

**Why it kills rainbow tables:** the attacker's table contains the hash of `"1234"`. Your database contains the hash of `"1234xK9#mP2"`. Not in their table. To beat you they'd have to rebuild the *entire* billion-entry table from scratch — **for every single user**, because every user gets a different salt.

That's the real magic. One table attacks a billion accounts; salting forces one table **per account**.

---

> ### 🙋 WAIT — do two users with the same password look the same in the database?
>
> **No.** And this is a bigger deal than it sounds.
>
> Alice and Bob both pick `12345`. Alice gets salt `X97f!`, Bob gets salt `Q2m4p`. Their stored hashes share nothing.
>
> Why that matters: in the Adobe breach, identical passwords produced **identical** stored values. That single property is what let researchers group users together and crack them in bulk. Salting means an attacker can't even tell that two accounts share a password — let alone which one.

---

## ⚡ Still broken: hash functions are too *fast*

Salting stops the pre-computed table. It does **not** stop live guessing.

And here's the trap: SHA-256 and MD5 were designed to be **blazingly fast**, because their real job is checking file integrity, where you might hash a 4 GB file.

For passwords, speed is the enemy — it's the attacker's speed too.

> 🧪 **PROVEN ON MY MACHINE**
>
> ```txt
> SHA-256, single CPU core, in Node:   ~300,000 - 650,000 hashes/sec
> ```
>
> (I ran it twice and got both ends of that range — it moves with whatever else the machine is doing. The order of magnitude is the point.)
>
> That's **one core** of an ordinary laptop. A real attacker runs a rack of GPUs and reaches **billions per second**. A 6-character password dies in seconds.

---

## 🐢 Enter bcrypt: slow on purpose

bcrypt's entire design philosophy is one sentence:

> **Make computing a single hash expensive, and let the defender choose how expensive.**

That dial is the **work factor** (also called cost, or rounds). It's exponential:

| Work factor | Internal rounds | |
|:---:|:---:|---|
| 10 | 2¹⁰ = **1,024** | |
| 12 | 2¹² = **4,096** | ← common default today |
| 14 | 2¹⁴ = **16,384** | |

**+1 to the cost doubles the work. +2 quadruples it.**

> 🧪 **PROVEN ON MY MACHINE** — `node test-work-factors.js`
>
> ```txt
> cost  8  (2^8  =   256 rounds)     13ms  →  ~76.9 guesses/sec for an attacker
> cost 10  (2^10 =  1024 rounds)     66ms  →  ~15.2 guesses/sec
> cost 12  (2^12 =  4096 rounds)    244ms  →   ~4.1 guesses/sec
> cost 14  (2^14 = 16384 rounds)    936ms  →   ~1.1 guesses/sec
> ```
>
> Run it on your own machine. **Your numbers will differ, and that's the entire point** — you tune the cost to your hardware, not to a number you read somewhere. (A second run on a busier machine gave me 483ms at cost 12. Same shape, different absolute values.)

Now put the two measurements side by side:

```txt
SHA-256    ~644,000 guesses/sec   😱   (and that's just one CPU core)
bcrypt 12       ~4.1 guesses/sec   🐢
```

**That's a slowdown of roughly 150,000× — on the attacker.** For your user, it's a quarter of a second, once, at login. They will never notice.

> [!NOTE]
> **The tuning rule of thumb:** pick the highest cost where hashing still takes **~250–350ms on your production hardware**. Fast enough that logins feel instant, slow enough that offline cracking is hopeless. Re-check it every couple of years as CPUs get faster.

---

## 🔬 Anatomy of a real bcrypt string

This is a genuine bcrypt hash of the password `12345`, generated on my machine:

```txt
$2b$12$Wg7L08UrPcgkTdwuCtfsUOOVgviVDGo8Yx6EAf9f/GKainb2iDRBS
└┬─┘└┬┘└──────────┬─────────┘└──────────────┬──────────────┘
 1   2            3                         4
```

| # | Part | Length | What it is |
|:-:|------|:------:|------------|
| 1 | `$2b$` | 4 | **Version tag.** Says "this is bcrypt, variant 2b". |
| 2 | `12$` | 3 | **Cost factor.** 2¹² = 4,096 rounds. |
| 3 | `Wg7L08UrPcgkTdwuCtfsUO` | **22** | **The salt.** 16 random bytes in bcrypt's own base64. |
| 4 | `OVgviVDGo8Yx6EAf9f/GKainb2iDRBS` | **31** | **The actual hash output.** |

**Total: always exactly 60 characters.** Size your database column accordingly — `VARCHAR(60)`, or `VARCHAR(72)` if you want headroom for a future variant.

> [!IMPORTANT]
> Look at what that single string contains: the algorithm, the cost, the salt, *and* the hash. The database row **carries its own instructions for how to verify it.** That's why you never need a separate `salt` column, and why upgrading your cost factor later doesn't break old rows. It's a genuinely elegant piece of design.

---

## 🙋 The questions you're definitely asking

### "Does the `12` mean the salt is 12 characters long?"

**No** — and this is the single most common misreading of a bcrypt string.

`12` is the **work factor**: 2¹² = 4,096 rounds of math. The salt is a *separate* field, and its length is **fixed at 22 characters, always**, no matter what the cost is. Change the cost to 14 and the salt is still 22 characters.

---

### "How does a hacker know you used 12 rounds and not 14?"

**They just read it.** It's printed in plaintext as the third field of the string they stole: `$2b$`**`12`**`$...`

And that is completely fine. bcrypt's security has **nothing** to do with hiding the cost. It comes from the cost being genuinely expensive to pay. Knowing a vault takes 4,096 turns to open doesn't help you — you still have to make all 4,096 turns, for every guess.

> [!NOTE]
> This is **Kerckhoffs's principle**: a system must stay secure even when everything about it except the key is public knowledge. Any scheme whose safety depends on attackers not knowing how it works is already broken.

---

### "Same password + same salt + same cost — do I get the same hash?"

**Yes. Byte for byte, every time.** This is exactly how login verification works.

> 🧪 **PROVEN ON MY MACHINE** — one fixed salt, hashed twice
>
> ```txt
> fixed salt :  $2b$12$H3fT8FK4u5ZVktvR0yevhO
> hash run 1 :  $2b$12$H3fT8FK4u5ZVktvR0yevhODeFwUxl6vfB98/t5U0hTiSq4Pd9h1SK
> hash run 2 :  $2b$12$H3fT8FK4u5ZVktvR0yevhODeFwUxl6vfB98/t5U0hTiSq4Pd9h1SK
> identical? :  true ✅
> ```

---

### "Then why does `bcrypt.hash('12345', 12)` give me something different every time?"

Because when you *don't* hand it a salt, **bcrypt generates a fresh random one for you**. Different salt → different output. You cannot run bcrypt without a salt; it won't let you.

> 🧪 **PROVEN ON MY MACHINE** — same password, no fixed salt
>
> ```txt
> run 1 :  $2b$12$cxl40uxloxGMqB7rT.XvRueO2FMsBVvYARbDjz8o4g/SXq2XqbxAq
> run 2 :  $2b$12$Dtoz5tfQXYcDHpUpEX8wM.JI7/IaCoFALhO9qesam/BuKE5D31CyG
> identical? :  false ✅  ← this is correct behaviour, not a bug
> ```
>
> Both strings verify `12345` successfully. Each carries its own salt, so each knows how to check itself.

---

### "Same password, same salt, but cost 10 vs cost 12 — same hash?"

**No. Completely different.**

> 🧪 **PROVEN ON MY MACHINE** — identical salt bytes, only the cost changed
>
> ```txt
> cost 10 :  $2b$10$H3fT8FK4u5ZVktvR0yevhOjJXMUAdu/UKqC/DKVlOHU62dcd7yfIW
> cost 12 :  $2b$12$H3fT8FK4u5ZVktvR0yevhODeFwUxl6vfB98/t5U0hTiSq4Pd9h1SK
>            └─ same salt ─────────────┘└─ totally different output ────┘
> ```

Why? bcrypt feeds each round's output into the next round. It's a chain. Running the chain 4,096 times lands somewhere completely unrelated to running it 1,024 times — the same way baking a cake for 12 minutes and 14 minutes doesn't give you "roughly the same cake".

---

### "Could an attacker crack a bcrypt hash using fast SHA-256 instead?"

**No. You're exactly right about this, and it's an important thing to be right about.**

To test a guess, the attacker must produce **the identical 31-character output** that sits in your database. That output came out of bcrypt's math. Feeding a guess into SHA-256 produces a SHA-256-shaped answer that looks nothing like a bcrypt string.

There is no shortcut, no cheaper equivalent algorithm. **The attacker is trapped inside bcrypt's slow math for every single guess.** They have to pay your work factor, every time, forever. That's the whole design.

---

## 🎮 Why GPUs — the attacker's superweapon — choke on bcrypt

To crack MD5 or SHA-256, attackers don't use CPUs. They use **graphics cards**.

> **CPU** = one brilliant professor solving one hard problem at a time.
> **GPU** = five thousand schoolchildren all doing simple arithmetic simultaneously.

Password hashing is embarrassingly parallel — every guess is independent — so a GPU with thousands of cores is perfect for it. Hence billions of SHA-256 guesses per second.

**bcrypt was built to ruin this.**

Under the hood bcrypt uses the **Blowfish** cipher, whose key schedule needs a ~**4 KB table of S-boxes** that is constantly rewritten throughout all 4,096 rounds.

```txt
SHA-256 attack   →  tiny state, fits in a GPU core's registers   →  🚀 millions in parallel
bcrypt attack    →  4 KB of fast memory  PER CORE                →  🐌 cores stall, starving
```

4 KB is nothing to a CPU. But a GPU trying to run 5,000 guesses at once needs 4 KB of *fast local* memory for **each** of those 5,000 cores — roughly 20 MB of on-chip cache that simply does not exist. The cores end up queueing for slow memory and sit idle.

> [!TIP]
> This property is called being **memory-hard**. bcrypt is mildly memory-hard, almost by accident. **Argon2** — which won the 2015 Password Hashing Competition — was designed to be *aggressively* memory-hard, letting you demand hundreds of megabytes per guess. We'll compare them properly later; for now, know that bcrypt remains a perfectly respectable choice in 2026.

---

## 🔧 Raising your work factor years later, without breaking logins

Your app launched in 2020 with cost 10. It's now 2026 and cost 10 is too fast. You want 12.

You **cannot** just rehash the database — you don't have anyone's password. That's the whole point of hashing. So how does a real company migrate?

**Upgrade-on-login.** The one moment you briefly hold the plaintext password is during a successful login. Use it:

```mermaid
flowchart TD
    A["User logs in<br/>password: ••••••"] --> B["Read stored hash<br/>$2b$<b>10</b>$..."]
    B --> C["Verify using the cost<br/>written in the string (10)"]
    C -->|wrong| D["❌ 401"]
    C -->|correct| E{"stored cost < current<br/>target cost?"}
    E -->|"no (already 12)"| G["✅ log them in"]
    E -->|"yes (10 < 12)"| F["Re-hash the plaintext<br/>at cost 12, overwrite the row"]
    F --> G
```

```js
const ok = await bcrypt.compare(password, user.hash);
if (!ok) return sendJSON(res, 401, { error: "Invalid credentials" });

// The password is correct AND we still have the plaintext in memory.
// This is the only moment an upgrade is possible.
if (bcrypt.getRounds(user.hash) < SALT_ROUNDS) {
  user.hash = await bcrypt.hash(password, SALT_ROUNDS);
}
```

Old rows verify with old settings (the cost is in the string, remember). Active users silently migrate as they log in. Nobody is logged out, nobody resets anything, and after a few months almost everyone has moved.

> [!NOTE]
> Accounts that never log in keep their old hash forever. That's normally fine — but for a serious cost bump after a breach, you force a password reset on the stragglers instead.

---

## 💻 The code

Full runnable version: [`code/day-02-password-hashing/`](../../code/day-02-password-hashing/)

> [!TIP]
> **Read this code first. Don't scroll past it.**
>
> Go top to bottom and try to work out what each line is doing on your own — no Google, no AI, no scrolling ahead. You will hit lines that make no sense. *Why is there a second error handler on `req`? What is `DUMMY_HASH` even for? Why count bytes instead of characters?*
>
> **That feeling is not a knowledge gap. That is what learning something new feels like.** I'm a beginner here too — every single one of those lines stopped me dead the first time I wrote it. So underneath the code I've answered all of them, in the same order they hit me.
>
> Read it yourself first. Then come down and check your guesses. If a question of yours isn't answered down there, that's a gap in *my* writing — [tell me](#-this-is-open-source--help-make-it-better) and I'll add it.

```js
const http = require("http");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 12;
const MAX_PASSWORD_BYTES = 72;

const usersDB = {};

// Decoy hash so unknown usernames cost the same time as real ones.
const DUMMY_HASH = bcrypt.hashSync("a-password-nobody-will-ever-use", SALT_ROUNDS);

// Seeded legacy account at the OLD cost of 10, to watch the upgrade happen.
usersDB["legacy_user"] = { hash: bcrypt.hashSync("oldpassword123", 10) };

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  if (method === "POST" && url === "/register") {
    try {
      const { username, password } = await parseBody(req);

      if (!username || !password)
        return sendJSON(res, 400, { error: "Username and password required" });
      if (password.length < 8)
        return sendJSON(res, 400, { error: "Password must be at least 8 characters" });
      if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES)
        return sendJSON(res, 400, { error: `Password must be at most ${MAX_PASSWORD_BYTES} bytes` });
      if (usersDB[username])
        return sendJSON(res, 409, { error: "User already exists" });

      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      usersDB[username] = { hash };

      return sendJSON(res, 201, { message: "User registered successfully" });
    } catch (err) {
      if (err.message === "Invalid JSON")
        return sendJSON(res, 400, { error: "Invalid JSON" });
      console.error("[ERROR] /register failed:", err);   // full detail for us
      return sendJSON(res, 500, { error: "Internal server error" }); // vague for them
    }
  }

  else if (method === "POST" && url === "/login") {
    try {
      const { username, password } = await parseBody(req);

      if (!username || !password)
        return sendJSON(res, 400, { error: "Username and password required" });

      const user = usersDB[username];

      // Unknown user: burn the same time, then fail identically.
      if (!user) {
        await bcrypt.compare(password, DUMMY_HASH);
        return sendJSON(res, 401, { error: "Invalid credentials" });
      }

      const ok = await bcrypt.compare(password, user.hash);
      if (!ok) return sendJSON(res, 401, { error: "Invalid credentials" });

      // Upgrade-on-login
      if (bcrypt.getRounds(user.hash) < SALT_ROUNDS) {
        user.hash = await bcrypt.hash(password, SALT_ROUNDS);
      }

      return sendJSON(res, 200, { message: `Welcome ${username}! Password verified.` });
    } catch (err) {
      if (err.message === "Invalid JSON")
        return sendJSON(res, 400, { error: "Invalid JSON" });
      console.error("[ERROR] /login failed:", err);
      return sendJSON(res, 500, { error: "Internal server error" });
    }
  }

  else if (method === "GET" && url === "/debug-db") {
    return sendJSON(res, 200, { database: usersDB });
  }

  else {
    return sendJSON(res, 404, { error: "Route not found" });
  }
});

server.listen(3000, () => console.log("🔐 Day 2 server on http://localhost:3000"));
```

---

## 🔬 Line by line — the parts that are new since Day 1

Day 1 covered `require`, `createServer`, `req`/`res`, streams, chunks, `JSON.parse`, `res.end`. Those work identically here. **These are the genuinely new pieces.**

> [!TIP]
> **If any part of this feels heavy — don't worry. I had exactly the same questions.**
>
> Every `🙋 WAIT —` block below is a question that genuinely stopped me while writing this code. *Why two error handlers? Aren't `reject` and `catch` the same thing? Why count bytes instead of characters?* I didn't get Promises, streams or error handling on the first pass either — so I've written every one of those answers out below, in the order they hit me.
>
> Read it once for the shape, run the code, then come back. The second pass is where it clicks. That's how it went for me, and there's nothing wrong with you if it goes the same way.

---

### The one import that isn't built into Node

```js
const bcrypt = require("bcrypt");
```

Unlike `http`, this is **not** built into Node — you install it with `npm install bcrypt`.

One thing worth knowing: `bcrypt` is a **native module**. It ships C++ that gets compiled for your machine during install. That makes it fast, but on some Windows setups without build tools the install fails outright.

> [!TIP]
> If `npm install bcrypt` errors with something about `node-gyp` or Visual Studio, use **`bcryptjs`** instead — a pure-JavaScript implementation with an identical API. Just swap the require line. It's slower, which for a deliberately-slow algorithm matters less than you'd think.

---

### Wrapping the request body in a Promise

```js
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}
```

Day 1 handled the body inline:

```js
req.on("data", (chunk) => { body += chunk.toString(); });
req.on("end",  () => { /* all the logic, nested in here */ });
```

That works, but every route ends up with its logic buried inside a callback. Today we wrap the *same two events* in a **Promise** so we can write:

```js
const { username, password } = await parseBody(req);
```

Flat, readable, and errors land in a normal `try/catch`. **The mechanics underneath are byte-for-byte identical** — still a stream, still chunks, still `.toString()`. We only changed how we *wait* for it.

`resolve` = "success, here's the value." `reject` = "it failed, here's why." That's a Promise in one line.

> [!NOTE]
> Notice the `catch { reject(...) }` around `JSON.parse`. **This is the Day 1 crash bug, fixed.** Yesterday, sending `hello` to `/login` killed the entire process. Now it returns a clean 400.

---

> ### 🙋 WAIT — why `req.on("error", reject)`? The `try/catch` already catches errors.
>
> Genuinely sharp question, and the answer is that **those two lines catch two completely different failures that happen at two different moments.**
>
> ```js
> req.on("end", () => {
>   try { resolve(JSON.parse(body)); }
>   catch { reject(new Error("Invalid JSON")); }   // ← failure type 1
> });
>
> req.on("error", reject);                          // ← failure type 2
> ```
>
> | | `try/catch` around `JSON.parse` | `req.on("error", reject)` |
> |---|---|---|
> | **Catches** | Bad *data* — all of it arrived, but it isn't valid JSON (`{"name": "John"` with no closing brace) | Bad *connection* — the data never finished arriving |
> | **When** | **After** the request completed, inside `"end"` | **During** transmission, before `"end"` ever fires |
> | **Real cause** | User/client sent malformed JSON | Wi-Fi dropped, browser tab closed mid-upload, cable yanked |
>
> **Here's the killer detail: a stream error never reaches your `try/catch`.** It's not an exception being thrown down the call stack — it's an **event** being emitted on the stream object. Your `try/catch` sits *inside* the `"end"` callback, and when the network dies, `"end"` **never fires at all**. The catch block is never even reached.
>
> **So what happens if you delete that line?** Follow it through:
>
> ```txt
> 1. User's internet cuts out halfway through the upload
> 2. "end" never fires       →  your try/catch never runs
> 3. The stream emits "error" →  nobody is listening
> 4. Your Promise never resolves AND never rejects
>    →  it hangs pending forever  →  the memory it holds is never freed
> 5. In Node, an unhandled stream "error" event is thrown as an
>    uncaught exception  →  it can take the whole server down
> ```
>
> One dropped connection shouldn't be able to leak memory or kill your process. That one line is what prevents it.
>
> > [!NOTE]
> > This is a general rule in Node, not a bcrypt thing: **every stream you listen to needs an `"error"` listener.** Request bodies, file reads, database cursors, network sockets — all of them. An unhandled `"error"` event is one of the most common ways a Node server dies in production.

---

> ### 🙋 WAIT — if we have `resolve`/`reject`, why do we *also* need `try/catch`? Aren't they the same?
>
> They feel like the same thing because both deal with failure. But they sit on **opposite sides of the transaction**.
>
> | | `resolve` / `reject` | `try` / `catch` |
> |---|---|---|
> | **Role** | **Producer** — decides the outcome | **Consumer** — deals with the outcome |
> | **Lives** | inside `new Promise(...)` | inside the `async` function that `await`s it |
> | **Kitchen analogy** | The chef deciding "dish is ready" or "dish is ruined" | The customer at the table handling a ruined dish |
>
> `reject` **throws the ball. `catch` is the glove.** You need both, or the ball hits the floor.
>
> **And "hits the floor" is not a metaphor.** If a Promise rejects and nothing is there to catch it — no `try/catch` around the `await`, no `.catch()` chained on — Node raises an **unhandled promise rejection**. In modern Node that terminates the process by default. Your entire server goes down because one user sent a malformed request body.
>
> **So should you wrap every Promise in `try/catch`?** No — that's how you end up with "try/catch hell", nested blocks everywhere, unreadable. Use one when:
>
> - ✅ You're using `async`/`await` and want flat, readable error handling
> - ✅ You can actually **do something** about the failure right there — send a 400, show a fallback, retry
> - ❌ Not when you'd just re-throw it unchanged. Let it bubble up to a caller that *can* handle it.
>
> In our server each route handler has exactly one `try/catch` wrapping everything, because each route has exactly one meaningful recovery: send an error response instead of a success one. One handler, one catch. That's the right amount.

---

> ### 🙋 WAIT — how does a user even *send* invalid JSON? They type text into a box and the frontend builds the JSON. So can this error actually happen?
>
> ```js
> catch { reject(new Error("Invalid JSON")); }
> ```
>
> **You're right about the normal path — and right for the right reason.** Follow it:
>
> ```txt
> 1. User types  John  into a text box        →  just a string
> 2. Frontend runs JSON.stringify({ username: "John" })
> 3. JSON.stringify CANNOT produce broken JSON  →  that is its entire job
> 4. A perfectly-formed body arrives at your server
> ```
>
> On that path `JSON.parse` never throws. Not once. Ever.
>
> **The hidden assumption is step 1 — that every request comes from your website.** It doesn't. Your server has no idea what's on the other end of the connection. `http.createServer` sees raw text arriving on a port. It cannot tell a React app from a mobile app from somebody's terminal, and it never asks.
>
> Here are the three ways broken JSON genuinely reaches a production server.
>
> ---
>
> **① The frontend developer made a bug**
>
> They build the body by hand with string concatenation instead of `JSON.stringify` — or they use `JSON.stringify` correctly but forget `JSON.parse` on a value that was already a string. What leaves the browser is:
>
> ```txt
> { "username": "John", "password": "password123"
> ```
>
> No closing `}`. Nobody on the team notices, because the form *looks* like it submitted.
>
> Your 400 is the thing that tells them. Without it, that bug is invisible and reaches production.
>
> ---
>
> **② The connection died mid-transfer**
>
> A user on a train hits "Register" as they enter a tunnel. The frontend sent a perfect body; only part of it arrived:
>
> ```txt
> {"username": "Jo
> ```
>
> The stream ends, `"end"` fires, and `JSON.parse` is handed a sentence cut in half. **Nobody did anything wrong here** — not the user, not the developer. The network just lost. This case alone is enough reason for the check to exist.
>
> ---
>
> **③ Somebody skipped your frontend entirely — the common one**
>
> Attackers don't use your nice signup form. They talk to your API directly with `curl`, Postman, or a script. Every validation rule you wrote in JavaScript on the frontend — required fields, minimum length, "passwords must match" — **is skipped completely.** It was never a security control. It was a convenience for honest users.
>
> Watch it happen. This is one terminal command against the server you're running right now:
>
> ```bash
> curl -X POST http://localhost:3000/register \
>      -H "Content-Type: application/json" \
>      -d '{"username": "hacker", "password": '
> ```
>
> The body stops mid-sentence: no password value, no closing quote, no `}`. Now trace it through your own code:
>
> ```txt
> 1. req.on("data")  →  body += '{"username": "hacker", "password": '
> 2. req.on("end")   →  fires normally, the request DID complete
> 3. JSON.parse(body)  →  💥 SyntaxError: Unexpected end of JSON input
> 4. catch            →  reject(new Error("Invalid JSON"))
> 5. route catch (err) →  err.message === "Invalid JSON"  →  400
> ```
>
> > 🧪 **PROVEN ON MY MACHINE** — that exact command, against this server:
> >
> > ```txt
> > HTTP/1.1 400 Bad Request
> > {"error":"Invalid JSON"}
> > ```
> >
> > And the one-second version — no body at all, so `body` stays `""` and `JSON.parse("")` throws:
> >
> > ```txt
> > $ curl -X POST http://localhost:3000/login
> > {"error":"Invalid JSON"}
> > ```
>
> Here's what it costs you to be missing that `try/catch`. `JSON.parse` doesn't return `null` on bad input — it **throws**. Thrown inside an async handler with nothing to catch it, that's an unhandled rejection, and Node kills the process:
>
> ```txt
>                     ONE malformed request body
>                                │
>              ┌──────────────────┴──────────────────┐
>              │                                     │
>     ✅ try/catch present               ❌ no try/catch
>              │                                     │
>     400 Bad Request                   SyntaxError thrown
>              │                                     │
>     server keeps serving              unhandled rejection
>     every other user                           │
>              │                          process exits
>          nothing burns                         │
>                                    🔥 site down for EVERYONE
> ```
>
> **One attacker, one broken string, your whole site offline.** That is a denial-of-service attack that costs the attacker a single command — and it's exactly what Day 1's server was vulnerable to. **Two lines** of `try/catch` is the entire fix.
>
> ---
>
> **So what does the actual human see?**
>
> Never the words "Invalid JSON". That message is for a *developer*. The frontend catches the 400 and translates:
>
> | Layer | What it says |
> |---|---|
> | 🖥️ **Backend** | `400` · `{"error": "Invalid JSON"}` |
> | ⚛️ **Frontend** | sees status `400`, picks a human message |
> | 👤 **User** | *"Something went wrong sending your details. Check your connection and try again."* |
>
> Same rule as the byte-length error above: **API errors are written for developers; UI errors are written for humans.** And a real user hits this almost exclusively through cause ②, where "check your connection" happens to be exactly the right advice.
>
> ---
>
> > [!CAUTION]
> > **The twist that should bother you: valid JSON is not the same as safe JSON.**
> >
> > `JSON.parse` only checks *grammar*, never *meaning*. This is perfectly valid JSON — same key twice:
> >
> > ```bash
> > curl -X POST http://localhost:3000/register \
> >      -H "Content-Type: application/json" \
> >      -d '{"username":"alice","password":"longenough123","username":"admin"}'
> > ```
> >
> > It parses without complaint. JavaScript keeps the **last** value, so `username` is `"admin"`:
> >
> > ```txt
> > {"message":"User registered successfully"}
> >
> > $ curl localhost:3000/debug-db
> > { "database": { "admin": { "cost": 12, ... } } }      ← not alice
> > ```
> >
> > I ran that against this exact server. I asked for `alice` and created `admin`.
> >
> > Now imagine a gateway that validates the *first* `username` and a backend that stores the **last** one — different languages genuinely disagree here (Python keeps the last, Go keeps the last, some parsers keep the first, some reject outright). That mismatch is a real, named class of auth bypass: **JSON interoperability attacks.**
> >
> > `try/catch` gets you past "is this parseable". **Validating what's inside is a separate job, and it's the one that actually protects you.** We only check `!username || !password` today, which is nowhere near enough — schema validation is coming later in this series.

---

### The decoy hash — the line that looks like dead code

```js
const DUMMY_HASH = bcrypt.hashSync("a-password-nobody-will-ever-use", SALT_ROUNDS);
```

This line looks pointless — we hash a password nobody will ever type and never use the result to log anyone in. **It is one of the two most important lines in the file.**

It exists to make a *non-existent* user cost exactly as much CPU time as a real one.

```js
const user = usersDB[username];

if (!user) {
  await bcrypt.compare(password, DUMMY_HASH);   // burn the same ~244ms
  return sendJSON(res, 401, { error: "Invalid credentials" });
}
```

Without it, an unknown username returns in ~0ms while a real one takes ~244ms, and that gap tells an attacker **exactly which accounts exist on your platform.** They never need to guess a password to get value out of your login endpoint.

There's a full walkthrough with measured numbers in [the enumeration section below](#️-username-enumeration--the-leak-hiding-in-plain-sight) — including why 228ms is an enormous signal rather than a subtle one.

> [!NOTE]
> **Why `hashSync` here but `await bcrypt.compare` everywhere else?**
> `hashSync` **blocks the entire Node process** while it runs. That is unacceptable inside a request handler — one login would freeze every other user's request for 244ms. But this line runs **once, at startup**, before the server accepts any traffic. Blocking for a quarter second there costs nothing. Same reasoning for the seeded legacy account below.
> **Rule: `*Sync` at startup is fine. `*Sync` inside a request handler is a performance bug.**

---

### The seeded legacy account

```js
usersDB["legacy_user"] = { hash: bcrypt.hashSync("oldpassword123", 10) };
```

A fake account, deliberately hashed at the **old cost of 10** while the rest of the app uses 12.

It's there so you can watch a real production problem solve itself in front of you: **how do you strengthen your hashing years after launch, when you don't know anybody's password?**

You can't loop over the database and re-hash — hashing is one-way, you have nothing to re-hash *from*. The only moment the plaintext password exists anywhere in your system is **the instant a user types it to log in.** So you upgrade right then:

```js
if (bcrypt.getRounds(user.hash) < SALT_ROUNDS) {
  user.hash = await bcrypt.hash(password, SALT_ROUNDS);
}
```

Log in as `legacy_user` / `oldpassword123` and the server prints `[UPGRADE] legacy_user: cost 10 → 12`. Check `/debug-db` before and after — the stored string changes from `$2b$10$` to `$2b$12$`, and the user never noticed a thing.

That's the whole migration strategy, in three lines. Full explanation in [the upgrade section above](#-raising-your-work-factor-years-later-without-breaking-logins).

---

### Counting bytes instead of characters

```js
if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
  return sendJSON(res, 400, { error: `Password must be at most ${MAX_PASSWORD_BYTES} bytes` });
}
```

Two things to unpack: what `Buffer` is, and why we count **bytes** instead of using `.length`.

**`Buffer` is built into Node and globally available** — no `require` needed, like `console` or `process`. It represents **raw binary data**: the actual sequence of bytes, as the computer stores it.

You typed letters. The computer stores bytes. Those are not the same count:

| Character | `.length` says | Actual bytes |
|---|:---:|:---:|
| `a` `b` `1` `2` | 1 each | **1** each |
| `ñ` `ü` | 1 each | **2** each |
| `汉` | 1 | **3** |
| `😀` `🔥` | 2 each (!) | **4** each |

**Why this matters enormously here:** bcrypt ignores everything past the first **72 bytes**. Not characters — bytes. So:

```txt
A user picks a 50-emoji password.
password.length      →  100   ("looks fine, under 72? no — but close")
Buffer.byteLength()  →  200   (50 × 4 bytes)

bcrypt silently keeps the first 72 bytes and throws 128 bytes away.
The user can now log in by typing only the first ~18 emojis.
The rest of their password does nothing. They will never know.
```

Checking `password.length` would have let that straight through. `Buffer.byteLength()` catches it.

> [!IMPORTANT]
> **"But a normal user has no idea what a byte is!"** — completely right, and this is worth understanding properly.
>
> This server is a **backend API**. Its error messages are for the *frontend*, not the human. In a real product the frontend handles it in one of two ways:
>
> **1. Prevent it** (what most teams do): set `maxlength="72"` on the password input. Since 72 characters is the *worst* case only when every character is 4 bytes, ordinary passwords never come near the limit.
>
> **2. Translate it:** intercept the 400 and rewrite it in human language.
>
> ```js
> catch (error) {
>   if (error.response.data.error.includes("bytes")) {
>     showNotification("That password is too long. Try shortening it or using fewer special characters.");
>   }
> }
> ```
>
> **The general principle, and it's a big one: API errors are written for developers; UI errors are written for humans.** Never show a raw backend message directly to a user.

---

### The one word that changed on the handler

```js
const server = http.createServer(async (req, res) => {
```

Spot the `async`. Day 1's handler was a plain function.

It's `async` because hashing takes ~244ms and we must `await` it. Without `async` there's no `await`; without `await` you'd send the response before the hash finished.

---

### Hashing — the one line Day 2 exists for

```js
const hash = await bcrypt.hash(password, SALT_ROUNDS);
```

Internally it:

1. Generates **16 random bytes** of salt
2. Mixes salt + password
3. Runs **2¹² = 4,096 rounds** of the Blowfish key schedule
4. Returns the **60-character string** containing version + cost + salt + hash

You never create, store, or manage the salt yourself. It's inside the returned string.

---

### Verifying — the mirror image

```js
const ok = await bcrypt.compare(password, user.hash);
```

It's smarter than it looks. It does **not** "decrypt" anything — there's nothing to decrypt. It:

1. **Reads the cost** (`12`) out of the stored string
2. **Reads the 22-character salt** out of the stored string
3. Runs the identical math on the password just typed
4. Compares the two 31-character results **in constant time**
5. Returns `true` or `false` — never a password

> [!IMPORTANT]
> Step 4 is the one most people skip past. It is **not** doing `===`. Read on.

---

### The catch block — two kinds of failure, two kinds of answer

```js
} catch (err) {
  if (err.message === "Invalid JSON") {
    return sendJSON(res, 400, { error: "Invalid JSON" });
  }

  console.error("[ERROR] /login failed:", err);                   // developer sees everything
  return sendJSON(res, 500, { error: "Internal server error" });  // user sees nothing
}
```

**First: is `err` a JavaScript keyword?** No. `try` and `catch` are keywords — `err` is just a **variable name you picked**. When something throws, JavaScript creates an **Error object** and hands it to whatever name you put in the parentheses. You could write `catch (myBanana)` and it would work identically. The convention is `err` or `error`; that's all it is.

Every Error object carries a `.message` property — plain text describing what went wrong. Our `parseBody` rejects with `new Error("Invalid JSON")`, so `err.message === "Invalid JSON"` is just asking *"was this the failure I deliberately created, or something I didn't anticipate?"*

**Why two different status codes?** Because they mean genuinely different things, and the distinction is for the *client*, not decoration:

| | **400 Bad Request** | **500 Internal Server Error** |
|---|---|---|
| **Means** | "**You** sent something wrong." | "**We** broke. Not your fault." |
| **Cause here** | Malformed JSON in the request body | Database down, bcrypt failed, a bug in our code |
| **Can the caller fix it?** | Yes — fix the request and retry | No — retrying the same request changes nothing |

**Now the part you pushed back on, and you were right to:** *"we need to know the exact error instead of swallowing it."*

Correct — but the fix isn't to send the real error to the user. There are two different audiences, and they need opposite things:

**👤 What the user sees — generic, always.** Suppose the database is unreachable and the raw error is:

```txt
Error: connect ECONNREFUSED 127.0.0.1:5432
    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1148:16)
```

Ship that to the client and you've just told an attacker you run **PostgreSQL**, on the **default port**, on **localhost** — plus your file paths and framework internals. That's free reconnaissance. And a normal user can do nothing with it anyway.

**🛠️ What the developer sees — everything.** You log the full error, with stack trace, to your terminal or logging service.

```js
console.error("[ERROR] /login failed:", err);
```

> [!WARNING]
> **A bare `catch` with no logging is one of the worst habits in backend development.** Your server starts returning 500s, your users complain, and you have *nothing* — no message, no stack, no clue. The error happened and you threw away the only evidence.
>
> **Catch the error, log it fully, respond vaguely.** Never catch and stay silent.

> [!NOTE]
> In production you'd go one step further and attach a **request ID**: log `[req-a4f9c2] /login failed: <full error>` and respond `{"error": "Internal server error", "requestId": "a4f9c2"}`. Now the user can quote that ID in a support ticket and you can find the exact log line in seconds — without ever exposing what went wrong.

---

## ⏱️ Timing attacks — why `===` is dangerous for secrets

```js
if (storedValue === inputValue) { ... }   // 🚨 leaks information
```

JavaScript's `===` **short-circuits**. It stops at the first mismatched character:

```txt
"abc" === "xbc"   → mismatch at position 0 → stops after 1 comparison   (fast)
"abc" === "abx"   → mismatch at position 2 → stops after 3 comparisons  (slower)
```

The difference is microscopic — microseconds. But an attacker can send **millions** of requests and average the response times. Statistics erase the noise. Character by character, they reconstruct the secret.

This is a **timing attack**, and it has been used against real production systems.

`bcrypt.compare()` uses a **constant-time comparison**: it always checks every byte, no matter where the first mismatch is. The duration reveals nothing.

> [!NOTE]
> You get this for free from bcrypt. But when you compare any *other* secret yourself — an API key, a password-reset token, a webhook signature — reach for `crypto.timingSafeEqual()` instead of `===`. Same reasoning, and it's the kind of detail that separates a careful engineer from a lucky one.

---

## 🕵️ Username enumeration — the leak hiding in plain sight

Look at this innocent-looking code:

```js
const user = usersDB[username];
if (!user) {
  return sendJSON(res, 401, { error: "Invalid credentials" });   // 🚨
}
const ok = await bcrypt.compare(password, user.hash);
```

The *message* is identical in both cases — "Invalid credentials" — so nothing leaks, right?

**Wrong. The clock leaks.**

- **Unknown username** → returns immediately. No bcrypt. ~0ms.
- **Real username, wrong password** → runs bcrypt. ~244ms.

An attacker doesn't read your message. They read their stopwatch.

> 🧪 **PROVEN ON MY MACHINE**
>
> ```txt
> === NAIVE (early return on unknown user) ===
> unknown username :   0.01ms
> known username   : 228.69ms
> LEAK GAP         : 228.68ms   ← blindingly obvious to an attacker
> ```

A **228 millisecond** gap. That isn't a subtle statistical signal needing a million samples — you can see it with one request. Feed in a list of 10,000 email addresses and you learn exactly which ones have accounts. Now you have a confirmed target list for credential stuffing, phishing, or extortion ("we know you have an account at this clinic").

**The fix:** when the user doesn't exist, compare against a throwaway hash anyway, so both paths cost the same.

```js
const DUMMY_HASH = bcrypt.hashSync("a-password-nobody-will-ever-use", SALT_ROUNDS);

if (!user) {
  await bcrypt.compare(password, DUMMY_HASH);   // burn the same ~244ms
  return sendJSON(res, 401, { error: "Invalid credentials" });
}
```

> 🧪 **PROVEN ON MY MACHINE** — after the fix
>
> ```txt
> === FIXED (compare against decoy hash) ===
> unknown username : 222.25ms
> known username   : 218.09ms
> LEAK GAP         :   4.16ms   ← ordinary system noise. Indistinguishable.
> ```

> [!WARNING]
> **Enumeration leaks through other doors too**, and you have to close all of them:
> - **Registration:** "User already exists" tells an attacker the account is real. Real fix: accept the signup silently and send a "someone tried to register with your email" message to the inbox.
> - **Password reset:** always say *"If an account exists, we've sent a link"* — never "no such email".
> - **Error codes:** keep 401 for both wrong-user and wrong-password. Never 404 for one and 401 for the other.
>
> The code in this folder still leaks at registration. That's deliberate — proper email-verified signup is its own topic, and this is how far a username/password system can honestly get.

---

## 🪓 bcrypt silently ignores everything past 72 bytes

Almost nobody knows this one, and it is genuinely dangerous.

**bcrypt only looks at the first 72 bytes of a password.** Everything after is discarded without warning, without error.

> 🧪 **PROVEN ON MY MACHINE**
>
> ```txt
> password 1 : "AAAA...(72 A's)...THIS_PART_IS_IGNORED"        (92 chars)
> password 2 : "AAAA...(72 A's)...COMPLETELY_DIFFERENT_TAIL"   (97 chars)
>
> hash created from password 1
> does password 2 unlock it?          →  true   😱
> does just the bare 72 A's unlock it? →  true   😱
> ```

Three **different** passwords. One hash. All three open it.

Why does this matter in the real world? Because people use password managers that generate 100-character passwords, and because **a passphrase of ~12 average English words crosses 72 bytes**. And remember it's **bytes, not characters** — an emoji is 4 bytes, so a password can hit the limit far sooner than its length suggests.

**The fix — reject, don't truncate:**

```js
if (Buffer.byteLength(password, "utf8") > 72) {
  return sendJSON(res, 400, { error: "Password must be at most 72 bytes" });
}
```

`Buffer.byteLength()`, not `password.length`. `"😀".length` is 2, but it occupies 4 bytes.

> [!TIP]
> Some systems pre-hash with SHA-256 and feed the digest to bcrypt to dodge the limit. It works, but it has sharp edges of its own. **Argon2 has no such limit at all** — one more reason it's the modern recommendation.

---

## 🧪 Run it and watch it happen

```bash
cd code/day-02-password-hashing
npm install
node server.js
```

**1. Register, then look in the "database":**

```bash
curl -X POST localhost:3000/register -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"mypassword123"}'

curl localhost:3000/debug-db
```

You'll see the salt, cost and hash broken apart for you — and **no plaintext password anywhere.** That's the whole lesson in one response.

**2. Register a second user with the exact same password.** Compare the two stored strings. Completely different. That's salting.

**3. Log in correctly, then with a wrong password.** Note that wrong-password and wrong-username return the **identical message**.

**4. Watch a work-factor upgrade happen live:**

```bash
curl -X POST localhost:3000/login -H "Content-Type: application/json" \
  -d '{"username":"legacy_user","password":"oldpassword123"}'
```

The server log prints `[UPGRADE] legacy_user: cost 10 → 12`. Check `/debug-db` before and after — the stored string changes from `$2b$10$` to `$2b$12$`, and the user never knew.

**5. Feel the cost dial:**

```bash
node test-work-factors.js
```

**6. Be the attacker — bypass your own frontend.** Every one of these skips the browser entirely, and the server survives all of them. Day 1's server **died** on the first one:

```bash
curl -X POST localhost:3000/login -H "Content-Type: application/json" -d 'hello'

curl -X POST localhost:3000/login                     # no body at all

curl -X POST localhost:3000/register -H "Content-Type: application/json" \
  -d '{"username": "hacker", "password": '            # cut off mid-sentence
```

All three return `400 {"error":"Invalid JSON"}` and the process stays up. **That's the `try/catch` earning its place.**

**7. Now prove that valid JSON still isn't safe:**

```bash
curl -X POST localhost:3000/register -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"longenough123","username":"admin"}'

curl localhost:3000/debug-db
```

You asked for `alice`. Check the database — you created **`admin`**. Parsing succeeded; that was never the same thing as being safe.

---

## ✅ Day 2 recap

| Concept | What it actually means |
|---|---|
| **Never store passwords** | A breach is "when", not "if". Design for the attacker already being inside. |
| **Hashing** | One-way, deterministic. Destroys information **on purpose** — that's the security. |
| **Hashing ≠ encryption** | Encryption is reversible with a key. That was Adobe's fatal choice. |
| **Rainbow tables** | Pre-computed hash dictionaries. They defeat plain hashing instantly. |
| **Salt** | Random, per-user, **not secret**. Forces the attacker to rebuild their table per account. |
| **Why bcrypt, not SHA-256** | SHA-256 is fast — that's the attacker's advantage. bcrypt is slow by design. |
| **Work factor** | Exponential dial: +1 doubles, +2 quadruples. Target ~250–350ms on *your* hardware. |
| **The 60-char string** | version + cost + 22-char salt + 31-char hash. Carries its own verification instructions. |
| **Why GPUs fail** | Blowfish needs 4 KB of fast memory per guess. Thousands of GPU cores can't each have that. |
| **Upgrade-on-login** | Re-hash at the stronger cost during a successful login. Zero disruption. |
| **Timing attacks** | `===` short-circuits and leaks. `bcrypt.compare` is constant-time. |
| **Username enumeration** | Same message isn't enough — **the response time has to match too.** |
| **72-byte truncation** | bcrypt ignores the rest, silently. Reject long passwords instead. |
| **Frontend validation isn't security** | `curl` skips it entirely. Every rule has to exist on the server too. |
| **`try/catch` on `JSON.parse`** | One malformed body with no catch = the whole process exits. |
| **Valid ≠ safe** | Parsing checks grammar, never meaning. Schema validation is a separate job. |

---

## 🧠 Self-check (no peeking)

1. Your database leaks. Why is `03ac674216f3...` useless to the attacker, when the same string reliably logs you in every day?
2. The salt is stored in plaintext right next to the hash. Why doesn't that ruin everything?
3. Two users have the password `qwerty`. Why don't their rows look identical — and why did that exact property doom Adobe's users?
4. An attacker reads `$2b$14$...` and now knows your work factor. Explain why you don't care.
5. Both wrong-username and wrong-password return `401 Invalid credentials`. **Describe how an attacker still works out which emails have accounts.**
6. Why can't you just loop over your database and re-hash everyone at cost 14 tonight?
7. Your frontend already blocks empty passwords and short ones. Why does the server check again anyway?
8. A request body arrives as `{"username":"alice","username":"admin"}`. Does `JSON.parse` complain — and which user gets created?

If #5 came to you instantly, you're already thinking one level above most working developers.

---

## 🔮 Coming up — Day 03

The password problem is solved. **Day 1's problem is not.**

Log in successfully today and the server knows exactly who you are — for about 3 milliseconds. Then the response ends, and the next request arrives as a total stranger. We proved on Day 1 that HTTP remembers nothing.

Tomorrow: **Sessions** — the original answer. We build a complete session system from scratch in pure Node, no libraries: generating session IDs with real entropy (and why `Math.random()` is a genuine vulnerability), setting and reading cookies by hand, expiry, logout that actually logs out — and then we find exactly where sessions fall apart at scale.

---

## 🌱 This is open source — help make it better

I'm writing these notes while learning, in the open, because this is the explanation **I wish I'd found** when I started. Not "call `bcrypt.hash()` and move on", but *why every line exists and what breaks without it*.

We're all learning in an era where it's easy to get an answer and hard to get an understanding. These notes are my attempt at the second one — and they get better when other people push on them.

**So please — fork it, open an issue, send a PR:**

- 🐛 **Found a mistake?** Open an issue. I'd much rather be corrected in public than stay wrong in private.
- 🤔 **Something unclear?** That's a bug in the writing, not a gap in you. Tell me which paragraph lost you and I'll rewrite it.
- 💡 **Know a sharper analogy, a better diagram, or an attack I missed?** Send it. Especially if you've seen this stuff break in production.
- 🌍 **Want to translate a day into your language?** Go for it. More beginners reached is the entire point.
- ⭐ **Just learning along?** A star genuinely helps other beginners find it.

No contribution is too small. Fixing one confusing sentence helps the next person who reads it at 11pm wondering if they're the only one who doesn't get Promises.

> **You're not. I didn't either. That's why this repo exists.**

---

<div align="center">

**Yesterday you learned the server can't remember you.**
**Today you learned it shouldn't even know your password.**
**Two days in, and you're already designing for the breach. 🔥**

[⬅️ Day 01](day-01-what-is-authentication.md) · [⬆️ README](../../README.md) · [Day 03 ➡️ _(coming soon)_](#)

</div>
