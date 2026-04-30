module.exports = {
  root: true,
  extends: ['expo', 'prettier'],
  ignorePatterns: ['/dist/*', 'node_modules/'],
  rules: {
    'react-native/no-inline-styles': 'warn',
  },
};
