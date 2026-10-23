const fs=require('node:fs/promises'),nativeFs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises');
const {vacant}=require('./files.cjs');
async function snapshot(p,verify=false){const s=await fs.lstat(p);const out={size:s.size,mtime:s.mtimeMs,dir:s.isDirectory(),link:s.isSymbolicLink()};if(out.dir){out.children={};for(const name of (await fs.readdir(p)).sort())out.children[name]=await snapshot(path.join(p,name),verify);}else if(verify&&!out.link){const hash=crypto.createHash('sha256');for await(const chunk of nativeFs.createReadStream(p))hash.update(chunk);out.hash=hash.digest('hex');const end=await fs.lstat(p);if(end.size!==s.size||end.mtimeMs!==s.mtimeMs)throw Error('Item changed while verifying it.');}return out;}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function bytes(s){return s.dir?Object.values(s.children).reduce((n,v)=>n+bytes(v),0):s.link?0:s.size;}
async function copyTree(from,to,signal,progress,gate=async()=>{}){
 signal.throwIfAborted();const s=await fs.lstat(from);
 if(s.isSymbolicLink()){await fs.symlink(await fs.readlink(from),to);return;}
 if(s.isDirectory()){await fs.mkdir(to);for(const name of await fs.readdir(from))await copyTree(path.join(from,name),path.join(to,name),signal,progress,gate);return;}
 const input=nativeFs.createReadStream(from),output=nativeFs.createWriteStream(to,{flags:'wx'});await pipeline(input,async function*(source){for await(const chunk of source){await gate();signal.throwIfAborted();progress(chunk.length,from);yield chunk;}},output,{signal});await fs.utimes(to,s.atime,s.mtime);
}
async function commitFile(from,to){try{await fs.link(from,to);}catch(e){if(!['EPERM','ENOTSUP','EOPNOTSUPP','EXDEV'].includes(e.code))throw e;await fs.copyFile(from,to,nativeFs.constants.COPYFILE_EXCL);}await fs.unlink(from);}
class TransferQueue{
 constructor({onChange=()=>{},trash=async p=>fs.rm(p,{recursive:true}),journalPath=null}={}){this.jobs=[];this.history=[];this.running=false;this.onChange=onChange;this.trash=trash;this.journalPath=journalPath;}
 emit(){this.onChange(this.jobs.map(({controller,...j})=>({...j})));}
 enqueue(sources,destination,move=false){const controller=new AbortController();const job={id:crypto.randomUUID(),sources:[...sources],destination,move,status:'queued',bytes:0,total:0,current:'',completed:[],error:'',controller};this.jobs.push(job);this.emit();this.drain();return job.id;}
 cancel(id){const j=this.jobs.find(j=>j.id===id);if(j&&['queued','running'].includes(j.status)){j.controller.abort();if(j.status==='queued')j.status='cancelled';this.emit();}}
 pause(id,paused){const job=this.jobs.find(j=>j.id===id);if(!job||!['running','queued'].includes(job.status))throw Error('Transfer is no longer active.');job.paused=Boolean(paused);this.emit();}
 async drain(){if(this.running)return;this.running=true;try{for(const job of this.jobs){if(job.status!=='queued')continue;job.status='running';this.emit();try{await this.execute(job);job.status='completed';}catch(e){job.status=job.controller.signal.aborted?'cancelled':'failed';job.error=e.message;}this.emit();}}finally{this.running=false;}}
 async execute(job){
  const dest=await fs.realpath(job.destination),plan=[];const targetSet=new Set();
  for(const source of job.sources){job.controller.signal.throwIfAborted();const real=await fs.realpath(source),relative=path.relative(real,dest);if(relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw Error('Cannot put an item inside itself.');const target=path.join(dest,path.basename(source));if(targetSet.has(target.toLowerCase()))throw Error('Two selected items have the same destination name.');targetSet.add(target.toLowerCase());await vacant(target);const before=await snapshot(source);job.total+=bytes(before);plan.push({source,target,before});}
  this.emit();let last=0;
  for(const item of plan){const {source,target,before}=item;job.controller.signal.throwIfAborted();await vacant(target);const stage=path.join(dest,'.nothing-transfer-'+crypto.randomUUID());let committed=false;
   try{
    await copyTree(source,stage,job.controller.signal,(n,p)=>{job.bytes+=n;job.current=p;if(Date.now()-last>80){last=Date.now();this.emit();}},async()=>{while(job.paused){job.controller.signal.throwIfAborted();await new Promise(r=>setTimeout(r,50));}});
    if(!same(before,await snapshot(source)))throw Error('Source changed during the transfer; source was retained.');
    job.controller.signal.throwIfAborted();await vacant(target);
    if(before.dir)await fs.rename(stage,target);else await commitFile(stage,target);committed=true;
    const after=await snapshot(target,true);job.controller.signal.throwIfAborted();let moved=false;
    if(job.move){if(!same(before,await snapshot(source)))throw Error('Source changed before move completed; source was retained.');await this.trash(source);moved=true;}
    const record={type:'transfer',source,target,moved,after,verified:true};this.history.push(record);job.completed.push(target);await this.save();
   }catch(e){if(committed&&!job.completed.includes(target)){this.history.push({type:'transfer',source,target,moved:false,after:await snapshot(target,true),verified:true});job.completed.push(target);await this.save();}throw e;}finally{await fs.rm(stage,{recursive:true,force:true}).catch(()=>{});}
  }
 }
 async save(){this.history=this.history.slice(-100);if(this.journalPath){const data=JSON.stringify(this.history);this.saving=(this.saving||Promise.resolve()).catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(this.journalPath),{recursive:true});const temp=this.journalPath+'.tmp';await fs.writeFile(temp,data);await fs.rename(temp,this.journalPath);});await this.saving;}}
 async restore(){if(this.journalPath)try{const history=JSON.parse(await fs.readFile(this.journalPath,'utf8'));this.history=Array.isArray(history)?history:[];}catch{}}
 async recordRename(source,target){this.history.push({type:'rename',source,target,after:await snapshot(target,true),verified:true});await this.save();}
 async recordBatchRename(items){const records=[];for(const item of items)records.push({...item,after:await snapshot(item.target,true)});this.history.push({type:'batch-rename',items:records});await this.save();}
 async recordCreate(target){this.history.push({type:'create',target,after:await snapshot(target,true),verified:true});await this.save();}
 async undo(){if(this.running)throw Error('Wait for active transfers to finish before undoing.');const op=this.history.at(-1);if(!op)throw Error('Nothing to undo.');if(op.type==='batch-rename'){for(const item of op.items)if(!same(item.after,await snapshot(item.target,true)))throw Error('An item changed after renaming. Undo stopped.');await require('./bulk-rename.cjs').apply(op.items.map(i=>({source:i.target,target:i.source})));this.history.pop();await this.save();return op;}if(!same(op.after,await snapshot(op.target,!!op.verified)))throw Error('This item changed after the operation. Undo stopped to protect those changes.');
  if(op.type==='rename'){await vacant(op.source);await fs.rename(op.target,op.source);}
  else if(op.moved){await vacant(op.source);const restoreStage=path.join(path.dirname(op.source),'.nothing-undo-'+crypto.randomUUID());try{await copyTree(op.target,restoreStage,new AbortController().signal,()=>{});if(!same(op.after,await snapshot(op.target,!!op.verified)))throw Error('Item changed while undoing.');if(op.after.dir)await fs.rename(restoreStage,op.source);else await commitFile(restoreStage,op.source);await this.trash(op.target);}finally{await fs.rm(restoreStage,{recursive:true,force:true}).catch(()=>{});}}
  else await this.trash(op.target);const index=this.history.indexOf(op);if(index>=0)this.history.splice(index,1);await this.save();return op;
 }
}
module.exports={TransferQueue,snapshot,copyTree};
