// Which rules edition the DM's monster screens show (Monsters tab, NPC creator), remembered on the device.
// Campaigns do not carry an edition yet.
import type { Edition } from '../content'

export const DM_EDITION_KEY = 'ff.dm.edition.v1'

export const readDmEdition = (): Edition => { try { return localStorage.getItem(DM_EDITION_KEY) === '2024' ? '2024' : '2014' } catch { return '2014' } }

export function writeDmEdition(e: Edition) {
  try { localStorage.setItem(DM_EDITION_KEY, e) } catch { /* private mode */ }
}
