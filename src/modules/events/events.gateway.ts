import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';

@WebSocketGateway({ path: '/ws' })
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  private connectedClients: Set<WebSocket> = new Set();

  afterInit() {
    this.logger.log('RFC 6455 WebSocket Gateway initialized on path: /ws');
  }

  handleConnection(client: WebSocket) {
    this.connectedClients.add(client);
    this.logger.log(`Client connected to /ws (Total: ${this.connectedClients.size})`);
    
    // Send initial handshake message (matches powergrid firmware)
    if (client.readyState === WebSocket.OPEN) {
      client.send('[SYS] Client connected to Gateway Live Stream');
    }
  }

  handleDisconnect(client: WebSocket) {
    this.connectedClients.delete(client);
    this.logger.log(`Client disconnected from /ws (Total: ${this.connectedClients.size})`);
  }

  broadcast(message: string) {
    for (const client of this.connectedClients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (err) {
          this.logger.error(`Error sending WS frame: ${err.message}`);
          this.connectedClients.delete(client);
        }
      }
    }
  }
}
