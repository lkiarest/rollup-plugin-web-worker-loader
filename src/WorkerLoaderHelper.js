var kIsNodeJS = Object.prototype.toString.call(typeof process !== 'undefined' ? process : 0) === '[object process]';
var kRequire = kIsNodeJS ? module.require : null; // eslint-disable-line

function createInlineWorkerFactory(fn, sourcemap = null) {
    var source = fn.toString();
    var start = source.indexOf('\n', 10) + 1;
    var end = source.indexOf('}', source.length - 1);
    var body = source.substring(start, end) + (sourcemap ? `//# sourceMappingURL=${sourcemap}` : '');
    var blankPrefixLength = body.search(/\S/);
    var lines = body.split('\n').map(line => line.substring(blankPrefixLength) + '\n');

    if (kIsNodeJS) {
        /* node.js */
        var Worker = kRequire('worker_threads').Worker; // eslint-disable-line
        var concat = lines.join('\n');
        return function WorkerFactory(options) {
            return new Worker(concat, Object.assign({}, options, { eval: true }));
        };
    }

    /* browser */
    var blob = new Blob(lines, { type: 'application/javascript' });
    var url = URL.createObjectURL(blob);
    return function WorkerFactory(options) {
        return new Worker(url, options);
    };
}

function createURLWorkerFactory(url) {
    if (kIsNodeJS) {
        /* node.js */
        var Worker = kRequire('worker_threads').Worker; // eslint-disable-line
        return function WorkerFactory(options) {
            return new Worker(url, options);
        };
    }
    /* browser */
    return function WorkerFactory(options) {
        return new Worker(url, options);
    };
}

function createBase64WorkerFactory(base64, sourcemap = null) {
    var source = kIsNodeJS ? Buffer.from(base64, 'base64').toString('ascii') : atob(base64);
    var start = source.indexOf('\n', 10) + 1;
    var body = source.substring(start) + (sourcemap ? `//# sourceMappingURL=${sourcemap}` : '');

    if (kIsNodeJS) {
        /* node.js */
        var Worker = kRequire('worker_threads').Worker; // eslint-disable-line
        return function WorkerFactory(options) {
            return new Worker(body, Object.assign({}, options, { eval: true }));
        };
    }

    /* browser */
    var blob = new Blob([body], { type: 'application/javascript' });
    var url = URL.createObjectURL(blob);
    return function WorkerFactory(options) {
        return new Worker(url, options);
    };
}

module.exports = {
    createInlineWorkerFactory,
    createURLWorkerFactory,
    createBase64WorkerFactory,
}
