export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  moduleNameMapper: {
    '^aws-durable-execution-sdk-js$': '/tmp/aws-durable-execution-sdk-js/packages/aws-durable-execution-sdk-js/dist-cjs/index.js',
  },
};
