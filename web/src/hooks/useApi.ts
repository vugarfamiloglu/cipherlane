import { useEffect, useRef, useState } from 'react'

interface State<T> { data: T | null; error: string | null; loading: boolean }

/**
 * useResource loads async data, tracks loading/error, and exposes reload().
 * Pass a stable dependency list; changing it (or calling reload) refetches.
 */
export function useResource<T>(fn: () => Promise<T>, deps: unknown[] = []): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true })
  const [nonce, setNonce] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    fnRef.current()
      .then((d) => alive && setState({ data: d, error: null, loading: false }))
      .catch((e) => alive && setState({ data: null, error: e?.message ?? 'Error', loading: false }))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { ...state, reload: () => setNonce((n) => n + 1) }
}
