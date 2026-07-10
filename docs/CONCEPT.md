# Cipherlane — Concept & Product Specification

> **Cipherlane** is a modern VPN orchestration & monitoring platform (a *control plane*)
> for building, managing, and observing **Site-to-Site** and **Remote Access** VPNs from
> one beautiful console.
>
> The name = **Cipher** (the AES-256 / IPsec / WireGuard encryption at its core) +
> **lane** (the private, always-open, encrypted lane your traffic travels — between
> offices and from any device back to the corporate network).

---

## 1. Positioning & scope

Cipherlane is **not** a from-scratch cryptographic stack. It is the *management brain* that
sits on top of proven VPN data-plane technologies and makes them usable, observable, and
policy-driven:

- It **models** an organization's network: sites, gateways, subnets, users, devices,
  resources, and policies.
- It **generates** real, deployable configurations for **WireGuard** and **IPsec/IKEv2
  (strongSwan)** endpoints.
- It **observes** every tunnel in real time — handshakes, rekeys, throughput, latency,
  packet loss, session state — and streams it to the dashboard over WebSocket.
- It **enforces** who can reach what (access policies, split vs full tunnel, RBAC).

**Reality levels** (selectable per deployment):

1. **Orchestration + Simulation (default, fully shippable):** Cipherlane generates real
   configs and runs an internal *network engine* that produces realistic live telemetry.
   The whole product is demonstrable end-to-end without touching the host OS.
2. **Real integration (optional):** a lightweight agent on a Linux gateway applies the
   generated config via `wg` / `ipsec` and reports true interface counters back.

This keeps the product safe, portable, and demo-able, while leaving a clean path to real
enforcement.

---

## 2. Architecture — three planes

```
                    ┌─────────────────────────────┐
                    │   CIPHERLANE CONTROL PLANE   │  Go API + WebSocket
                    │  API · Vault · Policy · Live │  SQLite (WAL)
                    └──────────────┬──────────────┘
             config / telemetry    │   management
        ┌──────────────┬───────────┴───────────┬──────────────┐
        ▼              ▼                        ▼              ▼
   Site A GW      Site B GW               Cloud VPC        Remote devices
  (WireGuard/    (WireGuard/             (AWS/Azure/       (WG / IKEv2
   IPsec)         IPsec)                  GCP gateway)      clients + MFA)
        └───────── encrypted tunnels (AES-256 / ChaCha20) ──────────┘
```

- **Control plane** — the Cipherlane server (Go). Stores state, exposes REST + WebSocket,
  generates configs, enforces policy, keeps the audit log, and holds the encrypted vault
  (private keys, certificates, PSKs).
- **Data plane** — the actual VPN endpoints: office gateways (site-to-site) and user
  devices (remote access). Managed via generated configs / optional agents.
- **Presentation** — the React dashboard: topology map, live telemetry, wizards, tables,
  policy editors.

---

## 3. Site-to-Site module

Connects two or more LANs into one private overlay network over the internet. Tunnels are
established by **gateways** (routers / firewalls), not by end users.

**Core objects:** `Site` → has one `Gateway` + one or more `Subnet`s + attached `Resource`s.
A `Tunnel` joins two gateway endpoints.

**Tunnel wizard flow:**

1. Pick endpoint A and endpoint B (two sites, or a site and a cloud VPC).
2. Choose protocol: **IPsec/IKEv2** or **WireGuard**.
3. Choose cipher suite: **AES-256-GCM** (IPsec) or **ChaCha20-Poly1305** (WireGuard).
4. Choose auth: **Pre-Shared Key** or **certificate** (from the built-in CA).
5. Choose routing: **static routes** (declare remote subnets) or **dynamic (BGP/OSPF)**.
6. Toggle **Always-On** (auto-reconnect + dead-peer detection).
7. Cipherlane generates a deployable config per gateway + a copy/QR/download.

**What it delivers (mapped to the brief):**

| Capability | How Cipherlane represents it |
|---|---|
| Securely connect 2+ offices | Sites + tunnels on the topology map |
| Encrypted branch-to-branch data | AES-256-GCM / ChaCha20 tunnels |
| Private overlay over the internet | Overlay subnet plan + route table |
| Reach remote file servers / NAS | `Resource` objects (type: file/NAS) exposed across tunnels |
| Share Active Directory between branches | AD `Resource` + allowed subnets |
| ERP / CRM reachable everywhere | Internal-app `Resource`s attached to sites |
| Central printers / shared resources | Printer/device `Resource`s |
| Centralized backup | Backup `Resource` + routing rule |
| IPsec / SSL tunnels | Protocol selector (IPsec/IKEv2, WireGuard) |
| Strong AES encryption | Cipher-suite selector |
| Confidentiality + integrity | GCM/Poly1305 AEAD + integrity status per tunnel |
| Static + dynamic routing | Route table editor (static / BGP / OSPF) |
| Cloud (AWS/Azure/GCP) links | Cloud Connectors with native config templates |
| Always-On VPN | Always-On flag + auto-reconnect telemetry |

---

## 4. Remote Access module

Lets individual users connect their laptop/phone/tablet securely into the corporate
network from anywhere.

**Core objects:** `User` → belongs to `Group`s → owns `Device`s → opens `Session`s.
Access is governed by `Policy` rules pointing at `Resource`s.

**Onboarding flow:**

1. Create a user (or import a group).
2. Assign an access policy + an IP from the corporate pool.
3. Enroll a device → Cipherlane issues a per-device config (WireGuard `.conf` or IKEv2
   profile) with a **QR code** for mobile.
4. User connects; the session appears live in the console.

**What it delivers (mapped to the brief):**

