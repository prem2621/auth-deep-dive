<div align="center">

# 🔐 Auth Deep Dive

### Learning authentication the way a Stripe or Google engineer understands it — not the way a tutorial teaches it.

[![Language](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Focus](https://img.shields.io/badge/Focus-Security%20First-critical?style=for-the-badge)](#)
[![Learn](https://img.shields.io/badge/Learn-In%20Public-blue?style=for-the-badge)](#)

**One concept a day. Built from scratch in Node.js. Nothing hidden behind a framework.**

</div>

---

## 🎯 Why this repo exists

Most developers "know authentication" like this:

```txt
hash password with bcrypt  →  sign a JWT  →  store it in localStorage  →  ship it
```

That works. It also happens to be **broken in ways you can't see until someone exploits it.**

This repo is the opposite approach. Every entry takes one concept all the way down:

- **What problem existed before this thing was invented?**
- **What exactly does it solve, mechanically?**
- **What new attack does it introduce?** (Every fix creates a new hole. Always.)
- **Code it from scratch in Node.js** — no framework magic hiding the moving parts.

> [!NOTE]
> These are real working notes, written while learning. Every entry has runnable code you can break, fix, and break again. If something here helps you — steal it. That's the point.

---

## 📅 What's covered so far

| Day | Topic | Notes | Code |
|:---:|-------|:-----:|:----:|
| 01 | What is authentication? Why HTTP statelessness breaks everything | [📖 Read](notes/phase-1-foundations/day-01-what-is-authentication.md) | [💻 Run](code/day-01-stateless-problem/) |

_More added as I go. Each entry lands here once it's actually finished — not before._

---

## 🗂 Repo structure

```txt
auth-deep-dive/
│
├── README.md                          ← you are here
│
├── notes/                             ← the deep-dive writeups (one per day)
│   └── phase-1-foundations/
│       └── day-01-what-is-authentication.md
│
└── code/                              ← runnable code (one folder per day)
    └── day-01-stateless-problem/
        ├── server.js
        ├── package.json
        └── README.md                  ← how to run + what to observe
```

**Naming rules (so the repo stays sortable forever):**

| Thing | Convention | Example |
|-------|-----------|---------|
| Note file | `day-NN-kebab-case-topic.md` | `day-07-refresh-token-rotation.md` |
| Code folder | `day-NN-kebab-case-topic/` | `day-07-refresh-token-rotation/` |
| Day number | **always zero-padded** (`01`, not `1`) | keeps alphabetical = chronological |

---

## 🚀 How to run any day's code

```bash
git clone https://github.com/prem2621/auth-deep-dive.git
cd auth-deep-dive/code/day-01-stateless-problem
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

</div>
