import electronToolkit from '@electron-toolkit/eslint-config';
import prettier from '@electron-toolkit/eslint-config-prettier';
import react from 'eslint-plugin-react';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'out/**']
  },
  electronToolkit,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'no-unsafe-finally': 'off',
      'react/no-unknown-property': 'off',
      'no-unused-vars': 'off'
    }
  },
  prettier
];
