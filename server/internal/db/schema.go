package db

// schema is applied on every boot; every statement is CREATE ... IF NOT EXISTS
// so it doubles as a lightweight migration baseline.
const schema = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  location    TEXT NOT NULL DEFAULT '',
  subnet_cidr TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'online',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gateways (
  id         TEXT PRIMARY KEY,
  site_id    TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  endpoint   TEXT NOT NULL DEFAULT '',
  wan_ip     TEXT NOT NULL DEFAULT '',
  protocol   TEXT NOT NULL DEFAULT 'wireguard',
  version    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'online',
  last_seen  INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gateways_site ON gateways(site_id);

CREATE TABLE IF NOT EXISTS tunnels (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  a_site_id   TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  b_site_id   TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  protocol    TEXT NOT NULL DEFAULT 'wireguard',
  cipher      TEXT NOT NULL DEFAULT 'chacha20-poly1305',
  auth_method TEXT NOT NULL DEFAULT 'psk',
  routing     TEXT NOT NULL DEFAULT 'static',
  always_on   INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'up',
  mtu         INTEGER NOT NULL DEFAULT 1420,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS routes (
  id        TEXT PRIMARY KEY,
  tunnel_id TEXT NOT NULL REFERENCES tunnels(id) ON DELETE CASCADE,
  cidr      TEXT NOT NULL,
  kind      TEXT NOT NULL DEFAULT 'static'
);
CREATE INDEX IF NOT EXISTS idx_routes_tunnel ON routes(tunnel_id);

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL DEFAULT '',
  username     TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT 'member',
  group_name   TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'active',
  tunnel_mode  TEXT NOT NULL DEFAULT 'split',
  corporate_ip TEXT NOT NULL DEFAULT '',
  mfa_enabled  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  platform       TEXT NOT NULL DEFAULT 'windows',
  public_key     TEXT NOT NULL DEFAULT '',
  last_handshake INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id   TEXT NOT NULL DEFAULT '',
  client_ip   TEXT NOT NULL DEFAULT '',
  assigned_ip TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'connected',
  started_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS resources (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL,
  host       TEXT NOT NULL DEFAULT '',
  port       INTEGER NOT NULL DEFAULT 0,
  site_id    TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS policies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  group_name  TEXT NOT NULL DEFAULT '',
  resource_id TEXT NOT NULL DEFAULT '',
  action      TEXT NOT NULL DEFAULT 'allow',
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cloud_connectors (
  id         TEXT PRIMARY KEY,
  site_id    TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  provider   TEXT NOT NULL,
  region     TEXT NOT NULL DEFAULT '',
  vpc_id     TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'connected',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS certificates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  subject     TEXT NOT NULL DEFAULT '',
  fingerprint TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'valid',
  not_after   INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS keys (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  kind             TEXT NOT NULL,
  public_material  TEXT NOT NULL DEFAULT '',
  secret_encrypted TEXT NOT NULL DEFAULT '',
  created_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id         TEXT PRIMARY KEY,
  actor      TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL DEFAULT '',
  target     TEXT NOT NULL DEFAULT '',
  ip         TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id         TEXT PRIMARY KEY,
  severity   TEXT NOT NULL DEFAULT 'info',
  title      TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);
`
