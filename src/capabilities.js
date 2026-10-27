// System integrations and file-manager commands; filesystem access stays in main.
function displayPathName(p){return driveLocations.find(d=>d.path.toLowerCase()===p.toLowerCase())?.name||basename(p);}
function paintDrives(drives){driveLocations=drives;$('#drives').innerHTML=drives.map(d=>`<div class="drive-item"><button title="${esc(d.provider||d.name)}" data-location="${esc(d.path)}">${icon('drive')}<span>${esc(d.name)}</span></button>${d.total?`<progress class="volume-progress" max="100" value="${Math.round(100*(1-d.free/d.total))}"></progress><div class="drive-space">${size(d.free)} free of ${size(d.total)}</div>`:'<div class="drive-space">No media / unavailable</div>'}</div>`).join('');}
async function refreshDrives(){const data=await call('locations');paintDrives(data.drives);drawTabs();}
function saveSession(){if(tabs.length)localStorage.setItem('session-v1',JSON.stringify({paths:tabs.map(t=>t.path),current}));}
function restoreSession(fallback){try{const data=JSON.parse(localStorage.getItem('session-v1'));if(Array.isArray(data?.paths)&&data.paths.length){const paths=data.paths.filter(p=>typeof p==='string'&&p.length).slice(0,30);if(paths.length){current=Math.max(0,Math.min(Number(data.current)||0,paths.length-1));return paths.map(p=>({path:p,history:[],index:-1}));}}}catch{}return [{path:fallback,history:[],index:-1}];}
function pinned(){try{const value=JSON.parse(localStorage.getItem('pins-v1'));return Array.isArray(value)?value.filter(p=>typeof p==='string'):[];}catch{return [];}}
function drawPinned(){let nav=$('#pinned');if(!nav){nav=document.createElement('nav');nav.id='pinned';$('#locations').after(nav);}nav.innerHTML=pinned().map(p=>`<button data-location="${esc(p)}" title="${esc(p)}">${icon('folder')}<span>${esc(displayPathName(p))}</span></button>`).join('');}
function addCommand(cmd,label){const b=document.createElement('button');b.dataset.action=cmd;b.textContent=label;extraMenu.append(b);}
for(const [cmd,label] of [['indexed-search','Use Windows Search index'],['undo','Undo last file operation'],['pin','Pin / unpin folder'],['compress','Compress to ZIP'],['extract','Extract ZIP…'],['archive','Browse ZIP'],['native-properties','Windows properties…'],['open-with','Open with…'],['network','Network'],['recycle','Recycle Bin']])addCommand(cmd,label);
let activeArchive=null,indexedSearch=false,sortOrder=localStorage.getItem('sort-order')||'auto';
async function browseArchive(p){const data=await call('archiveList',p);activeArchive=p;$('#archive-title').textContent=basename(p);$('#archive-summary').textContent=`${data.entries.length} entries · ${size(data.total)} unpacked${data.truncated?' · First 20,000 entries shown':''}`;$('#archive-list').innerHTML=data.entries.map(e=>`<div class="archive-entry"><span>${icon(e.directory?'folder':'file')}${esc(e.name)}</span><small>${e.directory?'':size(e.size)}</small></div>`).join('');$('#archive-dialog').showModal();}
const capabilityAction=action;
action=async function(cmd){try{
 const paths=[...selected],p=paths[0],folder=tab()?.path;
 switch(cmd){
 case 'indexed-search':indexedSearch=!indexedSearch;recursiveSearch=true;document.querySelector('[data-action="indexed-search"]').classList.toggle('active',indexedSearch);$('#search').placeholder=indexedSearch?'Search Windows index':'Search folder and subfolders';if($('#search').value.trim())performRecursiveSearch();else notify(indexedSearch?'Search uses the Windows index; only indexed locations are included.':'Search uses folder scanning.');return;
 case 'refresh':await refreshDrives();return capabilityAction(cmd);
 case 'copy':case 'cut':clipboardCheck++;if(paths.length)await call('clipboardFiles','write',paths,cmd==='cut');return capabilityAction(cmd);
 case 'paste':{const external=await call('clipboardFiles','read');clipboard=external?.paths?.length?external:null;updateButtons();if(!clipboard){notify('No files on the clipboard.');return;}await capabilityAction(cmd);const currentClipboard=await call('clipboardFiles','read');clipboard=currentClipboard?.paths?.length?currentClipboard:null;updateButtons();return;}
 case 'undo':await call('undo');await refresh();notify('Last file operation undone.');return;
 case 'pin':{const entry=entries.find(e=>e.path===p),target=entry?.directory?p:folder;const list=pinned(),i=list.indexOf(target);if(i<0)list.push(target);else list.splice(i,1);localStorage.setItem('pins-v1',JSON.stringify(list));drawPinned();return;}
 case 'native-properties':await call('nativeProperties',p||folder);return;
 case 'open-with':if(paths.length!==1)throw Error('Select one file to open with another app.');await call('openWith',p);return;
 case 'network':case 'recycle':await call('shellFolder',cmd);return;
 case 'archive':if(!p||!p.toLowerCase().endsWith('.zip'))throw Error('Select a ZIP file.');await browseArchive(p);return;
 case 'compress':if(!paths.length)throw Error('Select files or folders to compress.');askName('Compress to ZIP','Archive.zip',async name=>{if(!name.toLowerCase().endsWith('.zip'))name+='.zip';notify('Creating ZIP…');return call('archiveCreate',paths,folder.replace(/[\\/]$/,'')+'\\'+name);});return;
 case 'extract':{const source=p?.toLowerCase().endsWith('.zip')?p:activeArchive;if(!source)throw Error('Select a ZIP file.');$('#archive-dialog').close();askName('Extract ZIP to a new folder',basename(source).replace(/\.zip$/i,''),async name=>{notify('Extracting ZIP…');return call('archiveExtract',source,folder.replace(/[\\/]$/,'')+'\\'+name);});return;}
 case 'open':if(paths.length===1&&p.toLowerCase().endsWith('.zip')){await browseArchive(p);return;}break;
 }
 return capabilityAction(cmd);
}catch(e){notify(e.message);}};
$('#archive-close').onclick=()=>$('#archive-dialog').close();
$('#archive-extract').onclick=()=>action('extract');
api.onTransfers(jobs=>{const active=jobs.filter(j=>['queued','running'].includes(j.status));$('#transfer-panel').hidden=!active.length;$('#transfer-jobs').innerHTML=jobs.slice(-8).reverse().map(j=>`<div class="transfer-job"><div><strong>${j.move?'Moving':'Copying'} ${j.sources.length} item(s)</strong><span>${esc(j.status)}${j.error?' · '+esc(j.error):''}</span></div><progress max="${j.total||1}" value="${j.bytes}"></progress><small>${size(j.bytes)} / ${size(j.total)} · ${j.completed.length} completed</small>${['queued','running'].includes(j.status)?`<button data-pause-transfer="${j.id}" data-paused="${Boolean(j.paused)}">${j.paused?'Resume':'Pause'}</button><button data-cancel-transfer="${j.id}">Cancel</button>`:''}</div>`).join('');});
document.addEventListener('click',e=>{const button=e.target.closest('[data-cancel-transfer]');if(button)call('cancelTransfer',button.dataset.cancelTransfer).catch(e=>notify(e.message));});
let clipboardCheck=0;
window.addEventListener('focus',async()=>{const id=++clipboardCheck;try{const data=await call('clipboardFiles','read');if(id===clipboardCheck){clipboard=data?.paths?.length?data:null;updateButtons();}}catch{}});
call('clipboardFiles','read').then(data=>{if(data?.paths?.length){clipboard=data;updateButtons();}}).catch(()=>{});
$('#files').addEventListener('dragstart',e=>{const row=e.target.closest('[data-index]'),entry=row&&visible()[Number(row.dataset.index)];if(!entry)return;e.preventDefault();api.startDrag(selected.has(entry.path)?[...selected]:[entry.path]);});
function dropDestination(target){const row=target.closest('[data-index]'),entry=row&&visible()[Number(row.dataset.index)],location=target.closest('[data-location]')?.dataset.location;if(location)return location;if(!target.closest('#file-area'))return null;return entry?.directory?entry.path:tab()?.path;}
function dropKeys(e){return {altKey:e.altKey,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey};}
document.addEventListener('dragover',e=>{const destination=dropDestination(e.target);if(!destination||destination.startsWith('shell:'))return;e.preventDefault();let paths=[];try{paths=api.filePaths([...e.dataTransfer.files]);}catch{}e.dataTransfer.dropEffect=DropIntent.effect(dropKeys(e),paths,destination);$('#file-area').classList.add('drop-target');});
document.addEventListener('dragleave',e=>{if(!e.relatedTarget)$('#file-area').classList.remove('drop-target');});
document.addEventListener('dragend',()=>$('#file-area').classList.remove('drop-target'));
document.addEventListener('drop',async e=>{e.preventDefault();$('#file-area').classList.remove('drop-target');try{const paths=api.filePaths([...e.dataTransfer.files]);if(!paths.length)return;const destination=dropDestination(e.target);if(!destination)throw Error('Drop into folder contents or onto a folder.');const result=await call('dropFiles',paths,destination,dropKeys(e));await refresh();notify(!result.paths.length?'Items are already in this folder.':result.modes.length===1?({copy:'Files copied.',move:'Files moved.',link:'Shortcuts created.'}[result.modes[0]]):'File drop completed.');}catch(e){await refresh();notify(e.message);}});
const sortPopover=$('#sort-menu .command-popover');
sortPopover.append(document.createElement('hr'));
for(const [order,label] of [['asc','Ascending'],['desc','Descending']]){const b=document.createElement('button');b.textContent=label;b.dataset.order=order;b.setAttribute('role','menuitemradio');b.setAttribute('aria-checked',String(sortOrder===order));b.onclick=()=>{sortOrder=order;localStorage.setItem('sort-order',order);document.querySelectorAll('[data-order]').forEach(el=>el.setAttribute('aria-checked',String(el===b)));render();};sortPopover.append(b);}
for(const [cmd,label] of [['select-all','Select all'],['invert-selection','Invert selection']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{const items=visible();selected=new Set(items.filter(e=>cmd==='select-all'||!selected.has(e.path)).map(e=>e.path));syncSelection();};extraMenu.append(b);}

document.addEventListener('click',e=>{const b=e.target.closest('[data-pause-transfer]');if(b)call('pauseTransfer',b.dataset.pauseTransfer,b.dataset.paused!=='true').catch(e=>notify(e.message));});
