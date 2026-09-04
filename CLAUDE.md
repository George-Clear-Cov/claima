# Claima — AI-Native Medical Billing (claima.io)

## Product
AI-native medical billing platform. Sells outcomes (% of collections), not software seats. Targets small/mid outpatient practices across all specialties (Family Medicine, Cardiology, Physical Therapy, Psychiatry, etc.) currently outsourcing to RCM firms. HIPAA compliance required on every PR.

Deployed at: **https://claima.io** — **Azure App Service** (`claima-web-d89893`, RG `claima-prod`,
West US 3), serving a container from ACR `claimaacrd89893`. **Vercel and Supabase are no longer
in the serving path** (cutover 2026-09-02).

Local dev: `cd /Users/georgenagib/claima && ~/.bun/bin/bun run dev`

**Deploy** (manual — ACR publishing is not automated; `.github/workflows/container-build.yml`
only proves the image builds):
```bash
TAG=$(git rev-parse --short HEAD)
az acr build --registry claimaacrd89893 --image claima-web:$TAG \
  --build-arg NEXT_PUBLIC_APP_URL=https://claima.io \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<pk_live> \
  --build-arg NEXT_PUBLIC_SENTRY_DSN=<dsn> .
az webapp config container set -g claima-prod -n claima-web-d89893 \
  --docker-custom-image-name claimaacrd89893.azurecr.io/claima-web:$TAG
az webapp restart -g claima-prod -n claima-web-d89893
```
⚠️ `az webapp restart` alone does **not** pull a new image — App Service serves the cached one.
The app is pinned to an explicit tag, so every deploy must set the new tag.

---

## Stack
- **Next.js 15** App Router, TypeScript, Tailwind CSS
- **Prisma 7** with `@prisma/adapter-pg` + explicit `pg.Pool`
- **PostgreSQL** — production is **Azure Database for PostgreSQL Flexible Server**
  (`claima-pgb-d89893`, database `claima`). Connection string lives in Key Vault
  `claima-kv-d89893` as `POSTGRES-PRISMA-URL`; App Service reads it as a Key Vault reference.
  **Local dev still points at the retired Supabase project** (`cocfvcqmwnvuxqzmngpy`) on
  purpose — test there, never against prod. Schema goes to Azure only when work is ready:
  `export DATABASE_URL=$(az keyvault secret show --vault-name claima-kv-d89893 --name POSTGRES-PRISMA-URL --query value -o tsv) && npx prisma db push`
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

### Runtime feature flags — read on the server, never as NEXT_PUBLIC_
`NEXT_PUBLIC_*` values are baked into the Docker image at build time, so flipping one needs a
rebuild and redeploy. Read flags server-side from `src/lib/flags.ts`, pass them down as props,
and mark the page `export const dynamic = "force-dynamic"` so the value is read per request.
A flag can then be flipped with `az webapp config appsettings set` + a restart.

### TLS — never set NODE_TLS_REJECT_UNAUTHORIZED globally
Do NOT set `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` in `prisma.ts` (or anywhere). It is a
process-global flag that disables TLS certificate verification for ALL outbound HTTPS — including
PHI sent to the AI provider, Claim.MD, and Stripe — exposing it to man-in-the-middle. Scope the
Supabase self-signed-CA exception to the DB connection only, via the pg `Pool`'s `ssl` option
(`ssl: { rejectUnauthorized: false }`). During the Azure migration, replace this with
`ssl: { ca: <azure-ca>, rejectUnauthorized: true }` so the DB cert is verified too. `scripts/audit.ts`
enforces the absence of the global flag (CRITICAL).

---

## Current State — What Works vs. Mock Mode

| Feature | Status | Needs |
|---|---|---|
| Auth (email/password) | ✅ Live | — |
| Azure AD SSO | ✅ Live | — |
| Claim submission | ✅ Live | Claim.MD production key installed 2026-09-01 |
| Eligibility verification | ✅ Live | Claim.MD production key installed 2026-09-01 |
| Free A/R Leak Report (`/leak-report`) | ✅ Public | Parses in-browser; sends nothing |
| Self-serve activation (`/engagement`) | 🔒 Flagged off | `ACTIVATION_ENABLED` — needs counsel review |
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
**The free A/R Leak Report at `/leak-report` is the conversion asset every channel points at.**
It parses a practice's own A/R export entirely in the browser and returns a dollar figure. Keep
that path pure — no fetch, no analytics, no server action — or the page's privacy promise, and
its exemption from PHI scope, both break.

Self-serve activation (account + BAA + Recovery Services Agreement + verified email, then
ingest) is built but **flagged off** pending counsel review of `/engagement`. The PHI-ingress
gate in `/api/import/backlog` is enforced regardless of the flag.

Marketplace listings remain a parallel track: AppSource → AWS Marketplace → GCP.

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
