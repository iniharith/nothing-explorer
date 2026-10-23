const fs=require('node:fs/promises'),nativeFs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises');
const {vacant}=require('./files.cjs');
async function snapshot(p,verify=false){const s=await fs.lstat(p);const out={size:s.size,mtime:s.mtimeMs,dir:s.isDirectory(),link:s.isSymbolicLink()};if(out.link)out.target=await fs.readlink(p);if(out.dir){out.children={};for(const name of (await fs.readdir(p)).sort())out.children[name]=await snapshot(path.join(p,name),verify);}else if(verify&&!out.link){const hash=crypto.createHash('sha256');for await(const chunk of nativeFs.createReadStream(p))hash.update(chunk);out.hash=hash.digest('hex');const end=await fs.lstat(p);if(end.size!==s.size||end.mtimeMs!==s.mtimeMs)throw Error('Item changed while verifying it.');}return out;}
function sameContent(a,b){if(a.dir!==b.dir||a.link!==b.link)return false;if(a.dir){const keys=Object.keys(a.children),other=Object.keys(b.children);return keys.length===other.length&&keys.every(k=>b.children[k]&&sameContent(a.children[k],b.children[k]));}return a.size===b.size&&a.hash===b.hash&&a.target===b.target;}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function bytes(s){return s.dir?Object.values(s.children).reduce((n,v)=>n+bytes(v),0):s.link?0:s.size;}
async function copyTree(from,to,signal,progress,gate=async()=>{}){
 signal.throwIfAborted();const s=await fs.lstat(from);
 if(s.isSymbolicLink()){await fs.symlink(await fs.readlink(from),to);return;}
 if(s.isDirectory()){await fs.mkdir(to);for(const name of await fs.readdir(from))await copyTree(path.join(from,name),path.join(to,name),signal,progress,gate);await fs.utimes(to,s.atime,s.mtime);return;}
 const input=nativeFs.createReadStream(from),output=nativeFs.createWriteStream(to,{flags:'wx'});await pipeline(input,async function*(source){for await(const chunk of source){await gate();signal.throwIfAborted();progress(chunk.length,from);yield chunk;}},output,{signal});await fs.utimes(to,s.atime,s.mtime);
}
async function commitFile(from,to){try{await fs.link(from,to);}catch(e){if(!['EPERM','ENOTSUP','EOPNOTSUPP','EXDEV'].includes(e.code))throw e;await fs.copyFile(from,to,nativeFs.constants.COPYFILE_EXCL);}await fs.unlink(from);}
class TransferQueue{
 constructor({onChange=()=>{},trash=async p=>fs.rm(p,{recursive:true}),journalPath=null}={}){this.jobs=[];this.history=[];this.redoStack=[];this.running=false;this.onChange=onChange;this.trash=trash;this.journalPath=journalPath;this.recoveryRoot=journalPath?path.join(path.dirname(journalPath),'recovery'):path.join(require('node:os').tmpdir(),'ne-recovery-'+crypto.randomUUID());}
 publicJobs(){return this.jobs.map(({controller,...job})=>({...job}));}
 emit(){this.onChange(this.publicJobs());}
 enqueue(sources,destination,move=false,names={}){const controller=new AbortController();const job={id:crypto.randomUUID(),sources:[...sources],destination,move,names,status:'queued',bytes:0,total:0,current:'',completed:[],completedSources:[],error:'',controller};this.jobs.push(job);this.emit();this.drain();return job.id;}
 cancel(id){const j=this.jobs.find(j=>j.id===id);if(j&&['queued','running'].includes(j.status)){j.controller.abort();if(j.status==='queued')j.status='cancelled';this.save().catch(()=>{});this.emit();}}
 pause(id,paused){const job=this.jobs.find(j=>j.id===id);if(!job||!['running','queued'].includes(job.status))throw Error('Transfer is no longer active.');job.paused=Boolean(paused);this.save().catch(()=>{});this.emit();}
 async drain(){if(this.running)return;this.running=true;try{for(const job of this.jobs){if(job.status!=='queued')continue;job.status='running';this.emit();try{await this.save();await this.execute(job);job.status='completed';}catch(e){job.status=job.controller.signal.aborted?'cancelled':'failed';job.error=e.message;}try{await this.save();}catch(e){job.status='failed';job.error='Operation history could not be saved: '+e.message;}this.emit();}}finally{this.running=false;}}
 async execute(job){
  job.total=0;job.bytes=0;const dest=await fs.realpath(job.destination),plan=[];const targetSet=new Set();
  for(const source of job.sources){if(job.completedSources?.includes(source))continue;job.controller.signal.throwIfAborted();const real=await fs.realpath(source),relative=path.relative(real,dest);if(relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error('Cannot put an item inside itself.');const name=job.names?.[source]||path.basename(source);require('./files.cjs').nameCheck(name);const target=path.join(dest,name);if(targetSet.has(target.toLowerCase()))throw Error('Two selected items have the same destination name.');targetSet.add(target.toLowerCase());await vacant(target);const before=await snapshot(source);job.total+=bytes(before);plan.push({source,target,before});}
  this.emit();let last=0;
  for(const item of plan){const {source,target,before}=item;job.controller.signal.throwIfAborted();await vacant(target);const stage=path.join(dest,'.nothing-transfer-'+crypto.randomUUID());let committed=false;
   try{
    job.stage=stage;await this.save();
    await copyTree(source,stage,job.controller.signal,(n,p)=>{job.bytes+=n;job.current=p;if(Date.now()-last>80){last=Date.now();this.emit();}},async()=>{while(job.paused){job.controller.signal.throwIfAborted();await new Promise(r=>setTimeout(r,50));}});
    if(!same(before,await snapshot(source)))throw Error('Source changed during the transfer; source was retained.');
    job.controller.signal.throwIfAborted();await vacant(target);
    if(before.dir)await fs.rename(stage,target);else await commitFile(stage,target);committed=true;
    const after=await snapshot(target,true);job.controller.signal.throwIfAborted();let moved=false;
    if(job.move){if(!same(before,await snapshot(source)))throw Error('Source changed before move completed; source was retained.');await this.trash(source);moved=true;}
    const record={type:'transfer',source,target,moved,after,verified:true};await this.invalidateRedo();this.history.push(record);job.completed.push(target);job.completedSources.push(source);await this.save();
   }catch(e){if(committed&&!job.completed.includes(target)){this.history.push({type:'transfer',source,target,moved:false,after:await snapshot(target,true),verified:true});job.completed.push(target);job.completedSources.push(source);await this.save();}throw e;}finally{await fs.rm(stage,{recursive:true,force:true}).catch(()=>{});delete job.stage;await this.save();}
  }
 }
 async save(){this.history=this.history.slice(-100);if(this.journalPath){const data=JSON.stringify({version:2,history:this.history,redo:this.redoStack,jobs:this.publicJobs().slice(-30)});this.saving=(this.saving||Promise.resolve()).catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(this.journalPath),{recursive:true});const temp=this.journalPath+'.tmp';await fs.writeFile(temp,data);await fs.rename(temp,this.journalPath);});await this.saving;}}
 async restore(){if(this.journalPath)try{const data=JSON.parse(await fs.readFile(this.journalPath,'utf8'));this.history=Array.isArray(data)?data:(data.history||[]);this.redoStack=Array.isArray(data.redo)?data.redo:[];this.jobs=Array.isArray(data.jobs)?data.jobs.map(job=>({...job,controller:new AbortController(),status:['running','queued'].includes(job.status)?'interrupted':job.status,paused:false,completedSources:job.completedSources||[]})):[];}catch{}}
 async retry(id){const job=this.jobs.find(j=>j.id===id);if(!job||!['interrupted','failed','cancelled'].includes(job.status))throw Error('This transfer cannot be retried.');for(const source of job.sources)if(!job.completedSources.includes(source))await fs.access(source);if(job.stage){const dest=await fs.realpath(job.destination);if(path.dirname(job.stage)!==dest||!/^\.nothing-transfer-[a-f0-9-]{36}$/.test(path.basename(job.stage)))throw Error('Invalid staging path; no cleanup performed.');await fs.rm(job.stage,{recursive:true,force:true});delete job.stage;}job.controller=new AbortController();job.paused=false;job.error='';job.status='queued';await this.save();this.emit();this.drain();return id;}
 async invalidateRedo(){for(const record of this.redoStack)if(record.stash)await this.trash(record.stash);this.redoStack=[];}
 async recordRename(source,target){await this.invalidateRedo();this.history.push({type:'rename',source,target,after:await snapshot(target,true),verified:true});await this.save();}
 async recordBatchRename(items){await this.invalidateRedo();const records=[];for(const item of items)records.push({...item,after:await snapshot(item.target,true)});this.history.push({type:'batch-rename',items:records});await this.save();}
 async recordCreate(target){await this.invalidateRedo();this.history.push({type:'create',target,after:await snapshot(target,true),verified:true});await this.save();}
 async relocate(source,target){
  await vacant(target);await fs.mkdir(path.dirname(target),{recursive:true});try{await fs.rename(source,target);return;}catch(e){if(e.code!=='EXDEV')throw e;}
  const stage=path.join(path.dirname(target),'.nothing-transfer-'+crypto.randomUUID());try{const before=await snapshot(source,true);await copyTree(source,stage,new AbortController().signal,()=>{});if(!same(before,await snapshot(source,true)))throw Error('Item changed while saving recovery data.');if(!sameContent(before,await snapshot(stage,true)))throw Error('Recovery copy verification failed.');await fs.rename(stage,target);try{await this.trash(source);}catch(e){await this.trash(target);throw e;}}finally{await fs.rm(stage,{recursive:true,force:true}).catch(()=>{});}
 }
 async undo(){
  if(this.running)throw Error('Wait for active transfers to finish before undoing.');const op=this.history.at(-1);if(!op)throw Error('Nothing to undo.');
  if(op.type==='batch-rename'){
   for(const item of op.items)if(!same(item.after,await snapshot(item.target,true)))throw Error('An item changed after renaming. Undo stopped.');
   await require('./bulk-rename.cjs').apply(op.items.map(i=>({source:i.target,target:i.source})));op.restoredItems=[];for(const item of op.items)op.restoredItems.push(await snapshot(item.source,true));
  }else{
   if(!same(op.after,await snapshot(op.target,!!op.verified)))throw Error('This item changed after the operation. Undo stopped to protect those changes.');
   if(op.type==='rename'){await vacant(op.source);await fs.rename(op.target,op.source);op.restored=await snapshot(op.source,true);}
   else{
    if(op.moved){await vacant(op.source);const stage=path.join(path.dirname(op.source),'.nothing-undo-'+crypto.randomUUID());try{await copyTree(op.target,stage,new AbortController().signal,()=>{});if(!same(op.after,await snapshot(op.target,!!op.verified)))throw Error('Item changed while undoing.');if(op.after.dir)await fs.rename(stage,op.source);else await commitFile(stage,op.source);op.restored=await snapshot(op.source,true);}finally{await fs.rm(stage,{recursive:true,force:true}).catch(()=>{});}}
    op.stash=path.join(this.recoveryRoot,crypto.randomUUID());await this.relocate(op.target,op.stash);op.stashed=await snapshot(op.stash,true);
   }
  }
  this.history.pop();this.redoStack.push(op);await this.save();return op;
 }
 async redo(){
  if(this.running)throw Error('Wait for active transfers to finish before redoing.');const op=this.redoStack.at(-1);if(!op)throw Error('Nothing to redo.');
  if(op.type==='batch-rename'){
   for(let i=0;i<op.items.length;i++)if(!same(op.restoredItems[i],await snapshot(op.items[i].source,true)))throw Error('An item changed after undo. Redo stopped.');
   await require('./bulk-rename.cjs').apply(op.items);for(const item of op.items)item.after=await snapshot(item.target,true);
  }else if(op.type==='rename'){
   if(!same(op.restored,await snapshot(op.source,true)))throw Error('Item changed after undo. Redo stopped.');await vacant(op.target);await fs.rename(op.source,op.target);op.after=await snapshot(op.target,true);
  }else{
   if(!same(op.stashed||op.after,await snapshot(op.stash,!!op.verified)))throw Error('Recovery copy changed. Redo stopped.');await vacant(op.target);
   if(op.moved&&!same(op.restored,await snapshot(op.source,true)))throw Error('Source changed after undo. Redo stopped.');
   await this.relocate(op.stash,op.target);if(op.moved)try{await this.trash(op.source);}catch(e){await this.relocate(op.target,op.stash);throw e;}delete op.stash;op.after=await snapshot(op.target,true);
  }
  this.redoStack.pop();this.history.push(op);await this.save();return op;
 }

}
module.exports={TransferQueue,snapshot,copyTree};
