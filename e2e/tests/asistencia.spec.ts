import { expect, Page, test } from '@playwright/test';

// Semana de prueba fija: lunes 2026-05-04.
const SEMANA = '2026-05-04';

async function crearTrabajador(page: Page, nombre: string, sueldo: number) {
  await page.getByLabel('Nombre').fill(nombre);
  await page.getByLabel('Sueldo base mensual (CLP)').fill(String(sueldo));
  await page.getByRole('button', { name: 'Agregar trabajador' }).click();
  await expect(page.getByRole('button', { name: nombre, exact: true })).toHaveAttribute('aria-pressed', 'true');
}

// Espera a que la API responda; si la marca se guardo, el formulario queda vacio.
async function registrarMarca(page: Page, entrada: string, salida: string, guardada = true) {
  await page.getByLabel('Entrada').fill(entrada);
  await page.getByLabel('Salida').fill(salida);
  const respuesta = page.waitForResponse((r) => r.url().endsWith('/marcas') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Registrar marca' }).click();
  await respuesta;
  if (guardada) await expect(page.getByLabel('Entrada')).toHaveValue('');
}

test('crea un trabajador, registra marcas y ve las horas extra de la semana', async ({ page }) => {
  await page.goto('/');
  await crearTrabajador(page, 'Ana Perez', 900_000); // valor hora 5.000

  await page.getByLabel('Semana desde').fill(SEMANA);

  // Lunes a viernes 8 horas y sabado 4: 44 horas, 2 de ellas extra.
  for (const dia of ['04', '05', '06', '07', '08']) {
    await registrarMarca(page, `2026-05-${dia}T08:00`, `2026-05-${dia}T16:00`);
  }
  await registrarMarca(page, '2026-05-09T08:00', '2026-05-09T12:00');

  await expect(page.getByTestId('ordinarias')).toHaveText('42');
  await expect(page.getByTestId('extra')).toHaveText('2');
  await expect(page.getByTestId('valor-hora')).toHaveText('$5.000');
  await expect(page.getByTestId('monto')).toHaveText('$15.000'); // 2 h * 5.000 * 1,5
  await expect(page.getByRole('row')).toHaveCount(8); // encabezado + 7 dias
  await expect(page.getByText('Mas de 2 horas extra')).toHaveCount(0);
});

test('muestra el error de la API cuando la salida es anterior a la entrada', async ({ page }) => {
  await page.goto('/');
  await crearTrabajador(page, 'Luis Soto', 800_000);
  await registrarMarca(page, '2026-05-04T17:00', '2026-05-04T08:00', false);
  await expect(page.locator('p.error')).toContainText('La salida debe ser posterior a la entrada');
});

test('avisa cuando un dia pasa de 2 horas extra', async ({ page }) => {
  await page.goto('/');
  await crearTrabajador(page, 'Marta Rios', 900_000);
  await page.getByLabel('Semana desde').fill(SEMANA);
  // 4 dias de 8 horas y un viernes de 15 horas: 47 horas, 5 extra el viernes.
  for (const dia of ['04', '05', '06', '07']) {
    await registrarMarca(page, `2026-05-${dia}T08:00`, `2026-05-${dia}T16:00`);
  }
  await registrarMarca(page, '2026-05-08T06:00', '2026-05-08T21:00');
  await expect(page.getByTestId('extra')).toHaveText('5');
  await expect(page.getByText('Mas de 2 horas extra el: 2026-05-08')).toBeVisible();
});
