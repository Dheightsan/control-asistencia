import { INestApplication, ValidationPipe } from '@nestjs/common';

// Se usa igual en main.ts y en las pruebas e2e, para probar lo mismo que corre.
export function configurarApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });
}
