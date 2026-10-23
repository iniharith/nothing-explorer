// There is one compiled release source. Renderer input cannot change the feed.
const releaseSource=Object.freeze({provider:'github',owner:'iniharith',repo:'nothing-explorer',private:false});
function createUpdates({app,win,busy,smoke=false}){
 let state={status:'idle',version:app.getVersion(),source:'iniharith/nothing-explorer'},checking=null,downloading=null;
 const send=patch=>{state={...state,...patch};if(!win.isDestroyed())win.webContents.send('update-state',state);return state;};
 if(!app.isPackaged||smoke)return {run:async command=>{if(command==='status')return state;return send({status:'unavailable',message:'Install the released NSIS setup to use GitHub updates.'});}};
 const {NsisUpdater}=require('electron-updater');
 const updater=new NsisUpdater(releaseSource);
 updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
 updater.on('checking-for-update',()=>send({status:'checking',message:'Checking GitHub Releases…'}));
 updater.on('update-available',info=>send({status:'available',latest:info.version,message:`Version ${info.version} is available.`}));
 updater.on('update-not-available',()=>send({status:'current',message:'You have the latest released version.'}));
 updater.on('download-progress',p=>send({status:'downloading',percent:Math.round(p.percent),message:`Downloading update · ${Math.round(p.percent)}%`}));
 updater.on('update-downloaded',()=>send({status:'ready',message:'Update downloaded. Restart to install.'}));
 updater.on('error',e=>send({status:'error',message:e.message}));
 async function run(command){
  if(command==='status')return state;
  if(command==='check'){if(['downloading','ready'].includes(state.status))return state;if(!checking)checking=updater.checkForUpdates().finally(()=>checking=null);await checking;return state;}
  if(command==='download'){if(state.status==='downloading')return state;if(state.status!=='available')throw Error('Check GitHub Releases before downloading.');if(!downloading)downloading=updater.downloadUpdate().finally(()=>downloading=null);await downloading;return state;}
  if(command==='install'){if(state.status!=='ready')throw Error('No downloaded update is ready.');if(busy())throw Error('Finish or cancel file transfers before restarting.');updater.quitAndInstall(false,true);return state;}
  throw Error('Unsupported update command.');
 }
 const startup=setTimeout(()=>run('check').catch(()=>{}),15000);startup.unref();
 const timer=setInterval(()=>run('check').catch(()=>{}),6*60*60*1000);timer.unref();app.on('before-quit',()=>{clearTimeout(startup);clearInterval(timer);});
 return {run};
}
module.exports={createUpdates,releaseSource};
