import type { BusinessInfo } from "@/lib/campaign-creator/types"

import type { ReturnAddress } from "./types"

/** Return address Click2Mail prints from the campaign's business basics. */
export function returnAddressFromBusiness(info: BusinessInfo | undefined): ReturnAddress {
  const name = info?.name?.trim() || "Modern Mail Test"
  const address: ReturnAddress = { rtnOrganization: name.slice(0, 80) }
  const street = info?.street?.trim()
  const city = info?.city?.trim()
  const state = info?.state?.trim()
  const postalCode = info?.postalCode?.trim()
  if (street) address.rtnaddress1 = street.slice(0, 64)
  if (city) address.rtnCity = city.slice(0, 40)
  if (state) address.rtnState = state.slice(0, 2)
  if (postalCode) address.rtnZip = postalCode.slice(0, 10)
  return address
}
