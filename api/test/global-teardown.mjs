export default async function () {
  await globalThis.__PG_DETENER__?.();
}
