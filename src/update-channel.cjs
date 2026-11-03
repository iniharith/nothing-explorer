const {spawn}=require('node:child_process');
const crypto=require('node:crypto');
// A handoff uses an inherited IPC channel; no network listener or public port.
function startCandidate(executable,args=[],{timeout=30000,spawnProcess=spawn,env={},windowsHide=true}={}){
 const token=crypto.randomBytes(32).toString('hex');const child=spawnProcess(executable,[...args,'--handoff-child'],{detached:true,windowsHide,stdio:['ignore','ignore','pipe','ipc'],env:{...process.env,...env,NOTHING_HANDOFF_TOKEN:token}});let errorText='',closed=false;
 child.stderr?.on('data',chunk=>{if(errorText.length<4096)errorText+=chunk.toString();});child.once('close',()=>{closed=true;});
 function exchange(type,payload){return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>finish(Error('The replacement app did not respond in time.')),timeout);timer.unref();function finish(error,value){if(done)return;done=true;clearTimeout(timer);child.off('message',onMessage);child.off('exit',onExit);child.off('error',onError);error?reject(error):resolve(value);}function onMessage(message){if(message?.token!==token||message?.replyTo!==type)return;if(message.error)finish(Error(String(message.error)));else finish(null,message.value);}function onExit(code){finish(Error(`The replacement app exited before ${type} completed (${code}). ${errorText.slice(-300)}`));}function onError(error){finish(error);}child.on('message',onMessage);child.once('exit',onExit);child.once('error',onError);if(closed||!child.connected)return finish(Error('The replacement app is not connected.'));child.send({token,type,payload},error=>{if(error)finish(error);});});}
 return {child,exchange,discard:()=>{if(!closed)child.kill();}};
}
module.exports={startCandidate};
