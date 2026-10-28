// Windows uses the supplied image as the drag ghost. Keep it at icon size.
function dragImage(nativeImage, preview, fallback){
 let image;
 if(typeof preview==='string' && preview.length<=2*1024*1024 && /^data:image\/(png|jpeg|webp);base64,/i.test(preview)){
  try{image=nativeImage.createFromDataURL(preview);}catch{}
 }
 if(!image||image.isEmpty())image=nativeImage.createFromPath(fallback);
 const {width,height}=image.getSize();
 if(width>32||height>32){const scale=32/Math.max(width,height);image=image.resize({width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),quality:'best'});}
 return image;
}
module.exports={dragImage};
