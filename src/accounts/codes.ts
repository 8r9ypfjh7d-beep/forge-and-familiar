// Activation code helpers. The code itself is checked by the server (claim_account).

/** Uppercases and drops spaces and dashes, so "roy 7pbj-2msu" matches "ROY-7PBJ-2MSU". */
export function normalizeActivationCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '')
}
