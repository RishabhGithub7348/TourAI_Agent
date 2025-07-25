"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var WsExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
let WsExceptionFilter = WsExceptionFilter_1 = class WsExceptionFilter extends websockets_1.BaseWsExceptionFilter {
    constructor() {
        super(...arguments);
        this.logger = new common_1.Logger(WsExceptionFilter_1.name);
    }
    catch(exception, host) {
        const client = host.switchToWs().getClient();
        this.logger.error('WebSocket exception:', exception);
        if (exception instanceof websockets_1.WsException) {
            client.emit('error', {
                message: exception.message,
                code: 'WS_EXCEPTION',
            });
        }
        else if (exception instanceof Error) {
            client.emit('error', {
                message: exception.message,
                code: 'INTERNAL_ERROR',
            });
        }
        else {
            client.emit('error', {
                message: 'An unknown error occurred',
                code: 'UNKNOWN_ERROR',
            });
        }
    }
};
exports.WsExceptionFilter = WsExceptionFilter;
exports.WsExceptionFilter = WsExceptionFilter = WsExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], WsExceptionFilter);
//# sourceMappingURL=ws-exception.filter.js.map