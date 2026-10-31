// Activation code helpers. The code itself is checked by the server (claim_account).

/** Uppercases and drops spaces and dashes, so "name ab12-cd34" matches "NAME-AB12-CD34". */
export function normalizeActivationCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '')
}
