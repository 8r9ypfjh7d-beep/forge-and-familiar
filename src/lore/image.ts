// Shrinks an uploaded picture to a JPEG data URL small enough for local storage.
// Maps keep more pixels than plain images so players can zoom in on them.
const MAX_SIDE: Record<'image' | 'map', number> = { image: 1280, map: 2048 }

/** Width and height that fit inside max on the longer side, never upscaled. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export async function shrinkImage(file: File, kind: 'image' | 'map'): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("That image couldn't be read.") })
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE[kind])
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  // JPEG has no transparency; parchment white reads better than black behind a cut-out map.
  ctx.fillStyle = '#fffdf8'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', kind === 'map' ? 0.85 : 0.8)
}
