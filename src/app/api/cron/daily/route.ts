import { NextRequest, NextResponse } from "next/server"
import { sendEmail } from "@/lib/email"
import { generateAppealLetter } from "@/lib/appeal-generator"
import { logAudit } from "@/lib/audit"
import { scrubClaim } from "@/lib/claim-scrub"

// GET /api/cron/daily — Vercel Cron calls this at 11:00 UTC (6am Eastern) daily
// Vercel automatically sends: Authorization: Bearer ${CRON_SECRET}
export const maxDuration = 300 // 5 minutes — gives enough time for all practices

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // Allow local dev without a secret, require it in production
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prisma } = await import("@/lib/prisma")

  const practices = await prisma.practice.findMany({
    include: {
      users: {
        where: { role: "ADMIN" },
        select: { email: true, name: true },
        take: 1,
      },
    },
  })

  const practiceResults: {
    practiceId: string
    practiceName: string
    adminEmail: string | null
    erasPosted: number
    appealsGenerated: number
    draftIssues: number
    timelyRisks: number
    agingClaims: number
    error: string | undefined
  }[] = []

  const PAYER_RATES: Record<string, { insRate: number; adjRate: number }> = {
    "Aetna":                { insRate: 0.70, adjRate: 0.10 },
    "BlueCross BlueShield": { insRate: 0.75, adjRate: 0.08 },
    "United Healthcare":    { insRate: 0.72, adjRate: 0.10 },
    "Cigna":                { insRate: 0.68, adjRate: 0.12 },
    "Humana":               { insRate: 0.65, adjRate: 0.13 },
  }
  const DEFAULT_RATES = { insRate: 0.70, adjRate: 0.10 }

  for (const practice of practices) {
    const adminEmail = practice.users[0]?.email ?? null
    const result: {
      practiceId: string
      practiceName: string
      adminEmail: string | null
      erasPosted: number
      appealsGenerated: number
      draftIssues: number
      timelyRisks: number
      agingClaims: number
      error: string | undefined
    } = {
      practiceId: practice.id,
      practiceName: practice.name,
      adminEmail,
      erasPosted: 0,
      appealsGenerated: 0,
      draftIssues: 0,
      timelyRisks: 0,
      agingClaims: 0,
      error: undefined,
    }

    try {
      const now = new Date()
      const eraCutoff = new Date(now.getTime() - 14 * 86400000)
      const tfCutoff = new Date(now.getTime() - 90 * 86400000)
      const agingCutoff = new Date(now.getTime() - 45 * 86400000)

      // ── 1. ERA auto-post ──────────────────────────────────────────────────
      const eraEligible = await prisma.claim.findMany({
        where: {
          practiceId: practice.id,
          claimStatus: { in: ["SUBMITTED", "ACCEPTED"] },
          submittedAt: { lte: eraCutoff },
          statement: null,
        },
        include: { patient: { select: { firstName: true, lastName: true, payerName: true } } },
      })

      for (const claim of eraEligible) {
        const totalCharge = Number(claim.totalCharge)
        const rates = PAYER_RATES[claim.patient.payerName] ?? DEFAULT_RATES
        const insurancePaid = Math.round(totalCharge * rates.insRate * 100) / 100
        const adjustments = Math.round(totalCharge * rates.adjRate * 100) / 100
        const patientOwes = Math.max(Math.round((totalCharge - insurancePaid - adjustments) * 100) / 100, 0)
        try {
          await prisma.$transaction([
            prisma.claim.update({
              where: { id: claim.id },
              data: { claimStatus: "PAID", paidAmount: insurancePaid, paidAt: now },
            }),
            prisma.patientStatement.create({
              data: {
                patientId: claim.patientId,
                claimId: claim.id,
                totalCharge,
                insurancePaid,
                adjustments,
                patientOwes,
                balanceDue: patientOwes,
                statementStatus: patientOwes === 0 ? "PAID" : "PENDING",
                dueDate: new Date(now.getTime() + 30 * 86400000),
                notes: `Auto-posted by daily cron — ${claim.patient.payerName}`,
              },
            }),
          ])
          result.erasPosted++
        } catch { /* skip individual failures, continue */ }
      }

      // ── 2. Auto-scrub DRAFT claims ───────────────────────────────────────
      const draftClaims = await prisma.claim.findMany({
        where: { practiceId: practice.id, claimStatus: "DRAFT" },
        include: {
          lineItems: { select: { cptCode: true, icd10Codes: true, modifier: true, chargeAmount: true } },
          patient: { select: { payerName: true } },
        },
        take: 20, // time budget cap
      })

      for (const claim of draftClaims) {
        for (const line of claim.lineItems) {
          try {
            const scrub = await scrubClaim({
              cptCode: line.cptCode,
              icd10Codes: line.icd10Codes as string[],
              modifier: line.modifier ?? undefined,
              payerName: claim.patient.payerName,
              charge: Number(line.chargeAmount),
              serviceDate: claim.serviceDate.toISOString().slice(0, 10),
            })
            if (scrub.verdict === "warning" || scrub.issues.some(i => i.severity === "error")) {
              result.draftIssues++
            }
          } catch { /* skip individual line failures */ }
        }
      }

      // ── 3. Denial auto-process ────────────────────────────────────────────
      const pendingDenials = await prisma.denial.findMany({
        where: {
          claim: { practiceId: practice.id },
          appealStatus: "PENDING",
          appealLetter: null,
          appealable: true,
        },
        include: {
          claim: { include: { patient: true, provider: true, practice: true, lineItems: true } },
        },
        take: 10, // limit per run to stay within time budget
      })

      for (const denial of pendingDenials) {
        try {
          const letter = await generateAppealLetter({
            patientName: `${denial.claim.patient.firstName} ${denial.claim.patient.lastName}`,
            patientDob: denial.claim.patient.dob.toISOString().slice(0, 10),
            memberId: denial.claim.patient.memberId,
            payerName: denial.claim.patient.payerName,
            claimId: denial.claimId,
            serviceDate: denial.claim.serviceDate.toISOString().slice(0, 10),
            cptCodes: denial.claim.lineItems.map((l) => l.cptCode),
            icd10Codes: denial.claim.lineItems.flatMap((l) => l.icd10Codes as string[]),
            totalCharge: Number(denial.claim.totalCharge),
            carcCode: denial.carcCode,
            denialReason: denial.denialReason,
            providerName: `${denial.claim.provider.firstName} ${denial.claim.provider.lastName}`,
            providerNpi: denial.claim.provider.npi,
            practiceName: denial.claim.practice.name,
          })
          await prisma.denial.update({
            where: { id: denial.id },
            data: { appealLetter: letter, appealStatus: "IN_PROGRESS" },
          })
          result.appealsGenerated++
        } catch { /* skip individual failures */ }
      }

      // ── 4. Patient outreach automation ───────────────────────────────
      let outreachSent = 0
      try {
        const { sendEmail } = await import("@/lib/email")
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
        const outreachCandidates = await prisma.patientStatement.findMany({
          where: {
            statementStatus: { notIn: ["PAID", "WRITE_OFF"] },
            balanceDue: { gt: 0 },
            claim: { practiceId: practice.id },
            OR: [
              { outreachCount: 0, createdAt: { lt: sevenDaysAgo } },
              { outreachCount: 1, outreachSentAt: { lt: new Date(now.getTime() - 7 * 86400000) } },
              { outreachCount: 2, outreachSentAt: { lt: new Date(now.getTime() - 18 * 86400000) } },
            ],
            patient: { email: { not: null } },
          },
          include: {
            patient: { select: { firstName: true, email: true } },
            claim: { include: { practice: { select: { name: true, phone: true } }, lineItems: { select: { cptCode: true }, take: 1 } } },
          },
          take: 20,
        })
        for (const stmt of outreachCandidates) {
          if (!stmt.patient.email) continue
          try {
            const balance = Number(stmt.balanceDue)
            const practiceName = stmt.claim.practice.name
            const phone = stmt.claim.practice.phone ?? ""
            const serviceDate = new Date(stmt.claim.serviceDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            const subjectMap = [`Your balance from ${practiceName}`, `Reminder: $${balance.toFixed(2)} balance due`, `Final notice: ${practiceName} balance`]
            const subject = subjectMap[Math.min(stmt.outreachCount, 2)]
            await sendEmail({
              from: `${practiceName} Billing <noreply@claima.io>`,
              to: stmt.patient.email,
              subject,
              html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111"><h2>${practiceName}</h2><p>Hi ${stmt.patient.firstName}, you have an outstanding balance of <strong>$${balance.toFixed(2)}</strong> for your visit on ${serviceDate}.</p>${stmt.outreachCount >= 2 ? `<p style="color:#dc2626"><strong>Final notice.</strong> Unpaid balances may be referred to collections.</p>` : ""}<p>Please call us at ${phone} or contact your provider to pay.</p></div>`,
            })
            await prisma.patientStatement.update({
              where: { id: stmt.id },
              data: { outreachSentAt: now, outreachCount: { increment: 1 }, statementStatus: "SENT" },
            })
            outreachSent++
          } catch { /* skip individual failures */ }
        }
      } catch { /* email unavailable */ }

      // ── 5. Timely filing + aging scan ────────────────────────────────────
      const [timelyRisks, agingClaims] = await Promise.all([
        prisma.claim.count({
          where: {
            practiceId: practice.id,
            claimStatus: { in: ["SUBMITTED", "ACCEPTED"] },
            submittedAt: { lt: tfCutoff },
          },
        }),
        prisma.claim.count({
          where: {
            practiceId: practice.id,
            claimStatus: { in: ["SUBMITTED", "ACCEPTED"] },
            submittedAt: { lt: agingCutoff, gte: tfCutoff },
          },
        }),
      ])
      result.timelyRisks = timelyRisks
      result.agingClaims = agingClaims

      // ── 5. Claim status polling (live mode only) ─────────────────────────
      const { getClaimStatus, isClaimMdConfigured } = await import("@/lib/claimmd")
      if (isClaimMdConfigured()) {
        const pollCutoff = new Date(now.getTime() - 24 * 3600000)
        const submittedClaims = await prisma.claim.findMany({
          where: {
            practiceId: practice.id,
            claimStatus: "SUBMITTED",
            stediClaimId: { not: null },
            submittedAt: { lt: pollCutoff },
          },
          select: { id: true, stediClaimId: true },
          take: 10,
        })
        for (const claim of submittedClaims) {
          if (!claim.stediClaimId) continue
          try {
            const statusResult = await getClaimStatus(claim.stediClaimId)
            if (!statusResult) continue
            const newStatus =
              statusResult.status === "accepted" ? "ACCEPTED" :
              statusResult.status === "rejected" ? "REJECTED" :
              statusResult.status === "paid" ? "PAID" :
              statusResult.status === "denied" ? "DENIED" : null
            if (newStatus) {
              await prisma.claim.update({
                where: { id: claim.id },
                data: { claimStatus: newStatus as "ACCEPTED" | "REJECTED" | "PAID" | "DENIED" },
              })
            }
          } catch { /* skip individual failures */ }
        }
      }

      // ── 6. Credentialing expiry check ────────────────────────────────────
      const in90 = new Date(now.getTime() + 90 * 86400000)
      const credProviders = await prisma.provider.findMany({
        where: {
          practiceId: practice.id,
          OR: [
            { deaExpiry: { lte: in90 } },
            { stateLicenseExpiry: { lte: in90 } },
            { boardCertExpiry: { lte: in90 } },
            { malpracticeExpiry: { lte: in90 } },
          ],
        },
        select: {
          firstName: true, lastName: true,
          deaExpiry: true, stateLicenseExpiry: true,
          boardCertExpiry: true, malpracticeExpiry: true,
        },
      })
      const credAlerts: string[] = []
      for (const prov of credProviders) {
        const name = `Dr. ${prov.lastName}, ${prov.firstName}`
        const flags: string[] = []
        const checkField = (label: string, expiry: Date | null) => {
          if (!expiry) return
          const days = Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
          if (days < 0) flags.push(`${label} EXPIRED`)
          else flags.push(`${label} in ${days}d`)
        }
        checkField("State License", prov.stateLicenseExpiry)
        checkField("DEA", prov.deaExpiry)
        checkField("Board Cert", prov.boardCertExpiry)
        checkField("Malpractice", prov.malpracticeExpiry)
        if (flags.length > 0) credAlerts.push(`${name}: ${flags.join(", ")}`)
      }

      // ── 7. OIG monthly re-check ──────────────────────────────────────────
      // CMS guidance: screen at least monthly. Run check for any provider
      // whose last OIG check is > 30 days old or who has never been checked.
      const oigCutoff = new Date(now.getTime() - 30 * 86400000)
      const allProviders = await prisma.provider.findMany({
        where: { practiceId: practice.id },
        select: {
          id: true, firstName: true, lastName: true, npi: true,
          oigChecks: {
            orderBy: { checkedAt: "desc" },
            take: 1,
            select: { checkedAt: true, status: true },
          },
        },
      })
      const needsOigCheck = allProviders.filter((p) => {
        const last = p.oigChecks[0]
        return !last || new Date(last.checkedAt) < oigCutoff
      })
      const { checkOigExclusion } = await import("@/lib/oig")
      let oigExclusionsFound = 0
      for (const prov of needsOigCheck) {
        try {
          const oigResult = await checkOigExclusion(prov.firstName, prov.lastName, prov.npi)
          await prisma.oigCheck.create({
            data: {
              practiceId:  practice.id,
              providerId:  prov.id,
              status:      oigResult.error ? "ERROR" : oigResult.excluded ? "EXCLUDED" : "CLEAR",
              matchFound:  oigResult.excluded,
              matchDetails: oigResult.matches.length > 0 ? (oigResult.matches as unknown as import("@prisma/client").Prisma.InputJsonValue) : undefined,
              error:       oigResult.error ?? undefined,
            },
          })
          if (oigResult.excluded) oigExclusionsFound++
        } catch { /* skip individual failures */ }
      }

      // ── 8. Daily summary email ────────────────────────────────────────────
      if (adminEmail) {
        const pendingAppeals = await prisma.denial.count({
          where: {
            claim: { practiceId: practice.id },
            appealStatus: { in: ["PENDING", "IN_PROGRESS"] },
          },
        })
        const overdueStatements = await prisma.patientStatement.count({
          where: {
            patient: { practiceId: practice.id },
            statementStatus: { notIn: ["PAID", "WRITE_OFF"] },
            dueDate: { lt: now },
          },
        })

        const hasUrgent = timelyRisks > 0 || result.erasPosted > 0 || result.appealsGenerated > 0 || credAlerts.some(a => a.includes("EXPIRED")) || oigExclusionsFound > 0

        const lines: string[] = []
        if (result.erasPosted > 0) lines.push(`✅ ${result.erasPosted} ERA payment${result.erasPosted === 1 ? "" : "s"} auto-posted`)
        if (result.appealsGenerated > 0) lines.push(`📝 ${result.appealsGenerated} appeal letter${result.appealsGenerated === 1 ? "" : "s"} drafted`)
        if (result.draftIssues > 0) lines.push(`📋 ${result.draftIssues} draft claim line${result.draftIssues === 1 ? "" : "s"} flagged by AI — review before submitting`)
        if (agingClaims > 0) lines.push(`⏳ ${agingClaims} claim${agingClaims === 1 ? "" : "s"} pending 45–90 days — follow up with payer`)
        if (timelyRisks > 0) lines.push(`🚨 ${timelyRisks} claim${timelyRisks === 1 ? "" : "s"} at timely filing risk (90+ days) — act today`)
        if (pendingAppeals > 0) lines.push(`📋 ${pendingAppeals} open appeal${pendingAppeals === 1 ? "" : "s"} in progress`)
        if (outreachSent > 0) lines.push(`📧 ${outreachSent} patient statement${outreachSent === 1 ? "" : "s"} emailed automatically`)
        if (overdueStatements > 0) lines.push(`💰 ${overdueStatements} overdue patient balance${overdueStatements === 1 ? "" : "s"}`)
        for (const alert of credAlerts) lines.push(`🪪 ${alert}`)
        if (needsOigCheck.length > 0 && oigExclusionsFound === 0) lines.push(`✅ OIG LEIE re-checked ${needsOigCheck.length} provider${needsOigCheck.length !== 1 ? "s" : ""} — all clear`)
        if (oigExclusionsFound > 0) lines.push(`🚨 OIG LEIE: ${oigExclusionsFound} provider${oigExclusionsFound !== 1 ? "s" : ""} matched exclusion list — do not bill Medicare/Medicaid until resolved`)
        if (lines.length === 0) lines.push("✅ Everything is on track — no action needed today")

        await sendEmail({
          to: adminEmail,
          subject: `${hasUrgent ? "⚠️ " : ""}Claima daily briefing — ${now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:4px">Good morning from Claima</div>
  <div style="font-size:13px;color:#888;margin-bottom:24px">${practice.name} · ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
  <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:20px">
    ${lines.map(l => `<div style="font-size:14px;color:#111;padding:6px 0;border-bottom:1px solid #f0f0f0">${l}</div>`).join("")}
  </div>
  <a href="https://claima.io" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;font-weight:600;font-size:13px;text-decoration:none">Open Claima →</a>
  <p style="color:#ccc;font-size:11px;margin-top:24px">This email is sent automatically each morning. Unsubscribe in Settings.</p>
</div>`,
        }).catch(e => console.error(`[cron] email to ${adminEmail} failed:`, e))
      }

      logAudit({
        action: "cron.daily",
        practiceId: practice.id,
        userEmail: adminEmail ?? undefined,
      })
    } catch (err) {
      result.error = err instanceof Error ? err.message : "Unknown error"
      console.error(`[cron] practice ${practice.id} failed:`, err)
    }

    practiceResults.push(result)
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    practices: practiceResults.length,
    totals: {
      erasPosted: practiceResults.reduce((s, r) => s + r.erasPosted, 0),
      appealsGenerated: practiceResults.reduce((s, r) => s + r.appealsGenerated, 0),
      draftIssues: practiceResults.reduce((s, r) => s + r.draftIssues, 0),
      errors: practiceResults.filter(r => r.error).length,
    },
    results: practiceResults,
  })
}
