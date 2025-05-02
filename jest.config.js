module.exports = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/shared/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(wav|mp3|png|jpg|jpeg|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    },
    transform: {
        '^.+\\.(ts|tsx|js|jsx)$': [
            'ts-jest',
            {
                tsconfig: '<rootDir>/tsconfig.test.json', // Use test-specific tsconfig
            },
        ],
    },
    transformIgnorePatterns: ['/node_modules/(?!@testing-library)'],
    testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
    collectCoverageFrom: [
        'components/**/*.{js,jsx,ts,tsx}',
        'services/**/*.{js,jsx,ts,tsx}',
        'utils/**/*.{js,jsx,ts,tsx}',
        'context/**/*.{js,jsx,ts,tsx}',
        '!**/*.d.ts',
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },
};