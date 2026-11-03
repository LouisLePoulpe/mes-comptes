// Firebase Auth reloads the persisted user before notifying auth listeners.
// Bound only that startup lookup/token refresh; a network timeout makes the SDK
// retain its persisted session. Sign-in/reauthentication are never intercepted.
export function limitStartupAuthRequests(apiKey, emulatorOrigin, timeoutMs = 500) {
  const original = globalThis.fetch
  const wrapped = async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url || input.href, globalThis.location?.href)
    const allowedOrigin = ['https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', emulatorOrigin].includes(url.origin)
    const startupEndpoint = url.pathname.endsWith('/accounts:lookup') || url.pathname.endsWith('/token')
    if (!allowedOrigin || !startupEndpoint || url.searchParams.get('key') !== apiKey) return original(input, options)
    // The device itself reports no network: fail at once instead of waiting for
    // the deadline. The SDK treats this like any network error and keeps the session.
    if (globalThis.navigator?.onLine === false) throw new TypeError('Failed to fetch')
    const controller = new AbortController()
    const signal = options?.signal || input?.signal
    const cancel = () => controller.abort()
    if (signal?.aborted) cancel()
    signal?.addEventListener('abort', cancel, { once: true })
    const timer = setTimeout(cancel, timeoutMs)
    try { return await original(input, { ...options, signal: controller.signal }) }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel) }
  }
  globalThis.fetch = wrapped
  return () => { if (globalThis.fetch === wrapped) globalThis.fetch = original }
}
