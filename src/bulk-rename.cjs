const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {nameCheck}=require('./files.cjs');
async function plan(sources,base){
 nameCheck(base);if(!Array.isArray(sources)||!sources.length||sources.length>1000)throw Error('Select between 1 and 1,000 items.');
 const unique=new Set(sources.map(p=>p.toLowerCase()));if(unique.size!==sources.length)throw Error('Duplicate source items.');
 const parent=path.dirname(sources[0]);if(sources.some(p=>path.dirname(p).toLowerCase()!==parent.toLowerCase()))throw Error('Bulk rename requires items in the same folder.');
 const result=[];
 for(let i=0;i<sources.length;i++){const source=sources[i],s=await fs.lstat(source),ext=s.isDirectory()?'':path.extname(source);const name=nameCheck(`${base} (${i+1})${ext}`);result.push({source,target:path.join(parent,name)});}
 await validate(result);return result;
}
async function validate(items){const sources=new Set(items.map(i=>i.source.toLowerCase())),targets=new Set();for(const item of items){await fs.lstat(item.source);const key=item.target.toLowerCase();if(targets.has(key))throw Error('Two items would have the same name.');targets.add(key);if(!sources.has(key)){try{await fs.lstat(item.target);}catch(e){if(e.code==='ENOENT')continue;throw e;}throw Error('Destination already exists: '+path.basename(item.target));}}}
async function apply(items){
 await validate(items);const staged=[],finished=[];
 try{for(const item of items){const stage=path.join(path.dirname(item.source),'.nothing-rename-'+crypto.randomUUID());await fs.rename(item.source,stage);staged.push({...item,stage});}
  for(const item of staged){await fs.lstat(item.target).then(()=>{throw Error('Destination appeared during rename.');},e=>{if(e.code!=='ENOENT')throw e;});await fs.rename(item.stage,item.target);finished.push(item);}
 }catch(error){const rollback=[];for(const item of [...finished].reverse()){try{await fs.rename(item.target,item.stage);}catch(e){rollback.push(e.message);}}for(const item of [...staged].reverse()){try{await fs.rename(item.stage,item.source);}catch(e){rollback.push(e.message);}}if(rollback.length)throw Error(error.message+' Recovery needed: '+rollback.join('; '));throw error;}
 return items;
}
module.exports={plan,apply};
