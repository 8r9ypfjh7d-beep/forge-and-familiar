// React side of screen.ts: screens publish what they show; the panel and the entry buttons read it.
import { useEffect, useSyncExternalStore } from 'react'
import { familiarAvailable, getFamiliarScreen, setFamiliarScreen, subscribeFamiliarAvailable, subscribeFamiliarScreen, type FamiliarScreen } from '../screen'

/** Publishes `screen` while the component is mounted (null publishes nothing). Pass a memoized object. */
export function useFamiliarScreen(screen: FamiliarScreen | null): void {
  useEffect(() => (screen ? setFamiliarScreen(screen) : undefined), [screen])
}

/** What is on screen now, for the panel. */
export const useFamiliarScreenValue = () => useSyncExternalStore(subscribeFamiliarScreen, getFamiliarScreen, getFamiliarScreen)

/** Whether a panel is mounted to answer askFamiliar. */
export const useFamiliarAvailable = () => useSyncExternalStore(subscribeFamiliarAvailable, familiarAvailable, familiarAvailable)
