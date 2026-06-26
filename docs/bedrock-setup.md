# Running Claude via AWS Bedrock (for the HIPAA BAA)

**Why:** sending PHI to a model provider makes them a HIPAA business associate, so you need a signed BAA. AWS signs a BAA **free and self-serve** (via AWS Artifact); Anthropic's direct BAA is a contact-sales/commercial agreement. Running Claude through **Bedrock** means your PHI is covered under the **AWS** BAA — faster, free, and aligned with the AWS marketplace GTM.

**The code is already wired** (`src/lib/ai.ts`): `getProvider()` auto-routes to Bedrock as soon as AWS creds are set, and the Bedrock invoke path (SigV4-signed) + cost logging + Haiku tiering all work across providers. **No code change is needed — this is env config you set in Vercel + a little AWS setup.**

## Steps

1. **Sign the AWS BAA** — AWS Console → **AWS Artifact** → Agreements → accept the **HIPAA Business Associate Addendum**. Free, instant.

2. **Enable Claude model access** — Bedrock console → **Model access** → request access to the Anthropic Claude models you'll use (Sonnet + Haiku), in the region you'll run in (e.g. `us-east-1`). Approval is usually instant.

3. **Create an IAM identity** with permission `bedrock:InvokeModel` (and `bedrock:InvokeModelWithResponseStream` if you later add streaming). Generate an access key + secret.

4. **Copy the exact model IDs** from the Bedrock console for your region (they vary by region and are inference-profile IDs like `us.anthropic.claude-...-v1:0`). You'll need a Sonnet ID (smart tier) and a Haiku ID (fast tier).

5. **Set these env vars in Vercel (production):**

   | Var | Value |
   |---|---|
   | `AI_PROVIDER` | `bedrock` *(makes it explicit; auto-detected anyway once AWS creds exist)* |
   | `AWS_BEDROCK_REGION` | e.g. `us-east-1` |
   | `AWS_ACCESS_KEY_ID` | from step 3 |
   | `AWS_SECRET_ACCESS_KEY` | from step 3 |
   | `AWS_BEDROCK_MODEL_ID` | exact Sonnet inference-profile ID from step 4 |
   | `AWS_BEDROCK_MODEL_ID_FAST` | exact Haiku inference-profile ID from step 4 |

6. **Redeploy.** Verify: AI features work, and the function logs show `[ai-cost] … sonnet/haiku …` lines (those confirm Bedrock responses + usage are flowing).

## Notes
- **Model IDs are the gotcha.** The defaults in `ai.ts` are placeholders — always set `AWS_BEDROCK_MODEL_ID` / `AWS_BEDROCK_MODEL_ID_FAST` to the real IDs from your Bedrock console, or invokes will 400.
- **`ANTHROPIC_API_KEY` can stay** — it's no longer used for PHI once `AI_PROVIDER=bedrock`, but the **CI LLM-audit** script (`scripts/llm-audit.ts`) reviews *code*, not PHI, so it's fine to keep using the direct Anthropic key there.
- **Streaming:** the Bedrock path returns the full response at once (the chat assistant won't token-stream on Bedrock). Functional, just no streaming UX.
- **Prompt caching:** only the direct-Anthropic path wires `cache_control`; Bedrock sends the system prompt as plain text. Minor cost difference.
- **Cost logging still works** — `priceFor()` keys off "haiku"/"sonnet" in the model ID, so attribution + quota are unaffected.

## Alternative
Azure (`AZURE_OPENAI_*`) is also supported and covered by Microsoft's BAA — same idea if you'd rather lead with the Azure marketplace.
