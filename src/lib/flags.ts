/**
 * Runtime feature flags.
 *
 * Read on the server at request time (not NEXT_PUBLIC_, not a Docker build arg) so a flag
 * can be flipped with an App Service setting and a restart instead of a rebuild. Pages that
 * read one must opt out of static rendering, or the value is frozen at build time.
 */

/**
 * Self-serve activation on the Leak Report: the flow that creates an account, takes
 * acceptance of the BAA and the Recovery Services Agreement, and ingests the practice's A/R.
 *
 * Default OFF, and deliberately so. Turning it on is what makes /engagement publicly
 * acceptable by strangers, and that agreement has not been reviewed by counsel — NY Educ.
 * Law §6530(19) fee-splitting is unresolved and the signing entity is still legally
 * Pathfinder Projects LLC. The diagnostic itself is unaffected and stays public either way.
 *
 * To enable once counsel has cleared it:
 *   az webapp config appsettings set -g claima-prod -n claima-web-d89893 \
 *     --settings ACTIVATION_ENABLED=true
 *   az webapp restart -g claima-prod -n claima-web-d89893
 */
export function activationEnabled(): boolean {
  return process.env.ACTIVATION_ENABLED === "true"
}
