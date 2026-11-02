import { lazy } from 'react'

/** The read-only share page, fetched only when a share link is opened. */
export const LazyShareView = lazy(() => import('./ShareView').then(m => ({ default: m.ShareView })))
