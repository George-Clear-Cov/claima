/**
 * A/R recovery playbook — product knowledge consumed by the AI layer at inference time.
 *
 * Lives in the repo (not Obsidian) because Claude-on-Bedrock must see it in production.
 * Obsidian holds engagement notes; this holds the rules the product reasons with.
 *
 * Derived from the first live A/R engagement (GI practice, 78 accounts, $95.6k aged A/R).
 */

export type RecoveryTier =
  | "STATUS_UNKNOWN"
  | "MEDICARE_REOPENING"
  | "NEVER_ADJUDICATED"
  | "APPEAL_IN_WINDOW"
  | "APPEAL_PAST_WINDOW"
  | "CORRECTED_CLAIM"
  | "PATIENT_RESPONSIBILITY"

export interface PayerRule {
  /** Canonical payer name. */
  payer: string
  /** Variants seen in practice-management exports; used to consolidate fragmented A/R. */
  aliases: string[]
  /** Days from denial to file an appeal. null = varies by plan, read the EOB. */
  appealDays: number | null
  /** Days from date of service to file the original claim. */
  timelyFilingDays: number
  /** Medicare only: days from initial determination in which a reopening may be requested. */
  reopeningDays?: number
  portal?: string
  /** Clearinghouse payer ID, where a single stable one exists. */
  payerId?: string
  /** Default prior-auth posture. Plan-level rules always override — verify via 270/271. */
  priorAuth?: string
  notes?: string
}

/**
 * Payer-name fragmentation is the single most under-appreciated problem in aged A/R:
 * one payer split across five spellings looks like five small problems instead of the
 * largest one. Always normalize before ranking by balance.
 */
export const PAYER_RULES: PayerRule[] = [
  {
    payer: "Medicare",
    aliases: ["medicare", "medicare part b", "ngs", "national government services"],
    appealDays: 120, // redetermination from initial determination
    timelyFilingDays: 365, // 12 months from DOS
    reopeningDays: 365, // 42 CFR 405.980
    portal: "NGS Connex (NY MAC)",
    payerId: "00010-00099 range (state-specific MAC)",
    priorAuth: "No PA for outpatient psychotherapy or most E&M",
    notes:
      "Past 120 days, a reopening is still available within 1 year for clerical error. " +
      "Timely filing for the original claim is 1 calendar year from DOS — a claim the " +
      "payer never received is filable, not lost.",
  },
  {
    payer: "UnitedHealthcare",
    aliases: [
      "united healthcare",
      "unitedhealthcare",
      "oxford united healthcare",
      "united healthcare / community plan",
      "emblem/united",
      "oxford",
      "optum",
      // The bare abbreviation matters: real exports write "UHC Community Plan" and
      // "Oxford UHC", neither of which contains the words "united healthcare".
      "uhc",
    ],
    appealDays: 180,
    timelyFilingDays: 365, // plan dependent, 90-365; use the outer bound and verify
    portal: "UHC Provider Portal / Optum",
    payerId: "87726",
    priorAuth: "No PA for outpatient psychotherapy on most plans",
    notes:
      "Timely filing varies 90–365 days by plan — verify per member. Frequently appears " +
      "under several names in one aging report; consolidate before ranking by balance.",
  },
  {
    payer: "Aetna",
    aliases: ["aetna", "aetna us healthcare"],
    appealDays: 180,
    timelyFilingDays: 180,
    portal: "Availity",
    payerId: "60054 (behavioral) / 00431 (medical)",
    priorAuth: "No PA for first 8 outpatient MH sessions/year; required beyond",
  },
  {
    payer: "Cigna",
    aliases: ["cigna", "cigna healthcare", "cigna behavioral"],
    appealDays: 180,
    timelyFilingDays: 180,
    portal: "Availity",
    payerId: "62308 (medical) / 73288 (behavioral)",
    priorAuth: "No PA for standard outpatient MH visits",
  },
  {
    payer: "Healthfirst",
    aliases: ["healthfirst"],
    appealDays: 60,
    timelyFilingDays: 180,
    notes: "Shorter appeal window than most commercial plans — prioritize these.",
  },
  {
    payer: "Empire BCBS",
    aliases: ["empire plan", "blue cross and blue shield of ny", "bcbs", "anthem"],
    appealDays: 180,
    timelyFilingDays: 180,
    portal: "Availity",
    payerId: "00310 / 00550 (state-specific — verify)",
  },
  {
    payer: "Humana",
    aliases: ["humana"],
    appealDays: 180,
    timelyFilingDays: 365,
    portal: "Availity",
    payerId: "61101",
    priorAuth: "May be required — check the plan",
  },
  {
    payer: "Healthcare Partners",
    aliases: ["healthcare partners"],
    appealDays: null,
    timelyFilingDays: 90,
  },
  {
    payer: "NYCE PPO",
    aliases: ["nyce ppo plan", "nyce"],
    appealDays: null,
    timelyFilingDays: 90,
  },
  {
    payer: "Surest",
    aliases: ["surest"],
    appealDays: 180,
    timelyFilingDays: 365,
    payerId: "87726 (UnitedHealth company)",
    notes: "UnitedHealth company; follows UHC timely-filing variability.",
  },
  {
    payer: "Magellan Health",
    aliases: ["magellan"],
    appealDays: null,
    timelyFilingDays: 180,
    payerId: "65101",
    priorAuth: "Often requires PA for ongoing treatment",
    notes: "Behavioral health carve-out.",
  },
  {
    payer: "Carelon (Beacon Health)",
    aliases: ["beacon health", "beacon", "carelon"],
    appealDays: null,
    timelyFilingDays: 180,
    payerId: "84146",
    priorAuth: "Often requires PA for ongoing treatment",
  },
  {
    payer: "Tricare",
    aliases: ["tricare"],
    appealDays: 90,
    timelyFilingDays: 365,
    payerId: "98392",
  },
  {
    payer: "Medicaid",
    aliases: ["medicaid", "healthplus amerigroup", "amerigroup", "partner health plan"],
    appealDays: null,
    timelyFilingDays: 90, // 90 days - 12 months, state dependent; assume the tightest
    priorAuth: "Varies heavily by state",
    notes:
      "State-dependent in every dimension. 90 days is the tightest common limit — verify " +
      "against the specific state plan before relying on it.",
  },
]

