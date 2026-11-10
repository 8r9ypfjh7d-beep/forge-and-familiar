// One shared "Enter activation code" dialog: any screen can open it instead of telling the player where to find it.
const EVENT = 'ff:activation-prompt'

/** Opens the activation code dialog (mounted once by ActivationPromptHost in App). */
export function openActivationPrompt(): void {
  window.dispatchEvent(new Event(EVENT))
}

export function onActivationPrompt(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}
