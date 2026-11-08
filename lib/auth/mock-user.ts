/**
 * The app no longer treats a hard-coded person as signed in.
 * The session lives in ./session.ts and fails closed until a provider is configured.
 * AUTH_MODE=dev-fixture is a local-only stand-in and does not run in production.
 */
