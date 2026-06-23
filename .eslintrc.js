module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // Reglas mejoradas para mejor calidad de código
    '@typescript-eslint/no-explicit-any': 'warn', // Advertir sobre uso de 'any'
    '@typescript-eslint/ban-ts-comment': 'error', // Prohibir @ts-ignore sin explicación
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_', // Permitir parámetros que empiezan con _
        varsIgnorePattern: '^_', // Permitir variables que empiezan con _
      },
    ],
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto',
      },
    ],
  },
  overrides: [
    {
      files: ['src/common/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['src/reservas/*', 'src/agencias/*', 'src/cotizaciones/*', 'src/vuelos/*', 'src/eventos/*', 'src/my-tool/*', 'src/notificaciones/*', 'src/booking-personas/*', 'src/bot-reservas-pendientes/*', 'src/integrations/*', 'src/files/*'],
                message: 'common/ no debe importar de módulos de features. Mueve el contrato compartido a common/ o al módulo del proveedor (autocore/, cobre/).',
              },
            ],
          },
        ],
      },
    },
  ],
};
