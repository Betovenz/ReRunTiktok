# จับภาพหน้าต่าง Rerun Studio → $args[0] (path png)
param([string]$Out = "C:\Users\Betovenz\AppData\Local\Temp\claude\rerun-capture.png")
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type @"
using System;using System.Runtime.InteropServices;
public class WCap{
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 public struct RECT{public int L,T,R,B;}
}
"@
$p = Get-Process -Name 'Rerun Studio' | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { "NO WINDOW"; exit 1 }
[void][WCap]::SetForegroundWindow($p.MainWindowHandle); Start-Sleep -Milliseconds 900
$r = New-Object WCap+RECT; [void][WCap]::GetWindowRect($p.MainWindowHandle, [ref]$r)
$w = $r.R - $r.L; $h = $r.B - $r.T
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
"saved $Out (${w}x${h})"
