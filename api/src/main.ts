import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';

async function main() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarApp(app);
  // En la demo sirve tambien la pagina exportada
  if (process.env.WEB_DIR) app.useStaticAssets(resolve(process.env.WEB_DIR));
  // PORT lo pone el hosting
  await app.listen(Number(process.env.API_PORT ?? process.env.PORT ?? 3001));
}
void main();
