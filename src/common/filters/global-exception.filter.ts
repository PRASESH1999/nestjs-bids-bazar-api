import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

/**
 * Centralized error handler.
 * Ensures all errors follow the standard response envelope:
 * { data: null, meta: null, error: { code, message, statusCode } }
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let fields: any[] | undefined;

    // Handle NestJS Built-in HttpExceptions
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res: any = exception.getResponse();
      message = res.message || exception.message;
      code = res.errorCode || this.getErrorCodeFromStatus(statusCode);
      fields = res.fields; // For validation errors
    }
    // Handle TypeORM Query Errors (Unique Constraints, etc.)
    else if (exception instanceof QueryFailedError) {
      const dbError = exception as any;
      if (dbError.code === '23505') {
        statusCode = HttpStatus.CONFLICT;
        code = 'DUPLICATE_RESOURCE';
        message = 'The resource you are trying to create already exists.';
      } else if (dbError.code === '23503') {
        statusCode = HttpStatus.CONFLICT;
        code = 'RESOURCE_REFERENCE_CONFLICT';
        message = 'This operation violates a foreign key constraint.';
      }
    }

    // Log the error
    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${statusCode}`,
        exception.stack,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} - ${statusCode}`);
    }

    // Standard Response Envelope
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

  private getErrorCodeFromStatus(status: number): string {
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
}
