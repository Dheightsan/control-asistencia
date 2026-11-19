import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { SemillaDemoService } from '../src/demo/semilla-demo.service';

describe('demo publica (contra PostgreSQL real)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('la semilla deja tres trabajadores con su semana calculada', async () => {
    const semilla = app.get(SemillaDemoService);
    await semilla.cargar('2026-05-04');
    await semilla.cargar('2026-05-04'); // dos veces: no duplica

    const lista = (await http().get('/trabajadores').expect(200)).body as { id: number; nombre: string }[];
    expect(lista.map((t) => t.nombre).sort()).toEqual(['Ana Pérez', 'Luis Soto', 'Marta Ríos']);

    const luis = lista.find((t) => t.nombre === 'Luis Soto')!;
    const r = await http().get(`/trabajadores/${luis.id}/semana?desde=2026-05-04`).expect(200);
    expect(r.body).toMatchObject({ horasExtra: 5, diasSobreTope: ['2026-05-08'] });
  });

  it('publica la documentacion de la API', async () => {
    const r = await http().get('/docs-json').expect(200);
    expect(Object.keys(r.body.paths)).toEqual(expect.arrayContaining(['/trabajadores', '/marcas', '/trabajadores/{id}/semana']));
    await http().get('/docs').expect(200);
  });
});
