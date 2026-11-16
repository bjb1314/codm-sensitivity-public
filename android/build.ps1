$ErrorActionPreference='Stop'
$androidSdk=$env:ANDROID_SDK_ROOT
if (-not $androidSdk) { $androidSdk=$env:ANDROID_HOME }
if (-not $androidSdk) { throw 'Set ANDROID_SDK_ROOT to the Android SDK directory' }
$buildTools=Join-Path $androidSdk 'build-tools\36.0.0'
$androidJar=Join-Path $androidSdk 'platforms\android-36.1\android.jar'
$javaHome=$env:JAVA_HOME
if (-not $javaHome) { throw 'Set JAVA_HOME to a JDK directory' }
$env:JAVA_HOME=$javaHome
$env:PATH="$javaHome\bin;$env:PATH"
New-Item -ItemType Directory -Force res,build,build\classes,build\dex | Out-Null
& "$buildTools\aapt.exe" package -f -M AndroidManifest.xml -S res -A assets -I $androidJar -F build\base.apk
if ($LASTEXITCODE -ne 0) { throw 'aapt failed' }
& "$javaHome\bin\javac.exe" -encoding UTF-8 -source 8 -target 8 -bootclasspath $androidJar -d build\classes src\com\shougankedu\codm\MainActivity.java
if ($LASTEXITCODE -ne 0) { throw 'javac failed' }
$classFiles=Get-ChildItem build\classes -Recurse -Filter '*.class' | ForEach-Object { $_.FullName }
& "$buildTools\d8.bat" --min-api 24 --lib $androidJar --output build\dex $classFiles
if ($LASTEXITCODE -ne 0) { throw 'd8 failed' }
Copy-Item build\base.apk build\unsigned.apk -Force
Push-Location build\dex
try { & "$buildTools\aapt.exe" add ..\unsigned.apk classes.dex; if ($LASTEXITCODE -ne 0) { throw 'add dex failed' } } finally { Pop-Location }
& "$buildTools\zipalign.exe" -f 4 build\unsigned.apk build\aligned.apk
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }
& "$buildTools\apksigner.bat" sign --ks "$env:USERPROFILE\.android\debug.keystore" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out build\shougankedu-codm-landscape.apk build\aligned.apk
if ($LASTEXITCODE -ne 0) { throw 'sign failed' }
& "$buildTools\apksigner.bat" verify --verbose build\shougankedu-codm-landscape.apk
if ($LASTEXITCODE -ne 0) { throw 'verification failed' }
