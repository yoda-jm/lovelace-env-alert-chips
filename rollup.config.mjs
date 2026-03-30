import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/lovelace-env-alert-chips.js',
    format: 'iife',
    sourcemap: false,
  },
  plugins: [
    terser({
      format: { comments: false },
    }),
  ],
};
