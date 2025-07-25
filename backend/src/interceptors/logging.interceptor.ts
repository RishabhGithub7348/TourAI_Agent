import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType();
    const now = Date.now();

    if (contextType === 'ws') {
      const wsContext = context.switchToWs();
      const client = wsContext.getClient();
      const data = wsContext.getData();
      
      this.logger.log(`WS Request - Client: ${client.id}, Data: ${JSON.stringify(data)}`);
    }

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - now;
        this.logger.log(`Request completed in ${elapsed}ms`);
      }),
      catchError((error) => {
        const elapsed = Date.now() - now;
        this.logger.error(`Request failed in ${elapsed}ms - Error: ${error.message}`);
        throw error;
      }),
    );
  }
}