param(
  [string]$Username,
  [string]$ApiKey
)

$ErrorActionPreference = "Stop"

function Get-EnvValue {
  param([string]$Key)
  if (-not (Test-Path ".env")) { return $null }
  $lines = Get-Content ".env" -ErrorAction SilentlyContinue
  foreach ($line in $lines) {
    if ($line -match "^\s*$Key\s*=\s*(.+)\s*$") {
      return $Matches[1].Trim()
    }
  }
  return $null
}

if (-not $Username) { $Username = Get-EnvValue "RA_USERNAME" }
if (-not $ApiKey) { $ApiKey = Get-EnvValue "RA_API_KEY" }

if (-not $Username -or -not $ApiKey) {
  Write-Error "Missing RA_USERNAME or RA_API_KEY. Provide parameters or set them in .env."
  exit 1
}

$base = "https://retroachievements.org/API/"
$headers = @{ "User-Agent" = "ra-cache-script" }

function Invoke-Ra {
  param(
    [string]$Endpoint,
    [hashtable]$Params,
    [switch]$IncludeUser
  )
  $pairs = @()
  $pairs += "y=$([uri]::EscapeDataString($ApiKey))"
  if ($IncludeUser -and $Username) {
    $pairs += "u=$([uri]::EscapeDataString($Username))"
  }
  foreach ($key in $Params.Keys) {
    $value = $Params[$key]
    $pairs += "$key=$([uri]::EscapeDataString($value))"
  }
  $url = $base + $Endpoint + "?" + ($pairs -join "&")
  Write-Host "Request: $url"
  try {
    return Invoke-RestMethod -Uri $url -Headers $headers -Method Get
  } catch {
    Write-Host "Request failed: $url"
    throw
  }
}

New-Item -ItemType Directory -Force -Path "assets\\console-icons" | Out-Null
New-Item -ItemType Directory -Force -Path "assets\\achievement-badges" | Out-Null
New-Item -ItemType Directory -Force -Path "assets\\cache" | Out-Null

Write-Host "Fetching console list..."
$consoles = Invoke-Ra -Endpoint "API_GetConsoleIDs.php" -Params @{ a = 1 }
$consoleCache = @()
foreach ($console in $consoles) {
  $id = $console.ID
  $name = $console.Name
  $iconUrl = $console.IconURL
  if ($iconUrl) {
    $target = "assets\\console-icons\\$id.png"
    if (-not (Test-Path $target)) {
      Invoke-WebRequest -Uri $iconUrl -OutFile $target -Headers $headers -Method Get | Out-Null
    }
  }
  $consoleCache += [ordered]@{
    id = $id
    name = $name
    icon = "assets/console-icons/$id.png"
  }
}
$consoleCache | ConvertTo-Json -Depth 3 | Set-Content -Path "assets\\cache\\consoles.json"

Write-Host "Fetching profile for member since date..."
$profile = Invoke-Ra -Endpoint "API_GetUserProfile.php" -Params @{} -IncludeUser
$memberSince = $profile.MemberSince
$fromEpoch = if ($memberSince) {
  [int][double](([datetime]$memberSince).ToUniversalTime() - [datetime]'1970-01-01').TotalSeconds
} else {
  [int][double](([datetime]::UtcNow.AddYears(-10)) - [datetime]'1970-01-01').TotalSeconds
}
$toEpoch = [int][double](([datetime]::UtcNow) - [datetime]'1970-01-01').TotalSeconds

Write-Host "Fetching achievements earned between $fromEpoch and $toEpoch..."
$badgeSet = New-Object System.Collections.Generic.HashSet[string]
$achievementMap = @{}
$chunkDays = 180
$chunkSeconds = $chunkDays * 86400
$cursor = $fromEpoch
while ($cursor -lt $toEpoch) {
  $chunkStart = $cursor
  $chunkEnd = [Math]::Min($cursor + $chunkSeconds, $toEpoch)
  Write-Host " - Range $chunkStart to $chunkEnd"
  $achievements = Invoke-Ra -Endpoint "API_GetAchievementsEarnedBetween.php" -Params @{ f = $chunkStart; t = $chunkEnd } -IncludeUser
  foreach ($achievement in $achievements) {
    $badgeName = $achievement.BadgeName
    if ($badgeName) {
      $badgeSet.Add($badgeName) | Out-Null
      $badgeTarget = "assets\\achievement-badges\\$badgeName.png"
      if (-not (Test-Path $badgeTarget) -and $achievement.BadgeURL) {
        $badgeUrl = "https://media.retroachievements.org$($achievement.BadgeURL)"
        Invoke-WebRequest -Uri $badgeUrl -OutFile $badgeTarget -Headers $headers -Method Get | Out-Null
      }
    }
    $key = "$($achievement.AchievementID)"
    $achievementMap[$key] = [ordered]@{
      id = $achievement.AchievementID
      title = $achievement.Title
      gameTitle = $achievement.GameTitle
      gameId = $achievement.GameID
      badgeName = $badgeName
      points = $achievement.Points
      date = $achievement.Date
    }
  }
  $cursor = $chunkEnd + 1
}

Write-Host "Fetching recent achievements to catch latest unlocks..."
$recent = Invoke-Ra -Endpoint "API_GetUserRecentAchievements.php" -Params @{ m = 1440 } -IncludeUser
foreach ($achievement in $recent) {
  $badgeName = $achievement.BadgeName
  if ($badgeName) {
    $badgeSet.Add($badgeName) | Out-Null
    $badgeTarget = "assets\\achievement-badges\\$badgeName.png"
    if (-not (Test-Path $badgeTarget) -and $achievement.BadgeURL) {
      $badgeUrl = "https://media.retroachievements.org$($achievement.BadgeURL)"
      Invoke-WebRequest -Uri $badgeUrl -OutFile $badgeTarget -Headers $headers -Method Get | Out-Null
    }
  }
  $key = "$($achievement.AchievementID)"
  $achievementMap[$key] = [ordered]@{
    id = $achievement.AchievementID
    title = $achievement.Title
    gameTitle = $achievement.GameTitle
    gameId = $achievement.GameID
    badgeName = $badgeName
    points = $achievement.Points
    date = $achievement.Date
  }
}

$badgeList = @()
foreach ($badge in $badgeSet) { $badgeList += $badge }
@{ badges = $badgeList } | ConvertTo-Json -Depth 3 | Set-Content -Path "assets\\cache\\achievement-badges.json"
$achievementMap | ConvertTo-Json -Depth 4 | Set-Content -Path "assets\\cache\\achievements.json"

Write-Host "Cache updated:"
Write-Host " - assets\\console-icons"
Write-Host " - assets\\achievement-badges"
Write-Host " - assets\\cache\\consoles.json"
Write-Host " - assets\\cache\\achievement-badges.json"
Write-Host " - assets\\cache\\achievements.json"
