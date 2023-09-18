module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    '@electron-toolkit'
  ],
  rules: {
    'react/prop-types': 0,
    'react/no-unescaped-entities': 0,
    'no-unsafe-finally': 0,
    'react/no-unknown-property': 0,
    'no-unused-vars': 0
  }
}
