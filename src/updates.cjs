// There is one compiled release source. Renderer input cannot change the feed.
const releaseSource=Object.freeze({provider:'github',owner:'iniharith',repo:'nothing-explorer',private:false});
function createUpdates({app,win,busy,smoke=false,updaterFactory=null,createHandoff=null}){
 let state={status:'idle',version:app.getVersion(),source:'iniharith/nothing-explorer',backgroundUpdates:false},checking=null,downloading=null;
 const send=patch=>{state={...state,...patch};if(!win.isDestroyed())win.webContents.send('update-state',state);return state;};
 if(!app.isPackaged||smoke)return {run:async (command,value)=>{if(command==='status')return state;if(command==='background')return send({backgroundUpdates:value===true});return send({status:'unavailable',message:'Install the released NSIS setup to use GitHub updates.'});}};
 const updater=updaterFactory?updaterFactory(releaseSource):new (require('electron-updater').NsisUpdater)(releaseSource);
 const handoff=createHandoff?.((phase,message)=>{if(phase==='preparing')send({status:'handoff',message:'Preparing the update in the background…'});else if(phase==='starting')send({status:'handoff',message:'Opening your workspace in the updated app…'});else if(phase==='switching')send({status:'handoff',message:'Switching to the updated app…'});else if(phase==='failed')send({status:'ready',message:'Could not switch versions: '+message});});
 updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
 updater.on('checking-for-update',()=>send({status:'checking',message:'Checking GitHub Releases…'}));
 updater.on('update-available',info=>{send({status:'available',latest:info.version,message:`Version ${info.version} is available.`});if(state.backgroundUpdates)run('download').catch(()=>{});});
 updater.on('update-not-available',()=>send({status:'current',message:'You have the latest released version.'}));
 updater.on('download-progress',p=>send({status:'downloading',percent:Math.round(p.percent),message:`Downloading update · ${Math.round(p.percent)}%`}));
 updater.on('update-downloaded',()=>send({status:'ready',message:'Update downloaded. Restart to install.'}));
 updater.on('error',e=>send({status:'error',message:e.message}));
 async function run(command,value){
  if(command==='status')return state;
  if(command==='background'){send({backgroundUpdates:value===true});if(state.backgroundUpdates&&state.status==='available')run('download').catch(()=>{});return state;}
  if(command==='check'){if(['downloading','ready'].includes(state.status))return state;if(!checking)checking=updater.checkForUpdates().finally(()=>checking=null);await checking;return state;}
  if(command==='download'){if(state.status==='downloading')return state;if(state.status!=='available')throw Error('Check GitHub Releases before downloading.');if(!downloading){send({status:'downloading',percent:0,message:'Downloading update in the background…'});downloading=updater.downloadUpdate().catch(error=>{send({status:'error',message:error.message});throw error;}).finally(()=>downloading=null);}await downloading;return state;}
  if(command==='handoff'){if(!handoff)throw Error('Workspace handoff is not available.');if(state.status!=='ready'||!state.latest)throw Error('Download the update before switching versions.');if(busy())throw Error('Finish or cancel file transfers before switching versions.');await handoff(state.latest);return state;}
  if(command==='install'){if(state.status!=='ready')throw Error('No downloaded update is ready.');if(busy())throw Error('Finish or cancel file transfers before restarting.');updater.quitAndInstall(false,true);return state;}
  throw Error('Unsupported update command.');
 }
 const startup=setTimeout(()=>run('check').catch(()=>{}),15000);startup.unref();
 const timer=setInterval(()=>run('check').catch(()=>{}),6*60*60*1000);timer.unref();app.on('before-quit',()=>{clearTimeout(startup);clearInterval(timer);});
 return {run};
}
module.exports={createUpdates,releaseSource};
