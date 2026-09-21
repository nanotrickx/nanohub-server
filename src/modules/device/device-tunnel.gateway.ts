import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { DeviceShadowService } from './device-shadow.service';
import { IncomingMessage } from 'http';

interface PendingCommand {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timer: NodeJS.Timeout;
}

@WebSocketGateway({ path: '/device/tunnel' })
export class DeviceTunnelGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(DeviceTunnelGateway.name);

  @WebSocketServer()
  server: Server;

  private activeDeviceSocket: WebSocket | null = null;
  private pendingCommands: Map<string, PendingCommand> = new Map();

  constructor(
    @Inject(forwardRef(() => DeviceShadowService))
    private readonly deviceShadowService: DeviceShadowService,
  ) {}

  afterInit() {
    this.logger.log('Industry Outbound Device Tunnel Gateway initialized on path: /device/tunnel');
  }

  handleConnection(client: WebSocket, req: IncomingMessage) {
    const remoteIp = req.socket.remoteAddress || 'unknown';
    this.logger.log(`Device connection opened from IP: ${remoteIp}`);

    // If a previous socket existed, close it cleanly
    if (this.activeDeviceSocket && this.activeDeviceSocket !== client) {
      try {
        this.activeDeviceSocket.close();
      } catch {}
    }

    this.activeDeviceSocket = client;

    // Send registration challenge / ACK
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: 'HANDSHAKE_REQ',
          server: 'nanohub-gateway',
          version: '2.1.0',
          timestamp: new Date().toISOString(),
        }),
      );
    }

    client.on('message', (raw: Buffer | string) => {
      this.handleDeviceMessage(client, raw.toString(), remoteIp);
    });

    client.on('error', (err) => {
      this.logger.error(`Device socket error: ${err.message}`);
    });
  }

  handleDisconnect(client: WebSocket) {
    if (this.activeDeviceSocket === client) {
      this.activeDeviceSocket = null;
      this.deviceShadowService.onTunnelDisconnect();
    }
  }

  isDeviceConnected(): boolean {
    return (
      this.activeDeviceSocket !== null &&
      this.activeDeviceSocket.readyState === WebSocket.OPEN
    );
  }

  async sendCommand(action: string, payload: Record<string, any> = {}, timeoutMs = 3500): Promise<any> {
    if (!this.isDeviceConnected()) {
      throw new Error('Device tunnel is not connected');
    }

    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const frame = JSON.stringify({
      type: 'COMMAND',
      command_id: commandId,
      action,
      ...payload,
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error(`Command ${action} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingCommands.set(commandId, { resolve, reject, timer });

      try {
        this.activeDeviceSocket!.send(frame, (err) => {
          if (err) {
            clearTimeout(timer);
            this.pendingCommands.delete(commandId);
            reject(err);
          }
        });
      } catch (err) {
        clearTimeout(timer);
        this.pendingCommands.delete(commandId);
        reject(err);
      }
    });
  }

  private handleDeviceMessage(client: WebSocket, raw: string, remoteIp: string) {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.logger.warn(`Malformed JSON from device: ${raw.slice(0, 100)}`);
      return;
    }

    const msgType = msg.type || msg.action;

    switch (msgType) {
      case 'REGISTER':
      case 'HANDSHAKE':
        this.deviceShadowService.onTunnelConnect({
          deviceId: msg.device_id || 'ESP32-HOMEHUB',
          mac: msg.mac || 'UNKNOWN_MAC',
          firmware: msg.firmware || msg.fw || '2.1.0',
          ip: remoteIp,
          connectedAt: new Date().toISOString(),
        });

        // Send registration confirmation
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: 'REGISTER_ACK',
              status: 'ACCEPTED',
              session_id: Date.now(),
            }),
          );
        }
        break;

      case 'TELEMETRY':
      case 'STATUS':
        this.deviceShadowService.updateFromTunnelTelemetry(msg);
        break;

      case 'EVENT':
        this.deviceShadowService.updateFromTunnelTelemetry(msg);
        break;

      case 'COMMAND_ACK':
        if (msg.command_id && this.pendingCommands.has(msg.command_id)) {
          const pending = this.pendingCommands.get(msg.command_id)!;
          clearTimeout(pending.timer);
          this.pendingCommands.delete(msg.command_id);
          pending.resolve(msg);
        }
        break;

      case 'PING':
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        }
        break;

      default:
        // Generic telemetry fallback if payload contains mains or temp
        if (msg.mains !== undefined || msg.temp !== undefined) {
          this.deviceShadowService.updateFromTunnelTelemetry(msg);
        }
        break;
    }
  }
}
