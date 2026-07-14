// Package sim is the in-memory network engine. It holds live telemetry for
// every tunnel and session, advances it on a ticker with a mean-reverting
// random walk (so the numbers look real, not jittery), and streams snapshots to
// the WebSocket hub. Nothing here is persisted — structural data lives in SQLite.
package sim

import (
	"database/sql"
	"encoding/json"
	"math"
	"math/rand"
	"sync"
	"time"

	"cipherlane/internal/models"
	"cipherlane/internal/ws"
)

const (
	tickInterval = 2 * time.Second
	seriesCap    = 120
	histCap      = 40 // per-tunnel throughput samples kept for sparklines
)

// GlobalPoint is one sample of aggregate throughput for the overview chart.
type GlobalPoint struct {
	TS int64   `json:"ts"`
	Rx float64 `json:"rx"`
	Tx float64 `json:"tx"`
}

// Global is the aggregate live state.
type Global struct {
	Rx             float64 `json:"rx"`
	Tx             float64 `json:"tx"`
	ActiveTunnels  int     `json:"activeTunnels"`
	OnlineSessions int     `json:"onlineSessions"`
}

// Snapshot is the initial live state returned over REST.
type Snapshot struct {
	Tunnels  map[string]models.TunnelLive `json:"tunnels"`
	Sessions map[string]sessionOut        `json:"sessions"`
	Global   Global                       `json:"global"`
	Series   []GlobalPoint                `json:"series"`
}

type sessionOut struct {
	RxMbps float64 `json:"rxMbps"`
	TxMbps float64 `json:"txMbps"`
	Status string  `json:"status"`
}

type tunnelState struct {
	live    models.TunnelLive
	baseRx  float64
	baseTx  float64
	baseLat float64
	hist    []float64 // rolling rx+tx totals for the sparkline
	real    bool      // driven by a real gateway agent, not the simulator
}

type sessionState struct {
	rx, tx         float64
	baseRx, baseTx float64
	status         string
}

// Engine advances and broadcasts live telemetry.
type Engine struct {
	db  *sql.DB
	hub *ws.Hub
	rng *rand.Rand

	mu       sync.RWMutex
	tunnels  map[string]*tunnelState
	sessions map[string]*sessionState
	series   []GlobalPoint
	stop     chan struct{}
}

// New builds and primes the engine from current database rows.
func New(database *sql.DB, hub *ws.Hub) *Engine {
	e := &Engine{
		db:       database,
		hub:      hub,
		rng:      rand.New(rand.NewSource(time.Now().UnixNano())),
		tunnels:  map[string]*tunnelState{},
		sessions: map[string]*sessionState{},
		stop:     make(chan struct{}),
	}
	e.load()
	e.backfill()
	return e
}

func (e *Engine) load() {
	rows, err := e.db.Query("SELECT id, status FROM tunnels")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, status string
			if rows.Scan(&id, &status) == nil {
				e.tunnels[id] = e.newTunnel(status)
			}
		}
	}
	srows, err := e.db.Query("SELECT id, status FROM sessions")
	if err == nil {
		defer srows.Close()
		for srows.Next() {
			var id, status string
			if srows.Scan(&id, &status) == nil {
				connected := status == "connected"
				base := 0.4 + e.rng.Float64()*2.5
				if !connected {
					base = 0.05
				}
				e.sessions[id] = &sessionState{
					rx: base, tx: base * 0.5, baseRx: base, baseTx: base * 0.5, status: status,
				}
			}
		}
	}
}

