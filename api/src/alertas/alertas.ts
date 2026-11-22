import { CalculoService, MarcaEntrada } from '../calculo/calculo.service';

// Reglas de jornada (ver README, seccion Alertas). Las horas extra y el tope diario
// salen de CalculoService; aqui solo se agregan las reglas que ese calculo no mira.
export const MAX_ORDINARIA_DIARIA_HORAS = 10; // art. 28
export const COLACION_MIN_PAUSA_MIN = 30; // art. 34: "a lo menos, media hora"
// Criterio del proyecto, no texto de la ley: el art. 34 no fija desde cuantas horas
// se exige colacion. Solo se avisa si entre la primera entrada y la ultima salida
// pasan mas de 6 horas y no hay una pausa de media hora.
export const COLACION_DESDE_HORAS = 6;
export const MARCA_SOSPECHOSA_HORAS = 16; // probable olvido de marcar la salida

export type TipoAlerta =
  | 'extra_sobre_tope_diario'
  | 'jornada_diaria_excedida'
  | 'horas_extra_con_pacto'
  | 'colacion'
  | 'registro_dudoso';

export interface Alerta {
  tipo: TipoAlerta;
  fecha: string; // AAAA-MM-DD (UTC)
  detalle: string;
  articulo: string;
}

const HORA_MS = 3_600_000;
const MIN_MS = 60_000;
const calculo = new CalculoService();

const aFecha = (ms: number) => new Date(ms).toISOString().slice(0, 10);
// Numeros para el texto: coma decimal, sin ceros de sobra ("2,5", "10").
const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

// Alertas de una semana (los 7 dias desde `desde`, igual que CalculoService).
// Es una funcion pura: no lee la base ni la hora actual. Orden: fecha y luego tipo.
export function evaluarSemana(marcas: MarcaEntrada[], desde: string): Alerta[] {
  const semana = calculo.calcularSemana(marcas, 0, desde); // el sueldo no importa aqui
  const alertas: Alerta[] = [];

  for (const dia of semana.dias) {
    if (semana.diasSobreTope.includes(dia.fecha)) {
      alertas.push({
        tipo: 'extra_sobre_tope_diario',
        fecha: dia.fecha,
        detalle: `${num(dia.horasExtra)} horas extra el mismo dia; el maximo es 2 por dia.`,
        articulo: 'Art. 31',
      });
    }
    const ordinarias = Math.round((dia.horas - dia.horasExtra) * 100) / 100;
    if (ordinarias > MAX_ORDINARIA_DIARIA_HORAS) {
      alertas.push({
        tipo: 'jornada_diaria_excedida',
        fecha: dia.fecha,
        detalle: `${num(ordinarias)} horas ordinarias el mismo dia; el maximo es ${MAX_ORDINARIA_DIARIA_HORAS}.`,
        articulo: 'Art. 28',
      });
    }
  }

  const primerDiaExtra = semana.dias.find((d) => d.horasExtra > 0);
  if (primerDiaExtra) {
    alertas.push({
      tipo: 'horas_extra_con_pacto',
      fecha: primerDiaExtra.fecha,
      detalle: `${num(semana.horasExtra)} horas extra en la semana. Deben estar en un pacto escrito de hasta 3 meses; sin pacto igual se pagan con recargo si el empleador sabia.`,
      articulo: 'Art. 32',
    });
  }

  const enSemana = (fecha: string) => fecha >= semana.desde && fecha <= semana.hasta;
  alertas.push(...alertasColacion(marcas).filter((a) => enSemana(a.fecha)));
  alertas.push(...alertasRegistro(marcas).filter((a) => enSemana(a.fecha)));

  return alertas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo));
}

const porEntrada = (marcas: MarcaEntrada[]) =>
  [...marcas].sort((a, b) => a.entrada.getTime() - b.entrada.getTime());

// Las marcas se agrupan por el dia (UTC) de su entrada: un turno que cruza medianoche cuenta en el dia en que empezo.
function alertasColacion(marcas: MarcaEntrada[]): Alerta[] {
  const porDia = new Map<string, MarcaEntrada[]>();
  for (const m of porEntrada(marcas)) {
    const fecha = aFecha(m.entrada.getTime());
    porDia.set(fecha, [...(porDia.get(fecha) ?? []), m]);
  }
  const alertas: Alerta[] = [];
  for (const [fecha, delDia] of porDia) {
    let finMax = delDia[0].salida.getTime();
    let hayPausa = false;
    for (const m of delDia.slice(1)) {
      if (m.entrada.getTime() - finMax >= COLACION_MIN_PAUSA_MIN * MIN_MS) hayPausa = true;
      finMax = Math.max(finMax, m.salida.getTime());
    }
    const horas = (finMax - delDia[0].entrada.getTime()) / HORA_MS;
    if (horas > COLACION_DESDE_HORAS && !hayPausa) {
      alertas.push({
        tipo: 'colacion',
        fecha,
        detalle: `${num(horas)} horas entre la primera entrada y la ultima salida sin una pausa de al menos ${COLACION_MIN_PAUSA_MIN} minutos.`,
        articulo: 'Art. 34',
      });
    }
  }
  return alertas;
}

function alertasRegistro(marcas: MarcaEntrada[]): Alerta[] {
  const alertas: Alerta[] = [];
  const ordenadas = porEntrada(marcas);
  let finMax = -Infinity;
  for (const m of ordenadas) {
    const fecha = aFecha(m.entrada.getTime());
    const horas = (m.salida.getTime() - m.entrada.getTime()) / HORA_MS;
    if (m.entrada.getTime() < finMax) {
      alertas.push({
        tipo: 'registro_dudoso',
        fecha,
        detalle: 'Hay marcas superpuestas del mismo trabajador: las horas se estarian contando dos veces.',
        articulo: 'Art. 33',
      });
    }
    if (horas > MARCA_SOSPECHOSA_HORAS) {
      alertas.push({
        tipo: 'registro_dudoso',
        fecha,
        detalle: `Una sola marca de ${num(horas)} horas; es probable que falte marcar la salida.`,
        articulo: 'Art. 33',
      });
    }
    finMax = Math.max(finMax, m.salida.getTime());
  }
  return alertas;
}
