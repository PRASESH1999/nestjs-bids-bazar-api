import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class GlobalExceptionFilter implements ExceptionFilter<unknown> {
    private readonly logger;
    catch(exception: unknown, host: ArgumentsHost): void;
    private getErrorCodeFromStatus;
}
