package db

import "time"

// Seed populates a realistic demo estate on first boot only. It is a no-op once
// any site exists, so restarts never duplicate data.
func Seed(d *DB) error {
	var n int
	_ = d.QueryRow("SELECT COUNT(*) FROM sites").Scan(&n)
	if n > 0 {
		return nil
	}
	now := time.Now().Unix()
	const hour = int64(3600)
	tx, err := d.Begin()
	if err != nil {
		return err
	}
	var e error
	exec := func(q string, args ...any) {
		if e == nil {
			_, e = tx.Exec(q, args...)
		}
	}

	site := func(id, name, code, kind, loc, cidr, status string) {
		exec(`INSERT INTO sites(id,name,code,kind,location,subnet_cidr,status,created_at,updated_at)
			VALUES(?,?,?,?,?,?,?,?,?)`, id, name, code, kind, loc, cidr, status, now, now)
	}
	site("site_hq", "Cipherlane HQ", "HQ-BAK", "hq", "Baku, AZ", "10.10.0.0/16", "online")
	site("site_gnj", "Ganja Branch", "GNJ", "branch", "Ganja, AZ", "10.20.0.0/16", "online")
	site("site_sum", "Sumqayit Branch", "SUM", "branch", "Sumqayit, AZ", "10.30.0.0/16", "degraded")
	site("site_dc", "Baku Datacenter", "DC-BAK", "datacenter", "Baku, AZ", "10.40.0.0/16", "online")
	site("site_aws", "AWS eu-central-1", "AWS-EUC", "cloud", "Frankfurt, DE", "10.50.0.0/16", "online")

	gw := func(id, siteID, name, endpoint, wan, proto, ver, status string, seen int64) {
		exec(`INSERT INTO gateways(id,site_id,name,endpoint,wan_ip,protocol,version,status,last_seen,created_at,updated_at)
			VALUES(?,?,?,?,?,?,?,?,?,?,?)`, id, siteID, name, endpoint, wan, proto, ver, status, seen, now, now)
	}
	gw("gw_hq", "site_hq", "hq-gw-01", "vpn-hq.cipherlane.az:51820", "91.203.10.4", "wireguard", "1.0.20240514", "online", now-30)
	gw("gw_gnj", "site_gnj", "gnj-gw-01", "vpn-gnj.cipherlane.az:51820", "91.203.22.9", "wireguard", "1.0.20240514", "online", now-45)
	gw("gw_sum", "site_sum", "sum-gw-01", "vpn-sum.cipherlane.az:500", "91.203.31.7", "ipsec", "strongSwan 5.9.13", "degraded", now-620)
	gw("gw_dc", "site_dc", "dc-gw-01", "vpn-dc.cipherlane.az:51820", "91.203.40.2", "wireguard", "1.0.20240514", "online", now-15)
	gw("gw_aws", "site_aws", "aws-vgw-01", "52.29.14.88:500", "52.29.14.88", "ipsec", "AWS VGW", "online", now-20)

	tun := func(id, name, a, b, proto, cipher, auth, routing string, alwaysOn int, status string, mtu int) {
		exec(`INSERT INTO tunnels(id,name,a_site_id,b_site_id,protocol,cipher,auth_method,routing,always_on,status,mtu,created_at,updated_at)
			VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, name, a, b, proto, cipher, auth, routing, alwaysOn, status, mtu, now, now)
	}
	tun("tnl_hq_gnj", "HQ ⇄ Ganja", "site_hq", "site_gnj", "wireguard", "chacha20-poly1305", "psk", "static", 1, "up", 1420)
	tun("tnl_hq_sum", "HQ ⇄ Sumqayit", "site_hq", "site_sum", "ipsec", "aes-256-gcm", "certificate", "static", 1, "rekeying", 1400)
	tun("tnl_hq_dc", "HQ ⇄ Datacenter", "site_hq", "site_dc", "wireguard", "chacha20-poly1305", "certificate", "bgp", 1, "up", 1420)
	tun("tnl_hq_aws", "HQ ⇄ AWS eu-central", "site_hq", "site_aws", "ipsec", "aes-256-gcm", "psk", "static", 1, "up", 1400)
	tun("tnl_gnj_dc", "Ganja ⇄ Datacenter", "site_gnj", "site_dc", "wireguard", "chacha20-poly1305", "psk", "static", 0, "up", 1420)

	route := func(id, tid, cidr, kind string) {
		exec(`INSERT INTO routes(id,tunnel_id,cidr,kind) VALUES(?,?,?,?)`, id, tid, cidr, kind)
	}
	route("rt_1", "tnl_hq_gnj", "10.20.0.0/16", "static")
	route("rt_2", "tnl_hq_dc", "10.40.0.0/16", "bgp")
	route("rt_3", "tnl_hq_dc", "10.41.0.0/16", "bgp")
	route("rt_4", "tnl_hq_aws", "10.50.0.0/16", "static")

	user := func(id, name, email, uname, role, grp, status, mode, ip string, mfa int) {
		exec(`INSERT INTO users(id,name,email,username,role,group_name,status,tunnel_mode,corporate_ip,mfa_enabled,created_at,updated_at)
			VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, id, name, email, uname, role, grp, status, mode, ip, mfa, now, now)
	}
	user("usr_aygun", "Aygun Mammadova", "aygun.m@cipherlane.az", "aygun.m", "admin", "IT", "active", "full", "10.10.200.11", 1)
	user("usr_rashad", "Rashad Guliyev", "rashad.q@cipherlane.az", "rashad.q", "operator", "NetOps", "active", "split", "10.10.200.12", 1)
	user("usr_leyla", "Leyla Huseynova", "leyla.h@cipherlane.az", "leyla.h", "member", "Finance", "active", "split", "10.10.200.13", 0)
	user("usr_kamran", "Kamran Aliyev", "kamran.a@cipherlane.az", "kamran.a", "member", "Sales", "active", "split", "10.10.200.14", 0)
	user("usr_nigar", "Nigar Sadigova", "nigar.s@cipherlane.az", "nigar.s", "auditor", "Audit", "active", "full", "10.10.200.15", 1)
	user("usr_elvin", "Elvin Nabiyev", "elvin.n@cipherlane.az", "elvin.n", "member", "Support", "suspended", "split", "10.10.200.16", 0)

	dev := func(id, uid, name, plat, pk string, hs int64) {
		exec(`INSERT INTO devices(id,user_id,name,platform,public_key,last_handshake,status,created_at)
			VALUES(?,?,?,?,?,?,'active',?)`, id, uid, name, plat, pk, hs, now)
	}
	dev("dev_aygun_lt", "usr_aygun", "aygun-thinkpad", "windows", "kZ8Q...pub=", now-120)
	dev("dev_aygun_ph", "usr_aygun", "aygun-iphone", "ios", "mQ2R...pub=", now-300)
	dev("dev_rashad_lt", "usr_rashad", "rashad-mbp", "macos", "aX7T...pub=", now-90)
	dev("dev_leyla_lt", "usr_leyla", "leyla-win", "windows", "bL3P...pub=", now-3600)
	dev("dev_kamran_ph", "usr_kamran", "kamran-pixel", "android", "cV9K...pub=", now-5400)
	dev("dev_nigar_lt", "usr_nigar", "nigar-fedora", "linux", "dN1M...pub=", now-60)

	ses := func(id, uid, did, cip, aip, loc, status string, started int64) {
		exec(`INSERT INTO sessions(id,user_id,device_id,client_ip,assigned_ip,location,status,started_at)
			VALUES(?,?,?,?,?,?,?,?)`, id, uid, did, cip, aip, loc, status, started)
	}
	ses("ses_1", "usr_aygun", "dev_aygun_lt", "94.20.55.11", "10.10.200.11", "Baku, AZ", "connected", now-2*hour)
	ses("ses_2", "usr_rashad", "dev_rashad_lt", "213.172.9.44", "10.10.200.12", "Ganja, AZ", "connected", now-hour)
	ses("ses_3", "usr_nigar", "dev_nigar_lt", "185.98.3.20", "10.10.200.15", "Istanbul, TR", "connected", now-1800)
	ses("ses_4", "usr_kamran", "dev_kamran_ph", "31.11.2.9", "10.10.200.14", "Dubai, AE", "idle", now-600)

	res := func(id, name, kind, host string, port int, siteID string) {
		exec(`INSERT INTO resources(id,name,kind,host,port,site_id,created_at) VALUES(?,?,?,?,?,?,?)`,
			id, name, kind, host, port, siteID, now)
	}
	res("res_rdp", "HR Terminal", "rdp", "10.10.5.20", 3389, "site_hq")
	res("res_ssh", "Build Server", "ssh", "10.40.2.10", 22, "site_dc")
	res("res_pg", "Billing PostgreSQL", "db", "10.40.3.5", 5432, "site_dc")
	res("res_web", "Intranet Portal", "web", "10.10.6.8", 443, "site_hq")
	res("res_mail", "Mail Gateway", "mail", "10.10.7.3", 993, "site_hq")
	res("res_print", "HQ Print Fleet", "printer", "10.10.9.100", 9100, "site_hq")
	res("res_file", "Shared Files", "file", "10.10.4.4", 445, "site_hq")
	res("res_ad", "Active Directory", "ad", "10.10.1.2", 389, "site_hq")
	res("res_erp", "ERP System", "erp", "10.40.8.12", 8443, "site_dc")

	pol := func(id, name, grp, resID, action string) {
		exec(`INSERT INTO policies(id,name,group_name,resource_id,action,created_at) VALUES(?,?,?,?,?,?)`,
			id, name, grp, resID, action, now)
	}
	pol("pol_1", "IT — build server", "IT", "res_ssh", "allow")
	pol("pol_2", "Finance — billing DB", "Finance", "res_pg", "allow")
	pol("pol_3", "Sales — intranet", "Sales", "res_web", "allow")
	pol("pol_4", "Audit — ERP read", "Audit", "res_erp", "allow")
	pol("pol_5", "Support — deny billing DB", "Support", "res_pg", "deny")

	exec(`INSERT INTO cloud_connectors(id,site_id,provider,region,vpc_id,status,created_at)
		VALUES('cc_aws','site_aws','aws','eu-central-1','vpc-0af12cd34','connected',?)`, now)

	cert := func(id, name, kind, subject, fp, status string, notAfter int64) {
		exec(`INSERT INTO certificates(id,name,kind,subject,fingerprint,status,not_after,created_at)
			VALUES(?,?,?,?,?,?,?,?)`, id, name, kind, subject, fp, status, notAfter, now)
	}
	day := int64(86400)
	cert("cert_ca", "Cipherlane Root CA", "ca", "CN=Cipherlane Root CA", "9F:2A:1C:88:04:73:AE:20", "valid", now+3650*day)
	cert("cert_srv", "hq-gw-01 server", "server", "CN=vpn-hq.cipherlane.az", "3C:88:0A:12:9D:5F:11:C4", "valid", now+365*day)
	cert("cert_cli", "nigar.s client", "client", "CN=nigar.s", "A1:04:7B:2E:6C:90:D3:55", "valid", now+180*day)

	key := func(id, name, kind, pub string) {
		exec(`INSERT INTO keys(id,name,kind,public_material,secret_encrypted,created_at)
			VALUES(?,?,?,?,'',?)`, id, name, kind, pub, now)
	}
	key("key_wg_hq", "hq-gw-01 WireGuard", "wireguard", "kZ8Qm2R7dN1McV9K/pub=")
	key("key_psk_aws", "HQ⇄AWS PSK", "psk", "")

	alert := func(id, sev, title, detail, source, status string, ago int64) {
		exec(`INSERT INTO alerts(id,severity,title,detail,source,status,created_at) VALUES(?,?,?,?,?,?,?)`,
			id, sev, title, detail, source, status, now-ago)
	}
	alert("alr_1", "warning", "Tunnel rekey delayed", "HQ ⇄ Sumqayit exceeded its IKE rekey window.", "tnl_hq_sum", "open", 900)
	alert("alr_2", "critical", "Gateway degraded", "sum-gw-01 missed 3 consecutive keepalives.", "gw_sum", "open", 1200)
	alert("alr_3", "info", "New device enrolled", "nigar-fedora enrolled for Nigar Sadigova.", "usr_nigar", "resolved", 3600)
	alert("alr_4", "warning", "MFA disabled", "Kamran Aliyev is a member without MFA.", "usr_kamran", "open", 7200)

	audit := func(id, actor, action, target, ip string, ago int64) {
		exec(`INSERT INTO audit_events(id,actor,action,target,ip,created_at) VALUES(?,?,?,?,?,?)`,
			id, actor, action, target, ip, now-ago)
	}
	audit("aud_1", "aygun.m", "tunnel.create", "HQ ⇄ AWS eu-central", "94.20.55.11", 6*hour)
	audit("aud_2", "aygun.m", "user.enroll_device", "nigar-fedora", "94.20.55.11", 5*hour)
	audit("aud_3", "rashad.q", "policy.update", "Finance — billing DB", "213.172.9.44", 4*hour)
	audit("aud_4", "aygun.m", "gateway.rotate_key", "hq-gw-01", "94.20.55.11", 3*hour)
	audit("aud_5", "nigar.s", "session.disconnect", "kamran-pixel", "185.98.3.20", 2*hour)
	audit("aud_6", "system", "vault.seal", "HQ⇄AWS PSK", "127.0.0.1", hour)

	if e != nil {
		_ = tx.Rollback()
		return e
	}
	return tx.Commit()
}
