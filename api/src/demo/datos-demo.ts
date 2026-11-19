// Datos de ejemplo para la demo

export interface TrabajadorDemo {
  nombre: string;
  sueldoBase: number;
  marcas: { entrada: Date; salida: Date }[];
}

// Lunes (UTC) de la semana de fecha, AAAA-MM-DD
export function lunesUtc(fecha: Date): string {
  const lunes = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  lunes.setUTCDate(lunes.getUTCDate() - ((lunes.getUTCDay() + 6) % 7));
  return lunes.toISOString().slice(0, 10);
}

function turno(lunes: string, dia: number, desde: string, hasta: string) {
  const fecha = new Date(`${lunes}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dia);
  const ymd = fecha.toISOString().slice(0, 10);
  return { entrada: new Date(`${ymd}T${desde}:00Z`), salida: new Date(`${ymd}T${hasta}:00Z`) };
}

// Con horas extra, sobre el tope diario y sin extra
export function datosDemo(lunes: string): TrabajadorDemo[] {
  const dias = (n: number, desde: string, hasta: string) => [...Array(n).keys()].map((d) => turno(lunes, d, desde, hasta));
  return [
    {
      // 44 h, 2 extra
      nombre: 'Ana Pérez',
      sueldoBase: 900_000,
      marcas: [...dias(5, '08:00', '16:00'), turno(lunes, 5, '08:00', '12:00')],
    },
    {
      // 47 h, 5 extra el viernes
      nombre: 'Luis Soto',
      sueldoBase: 800_000,
      marcas: [...dias(4, '08:00', '16:00'), turno(lunes, 4, '06:00', '21:00')],
    },
    {
      // 40 h, sin extra
      nombre: 'Marta Ríos',
      sueldoBase: 1_200_000,
      marcas: dias(5, '09:00', '17:00'),
    },
  ];
}
