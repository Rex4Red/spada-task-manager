# spada-task-manager — Project Memory

> Auto-synced | 101 observations

**Stack:** JavaScript/TypeScript · Express + React + Tailwind · DB: Prisma

## 🏛️ CORE ARCHITECTURE

> **CRITICAL:** The following rules represent strict architectural boundaries defined by the user. NEVER violate them in your generated code or explanations.

# Intellectual Property & Architecture Rules
Write your strict architectural boundaries here. 
BrainSync will automatically enforce these rules across all agents (Cursor, Windsurf, Cline) 
and inject them into the memory context.

Example:
- NEVER use TailwindCSS. Only use vanilla CSS.
- NEVER write class components. Only use functional React components.

## 🛡️ GLOBAL SAFETY RULES

- **NEVER** run `git clean -fd` or `git reset --hard` without checking `git log` and verifying commits exist.
- **NEVER** delete untracked files or folders blindly. Always backup or stash before bulk edits.

## 🧭 ACTIVE CONTEXT

> Always read `.cursor/active-context.md` for exact instructions on the specific file you are currently editing. It updates dynamically.

## 🔴 STOP — READ THESE FIRST

- **Don't mix Tailwind with inline styles** — Don't mix Tailwind with inline styles
- **Don't store secrets in Docker images — use runtime injection** — Don't store secrets in Docker images — use runtime injection
- **Pin base image versions — not :latest** — Pin base image versions — not :latest
- **Don't run as root in containers — use USER directive** — Don't run as root in containers — use USER directive
- **Use prisma migrate deploy in production, not prisma db push** — Use prisma migrate deploy in production, not prisma db push

## 📐 Conventions

- Extract repeated class patterns into components
- Use responsive prefixes consistently (sm:, md:, lg:, xl:)
- Don't use arbitrary values when a utility class exists
- Use .dockerignore to exclude unnecessary files
- Use multi-stage builds to reduce image size
- Use select/include to limit data fetched — avoid over-fetching
- Use transactions for related database operations
- Rate limit API endpoints to prevent abuse

## ⚡ Available Tools (ON-DEMAND only)
- `save(title, content, category)` — Save a note + auto-detect conflicts
- `batch_save(items[])` — Save multiple notes in 1 call
- `query(text)` — Search memory for architecture, past fixes, decisions
- `search(text)` — Full-text search for details
- `check_errors()` — Check compiler errors after edits

> ℹ️ DO NOT call get_context() or get_gotchas() at startup — context above IS your context.

---
*Auto-synced | 2026-04-01*
