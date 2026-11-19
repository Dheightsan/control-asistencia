'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { DEMO, pedir, Semana, Trabajador } from './api';

const pesos = (n: number) => `$${n.toLocaleString('es-CL')}`;

// Lunes de la semana actual en AAAA-MM-DD (UTC, igual que la API).
function lunesActual(): string {
  const hoy = new Date();
  const dia = (hoy.getUTCDay() + 6) % 7; // lunes = 0
  hoy.setUTCDate(hoy.getUTCDate() - dia);
  return hoy.toISOString().slice(0, 10);
}

export default function Pagina() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [desde, setDesde] = useState(lunesActual);
  const [semana, setSemana] = useState<Semana | null>(null);
  const [error, setError] = useState('');

  const cargarTrabajadores = useCallback(async () => {
    const lista = await pedir<Trabajador[]>('/trabajadores');
    setTrabajadores(lista);
    // Elige el primero para mostrar una semana al abrir
    setSeleccionado((actual) => actual ?? lista[0]?.id ?? null);
  }, []);

  const cargarSemana = useCallback(async () => {
    if (seleccionado === null) return;
    setSemana(await pedir<Semana>(`/trabajadores/${seleccionado}/semana?desde=${desde}`));
  }, [seleccionado, desde]);

  // Ejecuta una accion y muestra el error si la API lo devuelve.
  async function intentar(accion: () => Promise<void>) {
    setError('');
    try {
      await accion();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    }
  }

  useEffect(() => {
    void intentar(cargarTrabajadores);
  }, [cargarTrabajadores]);

  useEffect(() => {
    if (seleccionado === null) return;
    void intentar(cargarSemana);
  }, [seleccionado, cargarSemana]);

  function crearTrabajador(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    void intentar(async () => {
      const nuevo = await pedir<Trabajador>('/trabajadores', {
        method: 'POST',
        body: JSON.stringify({ nombre: datos.get('nombre'), sueldoBase: Number(datos.get('sueldoBase')) }),
      });
      form.reset();
      await cargarTrabajadores();
      setSeleccionado(nuevo.id);
    });
  }

  function registrarMarca(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    void intentar(async () => {
      // El input datetime-local no trae zona: se interpreta como UTC (ver README).
      await pedir('/marcas', {
        method: 'POST',
        body: JSON.stringify({
          trabajadorId: seleccionado,
          entrada: `${datos.get('entrada')}:00Z`,
          salida: `${datos.get('salida')}:00Z`,
        }),
      });
      form.reset();
      await cargarSemana();
    });
  }

  return (
    <main>
      <h1>Control de asistencia</h1>
      {DEMO && (
        <p className="nota">
          Demo con datos de ejemplo de esta semana. Puedes agregar trabajadores y marcas; todo vuelve al inicio cuando
          el servidor se reinicia. API documentada en <a href="/docs">/docs</a> ·{' '}
          <a href="https://github.com/Dheightsan/control-asistencia">código en GitHub</a>
        </p>
      )}

      <section>
        <h2>Trabajadores</h2>
        <ul aria-label="Lista de trabajadores">
          {trabajadores.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={t.id === seleccionado ? undefined : 'secundario'}
                aria-pressed={t.id === seleccionado}
                onClick={() => setSeleccionado(t.id)}
              >
                {t.nombre}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={crearTrabajador} aria-label="Nuevo trabajador">
          <label>
            Nombre
            <input name="nombre" required maxLength={120} />
          </label>
          <label>
            Sueldo base mensual (CLP)
            <input name="sueldoBase" type="number" min={1} step={1} required />
          </label>
          <button type="submit">Agregar trabajador</button>
        </form>
      </section>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {seleccionado !== null && (
        <>
          <section>
            <h2>Registrar marca</h2>
            <form onSubmit={registrarMarca} aria-label="Registrar marca">
              <label>
                Entrada
                <input name="entrada" type="datetime-local" required />
              </label>
              <label>
                Salida
                <input name="salida" type="datetime-local" required />
              </label>
              <button type="submit">Registrar marca</button>
            </form>
          </section>

          <section>
            <h2>Semana</h2>
            <label>
              Semana desde
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            {semana && (
              <>
                <dl className="resumen">
                  <div>
                    <dt>Horas ordinarias</dt>
                    <dd data-testid="ordinarias">{semana.horasOrdinarias}</dd>
                  </div>
                  <div>
                    <dt>Horas extra</dt>
                    <dd data-testid="extra">{semana.horasExtra}</dd>
                  </div>
                  <div>
                    <dt>Valor hora</dt>
                    <dd data-testid="valor-hora">{pesos(semana.valorHora)}</dd>
                  </div>
                  <div>
                    <dt>Monto horas extra</dt>
                    <dd data-testid="monto">{pesos(semana.montoHorasExtra)}</dd>
                  </div>
                </dl>
                {semana.diasSobreTope.length > 0 && (
                  <p className="aviso">Mas de 2 horas extra el: {semana.diasSobreTope.join(', ')}</p>
                )}
                <table>
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th>Horas</th>
                      <th>Horas extra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semana.dias.map((d) => (
                      <tr key={d.fecha}>
                        <td>{d.fecha}</td>
                        <td>{d.horas}</td>
                        <td>{d.horasExtra}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
