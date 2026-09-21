# ESP32 Universal Home Hub - NestJS Gateway & REST Server

Enterprise **NestJS & TypeScript** Gateway, REST API, and Hardware Bridge for the **ESP32 Universal Home Hub & PowerGrid**.

Runs on your local PC, home server, or Raspberry Pi, and bridges your physical ESP32 to your **Compose Multiplatform App** and **Cloudflare Tunnel** with strict type safety, DTO validation, live WebSocket streams, and interactive Swagger OpenAPI documentation.

---

## 🏗️ Architecture Overview

```text
Server/
├── src/
│   ├── main.ts                         # Application bootstrap, Swagger setup, CORS, ValidationPipe
│   ├── app.module.ts                   # Root module wiring config, bridge, and feature domains
│   │
│   ├── config/                         # Environment configuration (PORT, ESP32_URL, etc.)
│   ├── common/                         # Global filters (HttpExceptionFilter), interceptors (LoggingInterceptor)
│   │
│   └── modules/
│       ├── esp32-bridge/               # Hardware Bridge (Pattern 1): non-blocking sync, retry, failover caching
│       ├── status/                     # GET /api/status (Mains state, DHT11 temp/hum, outages, uptime)
│       ├── ir/                         # POST /api/ir/send (38 kHz NEC carrier transmission)
│       ├── system/                     # POST /api/reset, POST /api/config, GET /api/wifi/scan
│       ├── simulator/                  # POST /api/simulate/* (Testing hooks for mains outage & IR sniffer)
│       ├── events/                     # RFC 6455 WebSocket Gateway at /ws (real-time stream)
│       └── views/                      # Embedded dark glassmorphism management dashboard at /
│
├── legacy/                             # Standalone zero-dependency fallback scripts
│   ├── server.js                       # Vanilla Node.js
│   └── server.py                       # Vanilla Python 3
└── test/                               # Jest unit and E2E tests
```

---

## 🚀 Quick Start (NestJS & TypeScript)

### 1. Install Dependencies
```bash
cd Server
npm install
```

### 2. Development Mode (Hot Reload)
```bash
# Point directly to your ESP32's local IP:
ESP32_URL=http://192.168.1.150 npm run start:dev

# Or default to mDNS (homehub.local):
npm run start:dev
```

### 3. Production Build & Run
```bash
npm run build
npm run start:prod
```

### 4. Run Unit Tests
```bash
npm test
```

---

## 📖 Interactive OpenAPI / Swagger Documentation

Open your browser and navigate to:
```
http://localhost:8080/api/docs
```
Explore, test, and trigger all REST endpoints interactively directly from the Swagger UI!

---

## 🌐 Connecting Cloudflare Tunnel

In your Cloudflare Zero Trust Tunnel configuration:
1. **Public Hostname**: `nanohub.shopyworld.in`
2. **Service Type**: `HTTP`
3. **URL**: `localhost:8080` (or `127.0.0.1:8080`)

Your mobile phone connects via HTTPS from anywhere in the world:
`App (4G/5G) → Cloudflare (HTTPS) → PC NestJS Server (8080) → ESP32 Hardware (LAN)`

---

## 📱 Connecting the Compose Multiplatform App

1. In the App, navigate to **Settings** (⚙️).
2. Enter your Cloudflare domain or PC server address:
   - **From outside home (Cellular/Internet)**: `nanohub.shopyworld.in`
   - **From home Wi-Fi**: `http://<YOUR_PC_IP>:8080`
3. Tap **Apply / Save**.

---

## 🔌 API Reference

| Endpoint | Method | Tag | Description |
| :--- | :--- | :--- | :--- |
| `/api/status` | `GET` | Telemetry | Returns live mains grid, DHT11 temp/humidity, and bridge status |
| `/api/ir/send?code=<hex>` | `POST` | IR Remote Blaster | Relays 38 kHz NEC carrier transmission to physical ESP32 blaster |
| `/api/bridge/target` | `POST` | Hardware Bridge | Dynamically updates target ESP32 IP without restarting server |
| `/api/wifi/scan` | `GET` | System | Relays Wi-Fi scan results from physical ESP32 |
| `/api/reset` | `POST` | System | Relays factory reset signal to ESP32 NVS memory |
| `/api/simulate/mains` | `POST` | Simulator | Toggles simulated mains power outage |
| `/ws` | `WS` | WebSocket | RFC 6455 live WebSocket streaming outage alerts & serial events |
| `/api/docs` | `GET` | Docs | Swagger / OpenAPI Interactive Documentation |
| `/` | `GET` | Dashboard | Embedded Web Management Dashboard |
