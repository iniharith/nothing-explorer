using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
namespace NothingExplorer {
 public static class FileMetadata {
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct StreamInfo {public long Size;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=296)]public string Name;}
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr FindFirstStreamW(string name,int level,out StreamInfo data,uint flags);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool FindNextStreamW(IntPtr handle,out StreamInfo data);
  [DllImport("kernel32.dll")]static extern bool FindClose(IntPtr handle);
  static string Long(string p){p=Path.GetFullPath(p);return p.StartsWith("\\\\?\\")?p:p.StartsWith("\\\\")?"\\\\?\\UNC\\"+p.Substring(2):"\\\\?\\"+p;}
  public static int Apply(string source,string target){return Apply(source,target,false);}
  public static int Apply(string source,string target,bool shallow){source=Long(source);target=Long(target);FileAttributes attrs=File.GetAttributes(source);if((attrs&FileAttributes.ReparsePoint)!=0)return 0;int streams=0;
   if((attrs&FileAttributes.Directory)!=0){if(!shallow)foreach(string child in Directory.GetFileSystemEntries(source))streams+=Apply(child,Path.Combine(target,Path.GetFileName(child)));Directory.SetAccessControl(target,Directory.GetAccessControl(source,AccessControlSections.Access));Directory.SetCreationTimeUtc(target,Directory.GetCreationTimeUtc(source));Directory.SetLastWriteTimeUtc(target,Directory.GetLastWriteTimeUtc(source));Directory.SetLastAccessTimeUtc(target,Directory.GetLastAccessTimeUtc(source));}
   else{StreamInfo data;IntPtr handle=FindFirstStreamW(source,0,out data,0);if(handle!=new IntPtr(-1)){try{do{if(data.Name=="::$DATA")continue;using(FileStream input=new FileStream(source+data.Name,FileMode.Open,FileAccess.Read,FileShare.Read))using(FileStream output=new FileStream(target+data.Name,FileMode.Create,FileAccess.Write,FileShare.None)){input.CopyTo(output);output.Flush(true);}streams++;}while(FindNextStreamW(handle,out data));int error=Marshal.GetLastWin32Error();if(error!=38&&error!=0)throw new System.ComponentModel.Win32Exception(error);}finally{FindClose(handle);}}else{int error=Marshal.GetLastWin32Error();if(error!=38&&error!=1&&error!=87)throw new System.ComponentModel.Win32Exception(error);}
    File.SetAccessControl(target,File.GetAccessControl(source,AccessControlSections.Access));File.SetCreationTimeUtc(target,File.GetCreationTimeUtc(source));File.SetLastWriteTimeUtc(target,File.GetLastWriteTimeUtc(source));File.SetLastAccessTimeUtc(target,File.GetLastAccessTimeUtc(source));}
   const FileAttributes copy=FileAttributes.ReadOnly|FileAttributes.Hidden|FileAttributes.System|FileAttributes.Archive|FileAttributes.NotContentIndexed|FileAttributes.Temporary;
   File.SetAttributes(target,attrs&copy);return streams;
  }
 }
}
