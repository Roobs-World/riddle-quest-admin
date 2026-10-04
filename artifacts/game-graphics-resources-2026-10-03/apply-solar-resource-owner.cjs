const fs = require('node:fs');
const ts = require('../../packages/portal/node_modules/typescript');
const file = 'packages/portal/src/play/SolarSystem.tsx';
let source = fs.readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const classes = new Set(['SphereGeometry','RingGeometry','BufferGeometry','ShaderMaterial','PointsMaterial','MeshBasicMaterial','MeshPhongMaterial','SpriteMaterial','CanvasTexture']);
const insertions = [];
function visit(node) {
 if (ts.isNewExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(ast) === 'THREE' && classes.has(node.expression.name.text)) {
  insertions.push([node.getStart(ast), 'resources.own('], [node.end, ')']);
 }
 ts.forEachChild(node, visit);
}
visit(ast);
for (const [position, text] of insertions.sort((a,b)=>b[0]-a[0])) source = source.slice(0,position)+text+source.slice(position);
source = source.replace('import {createDecorativeAnimation} from "./game/decorativeAnimation";', 'import {createDecorativeAnimation} from "./game/decorativeAnimation";\nimport {createDecorativeResources} from "./game/decorativeResources";');
const stateStart = source.indexOf('    /** Whether the latest measured layout');
const cleanupStart = source.indexOf('    /** Releases every owned resource',stateStart);
let state = source.slice(stateStart,cleanupStart);
// The buffer vector remains inside the setup try, like the other Three constructors.
state = state.replace('    /** Drawing buffer dimensions used to constrain Firefox viewport rounding. */\n    const drawingBufferSize = new THREE.Vector2();\n','');
const failStart = source.indexOf('    /** A broken optional renderer',cleanupStart);
const contextStart = source.indexOf('    /** Context restoration',failStart);
const fail = source.slice(failStart,contextStart);
source = source.slice(0,stateStart)+'    /** Drawing buffer dimensions used to constrain Firefox viewport rounding. */\n    const drawingBufferSize = new THREE.Vector2();\n\n'+source.slice(contextStart);
const cleanup = `    /** Owns allocations even before the scene becomes reachable from its root. */
    const resources = createDecorativeResources(error => captureBrowserException(error, {component: "solar_system", operation: "dispose_scene"}));
    /** Stops browser work and releases partial or complete graphics setup exactly once. */
    const stopScene = () => {
      if (disposed) return;
      disposed = true;
      if (animationRef.current === animation) animationRef.current = null;
      resources.dispose();
    };

`;
source = source.replace('    /** Provides scene behavior. */',state+cleanup+fail+'    try {\n    /** Provides scene behavior. */');
source = source.replace('      return;\n    }\n    renderer.setPixelRatio', '      stopScene();\n      return stopScene;\n    }\n    resources.defer(() => renderer.domElement.remove());\n    resources.defer(() => renderer.forceContextLoss());\n    resources.own(renderer);\n    renderer.setPixelRatio');
source = source.replace('      const texture = textureLoader.load(url);', '      const texture = resources.own(textureLoader.load(url, undefined, undefined, error => failScene(error, "load_texture")));\n      if (disposed) throw new Error("Retired decorative texture setup");');
source = source.replace('    renderer.domElement.addEventListener("webglcontextlost", contextLost);', '    resources.defer(() => renderer.domElement.removeEventListener("webglcontextlost", contextLost));\n    resources.defer(() => renderer.domElement.removeEventListener("webglcontextrestored", contextRestored));\n    renderer.domElement.addEventListener("webglcontextlost", contextLost);');
source = source.replace('canRender: () => renderingReady && contextAvailable && !pausedRef.current,', 'canRender: () => !disposed && renderingReady && contextAvailable && !pausedRef.current,');
source = source.replace('    animationRef.current = animation;', '    resources.defer(() => animation?.dispose());\n    if (!disposed) animationRef.current = animation;');
source = source.replace('        observer.observe(mount);', '        resources.defer(() => observer?.disconnect());\n        observer.observe(mount);');
source = source.replace('    return stopScene;\n  }, []);', '    resources.defer(() => stopWaitingForLayout?.());\n    } catch (error) {\n      failScene(error, "initialize_scene");\n    }\n    return stopScene;\n  }, []);');
fs.writeFileSync(file, source);
console.log('Tracked',insertions.length/2,'graphics constructor sites');
