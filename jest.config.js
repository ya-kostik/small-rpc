module.exports = {
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: [
    './**/**',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/coverage/**',
    '!**/client/**',
    '!**.json',
    '!jest.config.js'
  ]
};
