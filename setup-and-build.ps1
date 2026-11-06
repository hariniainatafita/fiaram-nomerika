<#=====================================================================
  setup-and-build.ps1
  - Installe JDK 17
  - Installe Android SDK (plateforme 35 + build‑tools 35.0.2)
  - Génère les icônes Android à partir de src/FIARAM NOMERIKA.png
  - Compile l’APK debug (gradlew assembleDebug)
  - Installe l’APK sur l’appareil USB (adb install -r)
  Auteur : assistente IA – version 2026‑11‑05
=====================================================================#>

# -------------------------------------------------
# 0. Helper: écrire dans le journal (optionnel)
function Write-Log {
    param([string]$Message)
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "[$ts] $Message"
    # Optionnel : ajouter à un fichier de log
    # Add-Content -Path "$env:USERPROFILE\setup-build.log" -Value "[$ts] $Message"
}

# -------------------------------------------------
# 1. Vérifier que nous sommes en mode administrateur
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.BuiltInRole] "Administrator")) {
    Write-Log "⚠️  Ce script nécessite les droits d’administrateur. Relancez‑le en clic droit → “Exécuter en tant qu’administrateur”."
    exit 1
}

# -------------------------------------------------
# 2. Installer JDK 17
Write-Log "--- Étape 1 : Installation de JDK 17 ---"
if (Get-Command winget.exe -ErrorAction SilentlyContinue) {
    Write-Log "winget détecté, installation de JDK 17..."
    winget install --id EclipseAdoptium.Temurin.17.JDK --silent --accept-package-agreements
}
else {
    Write-Log "⚠️ winget non disponible – je propose un téléchargement manuel."
    Write-Host "Téléchargez Temurin 17 depuis https://adoptium.net/ et lancez l’installeur."
    Write-Host "Après installation, revenez ici et appuyez sur <Entrée>."
    $null = Read-Host
}

# S’assurer que JAVA_HOME existe
$jdkPath = (Get-ChildItem "C:\Program Files\EclipseAdoptium\Temurin-17*" -Directory -ErrorAction SilentlyContinue |
            Select-Object -First 1 FullName)
if (-NOT $jdkPath) {
    # Essai alternatif via la variable d’environnement déjà existante
    $jdkPath = $env:JAVA_HOME
}
if (-NOT $jdkPath) {
    Write-Log "❌ Impossible de détecter le dossier JDK. Vérifiez JAVA_HOME et ré‑exécutez le script."
    exit 1
}
Write-Log "JDK trouvé : $jdkPath"

# Création des variables système (persistantes)
if (-NOT [Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")) {
    [Environment]::SetEnvironmentVariable("JAVA_HOME", $jdkPath, "Machine")
    Write-Log "Variable JAVA_HOME (Machine) créée."
}
else {
    Write-Log "JAVA_HOME déjà définie : $env:JAVA_HOME"
}
# S’assurer que le PATH inclut le bin du JDK
$pathEntry = ";$jdkPath\bin"
if (-NOT $env:PATH.Contains("$jdkPath\bin")) {
    $newPath = $env:PATH + $pathEntry
    [Environment]::SetEnvironmentVariable("PATH", $newPath, "Machine")
    Write-Log "PATH mis à jour pour inclure $jdkPath\bin"
}

# -------------------------------------------------
# 3. Installer Android SDK (command‑line tools)
Write-Log "--- Étape 2 : Installation du Android SDK ---"
$androidSdkRoot = "C:\Android\Sdk"
if (-NOT (Test-Path $androidSdkRoot)) {
    Write-Log "SDK introuvable – tentative d’installation via winget..."
    if (Get-Command winget.exe -ErrorAction SilentlyContinue) {
        winget install --id Google.AndroidSDK --silent --accept-package-agreements
    }
    else {
        Write-Log "⚠️ winget non disponible – vous devez installer le SDK manuellement."
        Write-Host "Téléchargez le SDK Command‑line Tools ici : https://developer.android.com-studio#command-tools"
        Write-Host "Décompressez‑le dans C:\Android\Sdk et re‑lancez le script."
        $null = Read-Host "Appuyez sur Entrée pour quitter."
        exit 1
    }
}
# S’assurer que les sous‑dossiers existent
if (-NOT (Test-Path "$androidSdkRoot\tools")) { mkdir "$androidSdkRoot\tools" | Out-Null }
if (-NOT (Test-Path "$androidSdkRoot\tools\bin")) { mkdir "$androidSdkRoot\tools\bin" | Out-Null }

# Définir ANDROID_HOME et ANDROID_SDK_ROOT
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $androidSdkRoot, "Machine")
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $androidSdkRoot, "Machine")
# Mise à jour du PATH (ajout des dossiers bin)
$adbPath = "$androidSdkRoot\platform-tools"
if (-NOT $env:PATH.Contains($adbPath)) {
    $newPath = $env:PATH + ";$adbPath"
    [Environment]::SetEnvironmentVariable("PATH", $newPath, "Machine")
    Write-Log "PATH mis à jour avec $adbPath"
}

# -------------------------------------------------
# 4. Installer les composants requis (platform‑api 35 + build‑tools 35.0.2)
Write-Log "--- Étape 3 : Installation des outils Android requis ---"
# Utiliser sdkmanager si dispo, sinon appeler directement le jar
$sdkmanager = Join-Path $androidSdkRoot "tools\bin\sdkmanager.bat"
if (Test-Path $sdkmanager) {
    Write-Log "Exécution de sdkmanager..."
    & $sdkmanager "platforms;android-35" "build-tools;35.0.2"
}
else {
    # Fallback : utiliser le dossier cmdline-tools latest
    $cmdDir = Join-Path $androidSdkRoot "cmdline-tools\latest"
    if (-NOT (Test-Path $cmdDir)) {
        Write-Log "⚠️ Dossier cmdline-tools introuvable – installation manuelle requise."
        Write-Host "Téléchargez latest cmdline-tools depuis la console Android et décompressez‑le dans $cmdDir."
        $null = Read-Host "Appuyez sur Entrée pour quitter."
        exit 1
    }
    # On suppose que le binaire `sdkmanager` se trouve maintenant dans %ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat
    & Join-Path $cmdDir "bin\sdkmanager.bat" "platforms;android-35" "build-tools;35.0.2"
}