const ALIAS_INDEX: Map<string, PayerRule> = new Map(
  PAYER_RULES.flatMap((r) => [
    [r.payer.toLowerCase(), r] as [string, PayerRule],
    ...r.aliases.map((a) => [a.toLowerCase(), r] as [string, PayerRule]),
  ]),
)

/** Resolve a raw payer string from a PM export to its canonical rule. */
export function resolvePayer(raw: string | null | undefined): PayerRule | null {
  if (!raw) return null
  const k = raw.trim().toLowerCase()
  const exact = ALIAS_INDEX.get(k)
  if (exact) return exact
  for (const [alias, rule] of ALIAS_INDEX) {
    if (k.includes(alias)) return rule
  }
  return null
}

/** Canonical display name, falling back to the original string. */
export function canonicalPayerName(raw: string | null | undefined): string {
  return resolvePayer(raw)?.payer ?? (raw ?? "Unknown")
}

export interface TriageInput {
  payer: string | null
  /** Days since date of service. */
  arDays: number
  /** Whether anyone has documented follow-up on this account. */
  hasWorklog: boolean
  /** CARC from the 835, when a remit exists. */
  carcCode?: string | null
  /** Free-text worklog notes, if any. */
  notes?: string[]
}

export interface TriageResult {
  tier: RecoveryTier
  priority: "HIGH" | "MEDIUM" | "LOW"
  action: string
  /** File under docs/templates/ to draft from. */
  template: string | null
  /** True when the standard appeal window has already closed. */
  pastAppealWindow: boolean
}

/**
 * The core rule: an aged claim with no worklog is *status unknown*, not *denied*.
 * Appealing a claim the payer never received burns the appeal and misses the real fix
 * (resubmission inside timely filing). Always establish status first.
 */
