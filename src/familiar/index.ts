// The Familiar: in-app AI assistant (Gemini through the `familiar` Supabase Edge Function). See FAMILIAR.md.
import './tools/content'
import './tools/dm'

export * from './types'
export { edgeTransport, functionUrl, mergeChunks, parseSse, type FamiliarTransport } from './api'
export { MAX_HISTORY, MAX_TOOL_ROUNDS, runTurn, textOf, trimHistory, type TurnEvents, type TurnResult } from './chat'
export { characterCard } from './context'
export { systemInstruction, type PromptInput } from './prompt'
export { declarations, getTool, registerTool, runTool, type ToolData, type ToolDef, type ToolEnv } from './tools/registry'
export { sourceNote } from './tools/content'
export { MAX_THREADS, deleteThread, getThread, listThreads, newThread, saveTurn, titleFor } from './store'
export { checkEncounter, dmAllowed, findMonster, monsterBlock, partyMember, type DmToolData, type EncounterCheck } from './tools/dm'
export { DM_CHIPS, dmCard, dmToolData, loadCampaignCharacters, type DmCardInput } from './dm'
