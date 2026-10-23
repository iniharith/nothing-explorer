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
