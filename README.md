# Control de asistencia

Registra las marcas de entrada y salida de un equipo y calcula, por semana, las horas ordinarias, las horas extra y cuánto cuestan con la regla chilena de la jornada de 42 horas.

Stack: NestJS + TypeORM + PostgreSQL (api), Next.js App Router (web), Jest + supertest (pruebas de la API) y Playwright con chromium (flujo completo).

## La regla legal

Con la ley 21.561 la jornada ordinaria baja de 44 a 42 horas semanales desde el 26 de abril de 2026 (40 horas en 2028). El proyecto usa esto:

- Jornada ordinaria: 42 horas por semana. Lo que pase de eso en la semana es jornada extraordinaria (Código del Trabajo, art. 30).
- Recargo: las horas extra se pagan con 50 % de recargo sobre la hora ordinaria (art. 32).
- Tope: máximo 2 horas extra por día (art. 31).
- Valor de la hora ordinaria con sueldo mensual, según la Dirección del Trabajo con jornada de 42 horas: `sueldo / 30 * 28 / 168`. Para un sueldo de 800.000 da 4.444 por hora ordinaria y 6.667 por hora extra.

Fuentes, revisadas el 16-11-2026:

- Código del Trabajo, arts. 30, 31 y 32: https://www.bcn.cl/leychile/navegar?idNorma=207436
- Ley 21.561 (publicada el 26-04-2023, reduce la jornada en tramos): https://www.diariooficial.interior.gob.cl/publicaciones/2023/04/26/43536/01/2306561.pdf
- Minisitio 40 horas de la Dirección del Trabajo: https://dt.gob.cl/portal/1626/w3-propertyname-2556.html
- Cálculo de la hora extra con sueldo mensual (42 horas): https://dt.gob.cl/portal/1628/w3-article-95182.html

El texto de la ley dice 42 horas "al tercer año" desde la publicación; la fecha exacta del 26-04-2026 la confirman el minisitio de la DT y las notas de la DT. No es asesoría legal: no cubre jornadas especiales, turnos ni pactos de horas extra por escrito (art. 32).

## Cómo correrlo

Requiere Node 20.19 o más nuevo. No hace falta Docker: el PostgreSQL de desarrollo y de las pruebas es el paquete `embedded-postgres`.

```bash
npm install
npx playwright install chromium     # una sola vez

npm test                            # unitarias + e2e de la API (levanta su propio postgres)
npm run e2e                         # Playwright: levanta postgres, api y web, y prueba el flujo
```

Para usarlo a mano, en tres terminales:

```bash
npm run db                          # postgres embebido en el puerto 54329
DATABASE_URL=postgres://asistencia:asistencia@localhost:54329/asistencia npm run start:dev -w api
npm run dev -w web                  # http://localhost:3000
```

Las variables están en `.env.example`. Si `DATABASE_URL` ya existe (como en CI), las pruebas no levantan el postgres embebido y usan esa base.

Con Docker: `docker compose up -d` deja un postgres 16 en el mismo puerto 54329. Ese `docker-compose.yml` no lo pude probar, porque en esta máquina no hay Docker. El workflow de `.github/workflows/ci.yml` tampoco se ha corrido en GitHub todavía.

## API

| Método | Ruta | Qué hace |
| --- | --- | --- |
| GET, POST | `/trabajadores` | Lista y crea (`nombre`, `sueldoBase` en CLP) |
| GET, PATCH, DELETE | `/trabajadores/:id` | Lee, edita y borra (borra también sus marcas) |
| POST | `/marcas` | Registra una marca (`trabajadorId`, `entrada`, `salida` en ISO 8601) |
| GET | `/trabajadores/:id/semana?desde=AAAA-MM-DD` | Horas ordinarias, horas extra, valor hora, monto extra y detalle por día |

Errores: 400 si la salida no es posterior a la entrada o los datos no validan, 404 si el trabajador no existe, 409 si la marca se solapa con otra del mismo trabajador.

## Decisiones de diseño

1. Todo el cálculo está en `api/src/calculo/calculo.service.ts`, una clase sin acceso a la base de datos. Por eso se prueba con Jest sin levantar nada y es el archivo que explica el proyecto.
2. La semana son los 7 días desde `desde`. Los minutos se acumulan día a día; lo que pasa de 42 horas es extra. Una marca que cruza medianoche se parte entre los dos días.
3. Si un día tiene más de 2 horas extra, esas horas se pagan igual (ya se trabajaron) y el día queda en `diasSobreTope` para que el empleador lo vea.
4. Todas las fechas se tratan como UTC, sin husos horarios ni cambio de hora. Es una simplificación a propósito; un producto real tendría que guardar la zona de la empresa.
5. TypeORM crea las tablas con `synchronize` y no hay migraciones, para mantener el proyecto chico. En producción se usarían migraciones.

Versiones: uso NestJS 11 y TypeORM 0.3 porque las versiones más nuevas (NestJS 12, TypeORM 1.x) son solo ESM y complican Jest sin aportar algo que este proyecto necesite. Next.js 16, React 19 y Playwright están en su última versión. `embedded-postgres` instala PostgreSQL 18 y en CI se usa postgres 16; el SQL es el mismo en ambos.

## Estructura

```
api/    NestJS: entidades, endpoints, calculo.service.ts y pruebas (unitarias en src, e2e en test)
web/    Next.js: una página en web/app/page.tsx
e2e/    Playwright: global-setup.mjs levanta todo y apaga todo al terminar
scripts/postgres-embebido.mjs   postgres local sin Docker
```
