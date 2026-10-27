const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const intent=require('../src/drop-intent.js'),drop=require('../src/drop.cjs');
test('drop modifiers and drive feedback follow Explorer conventions',()=>{
 assert.equal(intent.effect({},['C:\\one'],'c:\\two'),'move');assert.equal(intent.effect({},['C:\\one'],'D:\\two'),'copy');
 assert.equal(intent.effect({ctrlKey:true},['C:\\one'],'C:\\two'),'copy');assert.equal(intent.effect({shiftKey:true},[],'D:\\two'),'move');
 assert.equal(intent.effect({ctrlKey:true,shiftKey:true},[],'D:\\two'),'link');assert.equal(intent.effect({altKey:true},[],'D:\\two'),'link');
 assert.equal(intent.effect({},['\\\\host\\share\\one'],'\\\\HOST\\SHARE\\two'),'move');
});
test('drop defaults use actual filesystem volume IDs, including mounted folders',async()=>{
 const root=path.resolve('drop-root'),a=path.join(root,'a'),b=path.join(root,'b'),dest=path.join(root,'dest');
 const inspect=async p=>({dev:p===b?2:1,isDirectory:()=>p===dest});
 assert.deepEqual(await drop.plan([a,b,a],dest,{},inspect),[{mode:'move',sources:[a]},{mode:'copy',sources:[b]}]);
 assert.deepEqual(await drop.plan([a,b],dest,{ctrlKey:true},inspect),[{mode:'copy',sources:[a,b]}]);
 await assert.rejects(drop.plan([a],a,{},inspect),/folder/);
});
test('shortcut creation never overwrites existing names and removes failed placeholders',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ne-drop-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const source=path.join(root,'source.txt');await fs.writeFile(source,'original');const existing=path.join(root,'source.txt - Shortcut.lnk');await fs.writeFile(existing,'keep');
 const history=[];const created=await drop.links([source],root,(target,options)=>{require('node:fs').writeFileSync(target,JSON.stringify(options));return true;},async p=>history.push(p));
 assert.equal(path.basename(created[0]),'source.txt - Shortcut (2).lnk');assert.deepEqual(history,created);assert.equal(await fs.readFile(existing,'utf8'),'keep');
 await assert.rejects(drop.links([source],root,()=>false,async()=>{}),/could not/);assert.equal((await fs.readdir(root)).length,3);
});
