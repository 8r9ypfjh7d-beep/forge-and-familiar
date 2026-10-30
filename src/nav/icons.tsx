// Small line icons for the top bar. They inherit the text colour.
import type { NavKey } from './items'

const PATHS: Record<NavKey | 'more', string> = {
  campaigns: 'M5 4h14v16l-7-4-7 4zM9 9h6M9 12h4',
  list: 'M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21c0-4 3.6-7 8-7s8 3 8 7',
  party: 'M9 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 4.5a3 3 0 0 1 0 6M18 14c2.4.6 4 2.8 4 6',
  combat: 'M4 4l9 9M4 4v4M4 4h4M20 4l-9 9M20 4v4M20 4h-4M7 14l3 3M17 14l-3 3M5 19l3-3M19 19l-3-3',
  requests: 'M4 5h16v11H9l-5 4zM9 9h6M9 12h4',
  dm: 'M3 6l9-3 9 3v6c0 5-4 8-9 9-5-1-9-4-9-9zM9 12l2 2 4-4',
  homebrew: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7 15h10',
  rules: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  admin: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
}

export function NavIcon({ name }: { name: NavKey | 'more' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth={name === 'more' ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  )
}
