const {parentPort}=require('node:worker_threads');
let magickReady;
const fs=require('node:fs/promises'),path=require('node:path');
async function decode({file,width}){
 const s=await fs.stat(file);if(!s.isFile()||s.size>256*1024*1024)throw Error('Image exceeds the 256 MB decoding limit.');
 const input=await fs.readFile(file),ext=path.extname(file).toLowerCase();const sharp=require('sharp');sharp.cache(false);sharp.concurrency(1);let pipeline;
 if(['.heic','.heif','.hif'].includes(ext)){
  const image=await require('heic-decode')({buffer:input});if(image.width*image.height>128000000)throw Error('Image exceeds the pixel limit.');
  pipeline=sharp(Buffer.from(image.data),{raw:{width:image.width,height:image.height,channels:4}});
 }else pipeline=sharp(input,{limitInputPixels:128000000,animated:false});
 let output;
 try{output=await pipeline.rotate().resize({width,height:width,fit:'inside',withoutEnlargement:true}).toFormat(['.jpg','.jpeg','.jpe','.jfif','.heic','.heif','.hif'].includes(ext)?'jpeg':'png',{quality:94,compressionLevel:1}).toBuffer();}
 catch(error){
  const magick=require('@imagemagick/magick-wasm');if(!magickReady)magickReady=magick.initializeImageMagick(await fs.readFile(require.resolve('@imagemagick/magick-wasm/magick.wasm')));await magickReady;
  const formatKey=Object.keys(magick.MagickFormat).find(key=>key.toLowerCase()===ext.slice(1)),format=formatKey?magick.MagickFormat[formatKey]:undefined;
  const render=image=>{if(image.width*image.height>128000000)throw Error('Image exceeds the pixel limit.');image.autoOrient();if(image.width>width||image.height>width)image.resize(new magick.MagickGeometry(width,width));return image.write(magick.MagickFormat.Png,bytes=>Buffer.from(bytes));};output=format?magick.ImageMagick.read(new Uint8Array(input),format,render):magick.ImageMagick.read(new Uint8Array(input),render);
 }
 const mime=output[0]===255&&output[1]===216?'jpeg':'png';return 'data:image/'+mime+';base64,'+output.toString('base64');
}
parentPort.on('message',async task=>{try{parentPort.postMessage({data:await decode(task)});}catch(error){parentPort.postMessage({error:error.message});}});
