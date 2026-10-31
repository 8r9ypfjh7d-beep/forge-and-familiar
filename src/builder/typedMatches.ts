// The check behind TypedConfirmDialog (ConfirmDialog.tsx), kept apart so the dialog file only exports components.
/** Whether the typed text matches the phrase, ignoring case and spaces at either end. */
export const typedMatches = (typed: string, phrase: string) => typed.trim().toLocaleLowerCase() === phrase.trim().toLocaleLowerCase() && !!phrase.trim()
