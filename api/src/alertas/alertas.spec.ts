import { MarcaEntrada } from '../calculo/calculo.service';
import { Alerta, evaluarSemana, TipoAlerta } from './alertas';

// Semana de prueba: lunes 2026-05-04 a domingo 2026-05-10 (todo en UTC).
const DESDE = '2026-05-04';
const marca = (entrada: string, salida: string): MarcaEntrada => ({
  entrada: new Date(`${entrada}Z`),
  salida: new Date(`${salida}Z`),
});
// Un dia de trabajo de N horas desde las 08:00.
const dia = (fecha: string, horas: number): MarcaEntrada => {
  const ini = new Date(`${fecha}T08:00:00Z`);
  return { entrada: ini, salida: new Date(ini.getTime() + horas * 3_600_000) };
};
const de = (alertas: Alerta[], tipo: TipoAlerta) => alertas.filter((a) => a.tipo === tipo);
// Un dia por cada cantidad de horas, desde el lunes.
const semanaDe = (...horas: number[]) => horas.map((h, i) => dia(`2026-05-${String(4 + i).padStart(2, '0')}`, h));

describe('evaluarSemana', () => {
  it('semana vacia: sin alertas', () => {
    expect(evaluarSemana([], DESDE)).toEqual([]);
  });

  it('una semana ordenada con colacion no genera alertas', () => {
    const marcas = ['04', '05', '06', '07', '08'].flatMap((d) => [
      marca(`2026-05-${d}T08:00:00`, `2026-05-${d}T12:00:00`),
      marca(`2026-05-${d}T13:00:00`, `2026-05-${d}T17:00:00`),
    ]);
    expect(evaluarSemana(marcas, DESDE)).toEqual([]);
  });

  it('una fecha invalida falla como en el calculo semanal', () => {
    expect(() => evaluarSemana([], 'nunca')).toThrow('desde debe ser AAAA-MM-DD');
  });

  describe('mas de 2 horas extra en un dia (art. 31)', () => {
    it('justo 2 horas extra no alerta', () => {
      const alertas = evaluarSemana(semanaDe(8, 8, 8, 8, 8, 4), DESDE); // 44 h
      expect(de(alertas, 'extra_sobre_tope_diario')).toEqual([]);
    });

    it('un minuto de mas sobre las 2 horas extra alerta', () => {
      const marcas = [...semanaDe(8, 8, 8, 8, 8), marca('2026-05-09T08:00:00', '2026-05-09T12:01:00')];
      expect(de(evaluarSemana(marcas, DESDE), 'extra_sobre_tope_diario')).toEqual([
        {
          tipo: 'extra_sobre_tope_diario',
          fecha: '2026-05-09',
          detalle: '2,02 horas extra el mismo dia; el maximo es 2 por dia.',
          articulo: 'Art. 31',
        },
      ]);
    });

    it('usa lo que ya calcula CalculoService (diasSobreTope)', () => {
      // 4 dias de 8 h y un viernes de 15 h: 5 horas extra el viernes.
      const marcas = [...semanaDe(8, 8, 8, 8), dia('2026-05-08', 15)];
      const a = de(evaluarSemana(marcas, DESDE), 'extra_sobre_tope_diario');
      expect(a).toHaveLength(1);
      expect(a[0].fecha).toBe('2026-05-08');
      expect(a[0].detalle).toContain('5 horas extra');
    });
  });

  describe('jornada ordinaria diaria sobre 10 horas (art. 28)', () => {
    it('justo 10 horas no alerta', () => {
      expect(de(evaluarSemana([dia('2026-05-04', 10)], DESDE), 'jornada_diaria_excedida')).toEqual([]);
    });

    it('10 horas y un minuto alerta', () => {
      const marcas = [marca('2026-05-04T08:00:00', '2026-05-04T18:01:00')];
      expect(de(evaluarSemana(marcas, DESDE), 'jornada_diaria_excedida')).toEqual([
        {
          tipo: 'jornada_diaria_excedida',
          fecha: '2026-05-04',
          detalle: '10,02 horas ordinarias el mismo dia; el maximo es 10.',
          articulo: 'Art. 28',
        },
      ]);
    });

    it('las horas que ya son extra no cuentan como ordinarias', () => {
      // Viernes de 15 h con 10 ordinarias y 5 extra: pasa el tope de extra, no el de ordinarias.
      const marcas = [...semanaDe(8, 8, 8, 8), dia('2026-05-08', 15)];
      expect(de(evaluarSemana(marcas, DESDE), 'jornada_diaria_excedida')).toEqual([]);
    });

    it('la marca que cruza medianoche se reparte: ningun dia pasa de 10', () => {
      const marcas = [marca('2026-05-04T20:00:00', '2026-05-05T08:00:00')]; // 12 h: 4 y 8
      expect(de(evaluarSemana(marcas, DESDE), 'jornada_diaria_excedida')).toEqual([]);
    });
  });

  describe('semana con horas extra (art. 32)', () => {
    it('sin horas extra no avisa', () => {
      expect(de(evaluarSemana(semanaDe(7, 7, 7, 7, 7, 7), DESDE), 'horas_extra_con_pacto')).toEqual([]);
    });

    it('avisa una sola vez, en el primer dia con horas extra', () => {
      const a = de(evaluarSemana(semanaDe(8, 8, 8, 8, 8, 6, 3), DESDE), 'horas_extra_con_pacto');
      expect(a).toHaveLength(1);
      expect(a[0]).toMatchObject({ fecha: '2026-05-09', articulo: 'Art. 32' });
      expect(a[0].detalle).toContain('7 horas extra');
    });
  });

  describe('colacion (art. 34, criterio del proyecto)', () => {
    it('una jornada de mas de 6 horas sin pausa alerta, con la fecha de la entrada', () => {
      expect(de(evaluarSemana([dia('2026-05-05', 8)], DESDE), 'colacion')).toEqual([
        {
          tipo: 'colacion',
          fecha: '2026-05-05',
          detalle: '8 horas entre la primera entrada y la ultima salida sin una pausa de al menos 30 minutos.',
          articulo: 'Art. 34',
        },
      ]);
    });

    it('justo 6 horas no alerta; 6 horas y un minuto si', () => {
      expect(de(evaluarSemana([dia('2026-05-04', 6)], DESDE), 'colacion')).toEqual([]);
      const largo = [marca('2026-05-04T08:00:00', '2026-05-04T14:01:00')];
      expect(de(evaluarSemana(largo, DESDE), 'colacion')).toHaveLength(1);
    });

    it('una pausa de justo 30 minutos cumple; una de 29 no', () => {
      const con = [marca('2026-05-04T08:00:00', '2026-05-04T12:00:00'), marca('2026-05-04T12:30:00', '2026-05-04T17:00:00')];
      const sin = [marca('2026-05-04T08:00:00', '2026-05-04T12:00:00'), marca('2026-05-04T12:29:00', '2026-05-04T17:00:00')];
      expect(de(evaluarSemana(con, DESDE), 'colacion')).toEqual([]);
      expect(de(evaluarSemana(sin, DESDE), 'colacion')).toHaveLength(1);
    });

    it('marcas pegadas sin pausa suman una sola jornada', () => {
      const marcas = [marca('2026-05-04T08:00:00', '2026-05-04T12:00:00'), marca('2026-05-04T12:00:00', '2026-05-04T16:00:00')];
      expect(de(evaluarSemana(marcas, DESDE), 'colacion')).toHaveLength(1);
    });

    it('un turno nocturno cuenta en el dia en que empieza y alerta una sola vez', () => {
      const a = de(evaluarSemana([marca('2026-05-04T20:00:00', '2026-05-05T05:00:00')], DESDE), 'colacion');
      expect(a.map((x) => x.fecha)).toEqual(['2026-05-04']);
    });
  });

  describe('registro dudoso (art. 33)', () => {
    it('marcas superpuestas alertan en la fecha de la segunda entrada', () => {
      const marcas = [marca('2026-05-04T08:00:00', '2026-05-04T12:00:00'), marca('2026-05-04T11:00:00', '2026-05-04T15:00:00')];
      const a = de(evaluarSemana(marcas, DESDE), 'registro_dudoso');
      expect(a).toHaveLength(1);
      expect(a[0]).toMatchObject({ fecha: '2026-05-04', articulo: 'Art. 33' });
      expect(a[0].detalle).toContain('superpuestas');
    });

    it('marcas pegadas no son superposicion', () => {
      const marcas = [marca('2026-05-04T08:00:00', '2026-05-04T12:00:00'), marca('2026-05-04T12:00:00', '2026-05-04T15:00:00')];
      expect(de(evaluarSemana(marcas, DESDE), 'registro_dudoso')).toEqual([]);
    });

    it('una marca contenida dentro de otra tambien se detecta', () => {
      const marcas = [
        marca('2026-05-04T08:00:00', '2026-05-04T18:00:00'),
        marca('2026-05-04T09:00:00', '2026-05-04T10:00:00'),
        marca('2026-05-04T11:00:00', '2026-05-04T12:00:00'),
      ];
      expect(de(evaluarSemana(marcas, DESDE), 'registro_dudoso')).toHaveLength(2);
    });

    it('justo 16 horas no alerta; 16 horas y un minuto si', () => {
      expect(de(evaluarSemana([dia('2026-05-04', 16)], DESDE), 'registro_dudoso')).toEqual([]);
      const a = de(evaluarSemana([marca('2026-05-04T08:00:00', '2026-05-05T00:01:00')], DESDE), 'registro_dudoso');
      expect(a).toHaveLength(1);
      expect(a[0].detalle).toBe('Una sola marca de 16,02 horas; es probable que falte marcar la salida.');
    });

    it('una marca larga que empezo antes de la semana se avisa en su semana, no en esta', () => {
      const marcas = [marca('2026-05-03T20:00:00', '2026-05-04T13:00:00')]; // 17 h
      expect(de(evaluarSemana(marcas, DESDE), 'registro_dudoso')).toEqual([]);
      expect(de(evaluarSemana(marcas, '2026-04-27'), 'registro_dudoso')).toHaveLength(1);
    });
  });

  it('ordena por fecha y luego por tipo', () => {
    const marcas = [dia('2026-05-06', 12), dia('2026-05-04', 11)];
    const alertas = evaluarSemana(marcas, DESDE);
    expect(alertas.map((a) => `${a.fecha} ${a.tipo}`)).toEqual([
      '2026-05-04 colacion',
      '2026-05-04 jornada_diaria_excedida',
      '2026-05-06 colacion',
      '2026-05-06 jornada_diaria_excedida',
    ]);
  });
});
