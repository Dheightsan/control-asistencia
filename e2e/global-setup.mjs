import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iniciar } from '../scripts/postgres-embebido.mjs';
import { PUERTO_API, PUERTO_DB, PUERTO_WEB } from './entorno.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function esperar(url, proceso) {
  const limite = Date.now() + 120_000;
  while (Date.now() < limite) {
    if (proceso.exitCode !== null) throw new Error(`El proceso que sirve ${url} termino antes de tiempo`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // todavia no responde
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout esperando ${url}`);
}

// Levanta base de datos, API y web; devuelve la funcion que los apaga.
export default async function () {
  const apagar = [];
  try {
    let urlDb = process.env.DATABASE_URL; // en CI viene del servicio postgres
    if (!urlDb) {
      const db = await iniciar({ puerto: PUERTO_DB, carpeta: '.pgdata-e2e' });
      urlDb = db.url;
      apagar.push(() => db.detener());
    }

    const entornoApi = { ...process.env, DATABASE_URL: urlDb, API_PORT: String(PUERTO_API), WEB_ORIGIN: `http://localhost:${PUERTO_WEB}` };
    const entornoWeb = { ...process.env, NEXT_PUBLIC_API_URL: `http://localhost:${PUERTO_API}` };

    execSync('npm run build -w api', { cwd: raiz, stdio: 'inherit' });
    execSync('npm run build -w web', { cwd: raiz, stdio: 'inherit', env: entornoWeb });

    const api = spawn(process.execPath, ['dist/main.js'], { cwd: path.join(raiz, 'api'), env: entornoApi, stdio: 'inherit' });
    apagar.push(() => api.kill());
    const web = spawn(process.execPath, [path.join(raiz, 'node_modules/next/dist/bin/next'), 'start', '--port', String(PUERTO_WEB)], {
      cwd: path.join(raiz, 'web'),
      env: entornoWeb,
      stdio: 'inherit',
    });
    apagar.push(() => web.kill());

    await esperar(`http://localhost:${PUERTO_API}/trabajadores`, api);
    await esperar(`http://localhost:${PUERTO_WEB}`, web);
  } catch (e) {
    for (const f of apagar.reverse()) await f();
    throw e;
  }
  return async () => {
    for (const f of apagar.reverse()) await f();
  };
}
