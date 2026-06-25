# Claima — AI-Native Medical Billing (claima.io)

## Product
AI-native medical billing platform. Sells outcomes (% of collections), not software seats. Targets small/mid outpatient practices across all specialties (Family Medicine, Cardiology, Physical Therapy, Psychiatry, etc.) currently outsourcing to RCM firms. HIPAA compliance required on every PR.

Deployed at: **https://claima.io** (Vercel)
Local dev: `cd /Users/georgenagib/claima && ~/.bun/bin/bun run dev`
Deploy: `npx vercel --prod --yes`

---

## Stack
- **Next.js 15** App Router, TypeScript, Tailwind CSS
- **Prisma 7** with `@prisma/adapter-pg` + explicit `pg.Pool`
- **PostgreSQL** on Supabase (project ref: `cocfvcqmwnvuxqzmngpy`, region: us-west-2)
- **Bun** as package manager (`~/.bun/bin/bun`)
- **Stripe Connect** for payments (5% platform fee)
- **Claim.MD** clearinghouse for 837P EDI + 270/271 eligibility (`src/lib/claimmd.ts`)
- **Anthropic API** (claude-sonnet-4-6) for AI features

---

## Non-Negotiable Coding Rules

### Prisma — always use dynamic import
```typescript
// CORRECT — every API route
const { prisma } = await import("@/lib/prisma")

// NEVER do this
import { prisma } from "@/lib/prisma"  // breaks serverless
new PrismaClient()                      // missing adapter
```

### practiceId — always from session, never from request body
```typescript
// CORRECT
const session = await getSessionFromRequest(req)
const practiceId = session.practiceId

// NEVER accept practiceId in request body — privilege escalation risk
```

### All DB queries must be scoped to practiceId
```typescript
// CORRECT
prisma.claim.findMany({ where: { practiceId: session.practiceId } })

// WRONG — leaks data across practices
prisma.claim.findMany()
```

### Auth on every API route
```typescript
const session = await getSessionFromRequest(req)
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
```

### TLS — do not remove this from prisma.ts
`process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` is required. Supabase uses a self-signed CA chain that Prisma's Rust engine rejects. The pg adapter's `ssl` option alone doesn't fix it.

---

## Current State — What Works vs. Mock Mode

| Feature | Status | Needs |
|---|---|---|
| Auth (email/password) | ✅ Live | — |
| Azure AD SSO | ✅ Live | — |
| Claim submission | ⚠️ Mock | `CLAIMMD_ACCOUNT_KEY` + `CLAIMMD_API_KEY` |
| Eligibility verification | ⚠️ Mock | `CLAIMMD_ACCOUNT_KEY` + `CLAIMMD_API_KEY` |
| Stripe payments | ✅ Live | — |
| Stripe Connect onboarding | ✅ Live | — |
| Stripe webhooks | ✅ Live | — |
| AI features (appeals, briefing, assistant) | ✅ Live | — |
| Patient statements | ✅ Live | — |
| Denial management | ✅ Live | — |

---

## Workflows Built
1. ✅ Claim submission — 837P EDI via Claim.MD, AI scrub, denial risk scoring
2. ✅ Denial management — CARC triage, AI appeal letters (claude-sonnet-4-6), appeal tracking
3. ✅ Eligibility verification — 270/271 via Claim.MD, AI interpretation
4. ✅ Patient billing & statements — balance tracking, Stripe PaymentIntents, Connect

---

## GTM Priority
**Microsoft AppSource listing is the immediate GTM focus.** No customers yet — acquiring through cloud marketplaces. AppSource → AWS Marketplace → Google Cloud Marketplace (in that order).

Azure AD SSO is already built. Needs: Azure app registration, listing copy, screenshots.

---

## Obsidian Knowledge Base
Full project docs live at: `/Users/georgenagib/.claude/projects/-Users-georgenagib/memory/`

**Proactively read these files when relevant — don't wait to be asked:**

| When you're about to... | Read this first |
|---|---|
| Add or modify an API route | `memory/api_reference.md` |
| Touch `prisma/schema.prisma` | `memory/db_schema.md` |
| Work on claim/denial/billing logic | `memory/billing_cheatsheet.md`, `memory/carc_reference.md` |
| Add a new env var or check key status | `memory/env_vars.md` |
| Start a new feature | `memory/backlog.md`, `memory/roadmap.md` |
| Make an architectural decision | `memory/decision_log.md` |
| Work on AppSource / GTM | `memory/gtm_appsource.md` |
| End of any session with code changes | Update `memory/session_log.md` + `memory/roadmap.md` + any affected notes |

---

## Seeded Data
- **Practice:** Riverside Medical Group (multi-specialty: Family Medicine + Physical Therapy)
- **Providers:** Dr. Emily Chen (Family Med), Dr. Marcus Rivera (Physical Therapy)
- **Patients:** Sarah Johnson, James Rivera, Amanda Torres, David Kim, Lisa Park
- **Login:** admin@riversidemedgroup.com / claima2026
- **CPTs:** 99213/99214/99215/99395/99203 (E&M), 97110/97140/97530 (PT)
- **ICD-10:** I10 (hypertension), E11.9 (diabetes), M54.50 (low back pain), M25.511 (shoulder), Z00.00 (wellness)

---

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
