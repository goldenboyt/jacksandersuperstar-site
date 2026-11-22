import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import vm from 'node:vm';
const scope={window:{}};
vm.runInNewContext(readFileSync(new URL('../release-data.js',import.meta.url),'utf8'),scope);
vm.runInNewContext(readFileSync(new URL('../song-waveforms.js',import.meta.url),'utf8'),scope);
const releases=scope.window.SuperstarCatalog.releases,shapes=scope.window.SuperstarWaveforms;
test('each current preview has measured, finite and varied per-window audio data',()=>{
  const urls=new Set(releases.flatMap(release=>release.previews||[]));assert.equal(Object.keys(shapes).length,urls.size);
  for(const url of urls){const shape=shapes[url];assert.ok(shape,`missing ${url}`);assert.equal(shape.samples.length,64);assert.ok(shape.duration>1&&shape.duration<=30);assert.ok(shape.samples.every(n=>Number.isInteger(n)&&n>=0&&n<=1000));assert.ok(new Set(shape.samples).size>5)}
});
test('local cats cash preview data matches independently decoded stereo audio',{skip:spawnSync('ffmpeg',['-version'],{stdio:'ignore'}).status!==0},()=>{
  const url='assets/previews/cats-cash.m4a';const buffer=execFileSync('ffmpeg',['-v','error','-i',new URL('../'+url,import.meta.url).pathname,'-t','30','-ar','8000','-ac','2','-f','f32le','-'],{maxBuffer:4000000});const frameCount=buffer.length/8,samples=[];
  for(let part=0;part<64;part++){const start=part*Math.floor(frameCount/64)+Math.min(part,frameCount%64),end=(part+1)*Math.floor(frameCount/64)+Math.min(part+1,frameCount%64);let sum=0;for(let i=start*2;i<end*2;i++){const n=buffer.readFloatLE(i*4);sum+=n*n}samples.push(Math.sqrt(sum/((end-start)*2)))}
  const max=Math.max(...samples);const expected=samples.map(n=>Math.round(n/max*1000));assert.deepEqual(Array.from(shapes[url].samples),expected);
});
