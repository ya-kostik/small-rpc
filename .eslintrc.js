module.exports = {
  env: {
    commonjs: true,
    es2020: true,
    node: true
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 12
  },
  rules: {
    'no-console': ['error', { 'allow': ['warn', 'error', 'info', 'dir'] }]
  }
};
