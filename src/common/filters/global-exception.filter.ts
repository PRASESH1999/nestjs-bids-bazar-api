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

interface HttpExceptionResponseBody {
  message?: string;
  errorCode?: string;
  fields?: { field: string; message: string }[];
}

interface PostgresQueryError extends QueryFailedError {
  code: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter<unknown> {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let fields: { field: string; message: string }[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const rawRes = exception.getResponse();
      if (typeof rawRes === 'object' && rawRes !== null) {
        const res = rawRes as HttpExceptionResponseBody;
        message = res.message ?? exception.message;
        code = res.errorCode ?? this.getErrorCodeFromStatus(statusCode);
        fields = res.fields;
      } else {
        message = String(rawRes);
        code = this.getErrorCodeFromStatus(statusCode);
      }
    } else if (exception instanceof QueryFailedError) {
      const dbError = exception as PostgresQueryError;
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

    const errorStack = exception instanceof Error ? exception.stack : undefined;

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} - ${statusCode}`,
        errorStack,
      );
    } else {
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
        ...(process.env.NODE_ENV === 'development'
          ? { stack: errorStack }
          : {}),
      },
    });
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'UNPROCESSABLE_ENTITY';
      case 429:
        return 'TOO_MANY_REQUESTS';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
