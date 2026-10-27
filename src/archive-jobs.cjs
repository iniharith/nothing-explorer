const crypto=require('node:crypto');
class ArchiveJobs {
 constructor(onChange=()=>{}){this.jobs=[];this.pending=[];this.draining=false;this.onChange=onChange;}
 get running(){return this.jobs.some(j=>['queued','running'].includes(j.status));}
 publicJobs(){return this.jobs.map(({controller,...job})=>({...job}));}
 emit(){this.onChange();}
 has(id){return this.jobs.some(j=>j.id===id);}
 cancel(id){const job=this.jobs.find(j=>j.id===id);if(job&&['queued','running'].includes(job.status)){job.controller.abort();if(job.status==='queued'){const index=this.pending.findIndex(item=>item.job===job);if(index>=0){const [item]=this.pending.splice(index,1);job.status='cancelled';job.error='Archive operation cancelled.';delete job.controller;item.reject(Object.assign(Error(job.error),{code:'ARCHIVE_CANCELLED'}));this.emit();}}return true;}return false;}
 cancelRequest(owner,requestId){for(const job of this.jobs)if(job.owner===owner&&job.requestId===requestId)this.cancel(job.id);}
 cancelAll(){for(const job of this.jobs)this.cancel(job.id);}
 dismiss(id){const job=this.jobs.find(j=>j.id===id);if(!job||['queued','running'].includes(job.status))throw Error('Only inactive operations can be dismissed.');job.dismissed=true;this.emit();}
 run(kind,sources,target,{owner,requestId}={},task){for(const job of this.jobs)if(job.kind===kind&&job.target===target&&!['queued','running'].includes(job.status))job.dismissed=true;const job={id:'archive-'+crypto.randomUUID(),kind,sources:[...sources],target,owner,requestId,status:'queued',bytes:0,total:0,completed:[],canPause:false,retryable:false,controller:new AbortController()};this.jobs.push(job);this.emit();return new Promise((resolve,reject)=>{this.pending.push({job,task,resolve,reject});this.drain();});}
 async drain(){if(this.draining)return;this.draining=true;try{while(this.pending.length){const {job,task,resolve,reject}=this.pending.shift();let last=0;try{job.controller.signal.throwIfAborted();job.status='running';this.emit();const value=await task({signal:job.controller.signal,onProgress:(bytes,name)=>{job.bytes+=bytes;job.current=name;if(Date.now()-last>=50){last=Date.now();this.emit();}},committed:value=>{job.completed=[value];}});job.completed=[value];job.status='completed';resolve(value);}catch(error){if(error.code==='ARCHIVE_PASSWORD'){job.dismissed=true;job.status='failed';reject(error);}else{const cancelled=job.controller.signal.aborted&&!job.completed.length;job.status=cancelled?'cancelled':'failed';job.error=cancelled?'Archive operation cancelled.':error.message;const result=cancelled?Object.assign(Error(job.error),{code:'ARCHIVE_CANCELLED'}):error;reject(result);}}finally{delete job.controller;this.jobs=this.jobs.filter(j=>['queued','running'].includes(j.status)||this.jobs.slice(-30).includes(j));this.emit();}}}finally{this.draining=false;}}
}
module.exports={ArchiveJobs};
