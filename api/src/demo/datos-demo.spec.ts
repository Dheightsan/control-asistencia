import { CalculoService } from '../calculo/calculo.service';
import { datosDemo, lunesUtc } from './datos-demo';

describe('datos de la demo', () => {
  it('lunesUtc devuelve el lunes de la semana', () => {
    expect(lunesUtc(new Date('2026-05-04T10:00:00Z'))).toBe('2026-05-04'); // lunes
    expect(lunesUtc(new Date('2026-05-07T23:59:00Z'))).toBe('2026-05-04'); // jueves
    expect(lunesUtc(new Date('2026-05-10T12:00:00Z'))).toBe('2026-05-04'); // domingo
    expect(lunesUtc(new Date('2026-03-01T12:00:00Z'))).toBe('2026-02-23'); // cruza de mes
  });

  it('cada trabajador muestra un caso distinto de la regla', () => {
    const calculo = new CalculoService();
    const [ana, luis, marta] = datosDemo('2026-05-04').map((t) => calculo.calcularSemana(t.marcas, t.sueldoBase, '2026-05-04'));

    expect(ana).toMatchObject({ horasOrdinarias: 42, horasExtra: 2, montoHorasExtra: 15_000, diasSobreTope: [] });
    expect(luis).toMatchObject({ horasOrdinarias: 42, horasExtra: 5, diasSobreTope: ['2026-05-08'] });
    expect(marta).toMatchObject({ horasOrdinarias: 40, horasExtra: 0, montoHorasExtra: 0 });
  });
});
