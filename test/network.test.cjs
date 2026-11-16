const test=require('node:test'),assert=require('node:assert/strict');
const {serversFromNetView,augment}=require('../src/network.cjs');
test('network discovery combines computers and mapped drives without duplicates',async()=>{
 assert.deepEqual(serversFromNetView('Server Name  Remark\r\n\\\\NAS    Storage\r\n\\\\nas  duplicate\r\n\\\\PRINT-PC\tPrinter\r\n'),['nas','print-pc']);
 const result=await augment({entries:[{name:'NAS',parsing:'\\\\nas',directory:true,filesystem:false}]},[{name:'Shared (Z:)',path:'Z:\\',type:4},{name:'Disk (C:)',path:'C:\\',type:3}],async()=>['nas','print-pc']);
 assert.equal(result.entries.length,3);assert.equal(result.entries[1].parsing,'Z:\\');assert.equal(result.entries[1].filesystem,true);assert.equal(result.entries[2].parsing,'\\\\print-pc');assert.equal(result.entries[2].filesystem,false);
});
