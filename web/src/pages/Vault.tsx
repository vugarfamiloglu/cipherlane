import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { Card, Badge, StatusBadge, Button } from '../components/ui/primitives'
import { Icon } from '../components/ui/Icon'
import { fmtDate } from '../lib/format'
import { confirmModal } from '../components/ui/Modal'
import { toast } from '../components/ui/Toaster'
import type { Certificate, KeyItem } from '../lib/types'

export function Vault() {
  const certs = useResource(() => api.certificates(), [])
  const keys = useResource(() => api.keys(), [])
  if (certs.loading && !certs.data) return <Loading label="Opening vault…" />
  if (certs.error) return <ErrorNote message={certs.error} onRetry={certs.reload} />

  const reveal = async (k: KeyItem) => {
    const ok = await confirmModal({ title: 'Reveal sealed secret?', message: `Revealing “${k.name}” is recorded in the audit log.`, confirmText: 'Reveal' })
    if (ok) toast.info('Reveal recorded · secret remains sealed in this demo')
  }

  const certCols: Column<Certificate>[] = [
    { key: 'name', header: 'Certificate', width: 200, render: (c) => (<div className="row gap-2"><span className="res-ic"><Icon name="shield" size={15} /></span><span className="cell-strong">{c.name}</span></div>) },
    { key: 'kind', header: 'Kind', width: 100, render: (c) => <Badge>{c.kind}</Badge> },
    { key: 'subject', header: 'Subject', width: 220, mono: true },
    { key: 'fingerprint', header: 'Fingerprint', width: 200, mono: true },
    { key: 'status', header: 'Status', width: 110, render: (c) => <StatusBadge status={c.status} /> },
    { key: 'notAfter', header: 'Expires', width: 130, mono: true, render: (c) => fmtDate(c.notAfter) },
  ]
  const keyCols: Column<KeyItem>[] = [
    { key: 'name', header: 'Key', width: 200, render: (k) => (<div className="row gap-2"><span className="res-ic"><Icon name="key" size={15} /></span><span className="cell-strong">{k.name}</span></div>) },
    { key: 'kind', header: 'Kind', width: 120, render: (k) => <Badge>{k.kind}</Badge> },
    { key: 'publicMaterial', header: 'Public material', width: 250, mono: true, render: (k) => (k.publicMaterial ? <span className="truncate">{k.publicMaterial}</span> : <span className="u-subtle">—</span>) },
    { key: 'sealed', header: 'Secret', width: 110, render: (k) => <Badge tone={k.sealed ? 'up' : 'idle'}>{k.sealed ? 'sealed' : 'none'}</Badge> },
    { key: 'act', header: '', width: 108, align: 'right', render: (k) => (k.sealed ? <Button size="sm" variant="ghost" onClick={() => reveal(k)}>Reveal</Button> : null) },
  ]

  return (
    <>
      <PageHead title="Vault" desc="Certificates, WireGuard keys, and PSKs — sealed with AES-256-GCM at rest." />
      <Card className="card-pad section-block">
        <div className="card-head"><div className="card-title">Certificates</div><Badge>{certs.data?.length ?? 0}</Badge></div>
        <DataTable columns={certCols} rows={certs.data ?? []} empty="No certificates." />
      </Card>
      <Card className="card-pad section-block">
        <div className="card-head"><div className="card-title">Keys &amp; PSKs</div><Badge>{keys.data?.length ?? 0}</Badge></div>
        <DataTable columns={keyCols} rows={keys.data ?? []} empty="No keys." />
      </Card>
    </>
  )
}
