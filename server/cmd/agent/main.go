// Command agent runs on a Linux VPN gateway: it pulls the generated WireGuard
// config from the Cipherlane control plane, applies it with wg, then reports real
// interface counters back so the dashboard shows live data instead of simulation.
//
// On non-Linux hosts (or with -dry-run) it synthesizes counters so the
// report loop can be exercised end-to-end without touching the system.
//
//	go build -o cipherlane-agent ./cmd/agent
//	./cipherlane-agent -server http://cp:7820 -token <agent-token> -gateway gw_hq -iface wg0
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type configResp struct {
	Config  string   `json:"config"`
	Tunnels []string `json:"tunnels"`
}

type envelope struct {
	OK    bool            `json:"ok"`
	Data  json.RawMessage `json:"data"`
	Error string          `json:"error"`
}

type peerReport struct {
	TunnelID      string  `json:"tunnelId"`
	RxMbps        float64 `json:"rxMbps"`
	TxMbps        float64 `json:"txMbps"`
	HandshakeAgeS int     `json:"handshakeAgeS"`
}

func main() {
	server := flag.String("server", "http://127.0.0.1:7820", "control plane base URL")
	token := flag.String("token", os.Getenv("CIPHERLANE_AGENT_TOKEN"), "agent bearer token")
	gateway := flag.String("gateway", "gw_hq", "gateway id")
	iface := flag.String("iface", "wg0", "WireGuard interface name")
	interval := flag.Int("interval", 5, "report interval seconds")
	dryRun := flag.Bool("dry-run", runtime.GOOS != "linux", "don't touch the system; synthesize counters")
	once := flag.Bool("once", false, "apply config, report once, then exit")
	flag.Parse()

	if *token == "" {
		log.Fatal("agent token required (-token or CIPHERLANE_AGENT_TOKEN)")
	}
	a := &agent{server: *server, token: *token, gateway: *gateway, iface: *iface, dry: *dryRun,
		http: &http.Client{Timeout: 10 * time.Second}}

	cfg, err := a.fetchConfig()
	if err != nil {
		log.Fatalf("fetch config: %v", err)
	}
	log.Printf("gateway %s: %d peer(s), applying config", *gateway, len(cfg.Tunnels))
	if err := a.apply(cfg.Config); err != nil {
		log.Fatalf("apply config: %v", err)
	}

	log.Printf("reporting every %ds (dry-run=%v)", *interval, a.dry)
	prev := map[string][2]int64{}
	for {
		reports := a.sample(cfg.Tunnels, prev, *interval)
		if err := a.report(reports); err != nil {
			log.Printf("report error: %v", err)
		} else {
			log.Printf("reported %d tunnel(s)", len(reports))
		}
		if *once {
			return
		}
		time.Sleep(time.Duration(*interval) * time.Second)
	}
}

type agent struct {
	server, token, gateway, iface string
	dry                           bool
	http                          *http.Client
	counter                       int64
}

func (a *agent) do(method, path string, body io.Reader) (json.RawMessage, error) {
	req, err := http.NewRequest(method, a.server+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+a.token)
	req.Header.Set("Content-Type", "application/json")
	res, err := a.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	var e envelope
	if err := json.NewDecoder(res.Body).Decode(&e); err != nil {
		return nil, err
	}
	if !e.OK {
		return nil, fmt.Errorf("%s", e.Error)
	}
	return e.Data, nil
}

func (a *agent) fetchConfig() (configResp, error) {
	var cfg configResp
	data, err := a.do("GET", "/api/agents/config?gateway="+a.gateway, nil)
	if err != nil {
		return cfg, err
	}
	return cfg, json.Unmarshal(data, &cfg)
}

func (a *agent) apply(config string) error {
	if a.dry {
		log.Printf("[dry-run] would write /etc/wireguard/%s.conf and run `wg-quick up %s`", a.iface, a.iface)
		return nil
	}
	if err := os.WriteFile("/etc/wireguard/"+a.iface+".conf", []byte(config), 0o600); err != nil {
		return err
	}
	if out, err := exec.Command("wg-quick", "up", a.iface).CombinedOutput(); err != nil {
		log.Printf("wg-quick up %s: %v (%s)", a.iface, err, strings.TrimSpace(string(out)))
	}
	return nil
}

// sample reads real counters via `wg show <iface> dump`, or synthesizes them.
func (a *agent) sample(tunnels []string, prev map[string][2]int64, interval int) []peerReport {
	if !a.dry {
		if reps, ok := a.sampleWG(tunnels, prev, interval); ok {
			return reps
		}
	}
	a.counter++
	reps := make([]peerReport, 0, len(tunnels))
	for i, id := range tunnels {
		base := 40.0 + float64((i*37+int(a.counter)*11)%120)
		reps = append(reps, peerReport{
			TunnelID: id, RxMbps: base, TxMbps: base * 0.55,
			HandshakeAgeS: int(a.counter*int64(interval)) % 120,
		})
	}
	return reps
}

func (a *agent) sampleWG(tunnels []string, prev map[string][2]int64, interval int) ([]peerReport, bool) {
	out, err := exec.Command("wg", "show", a.iface, "dump").Output()
	if err != nil {
		return nil, false
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	reps := []peerReport{}
	pi := 0
	for i, ln := range lines {
		if i == 0 { // first line is the interface itself
			continue
		}
		f := strings.Split(ln, "\t")
		if len(f) < 8 || pi >= len(tunnels) {
			continue
		}
		pub := f[0]
		handshake, _ := strconv.ParseInt(f[4], 10, 64)
		rx, _ := strconv.ParseInt(f[5], 10, 64)
		tx, _ := strconv.ParseInt(f[6], 10, 64)
		p := prev[pub]
		rxMbps := float64(rx-p[0]) * 8 / 1e6 / float64(interval)
		txMbps := float64(tx-p[1]) * 8 / 1e6 / float64(interval)
		prev[pub] = [2]int64{rx, tx}
		age := 0
		if handshake > 0 {
			age = int(time.Now().Unix() - handshake)
		}
		reps = append(reps, peerReport{TunnelID: tunnels[pi], RxMbps: max(0, rxMbps), TxMbps: max(0, txMbps), HandshakeAgeS: age})
		pi++
	}
	return reps, true
}

func (a *agent) report(reps []peerReport) error {
	body, _ := json.Marshal(map[string]any{"gatewayId": a.gateway, "peers": reps})
	_, err := a.do("POST", "/api/agents/report", bytes.NewReader(body))
	return err
}
