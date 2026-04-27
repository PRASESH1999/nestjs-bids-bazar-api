"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GlobalExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let GlobalExceptionFilter = GlobalExceptionFilter_1 = class GlobalExceptionFilter {
    logger = new common_1.Logger(GlobalExceptionFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let statusCode = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let code = 'INTERNAL_SERVER_ERROR';
        let fields;
        if (exception instanceof common_1.HttpException) {
            statusCode = exception.getStatus();
            const res = exception.getResponse();
            message = res.message || exception.message;
            code = res.errorCode || this.getErrorCodeFromStatus(statusCode);
            fields = res.fields;
        }
        else if (exception instanceof typeorm_1.QueryFailedError) {
            const dbError = exception;
            if (dbError.code === '23505') {
                statusCode = common_1.HttpStatus.CONFLICT;
                code = 'DUPLICATE_RESOURCE';
                message = 'The resource you are trying to create already exists.';
            }
            else if (dbError.code === '23503') {
                statusCode = common_1.HttpStatus.CONFLICT;
                code = 'RESOURCE_REFERENCE_CONFLICT';
                message = 'This operation violates a foreign key constraint.';
            }
        }
        if (statusCode >= 500) {
            this.logger.error(`${request.method} ${request.url} - ${statusCode}`, exception.stack);
        }
        else {
            this.logger.warn(`${request.method} ${request.url} - ${statusCode}`);
        }
        response.status(statusCode).json({
            data: null,
            meta: null,
            error: {
                code,
                message,
                statusCode,
                ...(fields ? { fields } : {}),
                ...(process.env.NODE_ENV === 'development' ? { stack: exception.stack } : {}),
            },
        });
    }
    getErrorCodeFromStatus(status) {
        switch (status) {
            case 400: return 'BAD_REQUEST';
            case 401: return 'UNAUTHORIZED';
            case 403: return 'FORBIDDEN';
            case 404: return 'NOT_FOUND';
            case 409: return 'CONFLICT';
            case 422: return 'UNPROCESSABLE_ENTITY';
            case 429: return 'TOO_MANY_REQUESTS';
            default: return 'INTERNAL_SERVER_ERROR';
        }
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = GlobalExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], GlobalExceptionFilter);
//# sourceMappingURL=global-exception.filter.js.map