func (e *Engine) newTunnel(status string) *tunnelState {
	var ts *tunnelState
	switch status {
	case "down":
		ts = &tunnelState{live: models.TunnelLive{Status: "down"}}
	case "rekeying":
		lat := 28 + e.rng.Float64()*36
		ts = &tunnelState{
			live: models.TunnelLive{
				Status: "rekeying", RxMbps: 14, TxMbps: 9, LatencyMs: lat,
				LossPct: 0.6, HandshakeAgeS: 2, RekeyInS: 4 + e.rng.Intn(16),
			},
			baseRx: 16, baseTx: 11, baseLat: lat,
		}
	default:
		br := 30 + e.rng.Float64()*150
		bt := 18 + e.rng.Float64()*95
		lat := 6 + e.rng.Float64()*22
		ts = &tunnelState{
			live: models.TunnelLive{
				Status: "up", RxMbps: br, TxMbps: bt, LatencyMs: lat,
				LossPct: e.rng.Float64() * 0.2, HandshakeAgeS: 5 + e.rng.Intn(60),
				RekeyInS: 60 + e.rng.Intn(120),
			},
			baseRx: br, baseTx: bt, baseLat: lat,
		}
	}
	// Seed a plausible history so sparklines render immediately.
	base := ts.live.RxMbps + ts.live.TxMbps
	ts.hist = make([]float64, 0, histCap)
	for i := 0; i < 20; i++ {
		ts.hist = append(ts.hist, round1(base*(0.8+e.rng.Float64()*0.4)))
	}
	return ts
}

func (e *Engine) backfill() {
	rx, tx := e.aggregateLocked()
	now := time.Now().Unix()
	pts := make([]GlobalPoint, 0, seriesCap)
	for i := seriesCap - 1; i >= 0; i-- {
		phase := float64(i) * 0.18
		wobble := 0.75 + 0.25*math.Sin(phase) + (e.rng.Float64()-0.5)*0.12
		pts = append(pts, GlobalPoint{
			TS: now - int64(i)*2,
			Rx: round1(rx * wobble),
			Tx: round1(tx * wobble),
		})
	}
	e.series = pts
}

// Run advances telemetry until Stop is called; intended as a goroutine.
func (e *Engine) Run() {
	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()
	for {
		select {
		case <-e.stop:
			return
		case <-ticker.C:
			e.tick()
		}
	}
}

// Stop halts the engine loop.
func (e *Engine) Stop() { close(e.stop) }

// Reload rebuilds live state from the database, e.g. after an estate reset.
func (e *Engine) Reload() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.tunnels = map[string]*tunnelState{}
	e.sessions = map[string]*sessionState{}
	e.load()
	e.backfill()
}

func (e *Engine) tick() {
	e.mu.Lock()
	for _, t := range e.tunnels {
		if t.live.Status != "down" && !t.real { // real tunnels are driven by agent reports
			t.live.RxMbps = round1(e.walk(t.live.RxMbps, t.baseRx, t.baseRx*0.06+1, 0, t.baseRx*2))
			t.live.TxMbps = round1(e.walk(t.live.TxMbps, t.baseTx, t.baseTx*0.06+1, 0, t.baseTx*2))
			t.live.LatencyMs = round1(e.walk(t.live.LatencyMs, t.baseLat, 1.4, 2, 220))
			lossBase := 0.05
			if t.live.Status == "rekeying" {
				lossBase = 0.7
			}
			t.live.LossPct = round2(e.walk(t.live.LossPct, lossBase, 0.05, 0, 3))
			t.live.RekeyInS -= int(tickInterval.Seconds())
			if t.live.RekeyInS <= 0 {
				t.live.RekeyInS = 60 + e.rng.Intn(120)
				t.live.HandshakeAgeS = 0
			} else {
				t.live.HandshakeAgeS += int(tickInterval.Seconds())
			}
		}
		t.hist = append(t.hist, round1(t.live.RxMbps+t.live.TxMbps))
		if len(t.hist) > histCap {
			t.hist = t.hist[len(t.hist)-histCap:]
		}
	}
	for _, s := range e.sessions {
		if s.status != "connected" {
			s.rx = round1(e.walk(s.rx, 0.05, 0.03, 0, 0.4))
			s.tx = round1(e.walk(s.tx, 0.03, 0.02, 0, 0.3))
			continue
		}
		s.rx = round1(e.walk(s.rx, s.baseRx, s.baseRx*0.12+0.1, 0, s.baseRx*3))
		s.tx = round1(e.walk(s.tx, s.baseTx, s.baseTx*0.12+0.1, 0, s.baseTx*3))
	}
	rx, tx := e.aggregateLocked()
	now := time.Now().Unix()
	e.series = append(e.series, GlobalPoint{TS: now, Rx: round1(rx), Tx: round1(tx)})
	if len(e.series) > seriesCap {
		e.series = e.series[len(e.series)-seriesCap:]
	}
	payload := e.snapshotLocked()
	e.mu.Unlock()

	if b, err := json.Marshal(map[string]any{"type": "telemetry", "ts": now, "data": payload}); err == nil {
		e.hub.Broadcast(b)
	}
}

