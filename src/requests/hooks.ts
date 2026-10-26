import { useEffect, useState } from 'react'
import { listRequests, onRequestsChanged } from './store'
import type { DmRequest } from './types'

/** Every request on this device, live across tabs. */
export function useRequests(): DmRequest[] | null {
  const [list, setList] = useState<DmRequest[] | null>(null)
  useEffect(() => {
    const load = () => { listRequests().then(setList) }
    load()
    return onRequestsChanged(load)
  }, [])
  return list
}
