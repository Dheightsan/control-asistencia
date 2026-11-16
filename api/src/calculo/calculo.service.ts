import { BadRequestException, Injectable } from '@nestjs/common';

// Regla chilena 2026 (ver README): 42 horas ordinarias por semana,
// recargo de 50 % sobre la hora ordinaria y tope de 2 horas extra por dia.
export const HORAS_SEMANA = 42;
export const RECARGO_EXTRA = 0.5;
export const TOPE_EXTRA_DIARIO_HORAS = 2;

const MIN_DIA = 24 * 60;
const MS_MIN = 60_000;

export interface MarcaEntrada {
  entrada: Date;
  salida: Date;
}

export interface DiaCalculado {
  fecha: string; // AAAA-MM-DD
  horas: number;
  horasExtra: number;
}

export interface ResultadoSemana {
  desde: string;
  hasta: string; // ultimo dia incluido
  horasOrdinarias: number;
  horasExtra: number;
  valorHora: number;
  montoHorasExtra: number;
  dias: DiaCalculado[];
  // Dias donde las horas extra pasan el tope diario. Se pagan igual; se avisan al empleador.
  diasSobreTope: string[];
}

const aHoras = (minutos: number) => Math.round((minutos / 60) * 100) / 100;
const aFecha = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// Valor de la hora ordinaria: sueldo mensual / 30 * 7 / horas de la semana (criterio de la DT).
export function valorHora(sueldoBase: number): number {
  return ((sueldoBase / 30) * 7) / HORAS_SEMANA;
}

export function validarMarca(m: MarcaEntrada): void {
  if (Number.isNaN(m.entrada.getTime()) || Number.isNaN(m.salida.getTime())) {
    throw new BadRequestException('Fecha invalida');
  }
  if (m.salida.getTime() <= m.entrada.getTime()) {
    throw new BadRequestException('La salida debe ser posterior a la entrada');
  }
}

@Injectable()
export class CalculoService {
  // `desde` es AAAA-MM-DD; la semana son los 7 dias desde esa fecha (UTC, ver README).
  calcularSemana(marcas: MarcaEntrada[], sueldoBase: number, desde: string): ResultadoSemana {
    const inicio = Date.parse(`${desde}T00:00:00Z`);
    if (Number.isNaN(inicio)) throw new BadRequestException('desde debe ser AAAA-MM-DD');
    const fin = inicio + 7 * MIN_DIA * MS_MIN;

    // 1) Minutos trabajados por dia. Una marca que cruza medianoche se parte en dos dias.
    const minutosPorDia = new Array<number>(7).fill(0);
    for (const marca of marcas) {
      validarMarca(marca);
      const desdeMs = Math.max(marca.entrada.getTime(), inicio);
      const hastaMs = Math.min(marca.salida.getTime(), fin);
      for (let dia = 0; dia < 7; dia++) {
        const diaIni = inicio + dia * MIN_DIA * MS_MIN;
        const diaFin = diaIni + MIN_DIA * MS_MIN;
        const solape = Math.min(hastaMs, diaFin) - Math.max(desdeMs, diaIni);
        if (solape > 0) minutosPorDia[dia] += solape / MS_MIN;
      }
    }

    // 2) Se acumula dia a dia: lo que pasa de 42 h en la semana es extra.
    const limiteMin = HORAS_SEMANA * 60;
    let acumulado = 0;
    let extraTotal = 0;
    const dias: DiaCalculado[] = [];
    const diasSobreTope: string[] = [];
    minutosPorDia.forEach((min, dia) => {
      const ordinarioDelDia = Math.max(0, Math.min(min, limiteMin - acumulado));
      const extraDelDia = min - ordinarioDelDia;
      acumulado += min;
      extraTotal += extraDelDia;
      const fecha = aFecha(inicio + dia * MIN_DIA * MS_MIN);
      dias.push({ fecha, horas: aHoras(min), horasExtra: aHoras(extraDelDia) });
      if (extraDelDia > TOPE_EXTRA_DIARIO_HORAS * 60) diasSobreTope.push(fecha);
    });

    const vh = valorHora(sueldoBase);
    return {
      desde,
      hasta: aFecha(fin - MS_MIN),
      horasOrdinarias: aHoras(acumulado - extraTotal),
      horasExtra: aHoras(extraTotal),
      valorHora: Math.round(vh),
      montoHorasExtra: Math.round((extraTotal / 60) * vh * (1 + RECARGO_EXTRA)),
      dias,
      diasSobreTope,
    };
  }
}
