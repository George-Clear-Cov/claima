# DNS cutover — claima.io: Vercel → Azure App Service

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

## Azure facts (captured 2026-07-15)

- App default host: `claima-web-d89893.azurewebsites.net`
- Custom-domain verification ID (asuid): `46BFB581E7DE2869B8E99996E7ABA4EA725C7D4D82A42F0A6036EB55CDF53D5A`
- Inbound IP: not yet allocated (null) — allocated on the first hostname/SSL binding.
  → Prefer pointing apex at the **hostname** (Namecheap ALIAS), not a raw IP.
- Bound hostnames: only the default `*.azurewebsites.net` (no custom domain yet).

---

## ⛔ Prerequisites — must ALL be true before cutover

1. **AI / Bedrock config is MISSING on Azure.** The app settings have Stripe,
   Claim.MD, ACS (email), Sentry, marketplace, JWT, and DB — but **no Anthropic or AWS
   Bedrock credentials**. After cutover, AI appeal letters / morning briefing /
   billing assistant would be dark (ai.ts fail-closes). Add the Bedrock creds (or
   `ANTHROPIC_*` + `ANTHROPIC_BAA_ACCEPTED=1`) to Azure Key Vault / app settings
   FIRST, and confirm an AI route returns 200 on the azurewebsites.net host.
2. **Claim.MD key decision.** Azure currently holds the **TEST** AccountKey. Decide
   test vs live (`31008-104894`) before real traffic — see the go-live note.
3. **Stripe live webhooks** repoint to `https://claima.io/api/webhooks/...` (and the
   `STRIPE_WEBHOOK_SECRET` / `STRIPE_V1_WEBHOOK_SECRET` on Azure match those endpoints).
4. **Azure AD SSO** redirect URIs include `https://claima.io/...` if SSO is used.
5. **Full smoke on the azurewebsites.net host** (login, a DB read/write, a Stripe
   test, an AI call, an eligibility check) — all green — BEFORE moving DNS.
6. `NEXT_PUBLIC_APP_URL` is already baked as `https://claima.io` in the image ✅.

---

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
