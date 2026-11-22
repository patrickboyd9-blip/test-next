/** A phone field with only spaces counts as empty. */
export function phoneFieldEmpty(phone: string): boolean {
  return phone.replace(/\s+/g, " ").trim().length === 0
}

/**
 * The front-phone checkbox starts checked once a number is entered.
 * Clearing the number turns it off. A later edit keeps the customer's choice.
 */
export function phoneOnFrontAfterEdit(previousPhone: string, nextPhone: string, wasChecked: boolean): boolean {
  if (phoneFieldEmpty(nextPhone)) return false
  if (phoneFieldEmpty(previousPhone)) return true
  return wasChecked
}
