const fs = require('node:fs/promises');
const path = require('node:path');
const queryTools=require('./query.js');
function nameCheck(name) {
 if(typeof name !== 'string' || name.length>255 || !name.trim() || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) || name==='.' || name==='..') throw Error('Enter a valid Windows file name.');
 return name;
}
async function vacant(target) { try {await fs.lstat(target);} catch(e) {if(e.code==='ENOENT')return;throw e;} throw Error('An item with this name already exists. Rename it or cancel.'); }
async function list(folder) {
 const entries = await fs.readdir(folder,{withFileTypes:true});
 const results=new Array(entries.length);let next=0;
 async function worker(){for(;;){const i=next++;if(i>=entries.length)return;const e=entries[i],p=path.join(folder,e.name);try{const s=await fs.stat(p);results[i]={name:e.name,path:p,directory:s.isDirectory(),link:e.isSymbolicLink(),size:s.size,created:s.birthtimeMs,modified:s.mtimeMs,extension:path.extname(e.name).slice(1).toLowerCase()};}catch{results[i]={name:e.name,path:p,directory:e.isDirectory(),link:e.isSymbolicLink(),size:0,created:0,modified:0,extension:path.extname(e.name).slice(1).toLowerCase(),inaccessible:true};}}}
 await Promise.all(Array.from({length:Math.min(32,entries.length)},worker));return results;
}
async function transfer(sources,destination,move=false) {
 const dest=await fs.realpath(destination); const plan=[];
 for(const source of sources){const real=await fs.realpath(source),target=path.join(dest,path.basename(source));const rel=path.relative(real,dest);if(rel==='' || (!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)))throw Error('Cannot put an item inside itself.');await vacant(target);plan.push([source,target]);}
 const completed=[];
 try {for(const [source,target] of plan){if(move)await fs.rename(source,target);else await fs.cp(source,target,{recursive:true,errorOnExist:true,force:false});completed.push(target);}}catch(e){throw Error(`${e.message} ${completed.length} of ${plan.length} items completed. Refresh both folders before retrying.`);}
 return completed;
}
async function search(root,query,{cancelled=()=>false,limit=5000}={}){
 const results=[],queue=[root];let visited=0,skipped=0;const contents=queryTools.tokens(query).filter(t=>t.field==='content').map(t=>t.value.toLowerCase());
 while(queue.length&&results.length<limit&&!cancelled()){
  const folder=queue.shift();let entries;try{entries=await list(folder);}catch{skipped++;continue;}
  visited++;for(const e of entries){if(cancelled())break;let matched=queryTools.matches(e,query);if(matched&&contents.length){if(e.directory||e.size>2*1024*1024)matched=false;else try{const text=(await fs.readFile(e.path,'utf8')).toLowerCase();matched=!text.includes('\0')&&contents.every(q=>text.includes(q));}catch{matched=false;}}
   if(matched){results.push(e);if(results.length>=limit)break;}if(e.directory&&!e.link)queue.push(e.path);}
 }
 return {entries:results,visited,skipped,truncated:queue.length>0&&results.length>=limit,cancelled:cancelled()};
}
module.exports={nameCheck,vacant,list,transfer,search};
