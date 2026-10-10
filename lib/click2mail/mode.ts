/** Safe to import from client components. No credentials and no environment reads. */
export interface PrintMailMode {
  environment: "stage" | "prod"
  /** True only when C2M_ENV=prod and C2M_ALLOW_PRODUCTION=true. */
  productionEnabled: boolean
  credentialsConfigured: boolean
}
