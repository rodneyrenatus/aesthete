// Compiles the SkSL look-engine shaders with CanvasKit so shader typos show up
// before you open the app on a phone. Run: npm run check:shaders
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/engine/shaders.ts'), 'utf8').replace(/export const/g, 'const') + ';return {PASS_A, PASS_B};';
const { PASS_A, PASS_B } = new Function(src)();
const dir = path.join(root, 'node_modules/canvaskit-wasm/bin/full/');
require(dir + 'canvaskit.js')({ locateFile: (f) => dir + f }).then((CK) => {
  let ok = true;
  for (const [name, code] of [['PASS_A', PASS_A], ['PASS_B', PASS_B]]) {
    const fx = CK.RuntimeEffect.Make(code, (e) => { ok = false; console.error(`${name}: ${e}`); });
    if (fx) console.log(`${name}: compiled, ${fx.getUniformCount()} uniforms`);
  }
  process.exit(ok ? 0 : 1);
});
