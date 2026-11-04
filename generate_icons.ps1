Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::FromFile('E:\FIARAM NOMERIKA\src\FIARAM NOMERIKA.png')
$max = [math]::Max($src.Width, $src.Height)
$crop = New-Object System.Drawing.Rectangle (( $src.Width-$max )/2 ,( $src.Height-$max )/2 , $max , $max)
$cropBmp = $src.Clone($crop,([System.Drawing.Imaging.PixelFormat])$src.PixelFormat)

$bData = $cropBmp.LockBits(new System.Drawing.Rectangle(0,0,$max,$max),
                           System.Drawing.Imaging.ImageLockMode.ReadOnly,
                           System.Drawing.Imaging.PixelFormat.Format32bppArgb)
$bStride = $bData.Stride;  $bScan0 = $bData.Scan0;  $bLen = $bStride * $max
$bPixels = New-Object byte[] $bLen
[System.Runtime.InteropServices.Marshal]::Copy($bScan0,$bPixels,0,$bLen)
$cropBmp.UnlockBits($bData)

for ($y=0;$y -lt $max;$y++) {
  $row = $y * $bStride
  for ($x=0;$x -lt $max;$x++) {
    $i = $row + $x*4
    $r = $bPixels[$i];    $g = $bPixels[$i+1];    $bcol= $bPixels[$i+2];    $a   = $bPixels[$i+3]
    if ($r -gt 245 -and $g -gt 245 -and $bcol -gt 245 -and $a -gt 10) {
       $bPixels[$i+3] = 0   # transparent
    }
  }
}

$out = New-Object System.Drawing.Bitmap($max,$max,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.DrawImage($cropBmp,0,0)

@{'mdpi'=48;'hdpi'=72;'xhdpi'=96;'xxhdpi'=144;'xxxhdpi'=192} | %{
  $sz = $_.Value
  $out.SaveFile("E:\FIARAM NOMERIKA\android\app\src\main\res\mipmap-$_\\ic_launcher.png")
  $out.SaveFile("E:\FIARAM NOMERIKA\android\app\src\main\res\mipmap-$_\\ic_launcher_foreground.png")
  $out.SaveFile("E:\FIARAM NOMERIKA\android\app\src\main\res\mipmap-$_\\ic_launcher_round.png")
}
$g.Dispose(); $cropBmp.Dispose(); $src.Dispose()
Write-Host "Icons generated successfully."