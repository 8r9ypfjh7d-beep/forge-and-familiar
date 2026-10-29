// Saved hand-out shape. A hand-out is something the DM prepares and gives to players:
// a written note, a picture, a map they can zoom around, or a link to an online table (Owlbear Rodeo, TaleSpire...).
export type HandoutKind = 'note' | 'image' | 'map' | 'table'

export interface Handout {
  id: string
  partyId: string
  /** UserProfile.id of the DM who wrote it. */
  fromId: string
  kind: HandoutKind
  title: string
  /** Note text, or a caption under an image or map. */
  text: string
  /** Downscaled JPEG data URL for image and map hand-outs. */
  image?: string
  /** https link to a shared battle map on another site, for 'table' hand-outs. */
  url?: string
  /** 'all' means every player in the party, including ones who join later. */
  to: 'all' | string[]
  /** Unset while it is a draft only the DM can see. */
  sentAt?: string
  /** userId → when that player first opened it. */
  seenBy: Record<string, string>
  createdAt: string
  updatedAt: string
}
