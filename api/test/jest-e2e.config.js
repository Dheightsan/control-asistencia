// Pruebas e2e: la API completa con supertest contra PostgreSQL real.
module.exports = {
  rootDir: '..',
  testRegex: 'test/.*[.]e2e-spec[.]ts$',
  transform: { '^.+[.]ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }] },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/global-setup.mjs',
  globalTeardown: '<rootDir>/test/global-teardown.mjs',
};
