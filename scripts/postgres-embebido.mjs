// Levanta un PostgreSQL local sin Docker usando el paquete embedded-postgres.
// Se usa de dos formas: `npm run db` (queda corriendo) o importando iniciar().
import EmbeddedPostgres from 'embedded-postgres';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function iniciar({ puerto = 54329, carpeta = '.pgdata' } = {}) {
  const databaseDir = path.join(raiz, carpeta);
  // Datos desechables: cada arranque parte de una base vacia.
  rmSync(databaseDir, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: 'asistencia',
    password: 'asistencia',
    port: puerto,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('asistencia');
  return {
    url: `postgres://asistencia:asistencia@localhost:${puerto}/asistencia`,
    detener: () => pg.stop(),
  };
}

// Si lo ejecutan directo desde la terminal: queda corriendo hasta Ctrl+C.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.env.PG_PORT ?? 54329);
  const carpeta = process.env.PG_DIR ?? '.pgdata';
  const db = await iniciar({ puerto, carpeta });
  console.log(`PostgreSQL listo: ${db.url}`);
  const salir = async () => {
    await db.detener();
    process.exit(0);
  };
  process.on('SIGINT', salir);
  process.on('SIGTERM', salir);
}
