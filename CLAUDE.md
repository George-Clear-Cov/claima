# MediBill — AI-Native Medical Billing

## Product
AI-native medical billing platform. Sells outcomes (% of collections), not software seats. Targets small/mid practices currently outsourcing to RCM firms. HIPAA compliance required on every PR.

## Workflows to Build (in order)
1. **Claim submission** ← active now
2. Denial management & appeals queue
3. Eligibility verification (270/271)
4. Patient billing & statements

## Stack
- TypeScript / Next.js (frontend + API routes)
- PostgreSQL (Supabase)
- HIPAA-compliant infra

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use ~/.claude/skills/gstack/... for gstack file paths.
