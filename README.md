# Control de asistencia

[![CI](https://github.com/Dheightsan/control-asistencia/actions/workflows/ci.yml/badge.svg)](https://github.com/Dheightsan/control-asistencia/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-20.19%2B-green.svg)](https://nodejs.org/)
[![Demo](https://img.shields.io/badge/demo-GitHub%20Pages-blue.svg)](https://dheightsan.github.io/control-asistencia/)

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
- Cálculo de la hora extra con sueldo mensual (42 horas): https://dt.gob.cl/portal/1628/w3-article-95182.html

La ley dice 42 horas "al tercer año" desde la publicación, o sea el 26-04-2026. Esa fecha sale en la prensa sobre el Dictamen 142/09 de la DT (por ejemplo https://www.diarioconstitucional.cl/2026/03/04/reduccion-a-42-horas-semanales-debera-implementarse-desde-abril-de-2026/). No es asesoría legal: no cubre jornadas especiales, turnos ni pactos de horas extra por escrito (art. 32); solo avisa que deben existir.

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

Con Docker: `docker compose up -d` deja un postgres 16 en el mismo puerto 54329.

## API

| Método | Ruta | Qué hace |
| --- | --- | --- |
| GET, POST | `/trabajadores` | Lista y crea (`nombre`, `sueldoBase` en CLP) |
| GET, PATCH, DELETE | `/trabajadores/:id` | Lee, edita y borra (borra también sus marcas) |
| POST | `/marcas` | Registra una marca (`trabajadorId`, `entrada`, `salida` en ISO 8601) |
| GET | `/trabajadores/:id/semana?desde=AAAA-MM-DD` | Horas ordinarias, horas extra, valor hora, monto extra y detalle por día |
| GET | `/trabajadores/:id/alertas?desde=AAAA-MM-DD` | Alertas de cumplimiento de jornada de esa semana, cada una con su explicación |

Errores: 400 si la salida no es posterior a la entrada o los datos no validan, 404 si el trabajador no existe, 409 si la marca se solapa con otra del mismo trabajador.

## Alertas

La semana se evalúa con el mismo cálculo de arriba (`api/src/alertas/alertas.ts` reutiliza `CalculoService`; no repite sus cuentas). Cada alerta trae `tipo`, `fecha`, `detalle` y `articulo`. La respuesta del endpoint agrega una `explicacion` en palabras simples por alerta y `explicadoCon` (`plantilla` o `ia`).

| Tipo | Cuándo avisa | Artículo |
| --- | --- | --- |
| `extra_sobre_tope_diario` | Más de 2 horas extra en un día (las que ya marca `diasSobreTope`) | Código del Trabajo, art. 31 |
| `jornada_diaria_excedida` | Más de 10 horas ordinarias en un día (las horas extra de la semana no se cuentan) | art. 28 |
| `horas_extra_con_pacto` | La semana tiene horas extra: deben constar en un pacto escrito. Una sola alerta, en el primer día con extra | art. 32 |
| `colacion` | Más de 6 horas entre la primera entrada y la última salida del día sin una pausa de al menos 30 minutos | art. 34 |
| `registro_dudoso` | Marcas superpuestas del mismo trabajador, o una marca de más de 16 horas (probable salida sin marcar) | art. 33 |

Fuentes, revisadas el 22-11-2026, en el texto vigente del Código del Trabajo en BCN (versión del 23-07-2026, https://www.bcn.cl/leychile/navegar?idNorma=207436) y en la ley 21.561 del Diario Oficial:

- Art. 28, inciso segundo: "En ningún caso la jornada ordinaria podrá exceder de diez horas por día". La ley 21.561 solo cambió el inciso primero de este artículo (de "cinco" a "cuatro días"), no el límite diario.
- Art. 31: horas extra "hasta un máximo de dos por día".
- Art. 32: las horas extra "sólo podrán pactarse para atender necesidades o situaciones temporales de la empresa", por escrito y con vigencia de hasta tres meses, renovable. Sin pacto escrito, las horas trabajadas en exceso con conocimiento del empleador igual se consideran extraordinarias y se pagan; por eso la alerta pide revisar el pacto y no dice que las horas no valgan.
- Art. 34: la jornada "se dividirá en dos partes, dejándose entre ellas, a lo menos, el tiempo de media hora para la colación", y ese tiempo no se cuenta como trabajado.
- Art. 33: el empleador debe controlar la asistencia y determinar las horas de trabajo. Se cita para las marcas dudosas porque un registro que no se puede confiar no cumple ese deber.

Criterios del proyecto, no texto de la ley:

- Colación: el art. 34 no dice desde cuántas horas se exige. El proyecto avisa solo si pasan más de 6 horas entre la primera entrada y la última salida del día sin una pausa de 30 minutos entre marcas. Es una constante (`COLACION_DESDE_HORAS` en `alertas.ts`) y se puede cambiar. Las marcas se agrupan por el día de la entrada, así que un turno nocturno cuenta en el día en que empezó.
- Marca de más de 16 horas (`MARCA_SOSPECHOSA_HORAS`): solo una señal para revisar. La marca no puede quedar abierta porque `salida` es obligatoria; un olvido se nota como una marca demasiado larga.
- Las alertas de marcas dudosas se muestran en la semana donde empieza la marca.

### Explicación

Por defecto la explicación sale de plantillas en español (`api/src/alertas/explicador.ts`), sin red y siempre igual para las mismas alertas. Hay una segunda implementación opcional de la misma interfaz que pide a la API de Anthropic (modelo `claude-haiku-5-5`, `max_tokens` 700) reescribir las alertas dadas. Se activa solo con `EXPLICAR_CON_IA=1` y una `ANTHROPIC_API_KEY` en el entorno; la clave no se guarda en ningún archivo.

La salida de la IA se valida alerta por alerta y, si algo falla, se usa la plantilla de todas:

- Debe ser un arreglo JSON con una frase por alerta, en el mismo orden.
- Cada frase tiene que nombrar la fecha de su alerta y no puede traer otra fecha.
- No puede traer cifras que no estén en el `detalle` ni en el artículo de esa alerta.
- Un error de red, un código distinto de 200 o más de 10 segundos de espera también llevan a la plantilla.

Las pruebas usan un cliente falso; ninguna toca la red ni necesita clave.

## Decisiones de diseño

1. Todo el cálculo está en `api/src/calculo/calculo.service.ts`, una clase sin acceso a la base de datos. Por eso se prueba con Jest sin levantar nada y es el archivo que explica el proyecto.
2. La semana son los 7 días desde `desde`. Los minutos se acumulan día a día; lo que pasa de 42 horas es extra. Una marca que cruza medianoche se parte entre los dos días.
3. Si un día tiene más de 2 horas extra, esas horas se pagan igual (ya se trabajaron) y el día queda en `diasSobreTope` para que el empleador lo vea.
4. Todas las fechas se tratan como UTC, sin husos horarios ni cambio de hora. Es una simplificación a propósito; un producto real tendría que guardar la zona de la empresa.
5. TypeORM crea las tablas con `synchronize` y no hay migraciones, para mantener el proyecto chico. En producción se usarían migraciones.

Uso NestJS 11 y TypeORM 0.3 porque NestJS 12 es solo ESM y con Jest se complica. Localmente corre PostgreSQL 18 (`embedded-postgres`) y en CI postgres 16.

## Estructura

```
api/    NestJS: entidades, endpoints, calculo.service.ts, alertas/ y pruebas (unitarias en src, e2e en test)
web/    Next.js: una página en web/app/page.tsx (horas, alertas y marcas)
e2e/    Playwright: global-setup.mjs levanta todo y apaga todo al terminar
scripts/postgres-embebido.mjs   postgres local sin Docker
```
