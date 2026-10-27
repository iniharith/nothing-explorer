const fs=require('node:fs/promises'),nativeFs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises');
const {vacant}=require('./files.cjs');
async function snapshot(p,verify=false,signal=null){signal?.throwIfAborted();const s=await fs.lstat(p);const out={size:s.size,mtime:s.mtimeMs,dir:s.isDirectory(),link:s.isSymbolicLink()};if(out.link)out.target=await fs.readlink(p);if(out.dir){out.children={};for(const name of (await fs.readdir(p)).sort())out.children[name]=await snapshot(path.join(p,name),verify,signal);}else if(verify&&!out.link){const hash=crypto.createHash('sha256');for await(const chunk of nativeFs.createReadStream(p,signal?{signal}:{}))hash.update(chunk);out.hash=hash.digest('hex');const end=await fs.lstat(p);if(end.size!==s.size||end.mtimeMs!==s.mtimeMs)throw Error('Item changed while verifying it.');}return out;}
function sameContent(a,b){if(a.dir!==b.dir||a.link!==b.link)return false;if(a.dir){const keys=Object.keys(a.children),other=Object.keys(b.children);return keys.length===other.length&&keys.every(k=>b.children[k]&&sameContent(a.children[k],b.children[k]));}return a.size===b.size&&a.hash===b.hash&&a.target===b.target;}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function bytes(s){return s.dir?Object.values(s.children).reduce((n,v)=>n+bytes(v),0):s.link?0:s.size;}
async function prefixHash(file,length,signal){const hash=crypto.createHash('sha256');if(length)for await(const chunk of nativeFs.createReadStream(file,{start:0,end:length-1,signal}))hash.update(chunk);return hash.digest('hex');}
async function copyTree(from,to,signal,progress,gate=async()=>{},resume=false){
 signal.throwIfAborted();await gate();const s=await fs.lstat(from),existing=resume?await fs.lstat(to).catch(e=>{if(e.code==='ENOENT')return null;throw e;}):null;
 if(s.isSymbolicLink()){const link=await fs.readlink(from);if(existing){if(!existing.isSymbolicLink()||await fs.readlink(to)!==link)throw Error('Recovery link no longer matches the source.');}else await fs.symlink(link,to);return;}
 if(s.isDirectory()){if(existing&&(!existing.isDirectory()||existing.isSymbolicLink()))throw Error('Recovery directory was replaced.');if(!existing)await fs.mkdir(to);for(const name of await fs.readdir(from))await copyTree(path.join(from,name),path.join(to,name),signal,progress,gate,resume);await fs.utimes(to,s.atime,s.mtime);return;}
 let offset=0;if(existing){if(!existing.isFile()||existing.isSymbolicLink()||existing.size>s.size)throw Error('Recovery file does not match the source.');offset=existing.size;if(await prefixHash(from,offset,signal)!==await prefixHash(to,offset,signal))throw Error('Recovery file contents changed; source and staging were retained.');progress(offset,from);if(offset===s.size)return;}
 const input=nativeFs.createReadStream(from,{start:offset}),output=nativeFs.createWriteStream(to,{flags:existing?'a':'wx'});await pipeline(input,async function*(source){for await(const chunk of source){await gate();signal.throwIfAborted();progress(chunk.length,from);yield chunk;}},output,{signal});await fs.utimes(to,s.atime,s.mtime);
}
async function commitFile(from,to){try{await fs.link(from,to);}catch(e){if(!['EPERM','ENOTSUP','EOPNOTSUPP','EXDEV'].includes(e.code))throw e;await fs.copyFile(from,to,nativeFs.constants.COPYFILE_EXCL);}await fs.unlink(from);}
class TransferQueue{
 constructor({onChange=()=>{},trash=async p=>fs.rm(p,{recursive:true}),journalPath=null,metadata=null}={}){this.metadata=metadata;this.jobs=[];this.history=[];this.redoStack=[];this.running=false;this.onChange=onChange;this.trash=trash;this.journalPath=journalPath;this.recoveryRoot=journalPath?path.join(path.dirname(journalPath),'recovery'):path.join(require('node:os').tmpdir(),'ne-recovery-'+crypto.randomUUID());}
 publicJobs(){return this.jobs.map(({controller,finalStatus,...job})=>({...job}));}
 emit(){this.onChange(this.publicJobs());}
 enqueue(sources,destination,move=false,names={},policy='error'){if(this.creating)throw Error('Wait for file operations to finish.');const controller=new AbortController();const job={id:crypto.randomUUID(),sources:[...sources],destination,move,names,policy,operationIds:[],status:'queued',bytes:0,total:0,current:'',completed:[],completedSources:[],error:'',controller};this.jobs.push(job);this.emit();this.drain();return job.id;}
 cancel(id){const j=this.jobs.find(j=>j.id===id);if(j&&['queued','running'].includes(j.status)){j.controller.abort();if(j.status==='queued')j.status='cancelled';this.save().catch(()=>{});this.emit();}}
 pause(id,paused){const job=this.jobs.find(j=>j.id===id);if(!job||!['running','queued'].includes(job.status))throw Error('Transfer is no longer active.');job.paused=Boolean(paused);this.save().catch(()=>{});this.emit();}
 async drain(){if(this.running)return;this.running=true;try{for(const job of this.jobs){if(job.status!=='queued')continue;job.status='running';this.emit();try{await this.save();await this.execute(job);job.finalStatus='completed';await this.save();delete job.finalStatus;job.status='completed';}catch(e){delete job.finalStatus;job.status=job.controller.signal.aborted?'cancelled':'failed';job.error=e.message;try{await this.save();}catch(error){job.error+=' History could not be saved: '+error.message;}}this.emit();}}finally{this.running=false;}}
 async execute(job){
  const planner=require('./transfer-plan.cjs');job.operationIds=job.operationIds||[];job.total=0;job.bytes=0;
  if(!job.plan){const built=await planner.plan(job.sources.filter(p=>!job.completedSources.includes(p)),job.destination,{names:job.names,policy:job.policy||'error',inspect:snapshot,signal:job.controller.signal});job.plan=built.items;job.cleanupDirectories=built.directories;await this.save();}
  if(this.metadata)for(const directory of job.cleanupDirectories||[]){if(directory.metadataReady)continue;directory.metadataStash=directory.metadataStash||path.join(this.recoveryRoot,'directory-'+directory.id);await fs.mkdir(directory.metadataStash,{recursive:true});await this.metadata(directory.source,directory.metadataStash,{shallow:true});directory.metadataReady=true;await this.save();}
  const pending=job.plan.filter(item=>!job.completedSources.includes(item.source));for(const item of pending){if(!same(item.before,await snapshot(item.source)))throw Error('A source changed after the transfer was planned.');job.total+=bytes(item.before);}
  this.emit();let last=0;
  for(const item of pending){const {source,target,before}=item;job.controller.signal.throwIfAborted();const parent=await fs.realpath(path.dirname(target));const root=await fs.realpath(job.destination);if(!planner.within(root,parent))throw Error('Destination left the selected folder.');const resuming=job.resumeStage&&job.stageSource===source;const stage=resuming?job.stage:path.join(parent,'.nothing-transfer-'+crypto.randomUUID());let committed=false,moved=false,replaced=job.intent?.source===source?job.intent.replaced:null,keepIntent=false;
   try{
    job.stage=stage;job.stageSource=source;job.stageBefore=before;await this.save();
    await copyTree(source,stage,job.controller.signal,(n,p)=>{job.bytes+=n;job.current=p;if(Date.now()-last>80){last=Date.now();this.emit();}},async()=>{while(job.paused){job.controller.signal.throwIfAborted();await new Promise(r=>setTimeout(r,50));}},resuming);
    if(this.metadata)await this.metadata(source,stage);
    if(!same(before,await snapshot(source)))throw Error('Source changed during the transfer; source was retained.');
    const sourceVerified=await snapshot(source,true,job.controller.signal),stagedVerified=await snapshot(stage,true,job.controller.signal);if(!sameContent(sourceVerified,stagedVerified))throw Error('Staging verification failed; source was retained.');
    job.intent={id:job.intent?.source===source?job.intent.id:crypto.randomUUID(),source,target,sourceAfter:sourceVerified,after:stagedVerified,move:job.move,replaced};await this.save();job.controller.signal.throwIfAborted();
    if(item.targetBefore&&!replaced){if(!same(item.targetBefore,await snapshot(target,true)))throw Error('Destination changed before replacement.');replaced={stash:path.join(this.recoveryRoot,crypto.randomUUID()),before:item.targetBefore};job.intent.replaced=replaced;await this.save();await this.relocate(target,replaced.stash);replaced.after=await snapshot(replaced.stash,true);await this.save();}
    if(replaced&&!replaced.after){replaced.after=await snapshot(replaced.stash,true);await this.save();}
    await vacant(target);job.controller.signal.throwIfAborted();if(before.dir)await fs.rename(stage,target);else await commitFile(stage,target);committed=true;
    const after=await snapshot(target,true,job.controller.signal);job.intent.after=after;await this.save();job.controller.signal.throwIfAborted();
    if(job.move){if(!same(before,await snapshot(source)))throw Error('Source changed before move completed; source was retained.');await this.trash(source);moved=true;}
    const record={id:job.intent.id,type:'transfer',source,target,moved,after,replaced,verified:true};await this.invalidateRedo();this.history.push(record);job.operationIds.push(record.id);job.completed.push(target);job.completedSources.push(source);delete job.intent;await this.save();
   }catch(e){
    if(committed&&!job.completed.includes(target)){const record={id:job.intent?.id||crypto.randomUUID(),type:'transfer',source,target,moved,replaced,after:await snapshot(target,true),verified:true};this.history.push(record);job.operationIds.push(record.id);job.completed.push(target);job.completedSources.push(source);delete job.intent;await this.save();}
    if(!committed&&replaced){try{await vacant(target);await this.relocate(replaced.stash,target);delete job.intent;}catch(restoreError){keepIntent=true;e.message+=' Previous destination retained in recovery: '+replaced.stash+' ('+restoreError.message+')';}}
    throw e;
   }finally{await fs.rm(stage,{recursive:true,force:true}).catch(()=>{});delete job.stage;delete job.stageSource;delete job.stageBefore;delete job.resumeStage;if(!committed&&!keepIntent)delete job.intent;await this.save();}
  }
  if(job.move)for(const directory of [...(job.cleanupDirectories||[])].sort((a,b)=>b.source.length-a.source.length)){
   if(job.operationIds.includes(directory.id))continue;const stat=await planner.exists(directory.source);if(stat){if(!stat.isDirectory()||stat.isSymbolicLink()||(await fs.readdir(directory.source)).length)throw Error('A source folder gained items and was retained.');await fs.rmdir(directory.source);}this.history.push({type:'removed-directory',...directory});job.operationIds.push(directory.id);await this.save();
  }
  const records=this.history.filter(op=>job.operationIds.includes(op.id));if(records.length>1){this.history=this.history.filter(op=>!job.operationIds.includes(op.id));this.history.push({type:'group',id:job.id,ops:records});await this.save();}
 }
 async save(){this.history=this.history.slice(-100);if(this.journalPath){const data=JSON.stringify({version:2,history:this.history,redo:this.redoStack,jobs:this.jobs.map(({controller,finalStatus,...job})=>({...job,status:finalStatus||job.status})).slice(-30)});this.saving=(this.saving||Promise.resolve()).catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(this.journalPath),{recursive:true});const temp=this.journalPath+'.tmp';const file=await fs.open(temp,'w');try{await file.writeFile(data);await file.sync();}finally{await file.close();}await fs.rename(temp,this.journalPath);});await this.saving;}}
 async restore(){if(this.journalPath)try{const data=JSON.parse(await fs.readFile(this.journalPath,'utf8'));this.history=Array.isArray(data)?data:(data.history||[]);this.redoStack=Array.isArray(data.redo)?data.redo:[];this.jobs=Array.isArray(data.jobs)?data.jobs.map(job=>({...job,controller:new AbortController(),status:['running','queued'].includes(job.status)?'interrupted':job.status,paused:false,completedSources:job.completedSources||[]})):[];}catch{}}
 async validateStage(job){const dest=await fs.realpath(job.destination),stageParent=await fs.realpath(path.dirname(job.stage));const sameParent=require('./transfer-plan.cjs').within(dest,stageParent);if(!sameParent||!/^\.nothing-transfer-[a-f0-9-]{36}$/.test(path.basename(job.stage)))throw Error('Invalid staging path; no cleanup performed.');}
 async reconcile(job){const intent=job.intent;if(!intent)return;const exists=await fs.lstat(intent.target).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});if(!exists)return;const after=await snapshot(intent.target,true);if(!sameContent(intent.after,after)){if(intent.replaced&&sameContent(intent.replaced.before,after)&&!await require('./transfer-plan.cjs').exists(intent.replaced.stash)){delete job.intent;await this.save();return;}throw Error('Destination changed after interruption. No files were overwritten.');}let moved=false;if(intent.move){const sourceExists=await fs.lstat(intent.source).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});if(sourceExists){if(!same(intent.sourceAfter,await snapshot(intent.source,true)))throw Error('Source changed after interruption. Both copies were retained.');await this.trash(intent.source);}moved=true;}
  if(!this.history.some(op=>op.id===intent.id))this.history.push({id:intent.id,type:'transfer',source:intent.source,target:intent.target,moved,after,replaced:intent.replaced,verified:true});job.operationIds=job.operationIds||[];if(!job.operationIds.includes(intent.id))job.operationIds.push(intent.id);if(!job.completedSources.includes(intent.source))job.completedSources.push(intent.source);if(!job.completed.includes(intent.target))job.completed.push(intent.target);delete job.intent;if(job.stage){await this.validateStage(job);await fs.rm(job.stage,{recursive:true,force:true});delete job.stage;delete job.stageSource;delete job.stageBefore;}await this.save();}
 async retry(id){const job=this.jobs.find(j=>j.id===id);if(!job||!['interrupted','failed','cancelled'].includes(job.status))throw Error('This transfer cannot be retried.');await this.reconcile(job);for(const source of (job.plan?job.plan.map(item=>item.source):job.sources))if(!job.completedSources.includes(source))await fs.access(source);if(job.stage){await this.validateStage(job);if(job.stageSource&&job.stageBefore){if(!same(job.stageBefore,await snapshot(job.stageSource)))throw Error('Source changed after interruption. Recovery data was retained.');job.resumeStage=true;}else{await fs.rm(job.stage,{recursive:true,force:true});delete job.stage;}}
  job.controller=new AbortController();job.paused=false;job.error='';job.dismissed=false;job.status='queued';await this.save();this.emit();this.drain();return id;}
 async dismiss(id){const job=this.jobs.find(j=>j.id===id);if(!job||['queued','running'].includes(job.status))throw Error('Only inactive operations can be dismissed.');job.dismissed=true;await this.save();this.emit();}
 async invalidateRedo(){const release=async record=>{if(record.type==='group'){for(const child of record.ops)await release(child);}else if(record.stash)await this.trash(record.stash);};for(const record of this.redoStack)await release(record);this.redoStack=[];}
 async recordRename(source,target){await this.invalidateRedo();this.history.push({type:'rename',source,target,after:await snapshot(target,true),verified:true});await this.save();}
 async recordBatchRename(items){await this.invalidateRedo();const records=[];for(const item of items)records.push({...item,after:await snapshot(item.target,true)});this.history.push({type:'batch-rename',items:records});await this.save();}
 async recordCreate(target,groupId){await this.invalidateRedo();const record={type:'create',target,after:await snapshot(target,true),verified:true};if(groupId){let group=this.history.find(op=>op.type==='group'&&op.id===groupId);if(!group){group={type:'group',id:groupId,ops:[]};this.history.push(group);}group.ops.push(record);}else this.history.push(record);await this.save();}
 async createGroup(task){if(this.running||this.creating)throw Error('Wait for file operations to finish.');this.creating=true;const id=crypto.randomUUID();try{return await task(target=>this.recordCreate(target,id));}finally{this.creating=false;}}
 async relocate(source,target){
  await vacant(target);await fs.mkdir(path.dirname(target),{recursive:true});try{await fs.rename(source,target);return;}catch(e){if(e.code!=='EXDEV')throw e;}
  const stage=path.join(path.dirname(target),'.nothing-transfer-'+crypto.randomUUID());try{const before=await snapshot(source,true);await copyTree(source,stage,new AbortController().signal,()=>{});if(this.metadata)await this.metadata(source,stage);if(!same(before,await snapshot(source,true)))throw Error('Item changed while saving recovery data.');if(!sameContent(before,await snapshot(stage,true)))throw Error('Recovery copy verification failed.');await fs.rename(stage,target);try{await this.trash(source);}catch(e){await this.trash(target);throw e;}}finally{await fs.rm(stage,{recursive:true,force:true}).catch(()=>{});}
 }
 async undo(){if(this.running||this.creating)throw Error('Wait for active transfers to finish before undoing.');const op=this.history.at(-1);if(!op)throw Error('Nothing to undo.');await this.undoOp(op);this.history.pop();this.redoStack.push(op);await this.save();return op;}
 async undoOp(op){
  if(op.type==='group'){for(const child of [...op.ops].reverse()){if(child.undone)continue;await this.undoOp(child);child.undone=true;await this.save();}return;}
  if(op.type==='removed-directory'){await vacant(op.source);await fs.mkdir(op.source,{mode:op.mode});if(op.metadataStash&&this.metadata)await this.metadata(op.metadataStash,op.source,{shallow:true});await fs.utimes(op.source,op.atime/1000,op.mtime/1000);return;}
  if(op.replaced&&!same(op.replaced.after,await snapshot(op.replaced.stash,true)))throw Error('Previous destination changed in recovery. Undo stopped.');
  if(op.type==='batch-rename'){
   for(const item of op.items)if(!same(item.after,await snapshot(item.target,true)))throw Error('An item changed after renaming. Undo stopped.');
   await require('./bulk-rename.cjs').apply(op.items.map(i=>({source:i.target,target:i.source})));op.restoredItems=[];for(const item of op.items)op.restoredItems.push(await snapshot(item.source,true));
  }else{
   if(!same(op.after,await snapshot(op.target,!!op.verified)))throw Error('This item changed after the operation. Undo stopped to protect those changes.');
   if(op.type==='rename'){await vacant(op.source);await fs.rename(op.target,op.source);op.restored=await snapshot(op.source,true);}
   else{
    if(op.moved){await vacant(op.source);await fs.mkdir(path.dirname(op.source),{recursive:true});const stage=path.join(path.dirname(op.source),'.nothing-undo-'+crypto.randomUUID());try{await copyTree(op.target,stage,new AbortController().signal,()=>{});if(this.metadata)await this.metadata(op.target,stage);if(!same(op.after,await snapshot(op.target,!!op.verified)))throw Error('Item changed while undoing.');if(op.after.dir)await fs.rename(stage,op.source);else await commitFile(stage,op.source);op.restored=await snapshot(op.source,true);}finally{await fs.rm(stage,{recursive:true,force:true}).catch(()=>{});}}
    op.stash=path.join(this.recoveryRoot,crypto.randomUUID());await this.relocate(op.target,op.stash);op.stashed=await snapshot(op.stash,true);if(op.replaced){await this.relocate(op.replaced.stash,op.target);op.replaced.restored=await snapshot(op.target,true);}
   }
  }
  return op;
 }
 async redo(){if(this.running||this.creating)throw Error('Wait for active transfers to finish before redoing.');const op=this.redoStack.at(-1);if(!op)throw Error('Nothing to redo.');await this.redoOp(op);this.redoStack.pop();this.history.push(op);await this.save();return op;}
 async redoOp(op){
  if(op.type==='group'){for(const child of op.ops){if(!child.undone)continue;await this.redoOp(child);child.undone=false;await this.save();}return;}
  if(op.type==='removed-directory'){const st=await fs.lstat(op.source);if(!st.isDirectory()||st.isSymbolicLink()||(await fs.readdir(op.source)).length)throw Error('Restored directory changed. Redo stopped.');await fs.rmdir(op.source);return;}
  if(op.type==='batch-rename'){
   for(let i=0;i<op.items.length;i++)if(!same(op.restoredItems[i],await snapshot(op.items[i].source,true)))throw Error('An item changed after undo. Redo stopped.');
   await require('./bulk-rename.cjs').apply(op.items);for(const item of op.items)item.after=await snapshot(item.target,true);
  }else if(op.type==='rename'){
   if(!same(op.restored,await snapshot(op.source,true)))throw Error('Item changed after undo. Redo stopped.');await vacant(op.target);await fs.rename(op.source,op.target);op.after=await snapshot(op.target,true);
  }else{
   if(!same(op.stashed||op.after,await snapshot(op.stash,!!op.verified)))throw Error('Recovery copy changed. Redo stopped.');if(op.replaced){if(!same(op.replaced.restored,await snapshot(op.target,true)))throw Error('Destination changed after undo. Redo stopped.');await vacant(op.replaced.stash);}else await vacant(op.target);
   if(op.moved&&!same(op.restored,await snapshot(op.source,true)))throw Error('Source changed after undo. Redo stopped.');
   if(op.replaced){await this.relocate(op.target,op.replaced.stash);op.replaced.after=await snapshot(op.replaced.stash,true);}
   try{await this.relocate(op.stash,op.target);if(op.moved)await this.trash(op.source);}catch(e){if(await require('./transfer-plan.cjs').exists(op.target))await this.relocate(op.target,op.stash);if(op.replaced)await this.relocate(op.replaced.stash,op.target);throw e;}delete op.stash;op.after=await snapshot(op.target,true);
  }
  return op;
 }

}
module.exports={TransferQueue,snapshot,copyTree};
