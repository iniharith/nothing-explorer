const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
class ImageCache {
 constructor(directory){this.directory=directory;this.memory=new Map();this.bytes=0;this.pending=new Map();this.pruned=false;this.writes=0;this.pruning=null;}
 async get(key,loader){
  if(this.memory.has(key)){const data=this.memory.get(key);this.memory.delete(key);this.memory.set(key,data);return data;}
  if(this.pending.has(key))return this.pending.get(key);
  const work=this.load(key,loader).finally(()=>this.pending.delete(key));this.pending.set(key,work);return work;
 }
 async load(key,loader){
  const name=crypto.createHash('sha256').update(key).digest('hex')+'.img',file=path.join(this.directory,name);let data;
  try{const stat=await fs.stat(file);if(stat.size<=12*1024*1024&&Date.now()-stat.mtimeMs<7*86400000){const cached=await fs.readFile(file,'utf8');if(/^data:image\/(png|jpeg|webp);base64,/.test(cached))data=cached;}}catch{}
  if(!data){data=await loader();if(!data)return data;if(data.length<=12*1024*1024){const stage=file+'.'+crypto.randomUUID();try{await fs.mkdir(this.directory,{recursive:true});await fs.writeFile(stage,data,{flag:'wx'});await fs.rename(stage,file);this.writes++;}catch{await fs.unlink(stage).catch(()=>{});}}}
  this.memory.set(key,data);this.bytes+=data.length;while(this.memory.size>600||this.bytes>96*1024*1024){const oldest=this.memory.keys().next().value;this.bytes-=this.memory.get(oldest).length;this.memory.delete(oldest);}
  if((!this.pruned||this.writes>=25)&&!this.pruning){this.pruned=true;this.writes=0;this.pruning=this.prune().catch(()=>{}).finally(()=>this.pruning=null);}return data;
 }
 async prune(){let files=await fs.readdir(this.directory,{withFileTypes:true});files=await Promise.all(files.filter(f=>f.isFile()&&/^[a-f0-9]{64}\.img$/.test(f.name)).map(async f=>{const file=path.join(this.directory,f.name);try{return {file,...await fs.stat(file)};}catch{return null;}}));files=files.filter(Boolean).sort((a,b)=>b.mtimeMs-a.mtimeMs);let bytes=0;for(let i=0;i<files.length;i++){bytes+=files[i].size;if(i>=1500||bytes>256*1024*1024||Date.now()-files[i].mtimeMs>7*86400000)await fs.unlink(files[i].file).catch(()=>{});}}
}
module.exports={ImageCache};
