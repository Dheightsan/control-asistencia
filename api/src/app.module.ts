import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalculoService } from './calculo/calculo.service';
import { SemillaDemoService } from './demo/semilla-demo.service';
import { Marca } from './marcas/marca.entity';
import { MarcasController } from './marcas/marcas.controller';
import { MarcasService } from './marcas/marcas.service';
import { Trabajador } from './trabajadores/trabajador.entity';
import { TrabajadoresController } from './trabajadores/trabajadores.controller';
import { TrabajadoresService } from './trabajadores/trabajadores.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Trabajador, Marca],
      // Sin migraciones: en un proyecto chico el esquema se crea solo. Ver README.
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Trabajador, Marca]),
  ],
  controllers: [TrabajadoresController, MarcasController],
  providers: [CalculoService, TrabajadoresService, MarcasService, SemillaDemoService],
})
export class AppModule {}
