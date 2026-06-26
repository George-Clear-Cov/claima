import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Request-scoped practice context for AI cost attribution + quota enforcement.
 * Set once per request from getSessionFromRequest/getSession (via enterWith),
 * read inside the central aiComplete/aiStream so we don't thread practiceId
 * through every call site.
 */
const store = new AsyncLocalStorage<{ practiceId?: string }>()

export function setAiPracticeContext(practiceId: string): void {
  store.enterWith({ practiceId })
}

export function getAiPracticeId(): string | undefined {
  return store.getStore()?.practiceId
}
