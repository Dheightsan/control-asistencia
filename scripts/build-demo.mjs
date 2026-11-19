// Compila la API y exporta la pagina a web/out
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

execSync('npm run build -w api', { cwd: raiz, stdio: 'inherit' });
execSync('npm run build -w web', {
  cwd: raiz,
  stdio: 'inherit',
  env: { ...process.env, EXPORTAR_ESTATICO: '1', NEXT_PUBLIC_MISMO_ORIGEN: '1' },
});
