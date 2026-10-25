// Invite codes and pure party updates. No storage here, so it is easy to test and
// the same rules can run on a backend later.
import type { Party } from './types'

/** No 0/O, 1/I/L, so codes read out loud at the table are hard to get wrong. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6

export function makeInviteCode(random: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  // 256 is not a multiple of 31, so reject bytes past the last full cycle to keep it uniform.
  const limit = 256 - (256 % CODE_ALPHABET.length)
  let out = ''
  while (out.length < CODE_LENGTH) {
    for (const b of random(CODE_LENGTH)) {
      if (b < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % CODE_ALPHABET.length]
    }
  }
  return out
}

/** Uppercases and drops spaces and dashes, so "abc 234" and "ABC-234" both work. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '')
}

export const isValidCode = (code: string) =>
  code.length === CODE_LENGTH && [...code].every(ch => CODE_ALPHABET.includes(ch))

export const formatCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`

export const isMember = (p: Party, userId: string) => p.members.some(m => m.userId === userId)

const touch = (p: Party, members: Party['members']): Party => ({ ...p, members, updatedAt: new Date().toISOString() })

/** Adds the player; joining twice keeps the first entry but can update the character. */
export function addMember(p: Party, userId: string, characterId?: string): Party {
  const existing = p.members.find(m => m.userId === userId)
  if (existing) return characterId === undefined ? p : setMemberCharacter(p, userId, characterId)
  return touch(p, [...p.members, { userId, characterId, joinedAt: new Date().toISOString() }])
}

export function setMemberCharacter(p: Party, userId: string, characterId: string | undefined): Party {
  return touch(p, p.members.map(m => (m.userId === userId ? { ...m, characterId } : m)))
}

/** Removes the player. Returns null when the party is left empty and should be deleted. */
export function removeMember(p: Party, userId: string): Party | null {
  const members = p.members.filter(m => m.userId !== userId)
  if (members.length === 0) return null
  const next = touch(p, members)
  // If the DM leaves, the longest-standing member takes over.
  return p.dmId === userId ? { ...next, dmId: members[0].userId } : next
}
