import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Se usa igual en main.ts y en las pruebas e2e, para probar lo mismo que corre.
export function configurarApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });

  // Swagger en /docs
  const documento = new DocumentBuilder()
    .setTitle('Control de asistencia')
    .setDescription('Marcas de entrada y salida y horas extra con la jornada chilena de 42 horas.')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, documento));
}
