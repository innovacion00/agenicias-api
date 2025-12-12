import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { envs } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  
  // Usar logger estructurado de Pino
  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);

  app.setGlobalPrefix('agencias/v1/');

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('API Agencias de Viajes')
    .setDescription('API para gestión de agencias de viajes, reservas, cotizaciones y más')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingrese el token JWT. Swagger agregará automáticamente "Bearer " al inicio. Solo pegue el token sin incluir "Bearer".',
        name: 'Authorization',
        in: 'header',
      },
      'JWT-auth', // Este nombre se usará en los decoradores @ApiBearerAuth()
    )
    .addTag('auth', 'Endpoints de autenticación')
    .addTag('agencias', 'Endpoints de agencias')
    .addTag('reservas', 'Endpoints de reservas')
    .addTag('cotizaciones', 'Endpoints de cotizaciones')
    .addTag('vuelos', 'Endpoints de vuelos')
    .addTag('eventos', 'Endpoints de eventos')
    .addTag('notificaciones', 'Endpoints de notificaciones')
    .addTag('cloudinary', 'Endpoints de Cloudinary')
    .addTag('integrations', 'Endpoints de integraciones')
    .addServer('http://localhost:3000', 'Servidor de desarrollo')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('agencias/v1/api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'API Agencias - Swagger',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
    `,
  });

  await app.listen(envs.port);
  logger.log(`🚀 Aplicación iniciada en puerto ${envs.port}`);
  logger.log(`📚 Documentación Swagger: http://localhost:${envs.port}/agencias/v1/api-docs`);
}
bootstrap();
