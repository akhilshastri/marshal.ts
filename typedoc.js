module.exports = {
    "mode": "modules",
    "out": "docs",
    exclude: [
        '**/node_modules/**',
        '**/*.spec.ts',
        '**/tests/**/*.ts',
    ],
    name: 'marshal.ts',
    excludePrivate: true,
    skipInternal: true,
    // theme: 'minimal'
};
