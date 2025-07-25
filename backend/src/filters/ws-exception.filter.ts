import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    
    this.logger.error('WebSocket exception:', exception);

    if (exception instanceof WsException) {
      client.emit('error', {
        message: exception.message,
        code: 'WS_EXCEPTION',
      });
    } else if (exception instanceof Error) {
      client.emit('error', {
        message: exception.message,
        code: 'INTERNAL_ERROR',
      });
    } else {
      client.emit('error', {
        message: 'An unknown error occurred',
        code: 'UNKNOWN_ERROR',
      });
    }
  }
}