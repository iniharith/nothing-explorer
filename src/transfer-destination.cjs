const fs=require('node:fs/promises'),path=require('node:path');
function numberedName(original,directory,reserved){const ext=directory?'':path.extname(original),base=ext?original.slice(0,-ext.length):original;let n=2,name;do{name=`${base} (${n++})${ext}`;}while(reserved.has(name.toLowerCase()));reserved.add(name.toLowerCase());return name;}
async function prepare(sources,dest,move){
 if(!Array.isArray(sources)||!sources.length||sources.some(p=>typeof p!=='string'||!path.isAbsolute(p)))throw Error('Choose filesystem items to transfer.');
 const destination=await fs.realpath(dest),reserved=new Set((await fs.readdir(destination)).map(n=>n.toLowerCase())),names={},remaining=[];
 const equal=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
 for(const source of [...new Set(sources)]){const sameParent=equal(await fs.realpath(path.dirname(source)),destination);if(sameParent&&move)continue;if(sameParent)names[source]=numberedName(path.basename(source),(await fs.lstat(source)).isDirectory(),reserved);remaining.push(source);}
 return {sources:remaining,destination,names};
}
module.exports={prepare,numberedName};
