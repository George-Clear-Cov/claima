# Azure Migration Runbook — claima

Goal: move hosting + database + secrets off Vercel/Supabase onto **Azure**, so the whole PHI
stack sits under **one Microsoft BAA** (Product Terms), aligned with the AppSource GTM. AI (Claude)
stays on **AWS Bedrock** under the free AWS Artifact BAA. Net subprocessors: Microsoft, AWS,
Claim.MD, Stripe.

> Big simplifier: there is **no production PHI yet** (only seed data). So the DB "migration" is
> just `prisma db push` to a fresh Azure Postgres + reseed — no `pg_dump`/restore needed. Do the
> real data-copy path (bottom of this doc) only once a live practice exists.

Target: **Azure App Service for Containers** (Linux) + **Azure Database for PostgreSQL Flexible
Server** + **Azure Key Vault** + **Entra ID** (SSO, already built). Region: `westus2` (co-located
with the current Supabase us-west-2). App Service is definitively HIPAA-eligible; Azure Container
Apps is a fine alternative if you want scale-to-zero.

---

## Phase 0 — Prerequisites (George; can't be scripted)

1. **Microsoft for Startups Founders Hub** → apply as **Claima LLC** at foundershub.microsoft.com.
   Investor-backed path unlocks the larger Azure credit tier. This makes the infra ~free.
2. **Create an Azure subscription** under Claima LLC (comes with the credits).
3. **Confirm the Microsoft HIPAA BAA** applies to the subscription (it's included in the Microsoft
   Product Terms/DPA for eligible customers). Save a PDF of the Product Terms + DPA for your file.
4. Install the CLI locally: `az` (Azure CLI) + Docker. Then `az login`.

Set these once so the commands below are copy-paste:
```bash
export RG=claima-prod
export LOC=westus2
export ACR=claimaacr$RANDOM          # container registry (globally unique)
export APP=claima-web                # web app name -> https://claima-web.azurewebsites.net
export PLAN=claima-plan
export PG=claima-pg-$RANDOM          # postgres server name (globally unique)
export KV=claima-kv-$RANDOM          # key vault name (globally unique)
export PGADMIN=claimadbadmin
export PGPASS="$(openssl rand -base64 24)"   # save this
```

---

## Phase 1 — Provision (run after `az login`)

```bash
az group create -n $RG -l $LOC

# Container registry
az acr create -n $ACR -g $RG --sku Basic --admin-enabled true

# Postgres Flexible Server (HIPAA-eligible). Start small; scale later.
az postgres flexible-server create \
  -g $RG -n $PG -l $LOC \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 \
  --version 16 --admin-user $PGADMIN --admin-password "$PGPASS" \
  --public-access 0.0.0.0   # temp: allow Azure services; tighten to VNet/Private Link later
az postgres flexible-server db create -g $RG -s $PG -d claima

# Key Vault
az keyvault create -n $KV -g $RG -l $LOC --enable-rbac-authorization true

# App Service plan + web app (container)
az appservice plan create -g $RG -n $PLAN --is-linux --sku B1
az webapp create -g $RG -p $PLAN -n $APP \
  --deployment-container-image-name mcr.microsoft.com/appsvc/staticsite:latest  # placeholder
az webapp identity assign -g $RG -n $APP    # managed identity for Key Vault access
```

**Postgres connection string** (runtime uses `POSTGRES_PRISMA_URL`):
```
postgresql://$PGADMIN:$PGPASS@$PG.postgres.database.azure.com:5432/claima?sslmode=require
```

---

## Phase 2 — Code changes (I own these; tracked in the repo)

- [ ] `next.config.ts`: add `output: "standalone"` (safe on Vercel too).
- [ ] `Dockerfile` + `.dockerignore`: multi-stage build → `prisma generate` → `next build` →
      run the standalone server on `$PORT` (App Service injects `PORT`).
- [ ] `src/lib/prisma.ts`: switch the pool to **verify** Azure's cert —
      `ssl: { ca: <DigiCertGlobalRootCA/G2>, rejectUnauthorized: true }` — removing the last
      TLS exception (closes the temporary Supabase carve-out from the HIPAA hardening batch).
      Ship the CA as `certs/azure-postgres-ca.pem`.
- [ ] **Cron**: Vercel Cron → an Azure **Logic App** (daily Recurrence) or a scheduled GitHub
      Action that does `curl -H "Authorization: Bearer $CRON_SECRET" https://claima.io/api/cron/daily`.
