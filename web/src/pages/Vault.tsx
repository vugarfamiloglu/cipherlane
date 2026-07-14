import { useState } from 'react'
import { api } from '../lib/api'
import { useResource } from '../hooks/useApi'
import { PageHead, Loading, ErrorNote } from '../components/ui/Page'
import { DataTable, type Column } from '../components/ui/DataTable'
import { Card, Badge, StatusBadge, Button } from '../components/ui/primitives'
import { FormModal } from '../components/ui/FormModal'
import { Modal, confirmModal } from '../components/ui/Modal'
import { Icon } from '../components/ui/Icon'
import { fmtDate } from '../lib/format'
import { toast } from '../components/ui/Toaster'
import { confirmDelete, errMsg, downloadText } from '../lib/ui'
import type { Certificate, KeyItem } from '../lib/types'

export function Vault() {
  const certs = useResource(() => api.certificates(), [])
  const keys = useResource(() => api.keys(), [])
  const [issuing, setIssuing] = useState(false)
  const [genKey, setGenKey] = useState(false)
  const [reveal, setReveal] = useState<{ name: string; secret: string } | null>(null)
  const [issued, setIssued] = useState<{ name: string; pem: string } | null>(null)

  if (certs.loading && !certs.data) return <Loading label="Opening vault…" />
  if (certs.error) return <ErrorNote message={certs.error} onRetry={certs.reload} />

  const doReveal = async (k: KeyItem) => {
    const ok = await confirmModal({ title: 'Reveal sealed secret?', message: `Revealing “${k.name}” is recorded in the audit log.`, confirmText: 'Reveal' })
    if (!ok) return
    try { const r = await api.revealKey(k.id); setReveal({ name: k.name, secret: r.secret }) } catch (e) { toast.error(errMsg(e)) }
  }
  const revoke = async (c: Certificate) => {
    const ok = await confirmModal({ title: `Revoke ${c.name}?`, message: 'The certificate will be marked revoked.', confirmText: 'Revoke', tone: 'danger' })
    if (!ok) return
    try { await api.revokeCert(c.id); toast.success('Certificate revoked'); certs.reload() } catch (e) { toast.error(errMsg(e)) }
  }

  const certCols: Column<Certificate>[] = [
    { key: 'name', header: 'Certificate', width: 190, render: (c) => (<div className="row gap-2"><span className="res-ic"><Icon name="shield" size={15} /></span><span className="cell-strong">{c.name}</span></div>) },
    { key: 'kind', header: 'Kind', width: 96, render: (c) => <Badge>{c.kind}</Badge> },
    { key: 'subject', header: 'Subject', width: 200, mono: true },
    { key: 'fingerprint', header: 'Fingerprint', width: 190, mono: true },
    { key: 'status', header: 'Status', width: 104, render: (c) => <StatusBadge status={c.status} /> },
    { key: 'notAfter', header: 'Expires', width: 120, mono: true, render: (c) => fmtDate(c.notAfter) },
    { key: 'act', header: '', width: 96, align: 'right', render: (c) => c.kind === 'ca' ? null : (<div className="row-acts">{c.status === 'valid' && <button className="row-act" title="Revoke" onClick={() => revoke(c)}><Icon name="power" size={15} /></button>}<button className="row-act danger" title="Delete" onClick={() => confirmDelete(c.name, () => api.deleteCert(c.id), certs.reload)}><Icon name="trash" size={15} /></button></div>) },
  ]
  const keyCols: Column<KeyItem>[] = [
    { key: 'name', header: 'Key', width: 190, render: (k) => (<div className="row gap-2"><span className="res-ic"><Icon name="key" size={15} /></span><span className="cell-strong">{k.name}</span></div>) },
    { key: 'kind', header: 'Kind', width: 120, render: (k) => <Badge>{k.kind}</Badge> },
    { key: 'publicMaterial', header: 'Public material', width: 240, mono: true, render: (k) => (k.publicMaterial ? <span className="truncate">{k.publicMaterial}</span> : <span className="u-subtle">—</span>) },
    { key: 'sealed', header: 'Secret', width: 100, render: (k) => <Badge tone={k.sealed ? 'up' : 'idle'}>{k.sealed ? 'sealed' : 'none'}</Badge> },
    { key: 'act', header: '', width: 110, align: 'right', render: (k) => (<div className="row-acts">{k.sealed && <button className="row-act" title="Reveal" onClick={() => doReveal(k)}><Icon name="eye" size={15} /></button>}<button className="row-act danger" title="Delete" onClick={() => confirmDelete(k.name, () => api.deleteKey(k.id), keys.reload)}><Icon name="trash" size={15} /></button></div>) },
  ]

  return (
    <>
      <PageHead title="Vault" desc="Certificates, WireGuard keys, and PSKs — sealed with AES-256-GCM at rest." />

      <Card className="card-pad section-block">
        <div className="card-head"><div className="card-title">Certificates</div><div className="row gap-2"><Badge>{certs.data?.length ?? 0}</Badge><Button size="sm" variant="primary" icon="plus" onClick={() => setIssuing(true)}>Issue certificate</Button></div></div>
        <DataTable columns={certCols} rows={certs.data ?? []} empty="No certificates." />
      </Card>

      <Card className="card-pad section-block">
        <div className="card-head"><div className="card-title">Keys &amp; PSKs</div><div className="row gap-2"><Badge>{keys.data?.length ?? 0}</Badge><Button size="sm" variant="default" icon="plus" onClick={() => setGenKey(true)}>Generate key</Button></div></div>
        <DataTable columns={keyCols} rows={keys.data ?? []} empty="No keys." />
      </Card>

      {issuing && <FormModal title="Issue certificate" submitLabel="Issue" onClose={() => setIssuing(false)}
        onSubmit={async (v) => { const r = await api.issueCert({ name: v.name, subject: v.subject, kind: v.kind, days: Number(v.days) || 365 }); setIssued({ name: v.name, pem: r.certPem }); toast.success('Certificate issued'); certs.reload() }}
        fields={[
          { name: 'name', label: 'Name', required: true, placeholder: 'jane.doe client' },
          { name: 'kind', label: 'Type', type: 'select', options: [{ value: 'client', label: 'Client' }, { value: 'server', label: 'Server' }] },
          { name: 'subject', label: 'Subject (CN)', placeholder: 'CN=jane.doe' },
          { name: 'days', label: 'Valid days', default: '365' },
        ]} />}

      {genKey && <FormModal title="Generate key" submitLabel="Generate" onClose={() => setGenKey(false)}
        onSubmit={async (v) => { await api.generateKey({ name: v.name, kind: v.kind }); toast.success('Key generated'); keys.reload() }}
        fields={[
          { name: 'name', label: 'Key name', required: true, placeholder: 'branch-gw WireGuard' },
          { name: 'kind', label: 'Type', type: 'select', options: [{ value: 'wireguard', label: 'WireGuard keypair' }, { value: 'psk', label: 'Pre-shared key' }] },
        ]} />}

      {issued && <Modal title={`${issued.name} — certificate`} onClose={() => setIssued(null)} wide>
        <pre className="codeblock mono" style={{ maxHeight: 280 }}>{issued.pem}</pre>
        <div className="row gap-2" style={{ marginTop: 'var(--sp-3)' }}>
          <Button size="sm" icon="copy" onClick={() => { navigator.clipboard?.writeText(issued.pem); toast.success('PEM copied') }}>Copy</Button>
          <Button size="sm" variant="default" icon="download" onClick={() => downloadText(issued.pem, `${issued.name}.pem`)}>Download</Button>
        </div>
      </Modal>}

      {reveal && <Modal title={`${reveal.name} — sealed secret`} onClose={() => setReveal(null)}>
        <p className="u-muted" style={{ fontSize: 'var(--fs-sm)' }}>This reveal was recorded in the audit log.</p>
        <div className="mfa-secret mono" style={{ marginTop: 'var(--sp-3)' }}>{reveal.secret}</div>
        <div className="modal-actions"><Button size="sm" icon="copy" onClick={() => { navigator.clipboard?.writeText(reveal.secret); toast.success('Secret copied') }}>Copy</Button></div>
      </Modal>}
    </>
  )
}