# -------------------------------------------------
# 5. Générer les icônes Android
Write-Log "--- Étape 4 : Génération des icônes Android ---"
# On réutilise le script précédent (copie inline pour éviter un fichier externe)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("E:\FIARAM NOMERIKA\src\FIARAM NOMERIKA.png")
$max = [math]::Max($img.Width, $img.Height)
$cropX = [math]::Floor(($img.Width - $max) / 2)
$cropY = [math]::Floor(($img.Height - $max) / 2)
$crop = New-Object System.Drawing.Rectangle($cropX, $cropY, $max, $max)
$cropImg = $img.Clone($crop, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

$bData = $cropImg.LockBits(New-Object System.Drawing.Rectangle(0,0,$max,$max),
    [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $bData.Stride
$scan0 = $bData.Scan0
$pixels = New-Object byte[] $stride * $max
[System.Runtime.InteropServices.Marshal]::Copy($scan0, $pixels, 0, $pixels.Length)
$cropImg.UnlockBits($bData)

for ($y = 0; $y -lt $max; $y++) {
    $row = $y * $stride
    for ($x = 0; $x -lt $max; $x++) {
        $i = $row + $x * 4
        $r = $pixels[$i]
        $g = $pixels[$i+1]
        $bcol = $pixels[$i+2]
        $a = $pixels[$i+3]
        if ($r -gt 245 -and $g -gt 245 -and $bcol -gt 245 -and $a -gt 10) {
            $pixels[$i+3] = 0
        }
    }
}
[System.Runtime.InteropServices.Marshal]::Copy($pixels, 0, $pixels.Length, $pixels)

$outImg = New-Object System.Drawing.Bitmap($max, $max, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($outImg)
$g.DrawImage($cropImg, 0, 0)

$densities = @{
    'mdpi'    = 48
    'hdpi'    = 72
    'xhdpi'   = 96
    'xxhdpi'  = 144
    'xxxhdpi' = 192
}
foreach ($kv in $densities) {
    $name  = $kv.Key
    $sz    = $kv.Value
    $resized = $outImg.GetThumbnailImage($sz, $sz, $null, $null)
    $resized.SaveFile("E:\FIARAM NOMERIKA\android\app\src\main\res\mipmap-$name\ic_launcher.png")
    $resized.SaveFile("E:\FIARAM NOMERIKA\android\app\src\main\res\mipmap-$name\ic_launcher_foreground.png")
    $resized.SaveFile("E:\FIARAM NOMERIKA\android\app\src\main\res\mipmap-$name\ic_launcher_round.png")
}
$g.Dispose()
$img.Dispose()
Write-Log "✅ Icônes générées pour : $($densities.Keys -join ', ')"

# -------------------------------------------------
# 6. Compilation de l’APK debug
Write-Log "--- Étape 5 : Compilation de l’APK debug ---"
# Reconstruit les fichiers web puis les copie dans le projet Android AVANT
# Gradle : sans cette étape l’APK peut embarquer une ancienne interface même
# si le site web affiche déjà les nouveautés.
Write-Log "--- Étape 4b : Build web + synchronisation Capacitor ---"
Push-Location "E:\FIARAM NOMERIKA"
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build a échoué" }
    npx cap sync android
    if ($LASTEXITCODE -ne 0) { throw "npx cap sync android a échoué" }
}
catch {
    Write-Log "❌ $($_.Exception.Message)"
    Pop-Location
    exit 1
}
Pop-Location

# On lance gradle depuis le répertoire android
$gradlew = "E:\FIARAM NOMERIKA\android\gradlew.bat"
if (-NOT (Test-Path $gradlew)) {
    Write-Log "❌ Fichier introuvable : $gradlew"
    exit 1
}
Write-Log "Lancement de `.\android\gradlew.bat assembleDebug`..."
& $gradlew "assembleDebug"

# Vérifier que l’APK a été créé
$apkPath = "E:\FIARAM NOMERIKA\android\app\build\outputs\apk\debug\app-debug.apk"
if (-NOT (Test-Path $apkPath)) {
    Write-Log "❌ L’APK n’a pas été produit. Vérifiez les erreurs ci‑dessus."
    exit 1
}
Write-Log "✅ APK créé : $apkPath"

# -------------------------------------------------
# 7. Installer l’APK sur l’appareil USB
Write-Log "--- Étape 6 : Installation de l’APK sur l’appareil ---"
# Vérifier adb
if (-NOT (Get-Command adb.exe -ErrorAction SilentlyContinue)) {
    Write-Log "⚠️ adb introuvable – assurez‑vous que le SDK Platform‑tools est dans le PATH."
    $null = Read-Host "Appuyez sur Entrée pour quitter."
    exit 1
}
Write-Log "Installation de l’APK sur l’appareil connecté..."
& adb install -r $apkPath

# Message final
Write-Log "🎉 Tout est prêt ! L’application debug est installée."
Write-Log "Vous pouvez maintenant lancer l’app depuis le menu Android."
Write-Log "La bannière “Mise à jour disponible” apparaîtra si la version précédente < 3."
Write-Host "Fin du script. Bonne compilation !"