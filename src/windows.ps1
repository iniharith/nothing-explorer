param([string]$Operation,[string]$PayloadBase64)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
if($Operation -eq 'broker'){
 while($null -ne ($line=[Console]::ReadLine())){
  try{$request=$line|ConvertFrom-Json;$raw=(& $PSCommandPath ([string]$request.operation) ([string]$request.payload)|Out-String).Trim();if(-not $raw){$raw='null'};$reply='{"id":'+([long]$request.id)+',"ok":true,"value":'+$raw+'}'}
  catch{$reply=(@{id=$request.id;ok=$false;error=$_.Exception.Message}|ConvertTo-Json -Compress)}
  [Console]::WriteLine($reply)
 }
 exit
}
$payloadJson=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64))
$payload=$payloadJson | ConvertFrom-Json
switch($Operation){
 'copyMetadata' {
  if(-not ('NothingExplorer.FileMetadata' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'file-metadata.cs')}
  @{streams=[NothingExplorer.FileMetadata]::Apply([string]$payload.source,[string]$payload.target,[bool]$payload.shallow)}|ConvertTo-Json -Compress;break
 }
 'shellList' {
  $shell=New-Object -ComObject Shell.Application;$folder=$shell.Namespace([string]$payload.path)
  if(-not $folder){throw 'Windows could not open this shell location.'}
  $items=@();$count=0
  foreach($item in $folder.Items()){
   if($count -ge 10000){break};$count++
   $raw=[string]$item.Path;$fileSystem=[bool]$item.IsFileSystem
   if($item.IsFolder -and $fileSystem -and -not [IO.Directory]::Exists($raw)){$fileSystem=$false}
   $modified=0;try{$modified=([DateTimeOffset][DateTime]$item.ModifyDate).ToUnixTimeMilliseconds()}catch{}
   $displayName=[string]$item.Name;$extension=[IO.Path]::GetExtension($raw);if($fileSystem -and -not $item.IsFolder -and $extension -and -not $displayName.EndsWith($extension,[StringComparison]::OrdinalIgnoreCase)){$displayName+=$extension}
   $items+=@{name=$displayName;parsing=$raw;directory=[bool]$item.IsFolder;filesystem=$fileSystem;size=[double]$item.Size;modified=$modified;extension=[IO.Path]::GetExtension($raw).TrimStart('.').ToLowerInvariant();type=[string]$item.Type;originalLocation=[string]$item.ExtendedProperty('System.Recycle.DeletedFrom');deleted=[string]$item.ExtendedProperty('System.Recycle.DateDeleted')}
  }
  $parent='';$parentName='';try{$parent=[string]$folder.ParentFolder.Self.Path;$parentName=[string]$folder.ParentFolder.Self.Name}catch{}
  @{name=[string]$folder.Self.Name;parent=$parent;parentName=$parentName;entries=$items;truncated=($folder.Items().Count -gt 10000)}|ConvertTo-Json -Compress -Depth 8;break
 }
 'shellInvoke' {
  $shell=New-Object -ComObject Shell.Application;$folder=$shell.Namespace([string]$payload.parent)
  if(-not $folder){$folder=$shell.Namespace([string]$payload.path);if($folder){$item=$folder.Self}}else{$item=$null;foreach($candidate in $folder.Items()){if([string]$candidate.Path -eq [string]$payload.path){$item=$candidate;break}}}
  if(-not $item){throw 'The Windows item is no longer available.'}
  switch([string]$payload.verb){'open' {$item.InvokeVerb();break};'properties' {$item.InvokeVerb('properties');break};'undelete' {$item.InvokeVerb('undelete');break};'delete' {$item.InvokeVerb('delete');break};default {throw 'Unsupported shell verb.'}}
  'true';break
 }
 'shellVerbs' {
  $shell=New-Object -ComObject Shell.Application;$folder=$shell.Namespace([string]$payload.parent);if(-not $folder){throw 'Shell parent is unavailable.'}
  $item=$null;foreach($candidate in $folder.Items()){if([string]$candidate.Path -eq [string]$payload.path){$item=$candidate;break}}
  if(-not $item){throw 'The item is no longer in this location.'}
  $verbs=@();$index=0;foreach($verb in $item.Verbs()){$verbs+=@{index=$index;name=[string]$verb.Name};$index++}
  if($payload.invoke -eq $true){$list=$item.Verbs();$index=[int]$payload.index;if($index -lt 0 -or $index -ge $list.Count){throw 'Shell action is no longer available.'};$verb=$list.Item($index);if([string]$verb.Name -ne [string]$payload.name){throw 'Shell action changed. Open the menu again.'};$verb.DoIt();'true'}else{ConvertTo-Json -InputObject $verbs -Compress};break
 }
 'systemCommand' {
  $target=[string]$payload.path
  $shell=New-Object -ComObject Shell.Application
  switch([string]$payload.command){
   'terminal' {if(-not [IO.Directory]::Exists($target)){$target=[IO.Path]::GetDirectoryName($target)};Start-Process -FilePath 'powershell.exe' -WorkingDirectory $target;break}
   'map-drive' {Start-Process -FilePath 'rundll32.exe' -ArgumentList 'shell32.dll,SHHelpShortcuts_RunDLL Connect';break}
   'folder-options' {Start-Process -FilePath 'rundll32.exe' -ArgumentList 'shell32.dll,Options_RunDLL 0';break}
   {$_ -in 'permissions','previous-versions'} {
    Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class ShellPages{[DllImport("shell32.dll",CharSet=CharSet.Unicode)]public static extern bool SHObjectProperties(IntPtr hwnd,uint flags,string path,string page);}'
    $page=if($payload.command -eq 'permissions'){'Security'}else{'Previous Versions'}
    if(-not [ShellPages]::SHObjectProperties([IntPtr]::Zero,2,$target,$page)){throw 'Windows could not open the property page.'};break
   }
   default {
    if($target -match '^[A-Za-z]:\\?$'){$item=$shell.Namespace(17).ParseName($target)}else{
     $folder=$shell.Namespace([IO.Path]::GetDirectoryName($target.TrimEnd('\')))
     if(-not $folder){throw 'Windows could not resolve the parent folder.'}
     $item=$folder.ParseName([IO.Path]::GetFileName($target.TrimEnd('\')))
    }
    if(-not $item){throw 'Windows could not resolve this item.'}
    switch([string]$payload.command){
     'print' {$item.InvokeVerb('print');break}
     'share' {$item.InvokeVerb('modernshare');break}
     'eject' {$item.InvokeVerb('Eject');break}
     'disconnect-drive' {$item.InvokeVerb('disconnect');break}
     'shortcut' {$desktop=[Environment]::GetFolderPath('Desktop');$name=[IO.Path]::GetFileName($target.TrimEnd('\'))+' - Shortcut.lnk';$destination=Join-Path $desktop $name;if(Test-Path -LiteralPath $destination){throw 'A shortcut with this name already exists.'};$ws=New-Object -ComObject WScript.Shell;$link=$ws.CreateShortcut($destination);$link.TargetPath=$target;$link.Save();break}
     default {throw 'Unsupported shell command.'}
    }
   }
  }
  'true';break
 }
 'drives' { @(Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName,DriveType,ProviderName,Size,FreeSpace) | ConvertTo-Json -Compress; break }
 'hidden' { @(Get-ChildItem -LiteralPath ([string]$payload.path) -Force | Where-Object {($_.Attributes -band [IO.FileAttributes]::Hidden) -or ($_.Attributes -band [IO.FileAttributes]::System)} | Select-Object -ExpandProperty Name) | ConvertTo-Json -Compress;break }
 'indexedSearch' {
  $scope=('file:'+([string]$payload.path)).Replace("'","''")
  $query=([string]$payload.query).Replace("'","''")
  $connection=New-Object -ComObject ADODB.Connection
  try{$connection.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';");$connection.CommandTimeout=15
   $recordset=$connection.Execute("SELECT TOP 5000 System.ItemPathDisplay FROM SYSTEMINDEX WHERE SCOPE='$scope' AND System.FileName LIKE '%$query%'")
   $paths=@();while(-not $recordset.EOF){$item=$recordset.Fields.Item(0).Value;if($item -and $item -isnot [DBNull]){$paths+=[string]$item};$recordset.MoveNext()}
   $recordset.Close();@{paths=$paths}|ConvertTo-Json -Compress
  }finally{if($connection.State -ne 0){$connection.Close()}};break
 }
 'clipboardWrite' {
  Add-Type -AssemblyName System.Windows.Forms
  $data=[Windows.Forms.DataObject]::new();$paths=[Collections.Specialized.StringCollection]::new()
  foreach($filePath in $payload.paths){[void]$paths.Add([string]$filePath)}
  $data.SetFileDropList($paths)
  $effect=[IO.MemoryStream]::new([BitConverter]::GetBytes([int]$(if($payload.move){2}else{1})))
  $data.SetData('Preferred DropEffect',$effect)
  [Windows.Forms.Clipboard]::SetDataObject($data,$true)
  'true'; break
 }
 'clipboardRead' {
  Add-Type -AssemblyName System.Windows.Forms
  $data=[Windows.Forms.Clipboard]::GetDataObject();$paths=@();$move=$false
  if($data -and $data.GetDataPresent([Windows.Forms.DataFormats]::FileDrop)){
   $paths=@($data.GetData([Windows.Forms.DataFormats]::FileDrop));$effect=$data.GetData('Preferred DropEffect')
   if($effect -is [IO.MemoryStream]){$bytes=$effect.ToArray();if($bytes.Length -ge 4){$move=([BitConverter]::ToInt32($bytes,0) -band 2) -ne 0}}
  }
  @{paths=$paths;move=$move}|ConvertTo-Json -Compress;break
 }
 'clipboardCommitMove' {
  Add-Type -AssemblyName System.Windows.Forms
  $current=@([Windows.Forms.Clipboard]::GetFileDropList());$expected=@($payload.paths);$object=[Windows.Forms.Clipboard]::GetDataObject();$effect=$object.GetData('Preferred DropEffect');$isMove=$effect -is [IO.MemoryStream] -and $effect.Length -ge 4 -and (([BitConverter]::ToInt32($effect.ToArray(),0) -band 2) -ne 0)
  if($isMove -and $current.Count -eq $expected.Count -and (@(Compare-Object $current $expected).Count -eq 0)){
   $remaining=@($expected | Where-Object {Test-Path -LiteralPath ([string]$_)})
   if(-not $remaining.Count){[Windows.Forms.Clipboard]::Clear()}else{$data=[Windows.Forms.DataObject]::new();$paths=[Collections.Specialized.StringCollection]::new();foreach($filePath in $remaining){[void]$paths.Add([string]$filePath)};$data.SetFileDropList($paths);$data.SetData('Preferred DropEffect',[IO.MemoryStream]::new([BitConverter]::GetBytes([int]2)));[Windows.Forms.Clipboard]::SetDataObject($data,$true)}
  }
  'true';break
 }
 'clipboardClear' {
  Add-Type -AssemblyName System.Windows.Forms
  $current=@([Windows.Forms.Clipboard]::GetFileDropList())
  $expected=@($payload.paths)
  if($current.Count -eq $expected.Count -and (@(Compare-Object $current $expected).Count -eq 0)){[Windows.Forms.Clipboard]::Clear()}
  'true';break
 }
 'nativeProperties' {
  Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class ShellProperties{[DllImport("shell32.dll",CharSet=CharSet.Unicode)]public static extern bool SHObjectProperties(IntPtr hwnd,uint flags,string path,string page);}'
  [void][ShellProperties]::SHObjectProperties([IntPtr]::Zero,2,[string]$payload.path,$null);'true';break
 }
 'openWith' {
  Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class ShellOpenWith{[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]public struct Info{[MarshalAs(UnmanagedType.LPWStr)]public string file;[MarshalAs(UnmanagedType.LPWStr)]public string type;public uint flags;}[DllImport("shell32.dll",CharSet=CharSet.Unicode)]public static extern int SHOpenWithDialog(IntPtr hwnd,ref Info info);}'
  $info=[ShellOpenWith+Info]::new();$info.file=[string]$payload.path;$info.flags=4
  [void][ShellOpenWith]::SHOpenWithDialog([IntPtr]::Zero,[ref]$info);'true';break
 }
 'interopProbe' {
  Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class ShellProbe{[DllImport("kernel32.dll",CharSet=CharSet.Unicode)]public static extern IntPtr LoadLibrary(string name);[DllImport("kernel32.dll",CharSet=CharSet.Ansi,ExactSpelling=true)]public static extern IntPtr GetProcAddress(IntPtr module,string name);}'
  $module=[ShellProbe]::LoadLibrary('shell32.dll')
  @{properties=([ShellProbe]::GetProcAddress($module,'SHObjectProperties') -ne [IntPtr]::Zero);openWith=([ShellProbe]::GetProcAddress($module,'SHOpenWithDialog') -ne [IntPtr]::Zero)}|ConvertTo-Json -Compress;break
 }
 default {throw 'Unsupported Windows operation.'}
}
