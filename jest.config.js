module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '\\.e2e\\.test\\.'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        skipLibCheck: true,
        jsx: 'react-jsx'
      }
    }]
  },
  // Transform ESM packages that Jest can't parse by default
  transformIgnorePatterns: [
    'node_modules/(?!(@reown|@walletconnect|uint8arrays|multiformats|@noble)/)'
  ],
  moduleNameMapper: {
    // Handle CSS imports (with CSS modules)
    '\\.css$': 'identity-obj-proxy',
    // Handle image imports
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/__mocks__/fileMock.js',
    // Handle module aliases if needed
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock WalletConnect/Reown packages that have ESM issues
    '^@reown/appkit/react$': '<rootDir>/src/__mocks__/reownAppkit.js',
    // Mock wagmi (ESM package)
    '^wagmi$': '<rootDir>/src/__mocks__/wagmi.js'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10
    }
  }
};
