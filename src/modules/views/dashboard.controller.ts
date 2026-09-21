import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';
import { Esp32BridgeService } from '../esp32-bridge/esp32-bridge.service';

@Controller()
export class DashboardController {
  constructor(private readonly bridgeService: Esp32BridgeService) {}

  @Get()
  @ApiExcludeEndpoint()
  getDashboard(@Res() res: Response) {
    const state = this.bridgeService.getState();
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ESP32 Universal Hub - NestJS Gateway</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #151e32;
      --border: #223254;
      --cyan: #00e5ff;
      --green: #10b981;
      --red: #ef4444;
      --amber: #f59e0b;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 24px;
    }
    .container { max-width: 860px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    h1 { margin: 0; font-size: 1.6rem; color: var(--cyan); }
    .badge {
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: bold;
    }
    .badge-online { background: rgba(16, 185, 129, 0.2); color: var(--green); border: 1px solid var(--green); }
    .badge-alert { background: rgba(239, 68, 68, 0.2); color: var(--red); border: 1px solid var(--red); animation: pulse 1s infinite alternate; }
    @keyframes pulse { from { opacity: 0.6; } to { opacity: 1; } }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px;
    }
    .card-title { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 10px; font-weight: bold; }
    .metric { font-size: 2.2rem; font-weight: 800; color: var(--text); }
    .metric-sub { font-size: 0.85rem; color: var(--muted); margin-top: 4px; }
    .mono { font-family: monospace; }

    button {
      background: var(--cyan);
      color: #0b0f19;
      border: none;
      padding: 10px 16px;
      border-radius: 8px;
      font-weight: bold;
      font-size: 0.9rem;
      cursor: pointer;
    }
    button.btn-danger { background: var(--red); color: #fff; }
    button.btn-amber { background: var(--amber); color: #0b0f19; }
    button.btn-dark { background: #1e293b; color: #fff; border: 1px solid var(--border); }

    input[type="text"] {
      background: #070a10;
      border: 1px solid var(--border);
      color: #fff;
      padding: 9px 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 0.9rem;
      flex: 1;
    }

    .log-box {
      background: #070a10;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      height: 180px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 0.8rem;
      color: #38bdf8;
    }
    .log-line { margin-bottom: 4px; }
    a { color: var(--cyan); text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>⚡ ESP32 Gateway (NestJS & TypeScript)</h1>
        <div style="font-size: 0.85rem; color: var(--muted); margin-top: 4px;">
          Interactive OpenAPI Docs: <a href="/api/docs" target="_blank">/api/docs</a> | WebSocket: <span class="mono">/ws</span>
        </div>
      </div>
      <div id="mains-badge" class="badge badge-online">MAINS NORMAL</div>
    </header>

    <!-- Target Hardware Bridge Configuration -->
    <div class="card" style="margin-bottom: 16px; border-color: var(--cyan);">
      <div class="card-title" style="color: var(--cyan);">🔗 Physical ESP32 Hardware Link</div>
      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
        <input type="text" id="target-url-input" placeholder="e.g. http://192.168.1.150 or http://homehub.local" value="${state.esp32_url}">
        <button onclick="updateTargetUrl()">Link Hardware</button>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
        <div>Link Status: <strong id="link-status" style="color: var(--amber);">Checking...</strong></div>
        <div>Last Hardware Sync: <span id="last-sync" class="mono">--</span></div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">Grid Status (PC817 - GPIO 18)</div>
        <div id="mains-val" class="metric" style="color: var(--green);">5V ACTIVE</div>
        <div class="metric-sub" id="outage-count-sub">Total Outages: 0</div>
      </div>

      <div class="card">
        <div class="card-title">Environmental Telemetry (DHT11)</div>
        <div style="display: flex; gap: 24px;">
          <div>
            <div class="metric" id="temp-val">-- °C</div>
            <div class="metric-sub">Temperature</div>
          </div>
          <div>
            <div class="metric" id="hum-val">-- %</div>
            <div class="metric-sub">Humidity</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Live WebSocket Stream Box -->
    <div class="card" style="margin-bottom: 16px;">
      <div class="card-title" style="color: var(--cyan);">⚡ Real-Time Log Stream (/ws)</div>
      <div class="log-box" id="ws-logs">Connecting to live stream...</div>
    </div>

    <!-- Quick Actions -->
    <div class="card">
      <div class="card-title">🛠️ Hardware Actions & Testing</div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn-dark" onclick="sendTestIR()">Send Test IR (0x20DF10EF)</button>
        <button class="btn-amber" onclick="toggleMainsSim()">Toggle Mains (Sim)</button>
        <button class="btn-danger" onclick="resetConfig()">Reset ESP32 NVS</button>
      </div>
    </div>
  </div>

  <script>
    const ws = new WebSocket((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws');
    const logBox = document.getElementById('ws-logs');

    ws.onopen = () => {
      logBox.innerHTML = '<div style="color: #10b981;">[WS] Connected to live Gateway log stream</div>';
    };

    ws.onmessage = (event) => {
      const line = document.createElement('div');
      line.className = 'log-line';
      line.textContent = event.data;
      if (event.data.includes("OUTAGE DETECTED")) {
        line.style.color = "#ef4444";
      } else if (event.data.includes("RESTORED") || event.data.includes("Linked to physical ESP32")) {
        line.style.color = "#10b981";
      }
      logBox.insertBefore(line, logBox.firstChild);
      updateStatus();
    };

    async function updateStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        const badge = document.getElementById('mains-badge');
        const mainsVal = document.getElementById('mains-val');
        const linkStatus = document.getElementById('link-status');
        const lastSync = document.getElementById('last-sync');

        if (data.mains) {
          badge.textContent = "MAINS NORMAL";
          badge.className = "badge badge-online";
          mainsVal.textContent = "5V ACTIVE";
          mainsVal.style.color = "var(--green)";
        } else {
          badge.textContent = "OUTAGE DETECTED";
          badge.className = "badge badge-alert";
          mainsVal.textContent = "OUTAGE";
          mainsVal.style.color = "var(--red)";
        }

        document.getElementById('temp-val').textContent = (data.temp || "--") + " °C";
        document.getElementById('hum-val').textContent = (data.hum || "--") + " %";
        document.getElementById('outage-count-sub').textContent = "Total Outages: " + (data.outages || 0);

        if (data.esp32_online) {
          linkStatus.textContent = "CONNECTED (" + data.esp32_url + ")";
          linkStatus.style.color = "var(--green)";
        } else {
          linkStatus.textContent = "DISCONNECTED (Using Cache / Sim)";
          linkStatus.style.color = "var(--amber)";
        }

        lastSync.textContent = data.last_sync ? new Date(data.last_sync).toLocaleTimeString() : "Never";
      } catch (e) {
        console.error("Failed to poll status", e);
      }
    }

    async function updateTargetUrl() {
      const url = document.getElementById('target-url-input').value.trim();
      if (!url) return;
      await fetch('/api/bridge/target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      updateStatus();
    }

    async function sendTestIR() {
      await fetch('/api/ir/send?code=0x20DF10EF', { method: 'POST' });
    }

    async function toggleMainsSim() {
      await fetch('/api/simulate/mains', { method: 'POST' });
      updateStatus();
    }

    async function resetConfig() {
      if (confirm("Send factory reset to ESP32?")) {
        await fetch('/api/reset', { method: 'POST' });
      }
    }

    setInterval(updateStatus, 3000);
    updateStatus();
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
