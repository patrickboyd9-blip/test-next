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
   * True only on staging, with C2M_EDDM_SUBMIT=true and credentials.
   * Production never turns this on. Full-service Every Door does not need
   * the customer's USPS account id.
   */
  eddmSubmitEnabled: boolean
  /** True when staging or production credentials are set. The values stay on the server. */
  eddmAccountConfigured: boolean
  /**
   * True when this order is allowed to leave for Click2Mail.
   * The page also turns this on when the campaign itself is marked paid.
   */
  eddmPaymentCleared: boolean
}