export function triageAccount(input: TriageInput): TriageResult {
  const rule = resolvePayer(input.payer)
  const notes = (input.notes ?? []).join(" ").toLowerCase()
  const pastAppealWindow = rule?.appealDays != null && input.arDays > rule.appealDays

  if (notes.includes("applied to the deductible")) {
    return {
      tier: "PATIENT_RESPONSIBILITY",
      priority: "MEDIUM",
      action:
        "Not payer A/R. Move to patient statements — it will never be paid by the plan " +
        "and ages against the wrong party where it sits.",
      template: null,
      pastAppealWindow: false,
    }
  }

  if (notes.includes("billed as diagnostic") || notes.includes("screening")) {
    return {
      tier: "CORRECTED_CLAIM",
      priority: "HIGH",
      action:
        "Likely a missing screening indicator (PT for Medicare, 33 for commercial). " +
        "Submit a corrected claim rather than an appeal — faster and higher yield.",
      template: "docs/templates/corrected-claim-screening-colonoscopy.md",
      pastAppealWindow: false,
    }
  }

  if (notes.includes("asking to process this claim") || notes.includes("never processed")) {
    return {
      tier: "NEVER_ADJUDICATED",
      priority: "HIGH",
      action:
        "Payer has neither paid nor denied. Escalate with proof of timely submission; " +
        "in NY cite Prompt Pay (Ins. Law § 3224-a). Do not mail another duplicate.",
      template: "docs/templates/payer-escalation-no-response.md",
      pastAppealWindow: false,
    }
  }

  if (!input.hasWorklog) {
    if (rule?.payer === "Medicare" && input.arDays > (rule.appealDays ?? 120)) {
      return {
        tier: "MEDICARE_REOPENING",
        priority: "HIGH",
        action:
          "Past redetermination but within the 1-year reopening window. Run a 276/277 " +
          "first — if Medicare has no record, resubmit (timely filing is 1 year from DOS).",
        template: "docs/templates/medicare-reopening-request.md",
        pastAppealWindow: true,
      }
    }
    return {
      tier: "STATUS_UNKNOWN",
      priority: pastAppealWindow ? "MEDIUM" : "HIGH",
      action:
        "No follow-up on record. Run a 276/277 claim-status inquiry before anything else; " +
        "route on the 277 result. Work newest-first to keep claims inside their window.",
      template: "docs/templates/claim-status-inquiry-batch.md",
      pastAppealWindow,
    }
  }

  if (notes.includes("requires authorization")) {
    return {
      tier: pastAppealWindow ? "APPEAL_PAST_WINDOW" : "APPEAL_IN_WINDOW",
      priority: pastAppealWindow ? "LOW" : "HIGH",
      action:
        "Prior-auth denial. Strongest argument is intra-operative conversion — a screening " +
        "that became therapeutic could not have been authorized in advance.",
      template: "docs/templates/prior-auth-retro-appeal.md",
      pastAppealWindow,
    }
  }

  return {
    tier: pastAppealWindow ? "APPEAL_PAST_WINDOW" : "APPEAL_IN_WINDOW",
    priority: pastAppealWindow ? "LOW" : "MEDIUM",
    action: pastAppealWindow
      ? "Past the standard appeal window; recovery depends on payer good-cause provisions."
      : "Pull the EOB, categorize the CARC, and appeal within the window.",
    template: null,
    pastAppealWindow,
  }
}

/** Compact playbook summary for injection into an AI prompt. */
export function playbookForPrompt(payer: string | null): string {
  const r = resolvePayer(payer)
  if (!r) return "No payer-specific rules on file; read the EOB for the appeal deadline."
  return [
    `Payer: ${r.payer}`,
    `Appeal window: ${r.appealDays ?? "varies — read the EOB"} days from denial`,
    `Timely filing: ${r.timelyFilingDays} days from DOS`,
    r.reopeningDays ? `Reopening: within ${r.reopeningDays} days of initial determination` : null,
    r.portal ? `Portal: ${r.portal}` : null,
    r.payerId ? `Payer ID: ${r.payerId}` : null,
    r.priorAuth ? `Prior auth: ${r.priorAuth}` : null,
    r.notes ?? null,
  ]
    .filter(Boolean)
    .join("\n")
}
