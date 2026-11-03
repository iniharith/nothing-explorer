const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalize,defaults}=require('../src/preferences.cjs');
const {createUpdates,releaseSource}=require('../src/updates.cjs');
test('appearance preferences clamp values and reject unexpected configuration',()=>{
 assert.deepEqual(normalize(),defaults);
 const p=normalize({motion:'arbitrary',opacity:1,blur:100,smooth:false,glass:false,theme:'light',wallpaper:false,feedURL:'https://attacker.invalid'});
 assert.equal(p.opacity,55);assert.equal(p.blur,30);assert.equal(p.motion,'standard');assert.equal(p.smooth,false);assert.equal(p.glass,false);assert.equal(p.theme,'light');assert.equal(p.wallpaper,false);assert.equal(p.feedURL,undefined);
});
test('release source is fixed and development builds cannot download updates',async()=>{
 assert.ok(Object.isFrozen(releaseSource));assert.equal(releaseSource.owner,'iniharith');assert.equal(releaseSource.repo,'nothing-explorer');
 const sent=[];const updates=createUpdates({app:{isPackaged:false,getVersion:()=> '0.5.0'},win:{isDestroyed:()=>false,webContents:{send:(_,s)=>sent.push(s)}},busy:()=>false});
 assert.equal((await updates.run('status')).status,'idle');assert.equal((await updates.run('download')).status,'unavailable');assert.equal(sent.length,1);
});
test('background updates download without restarting and respect active transfers',async()=>{
 const {EventEmitter}=require('node:events');const updater=new EventEmitter(),app=new EventEmitter();app.isPackaged=true;app.getVersion=()=> '1.0.0';let downloads=0,installs=0,busy=false,finish;
 updater.checkForUpdates=async()=>{updater.emit('update-available',{version:'1.1.0'});};updater.downloadUpdate=()=>{downloads++;return new Promise(resolve=>finish=()=>{updater.emit('update-downloaded');resolve();});};updater.quitAndInstall=()=>installs++;
 const updates=createUpdates({app,win:{isDestroyed:()=>false,webContents:{send(){}}},busy:()=>busy,updaterFactory:()=>updater});await updates.run('background',true);await updates.run('check');assert.equal(downloads,1);assert.equal(installs,0);assert.equal((await updates.run('status')).status,'downloading');finish();await new Promise(resolve=>setImmediate(resolve));assert.equal((await updates.run('status')).status,'ready');busy=true;await assert.rejects(updates.run('install'),/transfers/);assert.equal(installs,0);busy=false;await updates.run('install');assert.equal(installs,1);app.emit('before-quit');
});
