const {Worker}=require('node:worker_threads');
const path=require('node:path');
const pending=[];let active=0;
function drain(){
 while(active<2&&pending.length){
  const {file,width,resolve,reject}=pending.shift();let worker;
  try{worker=new Worker(path.join(__dirname,'image-worker.cjs'),{workerData:{file,width},resourceLimits:{maxOldGenerationSizeMb:512}});}catch(error){reject(error);continue;}
  active++;let done=false;
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);worker.terminate().catch(()=>{});active--;error?reject(error):resolve(value);drain();};
  const timer=setTimeout(()=>finish(Error('Image decoding timed out.')),45000);
  worker.once('message',message=>finish(message.error?Error(message.error):null,message.data));
  worker.once('error',error=>finish(error));
  worker.once('exit',code=>{if(!done)finish(Error('Image decoder exited '+code));});
 }
}
function decode(file,width=512){return new Promise((resolve,reject)=>{pending.push({file,width:Math.max(32,Math.min(8192,Number(width)||512)),resolve,reject});drain();});}
module.exports={decode};
