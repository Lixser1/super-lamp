import next from 'eslint-config-next'
import tailwind from 'eslint-plugin-tailwindcss'
import prettier from 'eslint-config-prettier'

export default [
  ...next(),
  {
    plugins: {
      tailwindcss: tailwind,
    },
    rules: {
      'tailwindcss/classnames-order': 'warn',
    },
  },
  prettier,
]
