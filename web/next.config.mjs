// EXPORTAR_ESTATICO=1: HTML estatico en web/out para la demo
const config = process.env.EXPORTAR_ESTATICO === '1' ? { output: 'export' } : {};

export default config;
