const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {prepare}=require('../src/transfer-destination.cjs'),{TransferQueue}=require('../src/transfers.cjs');
test('copying within the same folder preserves extensions and reserves vacant numbered names',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ne-inplace-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const source=path.join(root,'Artwork.txt'),folder=path.join(root,'Folder.with.dot');await fs.writeFile(source,'original');await fs.writeFile(path.join(root,'Artwork (2).txt'),'keep');await fs.mkdir(folder);
 const p=await prepare([source,folder,source],root,false);assert.deepEqual(p.sources,[source,folder]);assert.equal(p.names[source],'Artwork (3).txt');assert.equal(p.names[folder],'Folder.with.dot (2)');assert.equal(await fs.readFile(source,'utf8'),'original');
 assert.deepEqual((await prepare([source],root,true)).sources,[]);
});
test('shortcut-style grouped creations retain partial success and undo/redo together across restart',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ne-create-group-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const journal=path.join(root,'profile','history.json');let q=new TransferQueue({journalPath:journal});const a=path.join(root,'a.lnk'),b=path.join(root,'b.lnk');
 await assert.rejects(q.createGroup(async record=>{await fs.writeFile(a,'a');await record(a);await assert.rejects(q.undo(),/Wait/);await fs.writeFile(b,'b');await record(b);throw Error('later item failed');}),/later item failed/);
 assert.equal(q.creating,false);assert.equal(q.history.length,1);q=new TransferQueue({journalPath:journal});await q.restore();await q.undo();await assert.rejects(fs.access(a));await assert.rejects(fs.access(b));await q.redo();assert.equal(await fs.readFile(a,'utf8'),'a');assert.equal(await fs.readFile(b,'utf8'),'b');
});
