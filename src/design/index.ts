import './glass.css'
import { installScrollGlass } from './scrollGlass'

// Load once, before the first paint, so bars start at the right opacity.
if (typeof window !== 'undefined') installScrollGlass()

export { EDGE_RANGE, edgeLevel, scrollLevels, installScrollGlass } from './scrollGlass'
