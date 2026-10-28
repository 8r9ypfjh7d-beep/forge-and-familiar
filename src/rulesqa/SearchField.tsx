import type { InputHTMLAttributes } from 'react'
import './search-field.css'

/** Capsule glass search field with a magnifier at the start. Takes the usual input props. */
export function SearchField(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className="search-field">
      <svg className="search-icon" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none"
        stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4" />
      </svg>
      <input {...props} type="search" className="search-input" />
    </label>
  )
}
