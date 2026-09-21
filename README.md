<div align="center">

# 🔐 Auth Deep Dive

### Learning authentication the way a Stripe or Google engineer understands it — not the way a tutorial teaches it.

[![Language](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Progress](https://img.shields.io/badge/Progress-Day%201%20of%20~90-blue?style=for-the-badge)](#-progress-tracker)
[![Focus](https://img.shields.io/badge/Focus-Security%20First-critical?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/License-MIT-lightgrey?style=for-the-badge)](LICENSE)

**1 hour a day. ~3 months. Every concept built from scratch in Node.js.**

</div>

---

## 🎯 Why this repo exists

Most developers "know authentication" like this:

```txt
hash password with bcrypt  →  sign a JWT  →  store it in localStorage  →  ship it
```

That works. It also happens to be **broken in ways you can't see until someone exploits it.**

This repo is the opposite approach. Every day, one concept, taken all the way down:

- **What problem existed before this thing was invented?**
- **What exactly does it solve, mechanically?**
- **What new attack does it introduce?** (Every fix creates a new hole. Always.)
- **Code it from scratch in Node.js** — no framework magic hiding the moving parts.

> [!NOTE]
> These are real working notes, written while learning. Every file has runnable code you can break, fix, and break again. If something here helps you — steal it. That's the point.

---

## 🧭 The Roadmap

| Phase | What you learn | Est. | Status |
|:-----:|----------------|:----:|:------:|
| **1** | Auth fundamentals — HTTP, statelessness, cookies, hashing | ~2 wks | 🟡 In progress |
| **2** | JWT deep dive — structure, signing, attacks, storage | ~1.5 wks | ⚪ Not started |
| **3** | Sessions — server-side sessions, Redis, distributed sessions | ~1 wk | ⚪ Not started |
| **4** | Access + Refresh tokens, rotation, httpOnly cookies | ~1.5 wks | ⚪ Not started |
| **5** | CSRF — the attack that cookies introduce | ~1 wk | ⚪ Not started |
| **6** | OAuth 2.0 + OpenID Connect + PKCE | ~2 wks | ⚪ Not started |
| **7** | RBAC + ABAC — permission systems at scale | ~1.5 wks | ⚪ Not started |
| **8** | Attack vectors — XSS, timing attacks, session fixation | ~1 wk | ⚪ Not started |
| **9** | Production patterns — logging, rate limiting, key scoping | ~1 wk | ⚪ Not started |

---

## 📅 Progress Tracker

| Day | Topic | Notes | Code |
|:---:|-------|:-----:|:----:|
| 01 | What is authentication? Why HTTP statelessness breaks everything | [📖 Read](notes/phase-1-foundations/day-01-what-is-authentication.md) | [💻 Run](code/day-01-stateless-problem/) |
| 02 | _Password storage & hashing — coming next_ | — | — |

---

## 🗂 Repo structure

```txt
auth-deep-dive/
│
├── README.md                          ← you are here
├── ROADMAP.md                         ← the full 9-phase plan, in detail
│
├── notes/                             ← the deep-dive writeups (one per day)
│   └── phase-1-foundations/
│       └── day-01-what-is-authentication.md
│
├── code/                              ← runnable code (one folder per day)
│   └── day-01-stateless-problem/
│       ├── server.js
│       ├── package.json
│       ├── requests.http              ← click-to-run requests (VS Code REST Client)
│       └── README.md                  ← how to run + what to observe
│
├── assets/
│   └── diagrams/                      ← images used in the notes
│
└── linkedin/                          ← short-form versions of each day's note
    └── day-01-post.md
```

**Naming rules I follow (so the repo stays sortable forever):**

| Thing | Convention | Example |
|-------|-----------|---------|
| Note file | `day-NN-kebab-case-topic.md` | `day-07-refresh-token-rotation.md` |
| Code folder | `day-NN-kebab-case-topic/` | `day-07-refresh-token-rotation/` |
| Day number | **always zero-padded** (`01`, not `1`) | keeps alphabetical = chronological |
| Commit message | `day-NN: <what you learned>` | `day-01: HTTP statelessness + the naked problem` |
| Branch | just `main` | it's a learning log, not a product |

---

## 🚀 How to run any day's code

```bash
git clone https://github.com/<your-username>/auth-deep-dive.git
cd auth-deep-dive/code/day-01-stateless-problem
npm install     # (Day 1 has zero dependencies — this is a no-op)
node server.js
```

Each code folder has its own `README.md` telling you exactly what to try and what you should see break.

---

## 🧪 The rule I hold myself to

> You don't understand a security concept until you can name the attack it prevents,
> **and** the new attack it creates.

If a note in this repo doesn't answer both, it isn't finished yet.

---

## 🤝 Found an error? Disagree with something?

Open an issue. Being corrected in public is faster than being wrong in private.

---

<div align="center">

**⭐ Star this if you're learning auth properly too.**

_Updated daily-ish. One hour at a time._

</div>
