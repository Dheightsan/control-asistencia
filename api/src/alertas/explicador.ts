import { Alerta, TipoAlerta } from './alertas';

// Convierte alertas en frases simples, una por alerta y en el mismo orden.
export interface Explicador {
  explicar(alertas: Alerta[]): Promise<string[]>;
}

export const EXPLICADOR_IA = 'EXPLICADOR_IA';

const FRASES: Record<TipoAlerta, (a: Alerta) => string> = {
  extra_sobre_tope_diario: (a) =>
    `El ${a.fecha} hubo mas horas extra de las permitidas en un dia: ${a.detalle} Conviene revisar ese dia o pedir que no se repita (${a.articulo}).`,
  jornada_diaria_excedida: (a) =>
    `El ${a.fecha} la jornada ordinaria paso el maximo diario: ${a.detalle} Hay que repartir mejor las horas (${a.articulo}).`,
  horas_extra_con_pacto: (a) =>
    `Desde el ${a.fecha} la semana tiene horas extra. ${a.detalle} Revisa que exista el pacto por escrito (${a.articulo}).`,
  colacion: (a) =>
    `El ${a.fecha} no se ve el tiempo de colacion: ${a.detalle} Si hubo colacion, falta registrarla; si no, hay que darla (${a.articulo}).`,
  registro_dudoso: (a) =>
    `El ${a.fecha} el registro no es confiable: ${a.detalle} Corrigelo antes de calcular horas o pagar (${a.articulo}).`,
};

// Por defecto: texto fijo, sin red, siempre igual para las mismas alertas.
export class ExplicadorPlantilla implements Explicador {
  async explicar(alertas: Alerta[]): Promise<string[]> {
    return alertas.map((a) => FRASES[a.tipo](a));
  }
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

export const MODELO_IA = 'claude-haiku-5-5';

const INSTRUCCION =
  'Reescribe cada alerta en una frase corta en espanol simple, para alguien que no sabe de leyes. ' +
  'Usa solo los datos dados: no agregues hechos, fechas, cifras ni articulos nuevos. ' +
  'Nombra la fecha de cada alerta tal como viene (AAAA-MM-DD). ' +
  'Responde solo con un arreglo JSON de strings, uno por alerta y en el mismo orden.';

// Opcional: reescribe con la API de Anthropic. Si algo falla lanza; quien lo usa valida y cae a la plantilla.
export class ExplicadorAnthropic implements Explicador {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: Fetcher = (url, init) => fetch(url, init),
  ) {}

  async explicar(alertas: Alerta[]): Promise<string[]> {
    const res = await this.fetcher('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODELO_IA,
        max_tokens: 700,
        system: INSTRUCCION,
        messages: [{ role: 'user', content: JSON.stringify(alertas) }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Anthropic respondio ${res.status}`);
    const cuerpo = (await res.json()) as { content?: { type: string; text?: string }[] };
    const texto = cuerpo.content?.find((b) => b.type === 'text')?.text ?? '';
    return JSON.parse(texto.slice(texto.indexOf('['), texto.lastIndexOf(']') + 1)) as string[];
  }
}

const FECHA = /\d{4}-\d{2}-\d{2}/g;
const CIFRA = /\d+(?:[.,]\d+)?/g;
const cifras = (texto: string) =>
  new Set((texto.replace(FECHA, ' ').match(CIFRA) ?? []).map((c) => String(parseFloat(c.replace(',', '.')))));

// La frase debe nombrar la fecha de su alerta y no traer cifras que no esten en la alerta.
export function explicacionValida(alerta: Alerta, frase: unknown): frase is string {
  if (typeof frase !== 'string' || frase.trim() === '' || frase.length > 600) return false;
  if (!frase.includes(alerta.fecha)) return false;
  // Otras fechas tambien cuentan como cifras nuevas si no son la de la alerta.
  if ((frase.match(FECHA) ?? []).some((f) => f !== alerta.fecha)) return false;
  const permitidas = cifras(`${alerta.detalle} ${alerta.articulo}`);
  return [...cifras(frase)].every((c) => permitidas.has(c));
}

export interface Explicacion {
  explicaciones: string[];
  explicadoCon: 'plantilla' | 'ia';
}

// Usa la IA si hay un explicador y su salida pasa la validacion; si no, la plantilla.
export async function explicar(alertas: Alerta[], ia: Explicador | null): Promise<Explicacion> {
  const plantilla = await new ExplicadorPlantilla().explicar(alertas);
  if (ia && alertas.length > 0) {
    try {
      const frases = await ia.explicar(alertas);
      if (Array.isArray(frases) && frases.length === alertas.length && alertas.every((a, i) => explicacionValida(a, frases[i]))) {
        return { explicaciones: frases, explicadoCon: 'ia' };
      }
    } catch {
      // Sin red, sin cupo o respuesta mal formada: se usa la plantilla.
    }
  }
  return { explicaciones: plantilla, explicadoCon: 'plantilla' };
}

// Solo con EXPLICAR_CON_IA=1 y una clave en el entorno. La clave no se guarda en ningun archivo.
export function explicadorDesdeEntorno(env: NodeJS.ProcessEnv = process.env): Explicador | null {
  return env.EXPLICAR_CON_IA === '1' && env.ANTHROPIC_API_KEY ? new ExplicadorAnthropic(env.ANTHROPIC_API_KEY) : null;
}
