const fs=require('node:fs/promises'),path=require('node:path');
const intent=require('./drop-intent.js');
async function plan(sources,destination,keys={},inspect=fs.stat){
 if(!Array.isArray(sources)||!sources.length||sources.some(p=>typeof p!=='string'||!path.isAbsolute(p)))throw Error('Choose filesystem items to drop.');
 const dest=await inspect(destination);if(!dest.isDirectory())throw Error('Drop onto a folder.');
 const explicit=intent.modifier(keys),groups=[];
 for(const source of [...new Set(sources)]){const stat=await inspect(source),mode=explicit||(stat.dev===dest.dev?'move':'copy');let group=groups.find(g=>g.mode===mode);if(!group){group={mode,sources:[]};groups.push(group);}group.sources.push(source);}
 return groups;
}
async function links(sources,destination,write,record){
 const created=[];
 for(const source of sources){await fs.access(source);const base=path.basename(source).replace(/\.lnk$/i,'').slice(0,220)+' - Shortcut';let target,handle;
 for(let n=1;;n++){target=path.join(destination,base+(n===1?'':` (${n})`)+'.lnk');try{handle=await fs.open(target,'wx');break;}catch(e){if(e.code!=='EEXIST')throw e;}}
 await handle.close();try{if(!write(target,{target:source,cwd:path.dirname(source)}))throw Error('Windows could not create the shortcut.');}catch(e){await fs.unlink(target).catch(()=>{});throw e;}
 await record(target);created.push(target);
 }
 return created;
}
module.exports={plan,links};
