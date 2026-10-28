const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {ImageCache}=require('../src/image-cache.cjs');
test('image cache coalesces decoding, survives restart and separates revisions',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ne-image-cache-'));let calls=0;
 const loader=async()=>{calls++;await new Promise(r=>setTimeout(r,10));return 'data:image/png;base64,YQ==';};
 try{const cache=new ImageCache(root);const data=await Promise.all([cache.get('photo:mtime1:256',loader),cache.get('photo:mtime1:256',loader)]);assert.equal(calls,1);assert.equal(data[0],data[1]);assert.equal(await new ImageCache(root).get('photo:mtime1:256',()=>{throw Error('Disk cache was missed');}),data[0]);await cache.get('photo:mtime2:256',loader);assert.equal(calls,2);}finally{await fs.rm(root,{recursive:true,force:true});}
});
test('failed image decoding can retry and invalid cached data is regenerated',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ne-image-cache-'));
 try{const cache=new ImageCache(root);await assert.rejects(cache.get('key',()=>Promise.reject(Error('decoder failed'))));const data='data:image/jpeg;base64,YQ==';await cache.get('key',async()=>data);const files=await fs.readdir(root);await fs.writeFile(path.join(root,files.find(f=>f.endsWith('.img'))),'invalid cache');assert.equal(await new ImageCache(root).get('key',async()=>data),data);}finally{await fs.rm(root,{recursive:true,force:true});}
});
