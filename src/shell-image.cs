using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
public static class ShellImage {
 [StructLayout(LayoutKind.Sequential)] public struct Size {public int width,height;}
 [ComImport,Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Factory {[PreserveSig]int GetImage(Size size,uint flags,out IntPtr bitmap);}
 [DllImport("shell32.dll",CharSet=CharSet.Unicode,PreserveSig=false)] static extern void SHCreateItemFromParsingName(string path,IntPtr context,ref Guid iid,[MarshalAs(UnmanagedType.Interface)]out Factory item);
 [StructLayout(LayoutKind.Sequential)] struct NativeBitmap {public int type,width,height,widthBytes;public ushort planes,bits;public IntPtr pixels;}
 [DllImport("gdi32.dll")] static extern int GetObject(IntPtr handle,int size,out NativeBitmap bitmap);
 [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr value);
 [DllImport("gdi32.dll")] static extern int GetDIBits(IntPtr dc,IntPtr bitmap,uint start,uint lines,byte[] bits,ref Info info,uint usage);
 [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hwnd);
 [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr hwnd,IntPtr dc);
 [StructLayout(LayoutKind.Sequential)] struct Info {public uint size;public int width,height;public ushort planes,bits;public uint compression,imageSize;public int x,y;public uint colors,important;}
 public static string Read(string path,int pixels,bool iconOnly){
  Factory item=null;IntPtr bitmap=IntPtr.Zero,dc=IntPtr.Zero;
  try{
   Guid iid=typeof(Factory).GUID;SHCreateItemFromParsingName(path,IntPtr.Zero,ref iid,out item);
   int result=item.GetImage(new Size{width=pixels,height=pixels},(uint)(iconOnly?5:1),out bitmap);Marshal.ThrowExceptionForHR(result);if(bitmap==IntPtr.Zero)throw new Exception("Windows returned no image.");
   dc=GetDC(IntPtr.Zero);NativeBitmap native;GetObject(bitmap,Marshal.SizeOf(typeof(NativeBitmap)),out native);int width=native.width,height=Math.Abs(native.height);var info=new Info{size=40,width=width,height=-height,planes=1,bits=32};if(width<=0||height<=0||width>4096||height>4096)throw new Exception("Invalid shell image dimensions.");
   info.height=-height;info.bits=32;info.compression=0;byte[] pixelsData=new byte[checked(width*height*4)];if(GetDIBits(dc,bitmap,0,(uint)height,pixelsData,ref info,0)==0)throw new Exception("Windows image could not be read.");
   bool alpha=false;for(int i=3;i<pixelsData.Length;i+=4)if(pixelsData[i]!=0){alpha=true;break;}if(!alpha)for(int i=3;i<pixelsData.Length;i+=4)pixelsData[i]=255;
   using(var image=new Bitmap(width,height,PixelFormat.Format32bppArgb)){var locked=image.LockBits(new Rectangle(0,0,width,height),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);try{Marshal.Copy(pixelsData,0,locked.Scan0,pixelsData.Length);}finally{image.UnlockBits(locked);}using(var output=new MemoryStream()){image.Save(output,ImageFormat.Png);return "data:image/png;base64,"+Convert.ToBase64String(output.ToArray());}}
  }finally{if(dc!=IntPtr.Zero)ReleaseDC(IntPtr.Zero,dc);if(bitmap!=IntPtr.Zero)DeleteObject(bitmap);if(item!=null)Marshal.ReleaseComObject(item);}
 }
}
