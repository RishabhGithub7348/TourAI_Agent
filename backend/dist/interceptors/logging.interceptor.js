"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var LoggingInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
let LoggingInterceptor = LoggingInterceptor_1 = class LoggingInterceptor {
    constructor() {
        this.logger = new common_1.Logger(LoggingInterceptor_1.name);
    }
    intercept(context, next) {
        const contextType = context.getType();
        const now = Date.now();
        if (contextType === 'ws') {
            const wsContext = context.switchToWs();
            const client = wsContext.getClient();
            const data = wsContext.getData();
            this.logger.log(`WS Request - Client: ${client.id}, Data: ${JSON.stringify(data)}`);
        }
        return next.handle().pipe((0, operators_1.tap)(() => {
            const elapsed = Date.now() - now;
            this.logger.log(`Request completed in ${elapsed}ms`);
        }), (0, operators_1.catchError)((error) => {
            const elapsed = Date.now() - now;
            this.logger.error(`Request failed in ${elapsed}ms - Error: ${error.message}`);
            throw error;
        }));
    }
};
exports.LoggingInterceptor = LoggingInterceptor;
exports.LoggingInterceptor = LoggingInterceptor = LoggingInterceptor_1 = __decorate([
    (0, common_1.Injectable)()
], LoggingInterceptor);
//# sourceMappingURL=logging.interceptor.js.map