/** Opens the Solar game fixture and waits until its gameplay keyboard admits input. */
export async function openSolarGame(page,url) {
 await page.goto(url);
 await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
 const play=page.getByRole('button',{name:"Let's Play",exact:true});
 if(await play.count())await play.click();
 await page.locator('.keyboard .key:not(:disabled)').first().waitFor();
}

/** Builds the controlled graphics driver while retaining the real Three scene and resources. */
export function createSolarRendererSource({nativeRenderer,contextChecks,sizingChecks,resourceChecks,originalThree}) {
const stubRenderer=nativeRenderer?`export class WebGLRenderer extends THREE.WebGLRenderer {
 constructor(options){if(${contextChecks})window.currentResourceSiteCalls={};super(options);if(${contextChecks}){window.probe.rendererConstructions++;window.trackResource(this,'renderer');const gl=this.getContext(),getParameter=gl.getParameter.bind(gl);gl.getParameter=(name)=>{if(window.probe.failRestore){window.probe.failRestore=false;window.probe.nativeParameterFailures++;throw Error('injected native restoration getParameter failure');}return getParameter(name);};const lossExtension=gl.getExtension('WEBGL_lose_context');window.nativeLoseContext=()=>lossExtension.loseContext();window.nativeRestoreContext=()=>lossExtension.restoreContext();}if(${sizingChecks}){for(const name of ['width','height']){const descriptor=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,name);Object.defineProperty(this.domElement,name,{configurable:true,get:()=>descriptor.get.call(this.domElement),set:value=>{window.probe.bufferAssignments++;descriptor.set.call(this.domElement,value);}});}const viewportContext=this.getContext();window.nativeViewport=()=>Array.from(viewportContext.getParameter(viewportContext.VIEWPORT));}const draw=this.render.bind(this),resize=this.setSize.bind(this),dispose=this.dispose.bind(this),lose=this.forceContextLoss.bind(this);
 this.setSize=(width,height,updateStyle)=>{window.probe.resizes++;window.probe.sizes.push([width,height]);return resize(width,height,updateStyle);};
 this.render=(scene,camera)=>{window.probe.draws++;window.probe.angles.push(scene.children.find(object=>object.isMesh)?.rotation.y);draw(scene,camera);window.probe.nativeRenderCalls=this.info.render.calls;};
 this.dispose=()=>{window.markResourceDisposed?.(this);window.probe.disposals++;return dispose();};this.forceContextLoss=()=>{window.probe.contextReleases++;return lose();};}
}`:`export class WebGLRenderer {
 domElement;capabilities={getMaxAnisotropy:()=>{window.maybeFailResource?.('anisotropy');return 4;}};pixelRatio=1;width=1;height=1;
 constructor(options={}){this.domElement=options.canvas??document.createElement('canvas');window.currentResourceSiteCalls={};window.probe.rendererConstructions++;window.maybeFailResource?.('renderer_constructor');
  if(${contextChecks}){const canvas=this.domElement;this.contextLost=event=>{event.preventDefault();window.probe.driverLosses++;if(window.probe.failLoss)throw Error('injected driver context loss failure');};this.contextRestore=()=>{window.probe.driverRestores++;if(window.probe.failRestore)throw Error('injected driver context restoration failure');};this.contextCreationError=()=>{window.probe.driverCreationErrors++;if(window.probe.failCreationError)throw Error('injected driver context creation callback failure');};canvas.addEventListener('webglcontextlost',this.contextLost,false);canvas.addEventListener('webglcontextrestored',this.contextRestore,false);canvas.addEventListener('webglcontextcreationerror',this.contextCreationError,false);window.maybeFailResource?.('renderer_after_listeners');}
  window.trackResource?.(this,'renderer');}

 setPixelRatio(value){window.maybeFailResource?.('pixel_ratio');this.pixelRatio=value;}getPixelRatio(){return this.pixelRatio;}
 setSize(width,height){window.probe.resizes++;window.probe.sizes.push([width,height]);if(window.probe.failResize)throw Error('injected resize failure');this.width=width;this.height=height;}
 getDrawingBufferSize(target){return target.set(Math.floor(this.width*this.pixelRatio),Math.floor(this.height*this.pixelRatio));}setViewport(){}
 render(scene){window.probe.draws++;window.probe.angles.push(scene.children.find(object=>object.isMesh)?.rotation.y);if(window.probe.failDraw)throw Error('injected draw failure');}
 dispose(){if(${contextChecks}){this.domElement.removeEventListener('webglcontextlost',this.contextLost,false);this.domElement.removeEventListener('webglcontextrestored',this.contextRestore,false);this.domElement.removeEventListener('webglcontextcreationerror',this.contextCreationError,false);}window.markResourceDisposed?.(this);window.probe.disposals++;if(window.probe.failDispose)throw Error('injected disposal failure');}forceContextLoss(){window.probe.contextReleases++;}
}`;
const tracking=`const released=new WeakSet();for(const type of [THREE.BufferGeometry,THREE.Material,THREE.Texture]){const original=type.prototype.dispose;type.prototype.dispose=function(){window.markResourceDisposed?.(this);window.probe.resourceReleases++;if(released.has(this))window.probe.duplicateReleases++;released.add(this);return original.call(this);};}`;
const resourceFacade=resourceChecks?['SphereGeometry','RingGeometry','BufferGeometry','ShaderMaterial','PointsMaterial','MeshBasicMaterial','MeshPhongMaterial','SpriteMaterial','CanvasTexture'].map(type=>`export class ${type} extends THREE.${type}{constructor(...args){window.maybeFailResource?.('${type}');super(...args);window.trackResource(this,'${type}');}}`).join('\n')+`
export class TextureLoader extends THREE.TextureLoader{
 load(url,onLoad,onProgress,onError){window.maybeFailResource?.('texture_loader');const texture=super.load(url,onLoad,onProgress,onError);window.trackResource(texture,'texture');window.probe.textureCallbacks.push({texture,onError});if(window.failResource?.kind==='texture_error_sync')onError?.(Error('injected synchronous texture failure'));return texture;}
}`:'';
return `import * as THREE from ${JSON.stringify(originalThree)};export * from ${JSON.stringify(originalThree)};${tracking}\n${stubRenderer}\n${resourceFacade}`;
}
