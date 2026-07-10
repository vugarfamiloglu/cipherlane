// Package models defines the persistent domain entities and API DTOs shared by
// the Cipherlane control plane. Timestamps are unix seconds; public IDs are
// prefixed random hex so they read well in URLs and logs.
package models

// Site is a network location: HQ, branch, datacenter, or a cloud VPC.
type Site struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Code       string `json:"code"`
	Kind       string `json:"kind"` // hq | branch | datacenter | cloud
	Location   string `json:"location"`
	SubnetCIDR string `json:"subnetCidr"`
	Status     string `json:"status"` // online | degraded | offline
	CreatedAt  int64  `json:"createdAt"`
	UpdatedAt  int64  `json:"updatedAt"`

	Gateways    []Gateway `json:"gateways,omitempty"`
	TunnelCount int       `json:"tunnelCount"`
}

// Gateway is the VPN endpoint that terminates tunnels for a site.
type Gateway struct {
	ID        string `json:"id"`
	SiteID    string `json:"siteId"`
	Name      string `json:"name"`
	Endpoint  string `json:"endpoint"` // public host:port
	WANIP     string `json:"wanIp"`
	Protocol  string `json:"protocol"` // wireguard | ipsec
	Version   string `json:"version"`
	Status    string `json:"status"`
	LastSeen  int64  `json:"lastSeen"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

// Tunnel is an encrypted link between two sites (a site may be a cloud VPC).
type Tunnel struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	ASiteID    string  `json:"aSiteId"`
	BSiteID    string  `json:"bSiteId"`
	ASiteName  string  `json:"aSiteName"`
	BSiteName  string  `json:"bSiteName"`
	Protocol   string  `json:"protocol"` // wireguard | ipsec
	Cipher     string  `json:"cipher"`
	AuthMethod string  `json:"authMethod"` // psk | certificate
	Routing    string  `json:"routing"`    // static | bgp | ospf
	AlwaysOn   bool    `json:"alwaysOn"`
	Status     string  `json:"status"` // up | rekeying | down
	MTU        int     `json:"mtu"`
	CreatedAt  int64   `json:"createdAt"`
	UpdatedAt  int64   `json:"updatedAt"`
	Routes     []Route `json:"routes,omitempty"`
	Live       *TunnelLive `json:"live,omitempty"`
}

// Route is an advertised subnet carried over a tunnel.
type Route struct {
	ID       string `json:"id"`
	TunnelID string `json:"tunnelId"`
	CIDR     string `json:"cidr"`
	Kind     string `json:"kind"` // static | bgp | ospf
}

// TunnelLive is the in-memory telemetry snapshot for a tunnel.
type TunnelLive struct {
	Status        string  `json:"status"`
	RxMbps        float64 `json:"rxMbps"`
	TxMbps        float64 `json:"txMbps"`
	LatencyMs     float64 `json:"latencyMs"`
	LossPct       float64 `json:"lossPct"`
	HandshakeAgeS int     `json:"handshakeAgeS"`
	RekeyInS      int     `json:"rekeyInS"`
}

// User is a remote-access account.
type User struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	Username    string `json:"username"`
	Role        string `json:"role"`  // admin | operator | auditor | member
	Group       string `json:"group"`
	Status      string `json:"status"` // active | suspended
	TunnelMode  string `json:"tunnelMode"` // split | full
	CorporateIP string `json:"corporateIp"`
	MFAEnabled  bool   `json:"mfaEnabled"`
	CreatedAt   int64  `json:"createdAt"`
	UpdatedAt   int64  `json:"updatedAt"`
	Devices     []Device  `json:"devices,omitempty"`
	Sessions    []Session `json:"sessions,omitempty"`
}

// Device is an enrolled endpoint owned by a user.
type Device struct {
	ID            string `json:"id"`
	UserID        string `json:"userId"`
	Name          string `json:"name"`
	Platform      string `json:"platform"` // windows | macos | linux | android | ios
	PublicKey     string `json:"publicKey"`
	LastHandshake int64  `json:"lastHandshake"`
	Status        string `json:"status"`
	CreatedAt     int64  `json:"createdAt"`
}

// Session is a live remote-access connection.
type Session struct {
	ID         string  `json:"id"`
	UserID     string  `json:"userId"`
	UserName   string  `json:"userName"`
	DeviceID   string  `json:"deviceId"`
	DeviceName string  `json:"deviceName"`
	ClientIP   string  `json:"clientIp"`
	AssignedIP string  `json:"assignedIp"`
	Location   string  `json:"location"`
	Status     string  `json:"status"` // connected | idle
	StartedAt  int64   `json:"startedAt"`
	RxMbps     float64 `json:"rxMbps"`
	TxMbps     float64 `json:"txMbps"`
}

// Resource is an internal asset reachable over the VPN.
type Resource struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Kind      string `json:"kind"` // rdp | ssh | db | web | mail | printer | file | ad | erp | nas | backup
	Host      string `json:"host"`
	Port      int    `json:"port"`
	SiteID    string `json:"siteId"`
	SiteName  string `json:"siteName"`
	CreatedAt int64  `json:"createdAt"`
}

// Policy binds a group to a resource with an allow/deny action.
type Policy struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Group        string `json:"group"`
	ResourceID   string `json:"resourceId"`
	ResourceName string `json:"resourceName"`
	Action       string `json:"action"` // allow | deny
	CreatedAt    int64  `json:"createdAt"`
}

// CloudConnector holds provider metadata for a cloud-VPC site.
type CloudConnector struct {
	ID        string `json:"id"`
	SiteID    string `json:"siteId"`
	SiteName  string `json:"siteName"`
	Provider  string `json:"provider"` // aws | azure | gcp
	Region    string `json:"region"`
	VPCID     string `json:"vpcId"`
	Status    string `json:"status"`
	CreatedAt int64  `json:"createdAt"`
}

// Certificate is a PKI object managed by the built-in CA.
type Certificate struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Kind        string `json:"kind"` // ca | server | client
	Subject     string `json:"subject"`
	Fingerprint string `json:"fingerprint"`
	Status      string `json:"status"` // valid | revoked | expired
	NotAfter    int64  `json:"notAfter"`
	CreatedAt   int64  `json:"createdAt"`
}

// AuditEvent records a control-plane mutation.
type AuditEvent struct {
	ID        string `json:"id"`
	Actor     string `json:"actor"`
	Action    string `json:"action"`
	Target    string `json:"target"`
	IP        string `json:"ip"`
	CreatedAt int64  `json:"createdAt"`
}

// Alert is an operational notification.
type Alert struct {
	ID        string `json:"id"`
	Severity  string `json:"severity"` // info | warning | critical
	Title     string `json:"title"`
	Detail    string `json:"detail"`
	Source    string `json:"source"`
	Status    string `json:"status"` // open | resolved
	CreatedAt int64  `json:"createdAt"`
}
