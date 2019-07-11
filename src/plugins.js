const resolve = require('rollup-plugin-node-resolve');
const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const { uglify } = require('rollup-plugin-uglify');

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
