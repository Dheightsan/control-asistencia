// Pruebas unitarias: solo logica pura, sin base de datos.
module.exports = {
  rootDir: 'src',
  testRegex: '.*\.spec\.ts$',
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.test.json' }] },
  testEnvironment: 'node',
};
