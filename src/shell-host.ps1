param([string]$PayloadBase64)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$sourcePath=Join-Path $PSScriptRoot 'shell-host.cs'
Add-Type -Path $sourcePath -ReferencedAssemblies System.Windows.Forms,System.Drawing,System.Web.Extensions
$json=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64))
[NothingExplorer.ShellHost]::Run($json)
