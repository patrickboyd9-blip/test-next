import type { PostcardPostageRates } from "./cost"

/** Safe to import from client components. No credentials and no environment reads. */
export interface PrintMailMode {
  environment: "stage" | "prod"
  /** True only when C2M_ENV=prod and C2M_ALLOW_PRODUCTION=true. */
  productionEnabled: boolean
  credentialsConfigured: boolean
  /** First Class postcard postage used for the estimate on this server. */
  postage: PostcardPostageRates
  /**
   * True only on staging, with C2M_EDDM_SUBMIT=true, credentials, and a USPS
   * account id. Production never turns this on.
   */
  eddmSubmitEnabled: boolean
  /** True when C2M_EDDM_CRID is set. The id itself stays on the server. */
  eddmAccountConfigured: boolean
}
