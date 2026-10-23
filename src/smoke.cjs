const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async function smoke(win,openRequests){
 let fixture;const checks=[];
 const js=s=>win.webContents.executeJavaScript(s.includes('await ')?'(async()=>{'+s+'})()':s).catch(e=>{console.error('FAILED EXPRESSION',s);throw e;});
 const assert=(v,message)=>{if(!v)throw Error(message);};
 async function until(expression,message){for(let i=0;i<100;i++){if(await js(expression))return;await pause(50);}throw Error(message);}
 async function doubleClick(name){
  const rect=await js(`(()=>{const items=visible(),i=items.findIndex(e=>e.name===${JSON.stringify(name)}),row=document.querySelector('[data-index="'+i+'"]');window.testClickedRow=row;const r=row.getBoundingClientRect();return {x:Math.round(r.x+60),y:Math.round(r.y+r.height/2)};})()`);
  win.webContents.sendInputEvent({type:'mouseDown',...rect,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...rect,button:'left',clickCount:1});
  await pause(60);assert(await js('testClickedRow.isConnected'),'Selection replaced the clicked row; double-click will break');
  win.webContents.sendInputEvent({type:'mouseDown',...rect,button:'left',clickCount:2});win.webContents.sendInputEvent({type:'mouseUp',...rect,button:'left',clickCount:2});
 }
 try{
  await until('Boolean(tab()) && entries.length>0','Initial folder did not load');
  assert(await js(`driveLocations.length>0 && driveLocations.every(d=>/^[A-Z]:\\\\$/i.test(d.path))`),'Windows helper returned invalid drive data');
  const labelled=await js(`driveLocations.find(d=>d.label&&d.total>0)`);
  if(labelled){assert(await js(`$('#drives').textContent.includes(${JSON.stringify(labelled.name)})`),'Windows volume label missing from sidebar');await js(`navigate(${JSON.stringify(labelled.path)})`);assert(await js(`document.querySelector('.tab.active').textContent.includes(${JSON.stringify(labelled.label)}) && $('#breadcrumbs').textContent.includes(${JSON.stringify(labelled.label)})`),'Volume label missing from tabs or breadcrumbs');checks.push('live Windows drive labels in sidebar/tab/breadcrumb');}
  fixture=await fs.mkdtemp(path.join(os.tmpdir(),'ne-regression-'));
  await fs.mkdir(path.join(fixture,'Artwork'));await fs.writeFile(path.join(fixture,'Readme.txt'),'Nothing Explorer preview verification');await fs.copyFile(path.join(__dirname,'../assets/icon.png'),path.join(fixture,'Photo.png'));
  await js(`navigate(${JSON.stringify(fixture)})`);await until('entries.length===3','Fixture listing');
  await doubleClick('Artwork');await until(`tab().path===${JSON.stringify(path.join(fixture,'Artwork'))}`,'Folder double-click did not navigate');checks.push('real folder double-click');
  await js('action("back")');await until('entries.length===3','Back navigation');
  await doubleClick('Photo.png');for(let i=0;i<80&&!openRequests.length;i++)await pause(50);assert(openRequests.includes(path.join(fixture,'Photo.png')),'File double-click did not reach native-open handler');checks.push(process.argv.includes('--test-native-open')?'file double-click + Windows open accepted':'file double-click dispatch');
  await until(`Boolean(document.querySelector('#preview-art img')?.naturalWidth)`,'Photo preview did not decode');checks.push('decoded image preview');
  await js(`$('#search').value='readme';$('#search').dispatchEvent(new Event('input'));`);assert(await js(`document.querySelectorAll('.entry').length===1 && !$('#clear-search').hidden`),'Search/clear state');await js(`$('#clear-search').click()`);assert(await js(`$('#search').value==='' && document.querySelectorAll('.entry').length===3 && $('#clear-search').hidden`),'Search clear failed');checks.push('search clear button');
  await js(`document.querySelector('[data-sort="modified"]').click()`);assert(await js(`$('#sort').value==='modified' && document.querySelector('[data-sort="modified"]').getAttribute('aria-checked')==='true'`),'Sort menu failed');checks.push('themed sort menu');
  await js(`action('grid-view')`);await until(`Array.from(document.querySelectorAll('.file-thumbnail')).some(i=>i.naturalWidth>0)`,'Grid thumbnail did not decode');checks.push('decoded grid thumbnail');
  await js(`selected=new Set([entries.find(e=>e.name==='Readme.txt').path]);syncSelection();await preview()`);assert(await js(`$('#preview-content').textContent.includes('preview verification')`),'Text preview failed');checks.push('text preview');
  await js(`action('copy');`);await js(`navigate(${JSON.stringify(path.join(fixture,'Artwork'))})`);await js(`action('paste')`);await until(`entries.some(e=>e.name==='Readme.txt')`,'Copy/paste failed');checks.push('copy paste');
  await js(`action('properties')`);assert(await js(`$('#properties-dialog').open`),'Properties dialog failed');await js(`$('#properties-dialog').close()`);checks.push('properties');
  await js(`call('writeTextFile',tab().path,'Created.txt')`);assert((await fs.readFile(path.join(fixture,'Artwork','Created.txt'),'utf8'))==='','New text document failed');checks.push('new text document');
  await js(`call('undo')`);assert(!(await fs.readdir(path.join(fixture,'Artwork'))).includes('Created.txt'),'Undo create failed');await js(`call('writeTextFile',tab().path,'Created.txt')`);checks.push('persistent undo bridge');
  await js(`action('new-tab')`);assert(await js('tabs.length===2'),'New tab failed');checks.push('tabs');
  await js(`if(!document.body.classList.contains('light'))await action('theme')`);assert(await js(`document.body.classList.contains('light')`),'Light theme failed');await js(`action('theme')`);checks.push('themes');
  await js(`navigate(${JSON.stringify(fixture)})`);
  await js(`selected.clear();action('pin')`);assert(await js(`pinned().includes(${JSON.stringify(fixture)}) && $('#pinned').textContent.includes(basename(tab().path))`),'Pinned folder not shown');await js(`action('pin')`);assert(await js(`JSON.parse(localStorage.getItem('session-v1')).paths.includes(tab().path)`),'Session did not save');checks.push('pins and saved session');
  const zip=path.join(fixture,'Bundle.zip'),unpacked=path.join(fixture,'Unpacked');
  await js(`call('archiveCreate', [${JSON.stringify(path.join(fixture,'Readme.txt'))}], ${JSON.stringify(zip)})`);await js(`refresh()`);await js(`selected=new Set([${JSON.stringify(zip)}]);action('open')`);assert(await js(`$('#archive-dialog').open && $('#archive-list').textContent.includes('Readme.txt')`),'ZIP browser did not open');await js(`$('#archive-dialog').close()`);await js(`call('archiveExtract',${JSON.stringify(zip)},${JSON.stringify(unpacked)})`);assert((await fs.readFile(path.join(unpacked,'Readme.txt'),'utf8')).includes('verification'),'ZIP extraction failed');await js(`call('undo')`);await js(`call('undo')`);await js(`refresh()`);checks.push('ZIP create browse extract and undo');
  await js(`$('#search').value='Created';action('search-subfolders')`);await until(`entries.length===1 && entries[0].name==='Created.txt'`,'Subfolder search did not find descendant');
  await js(`action('refresh')`);await until(`entries.length===1 && entries[0].name==='Created.txt'`,'Recursive search refresh failed');
  await js(`$('#clear-search').click()`);await until(`entries.length===3 && $('#search').value===''`,'Recursive search clear failed');await js(`action('search-subfolders')`);checks.push('subfolder search refresh and clear');
  await js(`$('#search').focus()`);assert(await js(`getComputedStyle($('#search')).outlineStyle==='none'`),'Search still has a boxed outline');
  await js(`$('#address-form').classList.add('editing');$('#address').focus()`);assert(await js(`getComputedStyle($('#address')).outlineStyle==='none'`),'Address still has a boxed outline');await js(`$('#address').blur()`);checks.push('neutral field focus');
  await js(`$('#address-form').classList.remove('editing');notify('');selected=new Set([entries.find(e=>e.name==='Photo.png').path]);syncSelection();action('grid-view');document.querySelector('[data-sort="name"]').click()`);
  await until(`Boolean(document.querySelector('#preview-art img')?.naturalWidth) && Array.from(document.querySelectorAll('.file-thumbnail')).some(i=>i.naturalWidth>0)`,'Final photo render failed');
  const bulkPaths=[path.join(fixture,'Readme.txt'),path.join(fixture,'Photo.png')];
  await js(`call('bulkRename','preview',${JSON.stringify(bulkPaths)},'Renamed')`);assert(await fs.readFile(bulkPaths[0],'utf8'),'Bulk preview modified source');
  await js(`call('bulkRename','apply',${JSON.stringify(bulkPaths)},'Renamed')`);assert((await fs.readFile(path.join(fixture,'Renamed (1).txt'),'utf8')).includes('verification'),'Bulk rename did not apply');await js(`await call('undo');await refresh()`);assert(await fs.stat(bulkPaths[1]),'Bulk rename undo failed');checks.push('bulk rename IPC preview apply and grouped undo');
  await js(`action('redo')`);assert(await fs.stat(path.join(fixture,'Renamed (2).png')),'Redo did not rename group');await js(`action('undo')`);assert(await fs.stat(bulkPaths[1]),'Second undo failed');checks.push('group redo through application command');
  await js(`presentation.group='type';presentation.density='large';refreshPresentation()`);assert(await js(`fileViewport.geometry.headers.length>=2 && $('#file-area').dataset.density==='large'`),'Grouping or icon density failed');
  await js(`presentation.columns=['name','created','size'];refreshPresentation()`);assert(await js(`$('.columns').children.length===3 && document.querySelector('.entry .created')`),'Configurable detail columns failed');await js(`presentation.group='none';presentation.density='medium';presentation.columns=['name','modified','type','size'];refreshPresentation()`);checks.push('grouped virtual layout icon density and configurable columns');
  await js(`navigate('shell:computer')`);assert(await js(`tab().path==='shell:computer' && $('#breadcrumbs').textContent.includes('This PC') && entries.length>0`),'This PC namespace did not render');if(process.argv.includes('--capture')){await pause(150);await fs.writeFile(path.join(process.cwd(),'artifacts/this-pc.png'),(await win.webContents.capturePage()).toPNG());}
  await js(`navigate('shell:recycle')`);assert(await js(`tab().path==='shell:recycle' && entries.every(e=>e.path.startsWith('shell://'))`),'Recycle Bin namespace did not render');
  await js(`navigate('shell:libraries')`);assert(await js(`tab().path==='shell:libraries' && $('#breadcrumbs').textContent.includes('Libraries')`),'Libraries namespace did not render');
  if(process.argv.includes('--test-native-recycle')){const name='Nothing-Explorer-smoke-'+Date.now()+'.txt',nativeFile=path.join(fixture,name);await fs.writeFile(nativeFile,'recycle restore fixture');await require('electron').shell.trashItem(nativeFile);const data=await js(`call('list','shell:recycle')`),entry=data.entries.find(e=>e.name===name);assert(entry,'Native recycled fixture missing');await js(`call('shellInvoke',${JSON.stringify(entry.path)},'restore')`);for(let i=0;i<60;i++){if(await fs.access(nativeFile).then(()=>true,()=>false))break;await pause(50);}assert((await fs.readFile(nativeFile,'utf8'))==='recycle restore fixture','Native restore failed');await fs.unlink(nativeFile);checks.push('native recycle and in-app restore of disposable fixture');}
  await js(`await navigate(${JSON.stringify(fixture)});selected=new Set([entries.find(e=>e.name==='Photo.png').path]);syncSelection();await preview()`);checks.push('in-window This PC Recycle Bin and Libraries');
  await js(`showSettings('appearance')`);assert(await js(`settingsDialog.open && !document.querySelector('[data-panel="appearance"]').hidden`),'Settings did not open');
  await js(`$('#setting-motion').value='off';$('#setting-motion').dispatchEvent(new Event('input'));await preferenceSave`);assert(await js(`return document.body.dataset.motion==='off' && (await call('settings','load')).motion==='off'`),'Motion settings did not persist');
  await js(`$('#setting-glass').checked=false;$('#setting-glass').dispatchEvent(new Event('input'));await preferenceSave`);assert(await js(`document.body.dataset.glass==='false' && $('#setting-blur').disabled`),'Glass toggle failed');
  await js(`$('#setting-glass').checked=true;$('#setting-glass').dispatchEvent(new Event('input'));$('#setting-motion').value='standard';$('#setting-motion').dispatchEvent(new Event('input'));await preferenceSave;showSettings('updates')`);assert(await js(`return (await call('update','check')).status==='unavailable'`),'Smoke updates should be isolated');
  await js(`showSettings('about')`);await pause(150);assert(await js(`$('#creator-link').textContent.includes('INIHARITH')`),'Creator credit missing');
  if(process.argv.includes('--capture')){await fs.mkdir(path.join(process.cwd(),'artifacts'),{recursive:true});await fs.writeFile(path.join(process.cwd(),'artifacts/settings.png'),(await win.webContents.capturePage()).toPNG());}
  await js(`settingsDialog.close()`);checks.push('settings persistence motion glass updates and creator');
  if(process.argv.includes('--capture')){await fs.mkdir(path.join(process.cwd(),'artifacts'),{recursive:true});await pause(300);await fs.writeFile(path.join(process.cwd(),'artifacts/screenshot.png'),(await win.webContents.capturePage()).toPNG());}
  console.log('SMOKE',JSON.stringify({checks,status:await js(`$('#notice').textContent`)}));
 }finally{await js('navigate(locations[0].path)').catch(()=>{});if(fixture)await fs.rm(fixture,{recursive:true,force:true});}
};
