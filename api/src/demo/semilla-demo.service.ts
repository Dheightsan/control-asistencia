import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Marca } from '../marcas/marca.entity';
import { Trabajador } from '../trabajadores/trabajador.entity';
import { datosDemo, lunesUtc } from './datos-demo';

// SEMILLA_DEMO=1: al arrancar borra todo y carga la semana actual
@Injectable()
export class SemillaDemoService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SemillaDemoService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    if (process.env.SEMILLA_DEMO !== '1') return;
    const lunes = lunesUtc(new Date());
    await this.cargar(lunes);
    this.logger.log(`Datos de ejemplo cargados para la semana del ${lunes}`);
  }

  async cargar(lunes: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await m.query('TRUNCATE marcas, trabajadores RESTART IDENTITY CASCADE');
      for (const t of datosDemo(lunes)) {
        const { id } = await m.save(Trabajador, { nombre: t.nombre, sueldoBase: t.sueldoBase });
        await m.save(
          Marca,
          t.marcas.map((x) => ({ ...x, trabajadorId: id })),
        );
      }
    });
  }
}
