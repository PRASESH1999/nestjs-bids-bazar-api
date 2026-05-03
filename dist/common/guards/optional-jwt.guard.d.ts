declare const OptionalJwtGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class OptionalJwtGuard extends OptionalJwtGuard_base {
    handleRequest<TUser>(_err: Error | null, user: TUser | false | null): TUser | null;
}
export {};
