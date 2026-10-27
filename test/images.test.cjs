const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const sharp=require('sharp'),{decode}=require('../src/images.cjs');
test('bundled image engines decode real HEIC pixels without Windows codecs',async()=>{
 const data=await decode(path.join(__dirname,'../assets/fixtures/images/example.heic'),256);
 const metadata=await sharp(Buffer.from(data.split(',')[1],'base64')).metadata();
 assert.equal(metadata.width,256);assert.equal(metadata.height,171);assert.equal(metadata.format,'png');
});
test('image workers decode JPEG, TIFF, SVG, AVIF and TGA within thumbnail bounds',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ne-image-decode-'));
 try{
  const pixels=sharp({create:{width:80,height:40,channels:3,background:'#da9515'}});
  const inputs={jpg:await pixels.clone().jpeg().toBuffer(),tiff:await pixels.clone().tiff().toBuffer(),avif:await pixels.clone().avif().toBuffer(),svg:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="red"/></svg>')};
  const tga=Buffer.alloc(18+80*40*3);tga[2]=2;tga.writeUInt16LE(80,12);tga.writeUInt16LE(40,14);tga[16]=24;tga.fill(150,18);inputs.tga=tga;
  for(const [extension,buffer] of Object.entries(inputs)){const file=path.join(root,'sample.'+extension);await fs.writeFile(file,buffer);const output=await decode(file,40),metadata=await sharp(Buffer.from(output.split(',')[1],'base64')).metadata();assert.equal(metadata.width,40,extension);assert.equal(metadata.height,20,extension);}
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('corrupt images report decoder errors instead of pretending to be photo thumbnails',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ne-image-invalid-'));
 try{const file=path.join(root,'bad.heic');await fs.writeFile(file,'invalid image');await assert.rejects(decode(file),/HEIC|HEIF|image|format/i);}finally{await fs.rm(root,{recursive:true,force:true});}
});
