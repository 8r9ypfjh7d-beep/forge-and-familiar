import { installRadioGroupKeys } from './keyboard'
import { applyToDocument, getSettings } from './settings'
import './a11y.css'

// Apply saved settings before the first paint, and wire arrow keys for every radio group.
if (typeof document !== 'undefined') {
  applyToDocument(getSettings())
  installRadioGroupKeys()
}

export { announce } from './announce'
export * from './settings'
export { isTypingTarget, nextRadioIndex, shortcutKey } from './keyboard'
