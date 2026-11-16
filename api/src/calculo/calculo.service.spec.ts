import { BadRequestException } from '@nestjs/common';
import { CalculoService, MarcaEntrada, valorHora } from './calculo.service';

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

describe('CalculoService', () => {
  const servicio = new CalculoService();
  const SUELDO = 900_000; // valor hora = 900000 / 180 = 5000

  it('calcula el valor hora con la jornada de 42 horas', () => {
    expect(valorHora(SUELDO)).toBeCloseTo(5000, 6);
  });

  it('semana vacia: todo en cero', () => {
    const r = servicio.calcularSemana([], SUELDO, DESDE);
    expect(r).toMatchObject({ horasOrdinarias: 0, horasExtra: 0, montoHorasExtra: 0, valorHora: 5000 });
    expect(r.hasta).toBe('2026-05-10');
  });

  it('exactamente 42 horas: nada de extra', () => {
    const marcas = ['04', '05', '06', '07', '08', '09'].map((d) => dia(`2026-05-${d}`, 7));
    const r = servicio.calcularSemana(marcas, SUELDO, DESDE);
    expect(r.horasOrdinarias).toBe(42);
    expect(r.horasExtra).toBe(0);
    expect(r.montoHorasExtra).toBe(0);
  });

  it('42 horas y un minuto: un minuto de extra', () => {
    const marcas = ['04', '05', '06', '07', '08', '09'].map((d) => dia(`2026-05-${d}`, 7));
    marcas.push(marca('2026-05-10T08:00:00', '2026-05-10T08:01:00'));
    const r = servicio.calcularSemana(marcas, SUELDO, DESDE);
    expect(r.horasOrdinarias).toBe(42);
    expect(r.horasExtra).toBe(0.02); // 1 minuto redondeado a 2 decimales
    expect(r.montoHorasExtra).toBe(125); // 1/60 h * 5000 * 1.5
  });

  it('paga las horas extra con 50 % de recargo', () => {
    // lunes a viernes 8 h + sabado 4 h = 44 h: 2 h extra, 2 * 5000 * 1.5 = 15000
    const marcas = ['04', '05', '06', '07', '08'].map((d) => dia(`2026-05-${d}`, 8));
    marcas.push(dia('2026-05-09', 4));
    const r = servicio.calcularSemana(marcas, SUELDO, DESDE);
    expect(r.horasOrdinarias).toBe(42);
    expect(r.horasExtra).toBe(2);
    expect(r.montoHorasExtra).toBe(15_000);
    expect(r.diasSobreTope).toEqual([]);
  });

  it('la marca que cruza medianoche se reparte entre los dos dias', () => {
    const r = servicio.calcularSemana([marca('2026-05-04T22:00:00', '2026-05-05T06:00:00')], SUELDO, DESDE);
    expect(r.dias[0]).toMatchObject({ fecha: '2026-05-04', horas: 2 });
    expect(r.dias[1]).toMatchObject({ fecha: '2026-05-05', horas: 6 });
    expect(r.horasOrdinarias).toBe(8);
  });

  it('recorta la parte de una marca que cae fuera de la semana', () => {
    const r = servicio.calcularSemana([marca('2026-05-03T20:00:00', '2026-05-04T02:00:00')], SUELDO, DESDE);
    expect(r.horasOrdinarias).toBe(2); // solo las 2 h del lunes
  });

  it('avisa los dias con mas de 2 horas extra, pero igual las paga', () => {
    // 4 dias de 8 h = 32 h, y el viernes 15 h: total 47 h => 5 h extra ese dia.
    const marcas = [dia('2026-05-04', 8), dia('2026-05-05', 8), dia('2026-05-06', 8), dia('2026-05-07', 8), dia('2026-05-08', 15)];
    const r = servicio.calcularSemana(marcas, SUELDO, DESDE);
    expect(r.horasExtra).toBe(5);
    expect(r.diasSobreTope).toEqual(['2026-05-08']);
    expect(r.montoHorasExtra).toBe(37_500); // 5 * 5000 * 1.5
  });

  it('exactamente 2 horas extra en un dia no pasa el tope', () => {
    const marcas = [dia('2026-05-04', 8), dia('2026-05-05', 8), dia('2026-05-06', 8), dia('2026-05-07', 8), dia('2026-05-08', 12)];
    const r = servicio.calcularSemana(marcas, SUELDO, DESDE);
    expect(r.horasExtra).toBe(2);
    expect(r.diasSobreTope).toEqual([]);
  });

  it('salida antes de entrada es error 400', () => {
    const mala = marca('2026-05-04T17:00:00', '2026-05-04T08:00:00');
    expect(() => servicio.calcularSemana([mala], SUELDO, DESDE)).toThrow(BadRequestException);
  });

  it('salida igual a la entrada tambien es error 400', () => {
    const mala = marca('2026-05-04T08:00:00', '2026-05-04T08:00:00');
    expect(() => servicio.calcularSemana([mala], SUELDO, DESDE)).toThrow(BadRequestException);
  });

  it('fecha desde invalida es error 400', () => {
    expect(() => servicio.calcularSemana([], SUELDO, 'manana')).toThrow(BadRequestException);
  });
});
