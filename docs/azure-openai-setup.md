# Azure OpenAI setup — flip on the day Startups credits activate

Goal: put claima's **fast AI tier** on Azure OpenAI. Starts the Azure consumption meter
(Startups milestones + IP co-sell ACR), passes marketplace technical validation, defuses
the "all LLM spend to Anthropic" flag, and puts PHI-carrying fast-tier calls under
**Azure's HIPAA BAA** (better than Anthropic-direct standard tier). Claude/Sonnet keeps
the quality-critical smart tier (scrub, coding, appeals, assistant).

## 1. Azure portal (once, ~15 min — use the NEW Startups subscription)
1. Create resource → **Azure OpenAI** → region `eastus2` (or closest with model availability)
   → name e.g. `claima-openai` → Standard S0.
2. Open the resource in **Azure AI Foundry** → **Deployments → Create**:
   - Deployment name **`fast`** → model **gpt-4o-mini** (cheap, fast-tier workhorse)
   - (optional) Deployment name **`smart`** → **gpt-4o** — only as fallback; Sonnet stays primary
3. Resource → **Keys and Endpoint** → copy Endpoint + Key 1.

## 2. Env vars (local `.env.local` + Vercel all envs)
```
AZURE_OPENAI_ENDPOINT=https://claima-openai.openai.azure.com
AZURE_OPENAI_KEY=<key1>
AZURE_OPENAI_DEPLOYMENT_FAST=fast
AZURE_OPENAI_DEPLOYMENT=fast        # until/unless a smart deployment exists
AI_PROVIDER_FAST=azure              # routes ONLY tier:"fast" calls to Azure
```
Do NOT set `AI_PROVIDER=azure` (that would move everything). `AI_PROVIDER_FAST` is the
tier-scoped switch added to `src/lib/ai.ts` (getProvider). Fast-tier call sites today:
eligibility interpret, parse-natural, ERA parse, denial ROI, rate estimate, briefing,
patient outreach (~7 routes).

## 3. Verify
- `[ai-cost]` log lines for fast-tier labels should show the azure/gpt path.
- Azure portal → resource → Metrics → calls arriving.
- Smart-tier features (scrub/appeals/assistant) still hit Anthropic — spot-check quality unchanged.

## 4. The 10-workload map (Startups milestones M3→M5 + co-sell meter)
Adopt in roughly this order — every one is real product/infra value, no fake usage:
1. **Azure OpenAI** (this doc)
2. **Blob Storage** — raw 837/835 EDI archive (HIPAA retention we should do anyway)
3. **Key Vault** — Claim.MD key, marketplace secrets
4. **Azure Functions** — move a cron worker (daily agent step or monthly metering)
5. **Application Insights** — monitoring alongside Sentry
6. **Azure AI Document Intelligence** — parse scanned EOBs/superbills/faxes (real feature: paper-remit intake)
7. **Azure Communication Services** — SMS patient reminders (backlog feature) / email
8. **Azure Database for PostgreSQL** — data-moat warehouse/analytics replica (later: primary DB option)
9. **App Service / Container Apps** — staging environment, later prod hosting option
10. **Azure Front Door** — if/when hosting moves

Milestones: 5 workloads ~60d → **$25K** (+2-yr extension) · 7 → **$50K** ·
10 + **~$3K/mo sustained** → **$150K**. $3K/mo arrives organically at ~30–40 practices of
AI load or after a hosting/DB migration at scale — do NOT manufacture idle spend; MS
checks sustained patterns and gaming it poisons the co-sell relationship.
