import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';

async function main() {
  const app = await NestFactory.create(AppModule);
  configurarApp(app);
  await app.listen(Number(process.env.API_PORT ?? 3001));
}
void main();
