const path = require('path');
const rollup = require('rollup');
const babel = require('babel-core');
const utils = require('./utils');
const plugins = require('./plugins');

const helperId = path.resolve(__dirname, 'WorkerLoaderHelper.js');

module.exports = function workerLoaderPlugin(config = null) {
  const sourcemap = (config && config.sourcemap) || false;
  const loadPath = config && config.hasOwnProperty('loadPath') ? config.loadPath : '';
  const preserveSource = config && config.hasOwnProperty('preserveSource') ? config.preserveSource : false;
  let inline = config && config.hasOwnProperty('inline') ? config.inline : true;
  const patterns = config && config.hasOwnProperty('patterns') ? config.patterns : [/\/worker$/];

  const idMap = new Map();
  const exclude = new Map();
  let projectOptions = null;
  let basePath = null;
  let configuredFileName = null;

  return {
    name: 'web-worker-loader',

    options(options ) {
      if (!projectOptions) {
        projectOptions = Object.assign({}, options);
        projectOptions.plugins = plugins;
        basePath = path.dirname(options.input);
      }

      return null;
    },

    resolveId(importee, importer) {
      if (importee === 'rollup-plugin-web-worker-loader-helper') {
        return require.resolve(helperId);;
      } else if (patterns.some(item => item.test(importee))) {
        const folder = path.dirname(importer);
        const paths = require.resolve.paths(importer);
        paths.push(folder);

        const target = require.resolve(importee, { paths });
        if (target) {
          if (!idMap.has(target)) {
            const inputOptions = Object.assign({}, projectOptions, {
              input: target,
              external: [],
            });

            idMap.set(target, {
              workerID: `web-worker-${idMap.size}.js`,
              chunk: null,
              inputOptions,
            });
          }
          return target;
        }
      }
      return null;
    },

    load(id) {
      return new Promise((resolve, reject) => {
        if (id === helperId) {
          // const content = fs.readFileSync(id, 'utf-8')
          // helper file, convert to es5
          const output = babel.transformFileSync(id, { presets: [['env']]});
          return resolve({ code: output.code, map: output.map, inline: true });
        }

        if (idMap.has(id) && !exclude.has(id)) {
          if (!inline) {
            /* inline requires rollup version 1.9.2 or higher */
            const version = this.meta.rollupVersion.split('.');
            if (version.length !== 3) {
              this.warn('Unknown rollup version');
              inline = true;
            } else {
              const major = parseInt(version[0], 10);
              const minor = parseInt(version[1], 10);
              const patch = parseInt(version[2], 10);
              if (
                isNaN(major) ||
                isNaN(minor) ||
                isNaN(patch) ||
                major < 1 ||
                (major === 1 && minor < 9) ||
                (major === 1 && minor === 9 && patch < 2)
              ) {
                this.warn(`Rollup version 1.9.2 or higher is required for emitting a worker file (current version:${this.meta.rollupVersion}). See https://github.com/rollup/rollup/issues/2801`);
                inline = true;
              }
            }
          }

          const {inputOptions, workerID} = idMap.get(id);
          // console.log('input', inputOptions)
          exclude.set(id, true);
          rollup.rollup(inputOptions).then(bundle => {
            exclude.delete(id);
            // console.log('============ start to bundle ...', bundle)
            bundle.generate({
              format: 'iife',
              name: id,
              sourcemap: true,
              moduleName: 'Worker',
            }).then(result => {
              // console.log('result:  ', result)
              const output = result.output;
              let chunk = null;

              if (output) {
                for (const ch of output) {
                  if (!ch.isAsset) {
                    chunk = ch;
                    break;
                  }
                }
              } else {
                chunk = result
              }

              if (chunk !== null) {
                /* add dependencies to watch list */
                const deps = Object.keys(chunk.modules);
                for (const dep of deps) {
                  this.addWatchFile(dep);
                }

                let map = null;
                let source;
                if (inline) {
                  source = utils.extractSource(chunk.code, chunk.exports, preserveSource);
                  map = null;
                  if (sourcemap) {
                    map = utils.fixMapSources(chunk, basePath);
                  }
                } else {
                  source = path.join(loadPath, workerID);
                  chunk.fileName = workerID;
                  idMap.get(id).chunk = chunk;
                }
                resolve({code: utils.buildWorkerCode(source, map, inline, preserveSource)});
              } else {
                resolve(null);
              }
            }).catch(reject);
          }).catch(reason => {
            exclude.delete(id);
            reject(reason);
          });
        } else {
          resolve(null);
        }
      });
    },

    transform(code, id) {
      if (idMap.has(id) && !exclude.has(id)) {
        const {inputOptions} = idMap.get(id);
        return { code, map: `{"version":3,"file":"${path.basename(inputOptions.input)}","sources":[],"sourcesContent":[],"names":[],"mappings":""}` };
      }
      return null;
    },

    outputOptions(options) {
      if (!inline && options.file && !options.dir) {
        configuredFileName = path.basename(options.file);
        return Object.assign({}, options, {
          file: null,
          dir: path.dirname(options.file),
        });
      }
      return null;
    },

    generateBundle(options, bundle, isWrite) {
      if (!inline && isWrite) {
        if (configuredFileName && Object.keys(bundle).length === 1) {
          bundle[Object.keys(bundle)[0]].fileName = configuredFileName;
        }
        for (const worker of idMap) {
          if (worker[1].chunk && !bundle[worker[1].workerID]) {
            bundle[worker[1].workerID] = worker[1].chunk;
          }
        }
      }
    },
  };
};
