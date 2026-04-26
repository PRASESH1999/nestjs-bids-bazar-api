"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const cookieParser = require("cookie-parser");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    const prefix = configService.get('API_PREFIX', 'api');
    const version = configService.get('API_VERSION', 'v1');
    app.setGlobalPrefix(`${prefix}/${version}`);
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Bids Bazar API')
        .setDescription('The Bids Bazar Auction API description')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup(`${prefix}/${version}/docs`, app, document);
    app.use(cookieParser());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    const port = configService.get('PORT', 3000);
    await app.listen(port);
}
bootstrap();
//# sourceMappingURL=main.js.map