- [ ] **Secrets → Key Vault**: app reads secrets via managed identity / Key Vault references in
      App Service settings (`@Microsoft.KeyVault(...)`), not raw env where avoidable.

I'll implement these as the next work item and run a local `docker build` to verify.

---

## Phase 3 — Secrets into Key Vault

```bash
# (grant yourself + the app's managed identity 'Key Vault Secrets User/Officer' RBAC first)
az keyvault secret set --vault-name $KV -n POSTGRES-PRISMA-URL --value "postgresql://...require"
az keyvault secret set --vault-name $KV -n JWT-SECRET --value "$(openssl rand -base64 32)"  # NEW (rotate)
az keyvault secret set --vault-name $KV -n STRIPE-SECRET-KEY --value "<rotated sk_live_...>"
az keyvault secret set --vault-name $KV -n STRIPE-WEBHOOK-SECRET --value "<whsec_...>"
az keyvault secret set --vault-name $KV -n CLAIMMD-ACCOUNT-KEY --value "<rotated>"
az keyvault secret set --vault-name $KV -n RESEND-API-KEY --value "<key>"
az keyvault secret set --vault-name $KV -n CRON-SECRET --value "$(openssl rand -hex 32)"
# AI on Bedrock:
az keyvault secret set --vault-name $KV -n AWS-ACCESS-KEY-ID --value "<bedrock IAM key>"
az keyvault secret set --vault-name $KV -n AWS-SECRET-ACCESS-KEY --value "<bedrock IAM secret>"
```
App settings (note `AI_PROVIDER=bedrock`, no `ANTHROPIC_BAA_ACCEPTED`):
```bash
az webapp config appsettings set -g $RG -n $APP --settings \
  AI_PROVIDER=bedrock AWS_BEDROCK_REGION=us-east-1 \
  AWS_BEDROCK_MODEL_ID='us.anthropic.claude-sonnet-4-6-20260909-v1:0' \
  NEXT_PUBLIC_APP_URL=https://claima.io NODE_ENV=production \
  POSTGRES_PRISMA_URL='@Microsoft.KeyVault(SecretUri=https://'$KV'.vault.azure.net/secrets/POSTGRES-PRISMA-URL/)' \
  # ...repeat KeyVault reference for each secret above
```

---

## Phase 4 — Build, push, deploy

```bash
az acr build -r $ACR -t claima-web:latest .          # builds the Dockerfile in ACR
az webapp config container set -g $RG -n $APP \
  --docker-custom-image-name $ACR.azurecr.io/claima-web:latest \
  --docker-registry-server-url https://$ACR.azurecr.io
# Schema (no prod data yet): point Prisma at Azure PG and push
DATABASE_URL="postgresql://$PGADMIN:$PGPASS@$PG.postgres.database.azure.com:5432/claima?sslmode=require" \
  ~/.bun/bin/bun run prisma db push
az webapp restart -g $RG -n $APP
```

## Phase 5 — Domain, TLS, cutover

- [ ] `az webapp config hostname add` for `claima.io` (+ App Service Managed Certificate for TLS).
- [ ] Update Stripe webhook + Azure/AWS marketplace redirect URLs if the host changes during test
      (use the `*.azurewebsites.net` URL to smoke-test before DNS).
- [ ] Point `claima.io` DNS (Namecheap) at App Service; verify.
- [ ] Deauthorize Vercel deploy; keep Supabase read-only for 2 weeks as rollback, then delete.

## Phase 6 — Verify

- [ ] Login (email + Entra SSO), create/list patient (DB write/read), submit a test claim,
      run an AI feature (confirms Bedrock path), trigger `/api/cron/daily` manually with the secret.
- [ ] Confirm `NODE_TLS_REJECT_UNAUTHORIZED` is gone and DB TLS is **verified** (Azure CA).
- [ ] Re-run `bun scripts/audit.ts` (0 CRITICAL/HIGH) + `tsc`.

## Rollback
DNS back to Vercel; Vercel build + Supabase are untouched until Phase 5 teardown.

---

## Real data migration (LATER — only once a live practice exists)
```bash
pg_dump "postgresql://postgres:<pw>@db.cocfvcqmwnvuxqzmngpy.supabase.co:5432/postgres?sslmode=require" \
  --no-owner --no-privileges -Fc -f claima.dump
pg_restore --no-owner --no-privileges -d \
  "postgresql://$PGADMIN:$PGPASS@$PG.postgres.database.azure.com:5432/claima?sslmode=require" claima.dump
```
Do this in a maintenance window; freeze writes; verify row counts per table before cutover.
