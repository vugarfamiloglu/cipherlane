import { confirmModal } from '../components/ui/Modal'
import { toast } from '../components/ui/Toaster'

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

/** Confirm-then-delete with a danger modal, toast, and reload on success. */
export async function confirmDelete(label: string, fn: () => Promise<unknown>, onDone: () => void) {
  const ok = await confirmModal({
    title: `Delete ${label}?`,
    message: 'This action cannot be undone.',
    confirmText: 'Delete',
    tone: 'danger',
  })
  if (!ok) return
  try {
    await fn()
    toast.success(`${label} deleted`)
    onDone()
  } catch (e) {
    toast.error(errMsg(e))
  }
}

/** Fetch an auth-gated endpoint and save the response as a download. */
export async function downloadFile(path: string, filename: string) {
  const res = await fetch(path, { credentials: 'include' })
  if (!res.ok) throw new Error('Download failed')
  saveBlob(await res.blob(), filename)
}

/** Save a text string as a download. */
export function downloadText(text: string, filename: string) {
  saveBlob(new Blob([text], { type: 'text/plain' }), filename)
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
