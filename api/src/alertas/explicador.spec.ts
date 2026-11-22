import { Alerta } from './alertas';
import {
  explicacionValida,
  explicadorDesdeEntorno,
  ExplicadorAnthropic,
  ExplicadorPlantilla,
  explicar,
  Fetcher,
  MODELO_IA,
} from './explicador';

const A1: Alerta = {
  tipo: 'jornada_diaria_excedida',
  fecha: '2026-05-04',
  detalle: '11 horas ordinarias el mismo dia; el maximo es 10.',
  articulo: 'Art. 28',
};
const A2: Alerta = {
  tipo: 'colacion',
  fecha: '2026-05-05',
  detalle: '8 horas entre la primera entrada y la ultima salida sin una pausa de al menos 30 minutos.',
  articulo: 'Art. 34',
};

// Cliente falso: responde con el texto dado y guarda las llamadas. Nada sale a la red.
function falso(texto: string, ok = true) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const fetcher: Fetcher = async (url, init) => {
    llamadas.push({ url, init });
    return { ok, status: ok ? 200 : 500, json: async () => ({ content: [{ type: 'text', text: texto }] }) };
  };
  return { fetcher, llamadas };
}

describe('ExplicadorPlantilla', () => {
  it('da una frase por alerta, con su fecha y su articulo', async () => {
    const frases = await new ExplicadorPlantilla().explicar([A1, A2]);
    expect(frases).toHaveLength(2);
    expect(frases[0]).toContain('2026-05-04');
    expect(frases[0]).toContain('Art. 28');
    expect(frases[1]).toContain('2026-05-05');
  });

  it('es determinista y cubre todos los tipos', async () => {
    const tipos: Alerta['tipo'][] = [
      'extra_sobre_tope_diario',
      'jornada_diaria_excedida',
      'horas_extra_con_pacto',
      'colacion',
      'registro_dudoso',
    ];
    const alertas = tipos.map((tipo) => ({ ...A1, tipo }));
    const p = new ExplicadorPlantilla();
    const frases = await p.explicar(alertas);
    expect(frases).toEqual(await p.explicar(alertas));
    expect(frases.every((f) => f.includes('2026-05-04'))).toBe(true);
  });
});

describe('explicacionValida', () => {
  it('acepta una frase con la fecha y solo cifras de la alerta', () => {
    expect(explicacionValida(A1, 'El 2026-05-04 trabajo 11 horas y el maximo diario es 10 (Art. 28).')).toBe(true);
  });
  it('rechaza si falta la fecha', () => {
    expect(explicacionValida(A1, 'Trabajo 11 horas ese lunes.')).toBe(false);
  });
  it('rechaza una cifra inventada', () => {
    expect(explicacionValida(A1, 'El 2026-05-04 trabajo 12 horas.')).toBe(false);
  });
  it('rechaza otra fecha, texto vacio y tipos raros', () => {
    expect(explicacionValida(A1, 'El 2026-05-04 y el 2026-05-05 hubo exceso de 11 horas.')).toBe(false);
    expect(explicacionValida(A1, '')).toBe(false);
    expect(explicacionValida(A1, 42)).toBe(false);
  });
  it('trata 11 y 11,0 como la misma cifra', () => {
    expect(explicacionValida(A1, 'El 2026-05-04 fueron 11,0 horas.')).toBe(true);
  });
});

describe('explicar', () => {
  const buena = JSON.stringify([
    'El 2026-05-04 trabajo 11 horas ordinarias y el maximo es 10.',
    'El 2026-05-05 pasaron 8 horas sin una pausa de 30 minutos.',
  ]);

  it('sin cliente de IA usa la plantilla', async () => {
    const r = await explicar([A1, A2], null);
    expect(r.explicadoCon).toBe('plantilla');
    expect(r.explicaciones).toHaveLength(2);
  });

  it('con IA y salida valida usa la salida de la IA', async () => {
    const { fetcher, llamadas } = falso(`Aqui va: ${buena}`);
    const r = await explicar([A1, A2], new ExplicadorAnthropic('clave-de-prueba', fetcher));
    expect(r.explicadoCon).toBe('ia');
    expect(r.explicaciones[0]).toContain('11 horas');
    expect(llamadas).toHaveLength(1);
    const cuerpo = JSON.parse(String(llamadas[0].init.body));
    expect(llamadas[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(cuerpo.model).toBe(MODELO_IA);
    expect(cuerpo.max_tokens).toBeLessThanOrEqual(1000);
    expect(cuerpo.messages[0].content).toBe(JSON.stringify([A1, A2]));
    expect((llamadas[0].init.headers as Record<string, string>)['x-api-key']).toBe('clave-de-prueba');
  });

  const casosMalos: [string, string][] = [
    ['cifra inventada', JSON.stringify(['El 2026-05-04 fueron 13 horas.', 'El 2026-05-05 pasaron 8 horas.'])],
    ['falta una fecha', JSON.stringify(['El 2026-05-04 fueron 11 horas.', 'Ese dia pasaron 8 horas.'])],
    ['cantidad distinta de frases', JSON.stringify(['El 2026-05-04 y el 2026-05-05 fueron 11 y 8 horas.'])],
    ['no es JSON', 'no pude hacerlo'],
    ['no son strings', JSON.stringify([1, 2])],
  ];
  it.each(casosMalos)('si la salida falla la validacion (%s) usa la plantilla', async (_nombre, texto) => {
    const { fetcher } = falso(texto);
    const r = await explicar([A1, A2], new ExplicadorAnthropic('k', fetcher));
    expect(r.explicadoCon).toBe('plantilla');
    expect(r.explicaciones).toEqual(await new ExplicadorPlantilla().explicar([A1, A2]));
  });

  it('si la API responde con error usa la plantilla', async () => {
    const r = await explicar([A1], new ExplicadorAnthropic('k', falso('[]', false).fetcher));
    expect(r.explicadoCon).toBe('plantilla');
  });

  it('si la llamada lanza (sin red) usa la plantilla', async () => {
    const roto: Fetcher = async () => {
      throw new Error('ENOTFOUND');
    };
    const r = await explicar([A1], new ExplicadorAnthropic('k', roto));
    expect(r.explicadoCon).toBe('plantilla');
  });

  it('sin alertas no llama a la IA', async () => {
    const { fetcher, llamadas } = falso('[]');
    const r = await explicar([], new ExplicadorAnthropic('k', fetcher));
    expect(r).toEqual({ explicaciones: [], explicadoCon: 'plantilla' });
    expect(llamadas).toHaveLength(0);
  });
});

describe('explicadorDesdeEntorno', () => {
  it('solo se activa con EXPLICAR_CON_IA=1 y una clave', () => {
    expect(explicadorDesdeEntorno({})).toBeNull();
    expect(explicadorDesdeEntorno({ EXPLICAR_CON_IA: '1' })).toBeNull();
    expect(explicadorDesdeEntorno({ ANTHROPIC_API_KEY: 'k' })).toBeNull();
    expect(explicadorDesdeEntorno({ EXPLICAR_CON_IA: '0', ANTHROPIC_API_KEY: 'k' })).toBeNull();
    expect(explicadorDesdeEntorno({ EXPLICAR_CON_IA: '1', ANTHROPIC_API_KEY: '' })).toBeNull();
    expect(explicadorDesdeEntorno({ EXPLICAR_CON_IA: '1', ANTHROPIC_API_KEY: 'k' })).toBeInstanceOf(ExplicadorAnthropic);
  });
});
