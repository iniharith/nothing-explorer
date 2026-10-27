using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
public class PropertySheetLifetime {
 public delegate bool EnumProc(IntPtr hwnd,IntPtr data);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback,IntPtr data);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd,int command);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd,StringBuilder name,int length);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint process);
 [DllImport("shell32.dll",CharSet=CharSet.Unicode)] static extern bool SHObjectProperties(IntPtr hwnd,uint flags,string path,string page);
 static bool Sheets(bool reveal){
  bool found=false;uint own=(uint)Process.GetCurrentProcess().Id;
  EnumWindows((hwnd,data)=>{uint pid;GetWindowThreadProcessId(hwnd,out pid);if(pid!=own)return true;var name=new StringBuilder(128);GetClassName(hwnd,name,128);if(name.ToString()!="#32770")return true;found=true;if(reveal&&!IsWindowVisible(hwnd))ShowWindow(hwnd,5);return true;},IntPtr.Zero);
  return found;
 }
 public static bool Show(string path){
  bool opened=false;Exception failure=null;var finished=new ManualResetEvent(false);
  var thread=new Thread(()=>{try{opened=SHObjectProperties(IntPtr.Zero,2,path,null);var deadline=DateTime.UtcNow.AddSeconds(2);while(Sheets(false)||DateTime.UtcNow<deadline){Application.DoEvents();Thread.Sleep(30);}}catch(Exception error){failure=error;}finally{finished.Set();}});
  thread.SetApartmentState(ApartmentState.STA);thread.IsBackground=true;thread.Start();
  while(!finished.WaitOne(30)){Sheets(true);Application.DoEvents();}
  if(failure!=null)throw failure;return opened;
 }
}
