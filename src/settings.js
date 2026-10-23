// One restrained settings surface; all preferences are stored in the app profile.
let preferences={motion:'standard',smooth:true,glass:true,blur:15,opacity:82,wallpaper:true,theme:'dark'};
const settingsDialog=document.createElement('dialog');settingsDialog.id='settings-dialog';
settingsDialog.innerHTML=`<header class="settings-header"><div><span class="eyebrow">NOTHING EXPLORER</span><h2>Settings</h2></div><button id="settings-close" aria-label="Close settings">×</button></header>
<div class="settings-layout"><nav class="settings-nav" aria-label="Settings sections"><button data-section="appearance" class="active">Appearance</button><button data-section="updates">Updates</button><button data-section="about">About</button></nav><div class="settings-content">
<section data-panel="appearance"><h3>Make it yours</h3><p>Choose the appearance and motion that suit you.</p>
<label class="setting-row"><span>Color theme<small>Match your workspace</small></span><select id="setting-theme"><option value="dark">Dark</option><option value="light">Light</option></select></label>
<label class="setting-row"><span>Animation<small>Windows reduced-motion preferences always apply</small></span><select id="setting-motion"><option value="off">Off</option><option value="subtle">Subtle</option><option value="standard">Standard</option></select></label>
<label class="setting-row"><span>Smooth scrolling<small>Ease into each scroll movement</small></span><input type="checkbox" id="setting-smooth"></label>
<label class="setting-row"><span>Frosted glass<small>Soften the wallpaper behind your files</small></span><input type="checkbox" id="setting-glass"></label>
<label class="setting-row"><span>Blur strength<small id="blur-value"></small></span><input type="range" id="setting-blur" min="0" max="30" step="1"></label>
<label class="setting-row"><span>Panel opacity<small id="opacity-value"></small></span><input type="range" id="setting-opacity" min="55" max="100" step="1"></label>
<label class="setting-row"><span>Show wallpaper</span><input type="checkbox" id="setting-wallpaper"></label>
<div class="setting-row"><span>Wallpaper<small>PNG, JPEG or WebP · up to 20 MB</small></span><div><button id="setting-wallpaper-choose">Choose image…</button><button id="setting-wallpaper-reset">Default</button></div></div><button id="settings-reset">Reset appearance</button><p id="settings-feedback" role="status"></p></section>
<section data-panel="updates" hidden><h3>Always up to date</h3><p>Updates come exclusively from published GitHub releases.</p><div class="settings-card"><strong id="update-version"></strong><p id="update-status" role="status">Ready to check.</p><progress id="update-progress" max="100" hidden></progress><div class="settings-actions"><button id="update-check">Check for updates</button><button id="update-download" hidden>Download update</button><button id="update-install" hidden>Restart and install</button></div></div><p class="settings-note">Stable releases only. Downloads are checked against the release checksum. Restart happens when you choose, after file transfers finish.</p></section>
<section data-panel="about" hidden><img class="settings-brand" src="../assets/icon.png" alt="Nothing Explorer folder icon"><h3>Nothing Explorer</h3><p>A familiar place for your files.</p><div class="settings-card"><span class="eyebrow">CREATED BY</span><p><button id="creator-link" class="creator-link">INIHARITH ↗</button></p><p>iniharith.github.io</p></div><p id="about-version"></p><p class="settings-note">Windows shell tools open in their native Windows interface. See the capability audit for features that still require Windows Explorer.</p></section>
</div></div>`;document.body.append(settingsDialog);
function applyPreferences(){
 const p=preferences,b=document.body;b.dataset.motion=p.motion;b.dataset.smooth=String(p.smooth);b.dataset.glass=String(p.glass);b.dataset.blur=String(p.blur);b.dataset.wallpaper=String(p.wallpaper);
 b.style.setProperty('--panel-opacity',p.opacity/100);b.classList.toggle('light',p.theme==='light');localStorage.setItem('theme',p.theme);$('#theme-label').textContent=p.theme==='light'?'Light':'Dark';call('theme',p.theme).catch(()=>{});glassKey='';cacheWallpaperLayer();
 for(const key of Object.keys(p)){const input=$('#setting-'+key);if(!input)continue;if(input.type==='checkbox')input.checked=p[key];else input.value=p[key];}
 $('#blur-value').textContent=p.blur+' px';$('#opacity-value').textContent=p.opacity+'%';$('#setting-blur').disabled=!p.glass;
}
let preferenceSave=Promise.resolve();
function savePreferences(){const snapshot={...preferences};preferenceSave=preferenceSave.catch(()=>{}).then(()=>call('settings','save',snapshot)).catch(e=>{$('#settings-feedback').textContent=e.message;});return preferenceSave;}
for(const key of Object.keys(preferences))$('#setting-'+key)?.addEventListener('input',e=>{preferences[key]=e.target.type==='checkbox'?e.target.checked:e.target.type==='range'?Number(e.target.value):e.target.value;applyPreferences();savePreferences();});
function showSettings(section='appearance'){
 document.querySelectorAll('[data-panel]').forEach(el=>el.hidden=el.dataset.panel!==section);document.querySelectorAll('[data-section]').forEach(el=>el.classList.toggle('active',el.dataset.section===section));
 if(!settingsDialog.open)settingsDialog.showModal();call('update','status').then(paintUpdate).catch(e=>{$('#update-status').textContent=e.message;});
}
settingsDialog.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>showSettings(b.dataset.section));$('#settings-close').onclick=()=>settingsDialog.close();
$('#setting-wallpaper-choose').onclick=()=>wallpaperButton.click();
$('#setting-wallpaper-reset').onclick=async()=>{try{await call('wallpaper','reset');document.body.style.backgroundImage='';glassKey='';cacheWallpaperLayer();}catch(e){$('#settings-feedback').textContent=e.message;}};
$('#settings-reset').onclick=async()=>{preferences=await call('settings','reset');applyPreferences();};
$('#creator-link').onclick=()=>call('creator').catch(e=>notify(e.message));
function paintUpdate(state){$('#update-version').textContent='Version '+state.version;$('#about-version').textContent='Version '+state.version;$('#update-status').textContent=state.message||'Ready to check GitHub Releases.';$('#update-check').disabled=['checking','downloading'].includes(state.status);$('#update-download').hidden=state.status!=='available';$('#update-install').hidden=state.status!=='ready';$('#update-progress').hidden=state.status!=='downloading';$('#update-progress').value=state.percent||0;}
for(const command of ['check','download','install'])$('#update-'+command).onclick=async()=>{try{paintUpdate(await call('update',command));}catch(e){$('#update-status').textContent=e.message;}};
api.onUpdate(state=>{paintUpdate(state);settingsButton.textContent=['available','ready'].includes(state.status)?'Settings · Update available':'Settings';});
const settingsButton=document.createElement('button');settingsButton.textContent='Settings';settingsButton.title='Appearance, updates and about';settingsButton.onclick=()=>showSettings();$('.sidebar-bottom').prepend(settingsButton);wallpaperButton.hidden=true;
const credit=document.createElement('button');credit.textContent='INIHARITH ↗';credit.className='sidebar-credit';credit.onclick=()=>call('creator');$('.sidebar-bottom').append(credit);
const settingsAction=action;action=async function(cmd){if(cmd==='settings')return showSettings();if(cmd==='theme'){preferences.theme=document.body.classList.contains('light')?'dark':'light';applyPreferences();return savePreferences();}return settingsAction(cmd);};
call('settings','load').then(p=>{preferences=p;applyPreferences();}).catch(e=>notify(e.message));
