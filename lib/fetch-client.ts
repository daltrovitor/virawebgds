// Lightweight fetch helpers with timeout and better error messages
export const DEFAULT_TIMEOUT = 15000 // 15s

async function fetchWithTimeout(input: RequestInfo, init?: RequestInit, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(input, { signal: controller.signal, ...init })
    return res
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out')
    }
    // Network errors in the browser surface as TypeError: Failed to fetch
    throw new Error(err?.message || 'Failed to fetch')
  } finally {
    clearTimeout(id)
  }
}

export async function fetchJson(input: RequestInfo, init?: RequestInit, timeout = DEFAULT_TIMEOUT) {
  const res = await fetchWithTimeout(input, init, timeout)

  const text = await res.text()
  let payload: any = text
  try {
    payload = text ? JSON.parse(text) : {}
  } catch (e) {
    // not JSON, keep raw text
    payload = text
  }

  if (!res.ok) {
    // prefer structured message
    const msg = payload && (payload.error || payload.message) ? (payload.error || payload.message) : text || res.statusText
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }

  return payload
}

// Return the raw Response for streaming endpoints
export async function fetchRaw(input: RequestInfo, init?: RequestInit, timeout = DEFAULT_TIMEOUT) {
  const res = await fetchWithTimeout(input, init, timeout)
  if (!res.ok) {
    // try to read error body
    const text = await res.text().catch(() => '')
    let parsed: any = text
    try { parsed = text ? JSON.parse(text) : {} } catch (_) {}
    const msg = parsed && (parsed.error || parsed.message) ? (parsed.error || parsed.message) : text || res.statusText
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return res
}

export default fetchJson
