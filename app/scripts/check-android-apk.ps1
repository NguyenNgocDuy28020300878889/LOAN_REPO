param(
    [Parameter(Mandatory = $true)][string]$Apk,
    [ValidateSet('development', 'staging', 'production')][string]$AppEnvironment = 'staging',
    [string]$SdkRoot = $env:ANDROID_HOME,
    [string]$JavaExecutable = 'java'
)
$ErrorActionPreference = 'Stop'
$apkPath = (Get-Item -LiteralPath $Apk).FullName
if ([IO.Path]::GetExtension($apkPath) -ne '.apk') { throw 'An APK file is required.' }
if (-not $SdkRoot) { $SdkRoot = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$buildTools = Get-ChildItem -LiteralPath (Join-Path $SdkRoot 'build-tools') -Directory |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
    Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if (-not $buildTools) { throw 'Android SDK build-tools are required.' }
$aapt = Join-Path $buildTools.FullName 'aapt.exe'
$signer = Join-Path $buildTools.FullName 'lib/apksigner.jar'
$signature = & $JavaExecutable -jar $signer verify --verbose $apkPath 2>&1
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
$badging = & $aapt dump badging $apkPath
if ($LASTEXITCODE -ne 0) { throw 'Cannot read APK package metadata.' }
$manifest = (& $aapt dump xmltree $apkPath AndroidManifest.xml) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'Cannot read APK manifest.' }
$suffix = if ($AppEnvironment -eq 'production') { '' } elseif ($AppEnvironment -eq 'staging') { '.staging' } else { '.dev' }
$expectedPackage = 'com.loanappmobiles.loanapp' + $suffix
$expectedScheme = if ($AppEnvironment -eq 'production') { 'loan' } else { 'loan-' + $AppEnvironment }
$packageLine = $badging | Where-Object { $_ -like 'package:*' } | Select-Object -First 1
if ($packageLine -notmatch ("name='" + [regex]::Escape($expectedPackage) + "'")) { throw 'Unexpected application package.' }
if ($manifest -notmatch 'android:allowBackup[^\r\n]*\(type 0x12\)0x0\b') { throw 'Backup is not explicitly disabled.' }
if ($manifest -match 'android:debuggable[^\r\n]*\(type 0x12\)0xffffffff') { throw 'APK is debuggable.' }
$permissions = @($badging | Where-Object { $_ -like 'uses-permission:*' })
foreach ($forbidden in @('SYSTEM_ALERT_WINDOW', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE')) {
    if ($permissions -match [regex]::Escape('android.permission.' + $forbidden)) { throw "Forbidden permission: $forbidden" }
}
$schemes = @([regex]::Matches($manifest, 'android:scheme[^\r\n]*?="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
if ($expectedScheme -notin $schemes) { throw 'Expected application scheme is missing.' }
if ($AppEnvironment -ne 'development' -and ($schemes -match '^exp\+')) { throw 'Development scheme leaked into release profile.' }
[pscustomobject]@{
    File = $apkPath
    SHA256 = (Get-FileHash -LiteralPath $apkPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Package = $expectedPackage
    Environment = $AppEnvironment
    SignatureVerified = $true
    BackupDisabled = $true
    Schemes = $schemes
    Permissions = $permissions
    Scope = 'Static APK checks only; device, backend and 16 KB runtime acceptance remain separate.'
} | ConvertTo-Json -Depth 3
