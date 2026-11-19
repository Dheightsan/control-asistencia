// En la demo la pagina y la API comparten dominio
export const DEMO = process.env.NEXT_PUBLIC_MISMO_ORIGEN === '1';
export const API = DEMO ? '' : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

export interface Trabajador {
  id: number;
  nombre: string;
  sueldoBase: number;
}

export interface DiaCalculado {
  fecha: string;
  horas: number;
  horasExtra: number;
}

export interface Semana {
  desde: string;
  hasta: string;
  horasOrdinarias: number;
  horasExtra: number;
  valorHora: number;
  montoHorasExtra: number;
  dias: DiaCalculado[];
  diasSobreTope: string[];
}

// Llama a la API y convierte los errores en un mensaje legible.
export async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${ruta}`, {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));
    const mensaje = Array.isArray(cuerpo.message) ? cuerpo.message.join(', ') : cuerpo.message;
    throw new Error(mensaje ?? `Error ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
