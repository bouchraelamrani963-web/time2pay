const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
function loader(stubs = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, { module, exports: module.exports, Buffer, Date, Object, Map, Set, Response, Request, URL, Uint8Array, process, console,
      require: name => Object.hasOwn(stubs, name) ? stubs[name] : name === 'server-only' ? {} : name.startsWith('@/') ? load('src/' + name.slice(2) + '.ts') : name.startsWith('./') ? load(path.join(path.dirname(file), name) + '.ts') : require(name) }, { filename: file });
    return module.exports;
  }
  return load;
}
module.exports = { loader };
