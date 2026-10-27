using System;
using System.Collections.Generic;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace NothingExplorer {
 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int Left,Top,Right,Bottom;public Rect(int w,int h){Left=Top=0;Right=w;Bottom=h;}}
 [StructLayout(LayoutKind.Sequential)] public struct FolderSettings {public uint ViewMode,Flags;}
 [StructLayout(LayoutKind.Sequential)]public struct NativePoint {public int X,Y;}
 [StructLayout(LayoutKind.Sequential)]public struct NativeMessage {public IntPtr Window;public uint Message;public UIntPtr WParam;public IntPtr LParam;public uint Time;public NativePoint Point;public uint Private;}
 [ComImport,Guid("68284FAA-6A48-11D0-8C78-00C04FD918B4"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]public interface IInputObject {void UIActivateIO([MarshalAs(UnmanagedType.Bool)]bool activate,ref NativeMessage message);[PreserveSig]int HasFocusIO();[PreserveSig]int TranslateAcceleratorIO(ref NativeMessage message);}
 [ComImport,Guid("DFD3B6B5-C10C-4BE9-85F6-A66969F402F6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 public interface IExplorerBrowser {
  void Initialize(IntPtr parent,ref Rect rect,ref FolderSettings settings);void Destroy();void SetRect(IntPtr deferred,ref Rect rect);
  void SetPropertyBag([MarshalAs(UnmanagedType.LPWStr)]string name);void SetEmptyText([MarshalAs(UnmanagedType.LPWStr)]string text);void SetFolderSettings(ref FolderSettings settings);
  void Advise(IExplorerBrowserEvents sink,out uint cookie);void Unadvise(uint cookie);void SetOptions(uint options);void GetOptions(out uint options);
  void BrowseToIDList(IntPtr pidl,uint flags);void BrowseToObject([MarshalAs(UnmanagedType.IUnknown)]object item,uint flags);
  void FillFromObject([MarshalAs(UnmanagedType.IUnknown)]object item,uint flags);void RemoveAll();void GetCurrentView(ref Guid id,[MarshalAs(UnmanagedType.IUnknown)]out object view);
 }
 [ComVisible(true),Guid("361BBDC7-E6EE-4E13-BE58-58E2240C810F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 public interface IExplorerBrowserEvents {
  [PreserveSig]int OnNavigationPending(IntPtr pidl);[PreserveSig]int OnViewCreated([MarshalAs(UnmanagedType.IUnknown)]object view);
  [PreserveSig]int OnNavigationComplete(IntPtr pidl);[PreserveSig]int OnNavigationFailed(IntPtr pidl);
 }
 [ComImport,Guid("CDE725B0-CCC9-4519-917E-325D72FAB4CE"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 public interface IFolderView {
  void GetCurrentViewMode(out uint mode);void SetCurrentViewMode(uint mode);void GetFolder(ref Guid id,[MarshalAs(UnmanagedType.IUnknown)]out object folder);
  void Item(int index,out IntPtr pidl);void ItemCount(uint flags,out int count);void Items(uint flags,ref Guid id,[MarshalAs(UnmanagedType.IUnknown)]out object items);void GetSelectionMarkedItem(out int index);void GetFocusedItem(out int index);void GetItemPosition(IntPtr pidl,out NativePoint point);void GetSpacing(out NativePoint point);void GetDefaultSpacing(out NativePoint point);[PreserveSig]int GetAutoArrange();void SelectItem(int index,uint flags);void SelectAndPositionItems(uint count,IntPtr pidls,IntPtr points,uint flags);
 }
 [ComImport,Guid("B63EA76D-1F85-456F-A19C-48159EFA858B"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 public interface IShellItemArray {
  void BindToHandler(IntPtr context,ref Guid handler,ref Guid id,out IntPtr result);void GetPropertyStore(int flags,ref Guid id,out IntPtr store);
  void GetPropertyDescriptionList(IntPtr key,ref Guid id,out IntPtr list);void GetAttributes(uint flags,uint mask,out uint attributes);
  void GetCount(out uint count);void GetItemAt(uint index,out IShellItem item);void EnumItems(out IntPtr enumerator);
 }
 [ComImport,Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 public interface IShellItem {
  void BindToHandler(IntPtr context,ref Guid handler,ref Guid id,out IntPtr result);void GetParent(out IShellItem parent);
  void GetDisplayName(uint kind,out IntPtr name);void GetAttributes(uint mask,out uint attributes);void Compare(IShellItem other,uint hint,out int order);
 }
 [ComImport,Guid("000214E3-0000-0000-C000-000000000046"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]public interface IShellViewWindow {void GetWindow(out IntPtr window);void ContextSensitiveHelp([MarshalAs(UnmanagedType.Bool)]bool enter);void TranslateAccelerator(IntPtr message);void EnableModeless([MarshalAs(UnmanagedType.Bool)]bool enable);void UIActivate(uint state);}
 [ComVisible(true),ClassInterface(ClassInterfaceType.None)]
 public class ShellHost:Form,IExplorerBrowserEvents,IMessageFilter {
  [DllImport("shell32.dll",CharSet=CharSet.Unicode)]static extern int SHParseDisplayName(string path,IntPtr context,out IntPtr pidl,uint attrs,out uint result);
  [DllImport("shell32.dll")]static extern int SHGetNameFromIDList(IntPtr pidl,uint kind,out IntPtr name);
  [DllImport("user32.dll",SetLastError=true)]static extern IntPtr SetParent(IntPtr child,IntPtr parent);
  [DllImport("user32.dll")]static extern bool GetKeyboardState(byte[] state);
  [DllImport("user32.dll")]static extern bool SetKeyboardState(byte[] state);
  [DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr window,IntPtr process);
  [DllImport("kernel32.dll")]static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")]static extern bool AttachThreadInput(uint source,uint target,bool attach);
  [DllImport("user32.dll")]static extern IntPtr GetParent(IntPtr window);
  [DllImport("user32.dll")]static extern bool PrintWindow(IntPtr window,IntPtr dc,uint flags);
  [DllImport("user32.dll")]static extern bool ShowWindow(IntPtr window,int mode);
  [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")]static extern bool IsChild(IntPtr parent,IntPtr child);
  [DllImport("user32.dll")]static extern IntPtr GetAncestor(IntPtr window,uint flags);
  [DllImport("user32.dll")]static extern IntPtr WindowFromPoint(NativePoint point);
  [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr window,out Rect rect);
  [DllImport("user32.dll")]static extern bool IsWindow(IntPtr window);
  [DllImport("user32.dll")]static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int width,int height,uint flags);
  [DllImport("user32.dll")]static extern IntPtr SetFocus(IntPtr window);
  [DllImport("user32.dll")]static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("uxtheme.dll",CharSet=CharSet.Unicode)]static extern int SetWindowTheme(IntPtr window,string app,string id);
  [DllImport("user32.dll")]static extern bool EnumChildWindows(IntPtr parent,EnumWindows callback,IntPtr arg);
  delegate bool EnumWindows(IntPtr window,IntPtr arg);
  static readonly JavaScriptSerializer Json=new JavaScriptSerializer();static readonly object OutputLock=new object();
  IExplorerBrowser browser;uint cookie;IntPtr parentWindow;string currentPath="",selectionKey="";bool ready=false;Timer pulse;DateTime stateAfter=DateTime.MinValue;
  public static void Emit(object value){lock(OutputLock){Console.WriteLine(Json.Serialize(value));Console.Out.Flush();}}
  static string ParsingName(IntPtr pidl){IntPtr text;if(SHGetNameFromIDList(pidl,0x80028000,out text)<0)return "";try{return Marshal.PtrToStringUni(text);}finally{Marshal.FreeCoTaskMem(text);}}
  public ShellHost(IntPtr parent,string initial,int x,int y,int width,int height,bool frames){
   parentWindow=parent;TopLevel=false;FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;AutoScaleMode=AutoScaleMode.None;BackColor=Color.FromArgb(24,25,24);Bounds=new Rectangle(x,y,width,height);
   IntPtr handle=Handle;SetParent(handle,parent);Show();ShowWindow(handle,5);SetWindowPos(handle,IntPtr.Zero,x,y,width,height,0x0050);
   browser=(IExplorerBrowser)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("71F96385-DDD6-48D3-A0C1-AE06E8B055FB")));
   browser.SetOptions((uint)(0x40|0x4|(frames?2:0)));browser.SetPropertyBag("NothingExplorer.ShellView");
   Rect rect=new Rect(width,height);FolderSettings settings=new FolderSettings{ViewMode=4,Flags=0x00200000};browser.Initialize(handle,ref rect,ref settings);browser.Advise(this,out cookie);
   Application.AddMessageFilter(this);Navigate(initial);ready=true;
   pulse=new Timer();pulse.Interval=300;pulse.Tick+=delegate{if(!IsWindow(parentWindow)){Close();return;}PollSelection();};pulse.Start();Emit(new {kind="ready",handle=Handle.ToInt64(),path=currentPath});
  }
  void Navigate(string path){IntPtr pidl;uint attrs;int hr=SHParseDisplayName(path,IntPtr.Zero,out pidl,0,out attrs);Marshal.ThrowExceptionForHR(hr);try{browser.BrowseToIDList(pidl,0);}finally{Marshal.FreeCoTaskMem(pidl);}}
  IFolderView View(){Guid id=new Guid("CDE725B0-CCC9-4519-917E-325D72FAB4CE");object view;browser.GetCurrentView(ref id,out view);return (IFolderView)view;}
  public object State(){int count=0,selected=0;uint mode=0;IFolderView view=null;IntPtr viewWindow=IntPtr.Zero;try{view=View();view.ItemCount(2,out count);view.GetCurrentViewMode(out mode);view.ItemCount(1,out selected);Guid id=new Guid("000214E3-0000-0000-C000-000000000046");object native;browser.GetCurrentView(ref id,out native);try{((IShellViewWindow)native).GetWindow(out viewWindow);}finally{Marshal.ReleaseComObject(native);}}finally{if(view!=null)Marshal.ReleaseComObject(view);}Rect rect;GetWindowRect(Handle,out rect);NativePoint point=new NativePoint{X=(rect.Left+rect.Right)/2,Y=(rect.Top+rect.Bottom)/2};IntPtr hit=WindowFromPoint(point);bool covered=GetAncestor(hit,2)==parentWindow&&hit!=Handle&&!IsChild(Handle,hit);bool shown=IsWindowVisible(Handle)&&IsWindowVisible(viewWindow);return new {kind="state",path=currentPath,count=count,mode=mode,visible=shown,displayed=shown&&!covered,coveredByRenderer=covered,handle=Handle.ToInt64(),parent=GetParent(Handle).ToInt64(),selected=selected};}
  void PollSelection(){if(!ready||DateTime.UtcNow<stateAfter)return;IFolderView view=null;IShellItemArray items=null;try{view=View();Guid id=new Guid("B63EA76D-1F85-456F-A19C-48159EFA858B");object value;view.Items(1,ref id,out value);items=(IShellItemArray)value;uint count;items.GetCount(out count);List<string> paths=new List<string>();for(uint i=0;i<Math.Min(count,10000);i++){IShellItem item;items.GetItemAt(i,out item);try{IntPtr text;item.GetDisplayName(0x80028000,out text);try{paths.Add(Marshal.PtrToStringUni(text));}finally{Marshal.FreeCoTaskMem(text);}}finally{Marshal.ReleaseComObject(item);}}string key=String.Join("\n",paths.ToArray());if(key!=selectionKey){selectionKey=key;Emit(new {kind="selection",paths=paths});}}catch{}finally{if(items!=null)Marshal.ReleaseComObject(items);if(view!=null)Marshal.ReleaseComObject(view);}}
  public int OnNavigationPending(IntPtr pidl){return 0;}
  public int OnViewCreated(object view){SetWindowTheme(Handle,"Explorer",null);EnumChildWindows(Handle,delegate(IntPtr w,IntPtr a){SetWindowTheme(w,"Explorer",null);return true;},IntPtr.Zero);return 0;}
  public int OnNavigationComplete(IntPtr pidl){currentPath=ParsingName(pidl);stateAfter=DateTime.UtcNow.AddMilliseconds(150);selectionKey="";Emit(new {kind="navigation",path=currentPath});return 0;}
  public int OnNavigationFailed(IntPtr pidl){Emit(new {kind="error",message="Windows could not navigate to this location.",path=ParsingName(pidl)});return 0;}
  public bool PreFilterMessage(ref Message m){if(m.Msg==0x020C){int button=(int)(((long)m.WParam>>16)&0xffff);Emit(new {kind="command",command=button==1?"mouse-back":"mouse-forward"});return true;}if(m.Msg!=0x100&&m.Msg!=0x104)return false;Keys key=(Keys)(int)m.WParam,mods=Control.ModifierKeys;string command=null;if((mods&Keys.Control)!=0){switch(key){case Keys.L:command="focus-address";break;case Keys.F:command="focus-search";break;case Keys.T:command="new-tab";break;case Keys.W:command="close-tab";break;case Keys.Tab:command=(mods&Keys.Shift)!=0?"previous-tab":"next-tab";break;}}if((mods&Keys.Alt)!=0){if(key==Keys.Left)command="back";if(key==Keys.Right)command="forward";if(key==Keys.Up)command="up";}if(command!=null){Emit(new {kind="command",command=command});return true;}try{NativeMessage message=new NativeMessage{Window=m.HWnd,Message=(uint)m.Msg,WParam=new UIntPtr((uint)(long)m.WParam),LParam=m.LParam};return ((IInputObject)browser).TranslateAcceleratorIO(ref message)==0;}catch{return false;}}
  public object Command(Dictionary<string,object> input){string cmd=Convert.ToString(input["command"]);if(cmd=="navigate"){Navigate(Convert.ToString(input["path"]));return true;}if(cmd=="bounds"){int x=Convert.ToInt32(input["x"]),y=Convert.ToInt32(input["y"]),width=Convert.ToInt32(input["width"]),height=Convert.ToInt32(input["height"]);Bounds=new Rectangle(x,y,width,height);SetWindowPos(Handle,IntPtr.Zero,x,y,width,height,0x0010);Rect rect=new Rect(width,height);browser.SetRect(IntPtr.Zero,ref rect);return true;}if(cmd=="visible"){Visible=Convert.ToBoolean(input["visible"]);return true;}if(cmd=="status")return State();if(cmd=="view"){IFolderView view=View();try{view.SetCurrentViewMode(Convert.ToUInt32(input["mode"]));}finally{Marshal.ReleaseComObject(view);}return true;}if(cmd=="key"){string name=Convert.ToString(input["key"]);Dictionary<string,string> keys=new Dictionary<string,string>{{"copy","^c"},{"cut","^x"},{"paste","^v"},{"undo","^z"},{"redo","^y"},{"select-all","^a"},{"trash","{DELETE}"},{"rename","{F2}"},{"mkdir","^+n"},{"open","{ENTER}"},{"native-properties","%{ENTER}"},{"refresh","{F5}"}};if(!keys.ContainsKey(name))throw new Exception("Unsupported shell shortcut.");int vk=name=="copy"?(int)Keys.C:name=="cut"?(int)Keys.X:name=="paste"?(int)Keys.V:name=="undo"?(int)Keys.Z:name=="redo"?(int)Keys.Y:name=="select-all"?(int)Keys.A:name=="trash"?(int)Keys.Delete:name=="rename"?(int)Keys.F2:name=="mkdir"?(int)Keys.N:name=="refresh"?(int)Keys.F5:(int)Keys.Enter;
   NativeMessage message=new NativeMessage{Window=Handle,Message=0x100,WParam=new UIntPtr((uint)vk),LParam=new IntPtr(1)};byte[] saved=new byte[256];GetKeyboardState(saved);byte[] state=(byte[])saved.Clone();state[(int)Keys.ControlKey]=(byte)((name=="copy"||name=="cut"||name=="paste"||name=="undo"||name=="redo"||name=="select-all"||name=="mkdir")?0x80:0);state[(int)Keys.ShiftKey]=(byte)(name=="mkdir"?0x80:0);state[(int)Keys.Menu]=(byte)(name=="native-properties"?0x80:0);
   try{SetKeyboardState(state);IInputObject inputObject=(IInputObject)browser;inputObject.UIActivateIO(true,ref message);int result=inputObject.TranslateAcceleratorIO(ref message);if(result!=0&&name!="select-all")throw new Exception("Windows did not handle this shortcut.");if(name=="select-all"){IFolderView view=View();try{int count;view.ItemCount(2,out count);for(int i=0;i<count;i++)view.SelectItem(i,i==0?5U:1U);}finally{Marshal.ReleaseComObject(view);}}}finally{SetKeyboardState(saved);}return true;}if(cmd=="capture"){using(Bitmap bitmap=new Bitmap(Width,Height))using(Graphics graphics=Graphics.FromImage(bitmap)){IntPtr dc=graphics.GetHdc();try{if(!PrintWindow(Handle,dc,2))throw new Exception("Windows view capture failed.");}finally{graphics.ReleaseHdc(dc);}bitmap.Save(Convert.ToString(input["path"]),System.Drawing.Imaging.ImageFormat.Png);}return true;}if(cmd=="close"){BeginInvoke(new Action(Close));return true;}throw new Exception("Unknown native view command.");}
  protected override void OnFormClosed(FormClosedEventArgs e){ready=false;if(pulse!=null){pulse.Stop();pulse.Dispose();}Application.RemoveMessageFilter(this);if(browser!=null){try{browser.Unadvise(cookie);browser.Destroy();}catch{}Marshal.ReleaseComObject(browser);browser=null;}base.OnFormClosed(e);Application.ExitThread();}
  public static void Run(string encoded){try{try{SetProcessDpiAwarenessContext(new IntPtr(-4));}catch{}Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Dictionary<string,object> start=Json.Deserialize<Dictionary<string,object>>(encoded);ShellHost host=new ShellHost(new IntPtr(Convert.ToInt64(start["parent"])),Convert.ToString(start["path"]),Convert.ToInt32(start["x"]),Convert.ToInt32(start["y"]),Convert.ToInt32(start["width"]),Convert.ToInt32(start["height"]),Convert.ToBoolean(start["frames"]));Task.Run(delegate{try{string line;while((line=Console.ReadLine())!=null){Dictionary<string,object> request=Json.Deserialize<Dictionary<string,object>>(line);host.BeginInvoke(new Action(delegate{try{object result=host.Command(request);Emit(new {id=request["id"],ok=true,value=result});}catch(Exception error){Emit(new {id=request["id"],ok=false,error=error.Message});}}));}}catch(Exception error){Emit(new {kind="error",message=error.Message});}finally{try{host.BeginInvoke(new Action(host.Close));}catch{}}});Application.Run();}catch(Exception error){Emit(new {kind="fatal",message=error.ToString()});Environment.ExitCode=1;}}
 }
}
