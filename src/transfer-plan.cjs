const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');const {nameCheck}=require('./files.cjs');
function within(root,target){const relative=path.relative(root,target);return relative===''||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep));}
async function exists(p){return fs.lstat(p).catch(e=>{if(e.code==='ENOENT')return null;throw e;});}
async function plan(sources,destination,{names={},policy='error',inspect,signal}={}){
 const dest=await fs.realpath(destination),items=[],directories=[],targets=new Set();
 async function visit(source,target){signal?.throwIfAborted();if(items.length>200000)throw Error('Transfer contains more than 200,000 planned items.');const st=await fs.lstat(source),existing=await exists(target);if(path.resolve(source).toLowerCase()===path.resolve(target).toLowerCase())throw Error('Source and destination are the same item.');
  if(existing&&policy==='merge'&&st.isDirectory()&&!st.isSymbolicLink()&&existing.isDirectory()&&!existing.isSymbolicLink()){
   const real=await fs.realpath(target);if(!within(dest,real))throw Error('A destination link leaves the selected folder.');directories.push({id:crypto.randomUUID(),source,mode:st.mode,atime:st.atimeMs,mtime:st.mtimeMs});for(const name of await fs.readdir(source))await visit(path.join(source,name),path.join(real,name));return;
  }
  if(existing&&policy!=='merge')throw Error('An item with this name already exists. Rename it or cancel.');
  const key=target.toLowerCase();if(targets.has(key))throw Error('Two selected items have the same destination.');targets.add(key);
  const parent=await fs.realpath(path.dirname(target));if(!within(dest,parent))throw Error('Destination is outside the selected folder.');
  items.push({source,target,before:await inspect(source),targetBefore:existing?await inspect(target,true):null});
 }
 for(const source of sources){signal?.throwIfAborted();const real=await fs.realpath(source);if(within(real,dest))throw Error('Cannot put an item inside itself.');const name=names[source]||path.basename(source);nameCheck(name);await visit(source,path.join(dest,name));}
 return {items,directories,destination:dest};
}
module.exports={plan,within,exists};
