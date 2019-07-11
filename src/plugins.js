import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import { uglify } from 'rollup-plugin-uglify';

module.exports = [
  resolve({
    extensions: ['.jsx', '.js', '.json'],
  }),
  commonjs({
    ignoreGlobal: true,
    ignore: 'jszip',
  }),
  babel({
    presets: [['env', { modules: false }]],
    babelrc: false,
    exclude: ['node_modules/**'],
    runtimeHelpers: true,
    plugins: [['transform-runtime', {
      'helpers': true,
      'polyfill': false,
      'regenerator': true,
      'moduleName': 'babel-runtime',
    }]],
  }),
  uglify(),
];