| Capability | How Cipherlane represents it |
|---|---|
| Work-from-home access | Users + devices + live sessions |
| Access internal systems from anywhere | Resource catalog + policies |
| Remote file-server access | File `Resource` + allow rule |
| Internal web apps | Web-app `Resource`s |
| Secure RDP | RDP `Resource` (host + port) |
| Secure SSH to Linux | SSH `Resource` |
| Databases (MySQL/PostgreSQL/SQL Server) | DB `Resource`s with per-group rules |
| Corporate email | Mail `Resource` |
| Printers / local resources | Printer/device `Resource`s |
| Username/password, certificate, MFA | Auth methods per user (password + client cert + TOTP) |
| Full vs split tunnel | Per-user/group tunnel-mode selector |
| Public-Wi-Fi protection | "Encrypt-everywhere" indicator on full tunnel |
| Appear as corporate IP | Corporate IP pool assignment |
| Central activity monitoring | Live Sessions page + audit log + force-disconnect |
| Multi-OS clients | Config export for Windows / macOS / Linux / Android / iOS |

---

## 5. Dashboard & pages

The console is a **left sidebar + sticky top bar + workbench** shell (collapsible sidebar,
sticky header, dark + light). Signature live element in the top bar: a **global throughput
ticker** + active-tunnel pulse.

1. **Overview** — hero KPIs (active tunnels, online users, live throughput, open alerts),
   live global topology mini-map, real-time throughput chart, tunnel-health heatmap,
   recent events.
2. **Topology / Network Map** — interactive node-graph (sites, gateways, cloud, remote
   clusters); edges colored by health; click a node/edge for a live detail drawer.
3. **Sites** — list + rich detail page (subnets, gateway, resources, tunnels, live status).
4. **Tunnels (Site-to-Site)** — resizeable table (status, protocol, cipher, throughput
   sparkline); detail page with handshake/rekey timeline, throughput & latency charts,
   route table, config export, live logs.
5. **Users (Remote Access)** — list + detailed profile page (devices, policy, MFA,
   sessions, bandwidth); enroll-device with QR.
6. **Sessions** — live sessions table + map + force-disconnect (ConfirmModal).
7. **Resources & Policies** — define internal resources (RDP/SSH/DB/web/mail/printer) and
   build allow rules (who → what), split/full tunnel per group.
8. **Gateways / Devices** — managed endpoints, health, versions, key rotation.
9. **Cloud Connectors** — AWS / Azure / GCP integrations + generated configs.
10. **Vault (Certificates & Keys)** — CA, issue/revoke certs, WireGuard keypairs, PSKs,
    rotation — all behind the AES-256-GCM vault, with audited reveal.
11. **Monitoring / Logs** — in-app live log monitor + audit trail + alerts.
12. **Analytics / Reports** — bandwidth over time, top talkers, uptime/SLA; export PDF/CSV.
13. **Settings** — auth (admin passcode + MFA), RBAC roles, org profile, theme,
    backup/restore.
14. **Auth** — passcode + MFA login, HMAC session cookie.

**Recurring UI patterns:** resizeable table columns, hover-rich charts, ConfirmModal /
PromptModal for destructive & input actions, password show/hide on every secret field,
in-app log monitor, detailed profile pages, full-screen animated dashboard cards
(staggered entrance + hover lift, reduced-motion-safe), distinct chart designs per surface.

---

## 6. Security model

- **AES-256-GCM vault** for private keys / certificates / PSKs at rest; vault key at
  `data/.vault-key` (0600) or env-provided.
- **bcrypt passcode + Web-Crypto HMAC session cookie**; **TOTP MFA** for admin.
- **RBAC** roles: owner / admin / operator / auditor.
- **Full audit log** — every mutation recorded (who, what, when, from where).
- **Parameterized SQLite** everywhere; strict input validation at boundaries; rate limiting
  on auth endpoints; secrets never in source (vault + env).
- Security headers / CSP on the served console.

---

## 7. Data model (primary entities)

`Site`, `Gateway`, `Subnet`, `Tunnel`, `Route`, `User`, `Group`, `Device`, `Session`,
`Resource`, `Policy`, `Certificate`, `Key`, `CloudConnector`, `AuditEvent`, `Alert`,
`Metric` (time-series). All tables carry `created_at` / `updated_at` and a public ULID.

---

## 8. Technology stack

- **Backend / control plane:** Go (`net/http` + chi router + gorilla/websocket), SQLite
  (WAL). Chosen because a VPN control plane is a networking product — Go interfaces
  cleanly with `wg` / `ipsec` and streams telemetry efficiently.
- **Frontend / console:** React 19 + Vite + TypeScript, a design-token CSS system, Recharts
  / visx for telemetry, a custom canvas/WebGL topology map, Framer Motion for the shell.
- **Realtime:** WebSocket telemetry channel.
- **VPN layer:** real WireGuard + IPsec/strongSwan config generation; internal network
  engine for live metrics (simulation mode) + optional real gateway agent.
- **Dev port:** `7820` (a nod to WireGuard's 51820).

---

## 9. Roadmap (phased)

- **P0** — scaffold, design system, app shell (sidebar + topbar + workbench), theming.
- **P1** — auth + vault + RBAC + audit log.
- **P2** — sites / gateways / subnets + interactive topology map.
- **P3** — site-to-site tunnels + config generation + live telemetry engine.
- **P4** — remote-access users / devices / sessions + resources & policies + QR enrollment.
- **P5** — cloud connectors (AWS / Azure / GCP).
- **P6** — monitoring / logs / analytics / reports.
- **P7** — polish, tests (80%+), full README + docs.

---

## 10. Non-goals

- Not a consumer "hide-my-IP" proxy or a censorship-circumvention tool.
- Does not reimplement cryptographic primitives — it orchestrates vetted VPN stacks.
- Not tied to one OS — the control plane is portable; enforcement is delegated to gateways.
