import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';

describe('API (contra PostgreSQL real)', () => {
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

  const crearTrabajador = async (nombre = 'Ana Perez', sueldoBase = 900_000) =>
    (await http().post('/trabajadores').send({ nombre, sueldoBase }).expect(201)).body as { id: number };

  const marcar = (trabajadorId: number, entrada: string, salida: string) =>
    http().post('/marcas').send({ trabajadorId, entrada, salida });

  describe('trabajadores', () => {
    it('CRUD completo', async () => {
      const { id } = await crearTrabajador();
      await http().get(`/trabajadores/${id}`).expect(200).expect((r) => expect(r.body.nombre).toBe('Ana Perez'));
      await http().patch(`/trabajadores/${id}`).send({ sueldoBase: 1_000_000 }).expect(200);
      await http().get(`/trabajadores/${id}`).expect((r) => expect(r.body.sueldoBase).toBe(1_000_000));
      const lista = await http().get('/trabajadores').expect(200);
      expect(lista.body.some((t: { id: number }) => t.id === id)).toBe(true);
      await http().delete(`/trabajadores/${id}`).expect(204);
      await http().get(`/trabajadores/${id}`).expect(404);
    });

    it('rechaza datos invalidos con 400', async () => {
      await http().post('/trabajadores').send({ nombre: '', sueldoBase: 900000 }).expect(400);
      await http().post('/trabajadores').send({ nombre: 'X', sueldoBase: -5 }).expect(400);
      await http().post('/trabajadores').send({ nombre: 'X', sueldoBase: 900000, extra: 1 }).expect(400);
    });

    it('un id que no es numero da 400', async () => {
      await http().get('/trabajadores/abc').expect(400);
    });
  });

  describe('marcas', () => {
    it('salida antes de entrada es 400', async () => {
      const { id } = await crearTrabajador();
      await marcar(id, '2026-05-04T17:00:00Z', '2026-05-04T08:00:00Z').expect(400);
    });

    it('fecha mal escrita es 400', async () => {
      const { id } = await crearTrabajador();
      await marcar(id, 'ayer', '2026-05-04T08:00:00Z').expect(400);
    });

    it('trabajador inexistente es 404', async () => {
      await marcar(999_999, '2026-05-04T08:00:00Z', '2026-05-04T17:00:00Z').expect(404);
    });

    it('una marca que se solapa con otra es 409', async () => {
      const { id } = await crearTrabajador();
      await marcar(id, '2026-05-04T08:00:00Z', '2026-05-04T17:00:00Z').expect(201);
      await marcar(id, '2026-05-04T16:00:00Z', '2026-05-04T18:00:00Z').expect(409);
      // pegada justo al final no se solapa
      await marcar(id, '2026-05-04T17:00:00Z', '2026-05-04T18:00:00Z').expect(201);
    });
  });

  describe('GET /trabajadores/:id/semana', () => {
    it('calcula horas ordinarias, extra y monto', async () => {
      const { id } = await crearTrabajador('Luis Soto', 900_000); // valor hora 5000
      // lunes a viernes, 9 h cada dia = 45 h
      for (const d of ['04', '05', '06', '07', '08']) {
        await marcar(id, `2026-05-${d}T08:00:00Z`, `2026-05-${d}T17:00:00Z`).expect(201);
      }
      const r = await http().get(`/trabajadores/${id}/semana?desde=2026-05-04`).expect(200);
      expect(r.body).toMatchObject({
        horasOrdinarias: 42,
        horasExtra: 3,
        valorHora: 5000,
        montoHorasExtra: 22_500,
        diasSobreTope: [],
      });
      expect(r.body.dias).toHaveLength(7);
    });

    it('incluye la marca que cruza medianoche desde el dia anterior a la semana', async () => {
      const { id } = await crearTrabajador();
      await marcar(id, '2026-05-03T22:00:00Z', '2026-05-04T04:00:00Z').expect(201);
      const r = await http().get(`/trabajadores/${id}/semana?desde=2026-05-04`).expect(200);
      expect(r.body.horasOrdinarias).toBe(4);
    });

    it('desde faltante o mal escrito es 400; trabajador inexistente es 404', async () => {
      const { id } = await crearTrabajador();
      await http().get(`/trabajadores/${id}/semana`).expect(400);
      await http().get(`/trabajadores/${id}/semana?desde=04-05-2026`).expect(400);
      await http().get(`/trabajadores/${id}/semana?desde=2026-13-45`).expect(400);
      await http().get('/trabajadores/999999/semana?desde=2026-05-04').expect(404);
    });
  });
});
