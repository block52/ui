module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '\\.e2e\\.test\\.'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: {
    '^.+\\.tsx?$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript'
      ]
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
    '^wagmi$': '<rootDir>/src/__mocks__/wagmi.js',
    // import.meta shim (see src/utils/viteEnv.ts)
    'viteEnv$': '<rootDir>/src/__mocks__/viteEnv.js'
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
    },
    // Money-path ratchets (#619): pinned a few points under measured coverage
    // so a regression fails CI. Raise these as tests are added; never lower
    // them to make a build pass.
    './src/submit/': {
      branches: 80,
      functions: 75,
      lines: 85,
      statements: 85
    },
    './src/hooks/playerActions/': {
      branches: 38,
      functions: 43,
      lines: 45,
      statements: 45
    },
    './src/constants/currency.ts': {
      branches: 85,
      functions: 70,
      lines: 88,
      statements: 88
    }
  }
};
