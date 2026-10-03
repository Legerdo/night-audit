# Reusable helper: generate or edit one raster image with the Codex CLI built-in image_gen tool.
# Run it as a background process (generation takes 1-5 minutes):
#   powershell -ExecutionPolicy Bypass -File tools/imagegen/codex-image.ps1 -PromptFile art/prompts/x.txt -OutFile art/raw/x/normal_v1.png
#   powershell -ExecutionPolicy Bypass -File tools/imagegen/codex-image.ps1 -PromptFile art/prompts/x_edit.txt -OutFile art/raw/x/anomaly_v1.png -RefImage art/raw/x/normal_v1.png
param(
  [Parameter(Mandatory = $true)][string]$PromptFile,
  [Parameter(Mandatory = $true)][string]$OutFile,
  [string]$RefImage = ""
)
$ErrorActionPreference = "Stop"
$codexJs = Join-Path $env:APPDATA "npm\node_modules\@openai\codex\bin\codex.js"
if (-not (Test-Path $codexJs)) { throw "Codex CLI not found at $codexJs" }

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$outAbs = Join-Path $root $OutFile
New-Item -ItemType Directory -Force -Path (Split-Path $outAbs -Parent) | Out-Null
$logFile = "$outAbs.log.txt"

# Windows PowerShell 5.1 mangles embedded double quotes in native arguments; normalise them.
$body = (Get-Content -Raw -Encoding UTF8 (Join-Path $root $PromptFile)) -replace '"', "'"
$rel = $OutFile -replace '\\', '/'
if ($RefImage -ne "") {
  $instr = "Edit the attached image with your built-in image_gen tool, using the attached image as the edit input/reference. " +
    "Do not write code or use any other tool to draw or modify pixels. EDIT INSTRUCTIONS: " + $body +
    " Save the resulting PNG to $rel (relative to the current working directory). Do not overwrite the input image. Reply only with the saved path."
} else {
  $instr = "Use your built-in image_gen tool to create this image. Do not write code or use any other tool to draw the image. IMAGE BRIEF: " + $body +
    " Save the resulting PNG to $rel (relative to the current working directory). Reply only with the saved path."
}

Set-Location $root
$argsList = @($codexJs, "exec", "--skip-git-repo-check", "-s", "workspace-write", $instr)
if ($RefImage -ne "") {
  $refAbs = (Resolve-Path (Join-Path $root $RefImage)).Path
  $argsList += @("-i", $refAbs)
}
# Codex writes progress to stderr; in Windows PowerShell that must not be treated as a terminating error.
$ErrorActionPreference = "Continue"
& node @argsList 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath $logFile
if (Test-Path $outAbs) { Write-Output "IMAGEGEN_OK $OutFile" } else { Write-Output "IMAGEGEN_MISSING $OutFile" }
