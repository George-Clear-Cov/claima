# Transactable + MACC Playbook (Azure Marketplace)

> The plan from the start: the **list-only** AppSource offer is for discovery/co-sell now; when an
> enterprise buyer wants to **procure through the marketplace and spend down their Azure commitment
> (MACC)**, we stand up a **second, transactable, metered offer**. This doc is the runbook for that.
> See [[gtm-appsource]] · [[roadmap]] (GTM) · docs/gtm/cloud-cosell-playbook.md.

## Why (the payoff)
A transactable offer that's **Azure IP Co-sell eligible** auto-enrolls in **MACC** (~1 week). Then a
customer with an Azure spend commitment can buy Claima and **100% of the pre-tax price counts toward
their commitment** (if they check out via **"Get it in Azure portal"**, not credit card). For big
health systems / PE-backed groups sitting on large Azure commitments, that turns "new vendor spend"
into "money we already committed" — a huge procurement unlock and a co-sell magnet for Microsoft AEs.

## The trigger (when to build this — NOT before)
An enterprise/health-system/MSO deal asks to **procure via the Azure Marketplace** or **apply their
MACC**. Don't build it speculatively — transactable adds billing complexity + Microsoft's ~3%
marketplace fee. Until the trigger, list-only is correct.

## The hard part: billing a % of collections through Microsoft
Microsoft's marketplace bills **flat / per-seat / metered** — it can't natively bill "a % of what you
collect." The fix is **metered billing** with a custom dimension:

- **Design:** define one metered dimension, e.g. `platform-fee`, priced at **$1.00 per unit**.
- Each billing period, compute the fee off-platform (`fee = collectionsRate × dollarsCollected`, e.g.
  5% of $10,000 = $500) and **report `500` units** to Microsoft's Metering API → Microsoft invoices
  $500 and it counts toward the customer's MACC.
- This preserves the %-of-collections economics while being a valid transactable meter. (A flat
  **per-provider/month** plan can be offered as a simpler alternative SKU for buyers who prefer
  predictable pricing.)

## Steps
1. **New offer (don't convert the list-only one — that choice is locked post-publish).** Partner
   Center → new **SaaS** offer → Setup: **"Yes, sell through Microsoft."**
2. **Plans + pricing:** create a plan with **metered billing**; add the `platform-fee` dimension at
   $1/unit (and/or a flat per-provider/month plan). Set the free-trial option if desired.
3. **SaaS Fulfillment API v2** — subscription lifecycle: landing page resolves the marketplace token,
   activate/change/suspend/reinstate/unsubscribe via webhook. *Partial code exists:*
   `src/lib/azure-marketplace.ts` + `/api/marketplace/azure/activate` + `/api/webhooks/azure-marketplace`
   — extend for the full subscription lifecycle + plan/quantity changes.
4. **Metering Service API** — report `platform-fee` usage each billing period (compute fee → POST usage
   event). **New code to build** (`reportMeteredUsage()` + a monthly cron step that sums collections
   per marketplace subscription and reports units).
5. **Azure IP Co-sell eligible status** — complete the co-sell requirements on the transactable offer
   (solution validation, references, etc.). Co-sell already shows "In Market" on the list-only offer;
   IP co-sell eligible is the higher bar tied to transactable.
6. **Publish** → validation → preview → signoff → certification → live. MACC enrollment follows (~1 wk).

## Buyer flow to actually count toward MACC
Tell enterprise buyers to purchase via **"Get it in Azure portal"** using the Azure subscription tied
to their Enterprise Agreement/MACC. A direct credit-card purchase on the marketplace does **not** count
toward their commitment.

## Reuse from the list-only work
Description, RCM positioning, logos (216×216, 512×512), 815×290 hero, 300×150, screenshots + captions,
support/privacy links — all reusable. New = the transactable pricing plan + the metering integration.

## Constraints / gotchas
- Sell-through-Microsoft choice is **immutable once published** → this is a **separate offer** from the
  list-only one (you can run both).
- Microsoft takes a **marketplace fee (~3%)** on transactable revenue.
- Metered usage must be reported reliably each period (idempotent; reconcile against actual collections).
- Tax + banking (seller registration, task #20) is a prerequisite for any transactable payout.

## One-line status
List-only live for discovery (2026-07). Build this transactable/metered offer **when the first
enterprise/MACC procurement deal lands** — pricing = `platform-fee` meter @ $1/unit, report fee-as-units
monthly.
