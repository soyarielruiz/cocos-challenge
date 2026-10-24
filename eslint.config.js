import jsdoc from 'eslint-plugin-jsdoc';

export default [
  {
    files: ['src/**/*.js'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': ['error', { publicOnly: true }],
      'jsdoc/require-param': 'error',
      'jsdoc/require-param-type': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-type': 'error',
    },
  },
];
