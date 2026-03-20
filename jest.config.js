// jest.config.js
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


export default {
  testEnvironment: 'node',
  transform: {},
  rootDir: __dirname,
  moduleDirectories: ['node_modules', '<rootDir>', '<rootDir>/bin'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};



