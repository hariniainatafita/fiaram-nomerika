Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot
$sourcePath = Join-Path $root 'src\tld-logo.png'
$src = [System.Drawing.Bitmap]::FromFile($sourcePath)

# Detecte la zone utile du logo (le cercle dore) en ignorant le fond noir.
$minX = $src.Width; $minY = $src.Height; $maxX = 0; $maxY = 0
for ($y = 0; $y -lt $src.Height; $y += 2) {
  for ($x = 0; $x -lt $src.Width; $x += 2) {
    $c = $src.GetPixel($x, $y)
    if (($c.R + $c.G + $c.B) -gt 110) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}

$pad = 6
$minX = [math]::Max(0, $minX - $pad)
$minY = [math]::Max(0, $minY - $pad)
$maxX = [math]::Min($src.Width - 1, $maxX + $pad)
$maxY = [math]::Min($src.Height - 1, $maxY + $pad)

$side = [math]::Max($maxX - $minX + 1, $maxY - $minY + 1)
$cropX = [math]::Max(0, [math]::Floor(($minX + $maxX - $side + 1) / 2))
$cropY = [math]::Max(0, [math]::Floor(($minY + $maxY - $side + 1) / 2))
$side = [math]::Min($side, [math]::Min($src.Width - $cropX, $src.Height - $cropY))
$cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $side, $side)
$crop = $src.Clone($cropRect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

function New-RoundIcon {
  param(
    [System.Drawing.Bitmap]$Source,
    [int]$Size,
    [double]$InsetPercent
  )
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $inset = [int]($Size * $InsetPercent)
  $drawSize = $Size - (2 * $inset)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse($inset, $inset, $drawSize, $drawSize)
  $g.SetClip($path)
  $g.DrawImage($Source, $inset, $inset, $drawSize, $drawSize)
  $g.ResetClip()

  $path.Dispose()
  $g.Dispose()
  return $bmp
}

function Save-Icon {
  param([System.Drawing.Bitmap]$Source, [string]$Path, [int]$Size, [double]$InsetPercent = 0.02)
  $dir = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  $icon = New-RoundIcon -Source $Source -Size $Size -InsetPercent $InsetPercent
  $icon.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $icon.Dispose()
}

# Logos web / PWA / application embarquee
Save-Icon $crop (Join-Path $root 'public\logo.png') 512 0.03
Save-Icon $crop (Join-Path $root 'public\logo-192.png') 192 0.03
Save-Icon $crop (Join-Path $root 'public\logo-512.png') 512 0.03
Save-Icon $crop (Join-Path $root 'public\logo-maskable-512.png') 512 0.10
Save-Icon $crop (Join-Path $root 'src\assets\logo.png') 512 0.03

# Icones Android (lanceur classique / rondes / adaptatives)
$launcherSizes = @{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
$foregroundSizes = @{ 'mdpi' = 108; 'hdpi' = 162; 'xhdpi' = 216; 'xxhdpi' = 324; 'xxxhdpi' = 432 }
foreach ($kv in $launcherSizes.GetEnumerator()) {
  $dir = Join-Path $root "android\app\src\main\res\mipmap-$($kv.Key)"
  Save-Icon $crop (Join-Path $dir 'ic_launcher.png') $kv.Value 0.03
  Save-Icon $crop (Join-Path $dir 'ic_launcher_round.png') $kv.Value 0.03
}
foreach ($kv in $foregroundSizes.GetEnumerator()) {
  $dir = Join-Path $root "android\app\src\main\res\mipmap-$($kv.Key)"
  Save-Icon $crop (Join-Path $dir 'ic_launcher_foreground.png') $kv.Value 0.18
}

# Ecrans de demarrage Android : fond sombre + nouveau logo dore.
$splashFiles = Get-ChildItem -Path (Join-Path $root 'android\app\src\main\res') -Recurse -Filter 'splash.png'
foreach ($splashFile in $splashFiles) {
  $old = [System.Drawing.Image]::FromFile($splashFile.FullName)
  $w = $old.Width
  $h = $old.Height
  $old.Dispose()

  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#070d1e'))

  $min = [math]::Min($w, $h)
  $iconSize = [int]($min * 0.32)
  $icon = New-RoundIcon -Source $crop -Size $iconSize -InsetPercent 0.02
  $iconX = [int](($w - $iconSize) / 2)
  $iconY = [int](($h - $iconSize) / 2 - $min * 0.06)
  $g.DrawImage($icon, $iconX, $iconY, $iconSize, $iconSize)

  $titleFont = New-Object System.Drawing.Font('Arial', [math]::Max(14, [int]($min * 0.06)), [System.Drawing.FontStyle]::Bold)
  $subtitleFont = New-Object System.Drawing.Font('Arial', [math]::Max(9, [int]($min * 0.03)), [System.Drawing.FontStyle]::Regular)
  $goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#d4af37'))
  $mutedBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#94a3b8'))
  $center = New-Object System.Drawing.StringFormat
  $center.Alignment = [System.Drawing.StringAlignment]::Center
  $titleY = [single](($h + $iconSize) / 2 - $min * 0.03)
  $titleH = [single]($min * 0.1)
  $subY = [single]($titleY + ($min * 0.075))
  $subH = [single]($min * 0.07)
  $titleRect = New-Object System.Drawing.RectangleF -ArgumentList 0, $titleY, $w, $titleH
  $subRect = New-Object System.Drawing.RectangleF -ArgumentList 0, $subY, $w, $subH
  $g.DrawString('Pro-Num-TLD', $titleFont, $goldBrush, $titleRect, $center)
  $g.DrawString('Projet numerique TafLeaDer', $subtitleFont, $mutedBrush, $subRect, $center)

  $center.Dispose()
  $goldBrush.Dispose()
  $mutedBrush.Dispose()
  $titleFont.Dispose()
  $subtitleFont.Dispose()
  $icon.Dispose()
  $g.Dispose()
  $bmp.Save($splashFile.FullName, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$crop.Dispose()
$src.Dispose()
Write-Host "Logos, icones et ecrans de demarrage generes depuis src/tld-logo.png."
