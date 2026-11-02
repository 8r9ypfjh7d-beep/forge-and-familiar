// Shrinks a chosen picture to a JPEG data URL for one kind of art. Tokens are cut to a centred square.
import { fitWithin, squareCrop, type ArtKind } from './logic'

export class ArtImageError extends Error {}

export async function shrinkArt(file: File, kind: ArtKind, maxSide: number): Promise<string> {
  if (!file.type.startsWith('image/')) throw new ArtImageError('not-image')
  const bitmap = await createImageBitmap(file).catch(() => { throw new ArtImageError('unreadable') })
  const crop = kind === 'token' ? squareCrop(bitmap.width, bitmap.height) : { sx: 0, sy: 0, side: 0 }
  const srcW = kind === 'token' ? crop.side : bitmap.width
  const srcH = kind === 'token' ? crop.side : bitmap.height
  const { width, height } = fitWithin(srcW, srcH, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  // JPEG has no transparency: a dark backdrop suits cut-out token art on a map.
  ctx.fillStyle = '#1d1a24'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, crop.sx, crop.sy, srcW, srcH, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', kind === 'gallery' ? 0.85 : 0.82)
}
