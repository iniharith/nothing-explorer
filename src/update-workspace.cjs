const {validate}=require('./window-state.cjs');
function validateWindow(data){if(!data||!Array.isArray(data.tabs)||!data.tabs.length||data.tabs.length>30||!Number.isInteger(data.current)||data.current<0||data.current>=data.tabs.length)throw Error('A workspace has invalid tab state.');const tabs=data.tabs.map(item=>validate(item,item.path));const bounds=data.bounds;if(!bounds||!Number.isFinite(bounds.x)||!Number.isFinite(bounds.y)||!Number.isFinite(bounds.width)||!Number.isFinite(bounds.height)||bounds.width<1||bounds.height<1)throw Error('A workspace has invalid window bounds.');return {tabs,current:data.current,bounds:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},maximized:Boolean(data.maximized),minimized:Boolean(data.minimized)};}
// Called on trusted application windows only. Refuse handoff while an editor or
// operation dialog is open rather than silently dropping an unfinished action.
async function snapshotWorkspace(contexts){
 const windows=[];let storage=null;
 for(const context of contexts.values()){
  const win=context.win;if(win.isDestroyed()||win.webContents.isDestroyed())throw Error('A workspace window closed during the update.');
  const data=await win.webContents.executeJavaScript(`(()=>{if(navigating||document.querySelector('.inline-file-name')||[...document.querySelectorAll('dialog[open]')].some(dialog=>dialog.id!=='settings-dialog'))throw Error('Finish the current dialog or file edit before updating.');saveTabView();return {tabs:structuredClone(tabs),current,storage:Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)]))};})()`);
  if(storage===null)storage=validateStorage(data.storage||{});
  windows.push(validateWindow({...data,bounds:win.getBounds(),maximized:win.isMaximized(),minimized:win.isMinimized()}));
 }
 if(!windows.length)throw Error('There is no workspace to transfer.');return {version:1,windows,storage};
}
function validateStorage(storage){if(!storage||typeof storage!=='object'||Array.isArray(storage)||Object.keys(storage).length>512)throw Error('Invalid workspace preferences.');let size=0;const result=Object.create(null);for(const [key,value] of Object.entries(storage)){if(typeof value!=='string'||key.length>1024)throw Error('Invalid workspace preferences.');size+=key.length+value.length;if(size>10*1024*1024)throw Error('Workspace preferences are too large to transfer.');result[key]=value;}return result;}
module.exports={snapshotWorkspace,validateWindow,validateStorage};
