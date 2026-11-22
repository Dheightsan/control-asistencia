import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EXPLICADOR_IA, Explicador } from '../src/alertas/explicador';
import { configurarApp } from '../src/configurar-app';

describe('API (contra PostgreSQL real)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    // Sin IA, aunque el entorno tenga clave: las pruebas no salen a la red.
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EXPLICADOR_IA)
      .useValue(null)
      .compile();
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
      // lunes a viernes 8 h + sabado 4 h = 44 h
      for (const d of ['04', '05', '06', '07', '08']) {
        await marcar(id, `2026-05-${d}T08:00:00Z`, `2026-05-${d}T16:00:00Z`).expect(201);
      }
      await marcar(id, '2026-05-09T08:00:00Z', '2026-05-09T12:00:00Z').expect(201);
      const r = await http().get(`/trabajadores/${id}/semana?desde=2026-05-04`).expect(200);
      expect(r.body).toMatchObject({
        horasOrdinarias: 42,
        horasExtra: 2,
        valorHora: 5000,
        montoHorasExtra: 15_000,
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
  describe('GET /trabajadores/:id/alertas', () => {
    it('semana sin marcas: lista vacia', async () => {
      const { id } = await crearTrabajador();
      const r = await http().get(`/trabajadores/${id}/alertas?desde=2026-05-04`).expect(200);
      expect(r.body).toEqual({ desde: '2026-05-04', hasta: '2026-05-10', explicadoCon: 'plantilla', alertas: [] });
    });

    it('devuelve las alertas de la semana con su explicacion', async () => {
      const { id } = await crearTrabajador('Rosa Mena');
      // lunes 11 h seguidas (sin colacion, sobre 10 h ordinarias) y martes bien repartido
      await marcar(id, '2026-05-04T08:00:00Z', '2026-05-04T19:00:00Z').expect(201);
      await marcar(id, '2026-05-05T08:00:00Z', '2026-05-05T12:00:00Z').expect(201);
      await marcar(id, '2026-05-05T13:00:00Z', '2026-05-05T17:00:00Z').expect(201);
      const r = await http().get(`/trabajadores/${id}/alertas?desde=2026-05-04`).expect(200);
      expect(r.body.alertas.map((a: { tipo: string; fecha: string; articulo: string }) => [a.fecha, a.tipo, a.articulo])).toEqual([
        ['2026-05-04', 'colacion', 'Art. 34'],
        ['2026-05-04', 'jornada_diaria_excedida', 'Art. 28'],
      ]);
      expect(r.body.explicadoCon).toBe('plantilla');
      expect(r.body.alertas[1].explicacion).toContain('2026-05-04');
    });

    it('avisa las horas extra con pacto y el tope diario', async () => {
      const { id } = await crearTrabajador('Pedro Lara');
      for (const d of ['04', '05', '06', '07']) {
        await marcar(id, `2026-05-${d}T08:00:00Z`, `2026-05-${d}T12:00:00Z`).expect(201);
        await marcar(id, `2026-05-${d}T13:00:00Z`, `2026-05-${d}T17:00:00Z`).expect(201);
      }
      await marcar(id, '2026-05-08T06:00:00Z', '2026-05-08T10:00:00Z').expect(201);
      await marcar(id, '2026-05-08T11:00:00Z', '2026-05-08T21:00:00Z').expect(201); // 14 h el viernes
      const r = await http().get(`/trabajadores/${id}/alertas?desde=2026-05-04`).expect(200);
      const tipos = r.body.alertas.map((a: { tipo: string }) => a.tipo);
      expect(tipos).toEqual(expect.arrayContaining(['extra_sobre_tope_diario', 'horas_extra_con_pacto']));
    });

    it('una marca de mas de 16 horas queda como registro dudoso', async () => {
      const { id } = await crearTrabajador();
      await marcar(id, '2026-05-04T06:00:00Z', '2026-05-05T01:00:00Z').expect(201);
      const r = await http().get(`/trabajadores/${id}/alertas?desde=2026-05-04`).expect(200);
      expect(r.body.alertas.some((a: { tipo: string }) => a.tipo === 'registro_dudoso')).toBe(true);
    });

    it('desde faltante o mal escrito es 400; trabajador inexistente es 404', async () => {
      const { id } = await crearTrabajador();
      await http().get(`/trabajadores/${id}/alertas`).expect(400);
      await http().get(`/trabajadores/${id}/alertas?desde=04-05-2026`).expect(400);
      await http().get(`/trabajadores/${id}/alertas?desde=2026-13-45`).expect(400);
      await http().get('/trabajadores/abc/alertas?desde=2026-05-04').expect(400);
      await http().get('/trabajadores/999999/alertas?desde=2026-05-04').expect(404);
    });
  });

  describe('alertas con explicador de IA (cliente falso)', () => {
    let appIa: INestApplication;
    const ia: Explicador = { explicar: async (alertas) => alertas.map((a) => `Revisar el ${a.fecha}.`) };

    beforeAll(async () => {
      const modulo = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(EXPLICADOR_IA)
        .useValue(ia)
        .compile();
      appIa = modulo.createNestApplication();
      configurarApp(appIa);
      await appIa.init();
    });
    afterAll(async () => {
      await appIa.close();
    });

    it('usa la explicacion de la IA cuando es valida', async () => {
      const { id } = (await request(appIa.getHttpServer()).post('/trabajadores').send({ nombre: 'Eva', sueldoBase: 900_000 }).expect(201)).body;
      await request(appIa.getHttpServer()).post('/marcas').send({ trabajadorId: id, entrada: '2026-05-04T08:00:00Z', salida: '2026-05-04T19:00:00Z' }).expect(201);
      const r = await request(appIa.getHttpServer()).get(`/trabajadores/${id}/alertas?desde=2026-05-04`).expect(200);
      expect(r.body.explicadoCon).toBe('ia');
      expect(r.body.alertas[0].explicacion).toBe('Revisar el 2026-05-04.');
    });
  });
});
