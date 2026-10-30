import { useEffect, useState } from 'react'
import { loadKind, type Monster } from '../../content'

/** Monster stat blocks by "source:id", for rows that came from the library. */
export function useMonsterIndex(): Map<string, Monster> {
  const [index, setIndex] = useState(() => new Map<string, Monster>())
  useEffect(() => {
    let live = true
    loadKind('monsters').then(list => { if (live) setIndex(new Map(list.map(m => [`${m.source}:${m.id}`, m]))) }).catch(() => {})
    return () => { live = false }
  }, [])
  return index
}