func (e *Engine) walk(cur, base, sigma, min, max float64) float64 {
	next := cur + (base-cur)*0.08 + e.rng.NormFloat64()*sigma
	if next < min {
		next = min
	}
	if next > max {
		next = max
	}
	return next
}

func (e *Engine) aggregateLocked() (rx, tx float64) {
	for _, t := range e.tunnels {
		rx += t.live.RxMbps
		tx += t.live.TxMbps
	}
	for _, s := range e.sessions {
		rx += s.rx
		tx += s.tx
	}
	return rx, tx
}

func (e *Engine) snapshotLocked() Snapshot {
	tuns := make(map[string]models.TunnelLive, len(e.tunnels))
	active := 0
	for id, t := range e.tunnels {
		lv := t.live
		lv.History = append([]float64(nil), t.hist...)
		tuns[id] = lv
		if t.live.Status != "down" {
			active++
		}
	}
	sess := make(map[string]sessionOut, len(e.sessions))
	online := 0
	for id, s := range e.sessions {
		sess[id] = sessionOut{RxMbps: s.rx, TxMbps: s.tx, Status: s.status}
		if s.status == "connected" {
			online++
		}
	}
	rx, tx := e.aggregateLocked()
	return Snapshot{
		Tunnels:  tuns,
		Sessions: sess,
		Global:   Global{Rx: round1(rx), Tx: round1(tx), ActiveTunnels: active, OnlineSessions: online},
		Series:   append([]GlobalPoint(nil), e.series...),
	}
}

// Snapshot returns the current live state for REST bootstrapping.
func (e *Engine) Snapshot() Snapshot {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.snapshotLocked()
}

// TunnelLive returns the live telemetry for one tunnel, if tracked.
func (e *Engine) TunnelLive(id string) (models.TunnelLive, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	if t, ok := e.tunnels[id]; ok {
		lv := t.live
		lv.History = append([]float64(nil), t.hist...)
		return lv, true
	}
	return models.TunnelLive{}, false
}

// AddTunnel registers a freshly-created tunnel so it starts emitting telemetry.
func (e *Engine) AddTunnel(id, status string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if _, ok := e.tunnels[id]; !ok {
		e.tunnels[id] = e.newTunnel(status)
	}
}

// ApplyReport overrides a tunnel's live metrics with real agent-reported values
// and marks it real so the simulator stops touching it.
func (e *Engine) ApplyReport(id string, rxMbps, txMbps float64, handshakeAgeS int) {
	e.mu.Lock()
	defer e.mu.Unlock()
	t, ok := e.tunnels[id]
	if !ok {
		t = e.newTunnel("up")
		e.tunnels[id] = t
	}
	t.real = true
	t.live.Status = "up"
	t.live.RxMbps = round1(rxMbps)
	t.live.TxMbps = round1(txMbps)
	t.live.HandshakeAgeS = handshakeAgeS
}

// SessionLive returns live rx/tx for one session.
func (e *Engine) SessionLive(id string) (rx, tx float64, ok bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	if s, ok := e.sessions[id]; ok {
		return s.rx, s.tx, true
	}
	return 0, 0, false
}

func round1(f float64) float64 { return math.Round(f*10) / 10 }
func round2(f float64) float64 { return math.Round(f*100) / 100 }
