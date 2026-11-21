/** Customer-facing lines for a photo edit. No vendor, prompt, or price. */

export const PHOTO_EDITING = "The photo is being edited."
export const PHOTO_EDITED = "Here is the edited photo."
export const PHOTO_EDIT_PAUSED = "Photo editing is paused for now. Try again next month."
export const PHOTO_EDIT_DAILY = "You've made enough photo edits for today. Try again tomorrow."
export const PHOTO_EDIT_UNAVAILABLE = "Photo editing is not available right now."
export const PHOTO_EDIT_FAILED = "That photo could not be edited. Try a different request."
export const PHOTO_EDIT_SIGN_IN = "Sign in required."
export const PHOTO_EDIT_NEED_WORDS = "Tell us what to change."
export const PHOTO_EDIT_NEED_PHOTO = "Choose a photo to edit."
export const PHOTO_EDIT_TOO_LARGE = "That photo is too large to edit."
export const PHOTO_KEPT = "Kept."
export const PHOTO_ORIGINAL = "The original photo is back."
export const PHOTO_SAVE_FAILED = "That photo could not be saved."

export const CUSTOMER_PHOTO_MESSAGES = [
  PHOTO_EDITING,
  PHOTO_EDITED,
  PHOTO_EDIT_PAUSED,
  PHOTO_EDIT_DAILY,
  PHOTO_EDIT_UNAVAILABLE,
  PHOTO_EDIT_FAILED,
  PHOTO_EDIT_SIGN_IN,
  PHOTO_EDIT_NEED_WORDS,
  PHOTO_EDIT_NEED_PHOTO,
  PHOTO_EDIT_TOO_LARGE,
  PHOTO_KEPT,
  PHOTO_ORIGINAL,
  PHOTO_SAVE_FAILED,
] as const
