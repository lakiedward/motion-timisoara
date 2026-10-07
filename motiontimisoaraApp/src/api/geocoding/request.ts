export async function geocodingRequest<T>(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  signal?.throwIfAborted()
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: () => void = () => undefined
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => {
      controller.abort(signal?.reason)
      reject(signal?.reason ?? new DOMException('Request cancelled', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('Geocoding request timed out'))
    }, timeoutMs)
  })
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error(`Geocoding ${response.status}`)
        return (await response.json()) as T
      })(),
      interrupted,
    ])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
