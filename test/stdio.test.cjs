const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {protectBrokenPipes}=require('../src/stdio.cjs');
test('closed handoff output pipes do not crash the app while other stream errors remain visible',()=>{const stream=new EventEmitter();protectBrokenPipes([stream]);assert.doesNotThrow(()=>stream.emit('error',Object.assign(new Error('broken pipe'),{code:'EPIPE'})));assert.throws(()=>stream.emit('error',Object.assign(new Error('other failure'),{code:'EIO'})),/other failure/);});
