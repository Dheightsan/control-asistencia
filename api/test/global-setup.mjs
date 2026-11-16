import { iniciar } from '../../scripts/postgres-embebido.mjs';

// En CI hay un postgres como servicio y llega por DATABASE_URL; en local levantamos uno embebido.
export default async function () {
  if (process.env.DATABASE_URL) return;
  const db = await iniciar({ puerto: 54331, carpeta: '.pgdata-test' });
  process.env.DATABASE_URL = db.url;
  globalThis.__PG_DETENER__ = db.detener;
}
