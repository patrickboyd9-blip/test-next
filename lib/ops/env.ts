/** A partial environment. Production passes process.env. Tests pass a few keys. */
export type EnvBag = Record<string, string | undefined>
