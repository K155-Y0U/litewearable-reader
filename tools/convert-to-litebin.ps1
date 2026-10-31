param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [string]$OutputPath = "",

    [int]$Size = 466
)

# Convert a PNG/JPG/BMP image to the Lite Wearable .bin image format used by
# ace-loader/lite-image2bin.js:
#   uint32 LE magic = 256
#   uint32 LE dimensions = width | (height << 16)
#   BGRA pixels, 4 bytes per pixel
#
# The watch does not decode PNG/JPG for internal://app backgrounds; send the
# generated .bin file through WearEngine instead.

Add-Type -AssemblyName System.Drawing

if ($Size -lt 1 -or $Size -gt 512) {
    throw "Size must be between 1 and 512."
}

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
if ([string]::IsNullOrEmpty($OutputPath)) {
    $OutputPath = [System.IO.Path]::ChangeExtension($resolvedInput, ".bin")
}
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)

$source = [System.Drawing.Image]::FromFile($resolvedInput)
$bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.DrawImage($source, 0, 0, $Size, $Size)
$graphics.Dispose()
$source.Dispose()

$rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
$locked = $bitmap.LockBits(
    $rect,
    [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$pixels = New-Object byte[] ($Size * $Size * 4)
[System.Runtime.InteropServices.Marshal]::Copy($locked.Scan0, $pixels, 0, $pixels.Length)
$bitmap.UnlockBits($locked)
$bitmap.Dispose()

$output = New-Object byte[] (8 + $pixels.Length)
# 256 in little-endian.
$output[0] = 0
$output[1] = 1
$output[2] = 0
$output[3] = 0
# width | (height << 16), little-endian.
$dimensions = [uint32]($Size -bor ($Size -shl 16))
$dimensionBytes = [System.BitConverter]::GetBytes($dimensions)
[System.Array]::Copy($dimensionBytes, 0, $output, 4, 4)
[System.Array]::Copy($pixels, 0, $output, 8, $pixels.Length)

$outputDir = [System.IO.Path]::GetDirectoryName($OutputPath)
if (-not [System.IO.Directory]::Exists($outputDir)) {
    [System.IO.Directory]::CreateDirectory($outputDir) | Out-Null
}
[System.IO.File]::WriteAllBytes($OutputPath, $output)

Write-Output ("Wrote {0} ({1}x{2}, {3} bytes)" -f $OutputPath, $Size, $Size, $output.Length)
