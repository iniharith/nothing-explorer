(function(root){
 const modifier=keys=>keys.altKey||(keys.ctrlKey&&keys.shiftKey)?'link':keys.ctrlKey?'copy':keys.shiftKey?'move':null;
 const drive=p=>/^(?:([a-z]:)[\\/]|(\\\\[^\\/]+[\\/][^\\/]+)(?:[\\/]|$))/i.exec(p||'')?.slice(1).find(Boolean)?.toLowerCase();
 function effect(keys,sources,destination){const explicit=modifier(keys);if(explicit)return explicit;const volume=drive(destination);return volume&&sources?.length&&sources.every(p=>drive(p)===volume)?'move':'copy';}
 const api={modifier,effect};if(typeof module==='object'&&module.exports)module.exports=api;else root.DropIntent=api;
})(typeof globalThis==='object'?globalThis:this);
