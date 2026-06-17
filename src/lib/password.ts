export interface PasswordCheck {
  valid: boolean
  errors: string[]
}

const RULES: Array<{ test: (p: string) => boolean; message: string }> = [
  { test: (p) => p.length >= 8, message: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p), message: "One uppercase letter" },
  { test: (p) => /[a-z]/.test(p), message: "One lowercase letter" },
  { test: (p) => /[0-9]/.test(p), message: "One number" },
]

export function validatePassword(password: string): PasswordCheck {
  const errors = RULES.filter((r) => !r.test(password)).map((r) => r.message)
  return { valid: errors.length === 0, errors }
}

export const PASSWORD_RULES = RULES.map((r) => r.message)
