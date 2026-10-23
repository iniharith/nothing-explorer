const defaults=Object.freeze({motion:'standard',smooth:true,glass:true,blur:15,opacity:82,wallpaper:true,theme:'dark'});
function normalize(value={}){
 const range=(key,min,max)=>Number.isFinite(Number(value[key]))?Math.max(min,Math.min(max,Number(value[key]))):defaults[key];
 return {motion:['off','subtle','standard'].includes(value.motion)?value.motion:defaults.motion,smooth:typeof value.smooth==='boolean'?value.smooth:true,glass:typeof value.glass==='boolean'?value.glass:true,blur:range('blur',0,30),opacity:range('opacity',55,100),wallpaper:typeof value.wallpaper==='boolean'?value.wallpaper:true,theme:value.theme==='light'?'light':'dark'};
}
module.exports={defaults,normalize};
