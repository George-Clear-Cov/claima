# DNS cutover — claima.io: Vercel → Azure App Service

> ✅ **COMPLETED 2026-09-02.** Both hosts serve from Azure over TLS; Vercel is bypassed.
> Executed via the Namecheap API, not the UI. See "Execution log" at the end.

Move production traffic for **claima.io** from Vercel to the Azure App Service
`claima-web-d89893` (`claima-web-d89893.azurewebsites.net`). Registrar/DNS host is
**Namecheap** (BasicDNS: `dns1/dns2.registrar-servers.com`).

> Status: **PLAN ONLY.** Do not execute until the prerequisites below are green.
> The registrar changes must be made by George (I don't have Namecheap access).

---

## Current DNS (rollback target)

| Host | Type | Value (Vercel — today) |
|------|------|------------------------|
| `claima.io` (apex `@`) | A | `76.76.21.21` |
| `www.claima.io` | CNAME | `cname.vercel-dns.com` |

Keep these written down — they are the **rollback** values.

---

## Azure facts (re-verified 2026-09-01)

- App default host: `claima-web-d89893.azurewebsites.net`
- Custom-domain verification ID (asuid): `46BFB581E7DE2869B8E99996E7ABA4EA725C7D4D82A42F0A6036EB55CDF53D5A`
- Inbound IP: still null (no custom hostname bound yet). The default host resolves to
  `20.118.138.147`, but that is **not** a stable apex target.
  → Point the apex at the **hostname** via Namecheap ALIAS, not a raw IP.
- App Service Plan: `claima-plan` **B1 / Basic** — custom domains + free managed certs OK.
- All 27 app settings present; 16 are Key Vault references and they **resolve at runtime**
  (proved by the webhook returning 400, not 503).
- Bound hostnames: only the default `*.azurewebsites.net` (no custom domain yet).

---

## ⛔ Prerequisites — status as of 2026-09-01

1. ~~AI / Bedrock config MISSING~~ — **superseded.** Config is present and correct
   (`AI_PROVIDER=bedrock`, `AWS_BEDROCK_REGION=us-east-1`, `BEDROCK_API_KEY` in KV).
   ❌ **But AI is still dark, for a different reason:** every Bedrock call 404s with
   *"Model use case details have not been submitted for this account. Fill out the
   Anthropic use case details form before using the model."*
   Verified by calling `bedrock-runtime.us-east-1.amazonaws.com` directly with the
   stored key — **both** `us.anthropic.claude-sonnet-4-6` and the haiku profile fail
   identically, so it is an **account entitlement gap, not a model-ID or key problem.**
   → Fix in AWS Console → Bedrock → Model access → submit the Anthropic use-case form.
   → Symptom in-app: `/api/briefing` returns 200 with `"narrative": null` (fail-closed).
   → **Not a cutover blocker:** AI is equally dark on Vercel today, so flipping DNS
     does not regress it. It IS a client-readiness blocker for "AI-native RCM".
2. ~~Claim.MD key decision~~ — ✅ **PRODUCTION key installed** (account `31008`);
   `CLAIMMD_ACCOUNT_ID=31008` agrees with the deployed key's prefix.
   ⚠️ Rotate it: the value was accidentally echoed into a session transcript 2026-09-01.
3. **Stripe live webhooks** — ⏳ **still open, user action.** Confirm the endpoint in the
   Stripe dashboard reads `https://claima.io/api/webhooks/stripe`. Azure's
   `STRIPE_V1_WEBHOOK_SECRET` resolves and the handler is now **fail-closed** (see #6).
4. ~~Azure AD SSO redirect URIs~~ — ✅ already includes `https://claima.io/api/auth/azure/callback`.
5. **Smoke on the azurewebsites.net host** — ✅ login, `/api/context`, `/api/claims`,
   `/api/providers`, `/api/denials`, `/api/statements` all 200; NPI guard rejects a bad
   check digit with 400. ❌ AI call fails per #1.
6. ✅ `NEXT_PUBLIC_APP_URL` is baked as `https://claima.io` in the image. The *server-side*
   app setting still reads `https://claima-web-d89893.azurewebsites.net` —
   **change it to `https://claima.io` at cutover** (app-setting edit only, no rebuild).
7. ✅ **Stripe webhook signature bypass fixed** (`62419d4`) and live on Azure — an unsigned
   POST now returns `400 Missing signature`. ⚠️ Vercel still returns `200 {"received":true}`;
   the cutover is what closes that hole in production.

## TLS strategy (avoid an HTTPS gap)

App Service **Managed Certificates** are free but can only be *issued* once the
hostname already resolves to the app — so if you flip DNS first, there's a short
window where claima.io hits Azure with no cert (browser TLS errors). Two ways to
avoid that:

- **Recommended — prove `www` first, then apex.** Cut `www` over, issue+bind its
  managed cert (validates because `www` now points to Azure), verify
  `https://www.claima.io` on Azure, then repeat for the apex. Smaller blast radius.
- **Zero-gap — pre-stage a cert.** Upload a cert for `claima.io`/`www` (e.g. a
  purchased or externally-issued cert) and bind it BEFORE the DNS flip, so HTTPS is
  ready the instant traffic moves. Do this if a maintenance window isn't acceptable.

Either way, do the cutover in a low-traffic window and watch Sentry.

---

## Steps

### 1. Add verification TXT records (no traffic impact — safe anytime)
At Namecheap → Advanced DNS, add:

| Host | Type | Value |
|------|------|-------|
| `asuid` | TXT | `46BFB581E7DE2869B8E99996E7ABA4EA725C7D4D82A42F0A6036EB55CDF53D5A` |
| `asuid.www` | TXT | `46BFB581E7DE2869B8E99996E7ABA4EA725C7D4D82A42F0A6036EB55CDF53D5A` |

### 2. Bind the custom hostnames (works while DNS still points to Vercel — asuid TXT proves ownership)
```bash
export PATH="/opt/homebrew/bin:$PATH"
RG=claima-prod; APP=claima-web-d89893
az webapp config hostname add -g $RG --webapp-name $APP --hostname www.claima.io
az webapp config hostname add -g $RG --webapp-name $APP --hostname claima.io
```

### 3. Cut `www` over
At Namecheap, change `www` CNAME `cname.vercel-dns.com` → `claima-web-d89893.azurewebsites.net`.
Wait for propagation (`dig +short www.claima.io`), then issue + bind its cert:
```bash
az webapp config ssl create -g $RG --name $APP --hostname www.claima.io   # managed cert
# (older CLI: create returns a thumbprint, then `az webapp config ssl bind --ssl-type SNI ...`)
```
Verify: `curl -I https://www.claima.io` → 200 from Azure.

### 4. Cut the apex over
At Namecheap, replace the apex `@` **A `76.76.21.21`** with an **ALIAS record
`@` → `claima-web-d89893.azurewebsites.net`** (Namecheap BasicDNS supports ALIAS
for apex; if unavailable, use an A record to the app's inbound IP, which becomes
available after step 2 via `az webapp show -g $RG -n $APP --query inboundIpAddress`).
Then issue + bind the apex cert:
```bash
az webapp config ssl create -g $RG --name $APP --hostname claima.io
```
Verify: `curl -I https://claima.io` → 200 from Azure.

### 5. Post-cutover verification
- [ ] `https://claima.io` and `https://www.claima.io` both load over TLS (valid cert)
- [ ] Login works; a claim list loads (DB over verified TLS)
- [ ] An AI action (appeal letter / briefing) returns 200 — *depends on prereq #1*
- [ ] A Stripe test event hits the webhook and is acknowledged
- [ ] An eligibility check returns a parsed 271
- [ ] Sentry shows no error spike

---

## Rollback (if anything breaks)

At Namecheap, restore:
- apex `@` A → `76.76.21.21`
- `www` CNAME → `cname.vercel-dns.com`

DNS TTL governs how fast rollback takes effect — **lower the TTL to 5 min a day
before cutover** so both the cutover and any rollback propagate quickly. The Azure
hostname bindings and certs can stay bound; they're harmless while DNS points back
to Vercel.

---

## Execution log (2026-09-02)

Done through the **Namecheap API** (`namecheap.domains.dns.setHosts`). That call **replaces the
entire record set**, so each of the three writes re-submitted all records and passed
`EmailType=MX`; the set was read back and diffed after every write (16/16, zero dropped).

1. Added `asuid` + `asuid.www` TXT; dropped TTL to 60s on the apex A and `www` CNAME.
2. Bound `www.claima.io` and `claima.io` to the App Service — no traffic moved (asuid TXT alone
   proves ownership).
3. Flipped `www` CNAME → `claima-web-d89893.azurewebsites.net`; issued + SNI-bound managed cert
   `6AE002A7…08AA`. TLS gap ≈ 4 min.
4. Flipped the apex to **ALIAS → the App Service hostname** (not a raw IP — the inbound IP can
   change); issued + SNI-bound cert `874A7B37…0F7A`. TLS gap ≈ 4 min.
5. Set `NEXT_PUBLIC_APP_URL=https://claima.io`.

**Verified after:** both hosts 200 over TLS; login + 5 API routes 200; unsigned Stripe webhook
`400 Missing signature`; MX/SPF/DKIM/DMARC and all `mail.claima.io` records intact.

### Gotchas worth remembering
- `az webapp config ssl create` throws a JSONDecodeError on az-cli 2.88.0 **but still creates the
  certificate.** Fetch the thumbprint via the ARM GET, then `az webapp config ssl bind`.
- `az rest --method PUT` against `Microsoft.Web/certificates` returned exit 0, empty body, and
  created nothing. Use the CLI command instead.
- A managed cert cannot be issued until the hostname already resolves to the app, so a short TLS
  gap is unavoidable without pre-staging an external cert. Doing `www` first keeps the rehearsal
  off the primary domain.

### Still open
- **Bedrock entitlement** — AI is dark on both old and new hosts until the Anthropic use-case form
  is submitted in the AWS console. Not caused by the cutover.
- ~~Stripe signing secret is unproven~~ — ✅ **CLOSED 2026-09-02.** The API won't return the
  secret, so it was revealed in the Workbench UI and hashed **in-page** (never in plaintext
  anywhere outside the browser). Stripe endpoint secret and Key Vault
  `STRIPE-V1-WEBHOOK-SECRET` are identical: length 38, SHA-256 prefix `8d85c369c457`.
  Destination `claima-production` is Active on `https://claima.io/api/webhooks/stripe`
  (API 2026-05-27.dahlia, 4 events) with **0 deliveries / 0 failures** to date — nothing was
  lost during the cutover. Handler verified: valid sig→200, forged→400, missing→400.
- **Rotate the Claim.MD key and the Namecheap API key** — both were exposed in session transcripts.
- Retire the Vercel project and its Supabase database once you're satisfied with Azure.
