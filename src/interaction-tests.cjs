const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async function(win){
 const js=s=>win.webContents.executeJavaScript(s.includes('await ')&&!s.trim().startsWith('(async')?'(async()=>{'+s+'})()':s),checks=[];
 const assert=(v,m)=>{if(!v)throw Error(m);};
 async function until(expr,message){for(let i=0;i<120;i++){if(await js(expr))return;await pause(40);}throw Error(message);}
 const key=(code,modifiers=[])=>{win.webContents.sendInputEvent({type:'keyDown',keyCode:code,modifiers});win.webContents.sendInputEvent({type:'keyUp',keyCode:code,modifiers});};
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ne-regression-input-'));
 try{
  await fs.mkdir(path.join(root,'Child'));await fs.writeFile(path.join(root,'Note.txt'),'shortcut check');
  await js(`navigate(${JSON.stringify(root)})`);await js(`navigate(${JSON.stringify(path.join(root,'Child'))})`);
  key('L',['control']);await until(`$('#address-form').classList.contains('editing')`,'Native Ctrl+L failed');
  key('Left',['alt']);await until(`tab().path===${JSON.stringify(root)}`,'Alt+Left failed while address focused');checks.push('native keyboard navigation while editing');
  win.emit('app-command',{preventDefault(){}},'browser-forward');await until(`tab().path===${JSON.stringify(path.join(root,'Child'))}`,'Native mouse forward failed');
  win.emit('app-command',{preventDefault(){}},'browser-backward');await until(`tab().path===${JSON.stringify(root)}`,'Native mouse back failed');checks.push('Windows mouse app-command back/forward');
  await js(`document.dispatchEvent(new MouseEvent('mouseup',{button:4,bubbles:true,cancelable:true}))`);await until(`tab().path===${JSON.stringify(path.join(root,'Child'))}`,'DOM mouse forward fallback failed');
  await pause(170);await js(`document.dispatchEvent(new MouseEvent('mouseup',{button:3,bubbles:true,cancelable:true}))`);await until(`tab().path===${JSON.stringify(root)}`,'DOM mouse back fallback failed');checks.push('DOM side-button fallback');
  key('F',['control']);await until(`document.activeElement===$('#search')`,'Ctrl+F failed');key('T',['control']);await until('tabs.length===3','Ctrl+T failed from search');key('W',['control']);await until('tabs.length===2 && !navigating && entries.length===2','Ctrl+W failed');checks.push('native Ctrl+F/T/W');
  await js(`$('#files').focus()`);key('Down');await until('selected.size===1','Arrow key selection failed');key('A',['control']);await until('selected.size===2','Ctrl+A failed');await js(`focusItem(0)`);key('F2');await until(`$('#name-dialog').open`,'F2 rename failed');
  await js(`$('#name-dialog').close()`);checks.push('list focus, selection and F2');
  key('N',['control','shift']);await until(`$('#name-dialog').open`,'Ctrl+Shift+N failed');await js(`$('#name-dialog').close()`);checks.push('Ctrl+Shift+N');
  await js(`action('list-view');selected.clear();$('#file-area').scrollTop=0;entries=Array.from({length:50000},(_,i)=>({name:'Folder '+String(i).padStart(6,'0'),path:tab().path+'\\\\Synthetic-'+i,directory:true,modified:1,size:0,extension:''}));render();`);
  assert(await js(`fileViewport.metrics.mounted<100 && fileViewport.metrics.total===50000`),'Large folder is not virtualized');assert(await js('visible()===visible()'),'Visible-list cache is not reused');checks.push('50,000 items with bounded DOM and cached sorting');
  await pause(500);const measurements=await js(`(async()=>{const area=$('#file-area');const ticks=[],costs=[],raw=[];let end=performance.now()+1600;function observe(t){raw.push(t);if(t<end)requestAnimationFrame(observe);}requestAnimationFrame(observe);return await new Promise(resolve=>{FrameClock.subscribe((now,dt)=>{const start=performance.now();ticks.push(now);area.scrollTop+=32;fileViewport.patch();costs.push(performance.now()-start);if(now>=end){costs.sort((a,b)=>a-b);resolve({updates:ticks.length,seconds:(ticks.at(-1)-ticks[0])/1000,averageFps:(ticks.length-1)*1000/(ticks.at(-1)-ticks[0]),rawRafFps:(raw.length-1)*1000/(raw.at(-1)-raw[0]),visibility:document.visibilityState,focused:document.hasFocus(),p95PatchMs:costs[Math.floor(costs.length*.95)],mounted:fileViewport.rows.size,total:fileViewport.items.length});return false;}});});})()`);
  measurements.gpu=require('electron').app.getGPUFeatureStatus();measurements.windowFocused=win.isFocused();measurements.displayHz=require('electron').screen.getDisplayMatching(win.getBounds()).displayFrequency;assert(measurements.averageFps<=62,'App update clock exceeds the 60 FPS target');assert(measurements.mounted<100,'Virtualization expanded to the whole list');checks.push('measured scrolling update pacing');
  await js(`smoothScrollers[0].stop();$('#file-area').scrollTop=0;smoothScrollers[0].stop();$('#file-area').dispatchEvent(new WheelEvent('wheel',{deltaY:480,deltaMode:0,bubbles:true,cancelable:true}));`);await until(`$('#file-area').scrollTop>450`,'Smooth wheel scrolling did not settle');checks.push('smooth wheel scrolling');
  await js(`$('#files').focus();focusItem(49999)`);assert(await js(`selected.size===1 && selected.has(visible()[49999].path) && Boolean(document.querySelector('[data-index="49999"]'))`),'Keyboard focus did not mount last row');checks.push('virtualized keyboard focus at final item');
  await fs.mkdir(path.join(process.cwd(),'artifacts'),{recursive:true});measurements.offscreen=win.webContents.isOffscreen();const report=JSON.stringify({checks,measurements},null,2);await fs.writeFile(path.join(process.cwd(),'artifacts/interaction-performance.json'),report);await fs.writeFile(path.join(process.cwd(),'artifacts/interaction-performance-'+(measurements.offscreen?'offscreen':'onscreen')+'.json'),report);console.log('INTERACTION',JSON.stringify({checks,measurements}));
 }finally{await js(`navigate(locations[0].path)`);await fs.rm(root,{recursive:true,force:true});}
};
