import type {
  AudienceDefinition,
  AudienceFilter,
  AudienceListType,
  AudienceProviderId,
  AudienceProviderState,
} from "@/lib/campaign-creator/types"

/**
 * List providers.
 *
 * None of these call a paid data API. Melissa is a stub until a data vendor
 * is signed. Every Door only names the handoff another step will route.
 * Upload counts names in a file the customer already has.
 */

export const EVERY_DOOR_ROUTE_HOOK = "eddm.routeMap" as const

export interface AudienceResolveInput {
  /** Names parsed from the customer's own file. Omit when no file was read. */
  uploadedRowCount?: number
}

export interface AudienceProviderResult {
  providerId: AudienceProviderId
  status: AudienceProviderState["status"]
  message: string
  count: AudienceProviderState["count"]
  hook?: typeof EVERY_DOOR_ROUTE_HOOK
  /** The spec the caller should keep. Providers do not drop or invent filters. */
  specSaved: true
}

export interface EveryDoorRouteHandoff {
  hook: typeof EVERY_DOOR_ROUTE_HOOK
  geographyLabel?: string
  filters: AudienceFilter[]
  quantityRequested?: number
}

export interface AudienceProvider {
  id: AudienceProviderId
  label: string
  /**
   * Resolve a saved audience. Must not call the network or invent a count.
   */
  resolve(input: AudienceResolveInput): AudienceProviderResult
}

const uploadProvider: AudienceProvider = {
  id: "upload",
  label: "Upload my list",
  resolve(input) {
    if (typeof input.uploadedRowCount === "number" && input.uploadedRowCount > 0) {
      return {
        providerId: "upload",
        status: "file_counted",
        message: `Your file has ${input.uploadedRowCount.toLocaleString("en-US")} names. That count is from the file, not an estimate.`,
        count: { kind: "from_upload", value: input.uploadedRowCount },
        specSaved: true,
      }
    }
    return {
      providerId: "upload",
      status: "needs_upload",
      message: "Upload your list on the audience step. We won't guess how many names are in it.",
      count: "unavailable",
      specSaved: true,
    }
  },
}

const everyDoorProvider: AudienceProvider = {
  id: "every_door",
  label: "Every Door",
  resolve() {
    return {
      providerId: "every_door",
      status: "route_to_eddm",
      message:
        "Every Door uses carrier routes. The route map isn't connected on this screen yet. This audience is saved for it.",
      count: "unavailable",
      hook: EVERY_DOOR_ROUTE_HOOK,
      specSaved: true,
    }
  },
}

const melissaProvider: AudienceProvider = {
  id: "melissa",
  label: "Melissa",
  resolve() {
    return {
      providerId: "melissa",
      status: "coming_soon",
      message: "Data partner coming soon. This audience is saved.",
      count: "unavailable",
      specSaved: true,
    }
  },
}

const PROVIDERS: Record<AudienceProviderId, AudienceProvider> = {
  upload: uploadProvider,
  every_door: everyDoorProvider,
  melissa: melissaProvider,
}

export function getAudienceProvider(id: AudienceProviderId): AudienceProvider {
  return PROVIDERS[id]
}

export function providerIdForListType(
  listType: AudienceListType,
  explicit?: AudienceProviderId
): AudienceProviderId {
  if (explicit === "upload") return "upload"
  if (listType === "every_door") return "every_door"
  if (listType === "house") return "upload"
  return "melissa"
}

export function providerStateFor(
  listType: AudienceListType | undefined,
  input: AudienceResolveInput = {},
  explicit?: AudienceProviderId
): AudienceProviderState | undefined {
  if (!listType && !explicit) return undefined
  const id = explicit ?? providerIdForListType(listType ?? "prospect")
  const result = getAudienceProvider(id).resolve(
    id === "upload" ? input : {}
  )
  return {
    id: result.providerId,
    status: result.status,
    message: result.message,
    count: result.count,
    hook: result.hook,
  }
}

/** Handoff for the route-map work. Does not build a map or a household count. */
export function everyDoorRouteHandoff(
  audience: AudienceDefinition | undefined
): EveryDoorRouteHandoff {
  return {
    hook: EVERY_DOOR_ROUTE_HOOK,
    geographyLabel: audience?.geography?.label,
    filters: audience?.filters ?? [],
    quantityRequested:
      audience?.quantityKind === "requested" ? audience.quantity : undefined,
  }
}
