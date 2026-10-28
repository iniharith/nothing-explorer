const {Worker}=require('node:worker_threads');
const path=require('node:path');
const pending=[],pool=new Set();
function remove(slot){clearTimeout(slot.idle);pool.delete(slot);slot.worker.terminate().catch(()=>{});}
function drain(){
 while(pending.length){
  let slot=[...pool].find(s=>!s.task);
  if(!slot){if(pool.size>=2)return;let worker;try{worker=new Worker(path.join(__dirname,'image-worker.cjs'),{resourceLimits:{maxOldGenerationSizeMb:512}});}catch(error){pending.shift().reject(error);continue;}slot={worker,task:null};pool.add(slot);
   const complete=(error,data)=>{const task=slot.task;if(!task)return;clearTimeout(slot.timer);slot.task=null;if(error&&error.fatal)remove(slot);else{slot.worker.unref();slot.idle=setTimeout(()=>remove(slot),30000);slot.idle.unref();}error?task.reject(error):task.resolve(data);drain();};
   worker.on('message',message=>complete(message.error?Error(message.error):null,message.data));
   worker.on('error',error=>{error.fatal=true;complete(error);remove(slot);drain();});
   worker.on('exit',code=>{pool.delete(slot);if(slot.task){const error=Error('Image decoder exited '+code);error.fatal=true;complete(error);}drain();});
  }
  clearTimeout(slot.idle);slot.task=pending.shift();slot.worker.ref();slot.timer=setTimeout(()=>{const task=slot.task;slot.task=null;remove(slot);task.reject(Error('Image decoding timed out.'));drain();},45000);slot.worker.postMessage({file:slot.task.file,width:slot.task.width});
 }
}
function decode(file,width=512,priority=false){return new Promise((resolve,reject)=>{const task={file,width:Math.max(32,Math.min(8192,Number(width)||512)),resolve,reject};priority?pending.unshift(task):pending.push(task);drain();});}
module.exports={decode};
