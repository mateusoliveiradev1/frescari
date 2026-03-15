param(
    [string]$RedisUrl,
    [string]$RedisCliCommand,
    [string]$RedisHost,
    [string]$RedisPort,
    [string]$RedisPassword,
    [string]$RedisUsername = "default",
    [switch]$PersistRedisUrl,
    [switch]$RunOnce,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ProjectRoot {
    return Split-Path -Parent $PSScriptRoot
}

function Get-EnvValueFromFile {
    param(
        [string]$Path,
        [string]$Name
    )

    if (-not (Test-Path $Path)) {
        return $null
    }

    $lines = Get-Content $Path

    foreach ($line in $lines) {
        if (($line -match '^\s*$') -or ($line -match '^\s*#')) {
            continue
        }

        $parts = $line -split '=', 2

        if ($parts.Count -ne 2) {
            continue
        }

        $key = $parts[0].Trim()
        $value = $parts[1].Trim()

        if ($key -ne $Name) {
            continue
        }

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            return $value.Substring(1, $value.Length - 2)
        }

        return $value
    }

    return $null
}

function Read-RequiredValue {
    param(
        [string]$Prompt
    )

    while ($true) {
        $value = Read-Host -Prompt $Prompt

        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value.Trim()
        }

        Write-Host "[WARN] Valor obrigatorio." -ForegroundColor Yellow
    }
}

function Build-RedisUrl {
    param(
        [string]$RedisHost,
        [string]$RedisPort,
        [string]$RedisPassword,
        [string]$RedisUsername,
        [string]$Scheme = "redis"
    )

    $encodedUsername = [System.Uri]::EscapeDataString($RedisUsername)
    $encodedPassword = [System.Uri]::EscapeDataString($RedisPassword)

    return "$($Scheme)://$encodedUsername`:$encodedPassword@$($RedisHost):$($RedisPort)"
}

function Trim-OptionalQuotes {
    param(
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $Value
    }

    $trimmed = $Value.Trim()

    if (($trimmed.StartsWith('"') -and $trimmed.EndsWith('"')) -or ($trimmed.StartsWith("'") -and $trimmed.EndsWith("'"))) {
        return $trimmed.Substring(1, $trimmed.Length - 2)
    }

    return $trimmed
}

function Parse-RedisCliCommand {
    param(
        [string]$Command
    )

    $result = @{
        RedisUrl = $null
        RedisHost = $null
        RedisPort = $null
        RedisPassword = $null
        RedisUsername = $null
        Scheme = "redis"
    }

    if ([string]::IsNullOrWhiteSpace($Command)) {
        return $result
    }

    $tokens = [regex]::Matches($Command, '("[^"]*"|''[^'']*''|\S+)') | ForEach-Object { $_.Value }

    for ($index = 0; $index -lt $tokens.Count; $index++) {
        $token = Trim-OptionalQuotes -Value $tokens[$index]

        switch ($token) {
            "--tls" {
                $result.Scheme = "rediss"
                continue
            }
            "-u" {
                if (($index + 1) -lt $tokens.Count) {
                    $result.RedisUrl = Trim-OptionalQuotes -Value $tokens[$index + 1]
                    $index++
                }
                continue
            }
            "-h" {
                if (($index + 1) -lt $tokens.Count) {
                    $result.RedisHost = Trim-OptionalQuotes -Value $tokens[$index + 1]
                    $index++
                }
                continue
            }
            "-p" {
                if (($index + 1) -lt $tokens.Count) {
                    $result.RedisPort = Trim-OptionalQuotes -Value $tokens[$index + 1]
                    $index++
                }
                continue
            }
            "--user" {
                if (($index + 1) -lt $tokens.Count) {
                    $result.RedisUsername = Trim-OptionalQuotes -Value $tokens[$index + 1]
                    $index++
                }
                continue
            }
            "-a" {
                if (($index + 1) -lt $tokens.Count) {
                    $result.RedisPassword = Trim-OptionalQuotes -Value $tokens[$index + 1]
                    $index++
                }
                continue
            }
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($result.RedisUrl)) {
        return $result
    }

    return $result
}

function Set-EnvValueInFile {
    param(
        [string]$Path,
        [string]$Name,
        [string]$Value
    )

    $encodedValue = '"' + $Value.Replace('"', '\"') + '"'

    if (-not (Test-Path $Path)) {
        Set-Content -Path $Path -Value "$Name=$encodedValue"
        return
    }

    $lines = Get-Content $Path
    $updated = $false

    for ($index = 0; $index -lt $lines.Count; $index++) {
        $line = $lines[$index]

        if ($line -match '^\s*#') {
            continue
        }

        $parts = $line -split '=', 2

        if ($parts.Count -ne 2) {
            continue
        }

        if ($parts[0].Trim() -ne $Name) {
            continue
        }

        $lines[$index] = "$Name=$encodedValue"
        $updated = $true
        break
    }

    if (-not $updated) {
        if (($lines.Count -gt 0) -and (-not [string]::IsNullOrWhiteSpace($lines[$lines.Count - 1]))) {
            $lines += ""
        }

        $lines += "$Name=$encodedValue"
    }

    Set-Content -Path $Path -Value $lines
}

function Get-RedactedRedisUrl {
    param(
        [string]$Url
    )

    try {
        $uri = [System.Uri]$Url
        $userInfo = $uri.UserInfo

        if ([string]::IsNullOrWhiteSpace($userInfo)) {
            return $Url
        }

        $username = $userInfo.Split(':')[0]
        return "$($uri.Scheme)://${username}:***@$($uri.Host):$($uri.Port)"
    }
    catch {
        return "[invalid redis url]"
    }
}

$projectRoot = Get-ProjectRoot
$envFilePath = Join-Path $projectRoot ".env"

if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    $databaseUrlFromFile = Get-EnvValueFromFile -Path $envFilePath -Name "DATABASE_URL"

    if (-not [string]::IsNullOrWhiteSpace($databaseUrlFromFile)) {
        $env:DATABASE_URL = $databaseUrlFromFile
    }
}

if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    throw "DATABASE_URL nao foi encontrado no ambiente nem no arquivo .env da raiz."
}

if ([string]::IsNullOrWhiteSpace($RedisUrl)) {
    if (-not [string]::IsNullOrWhiteSpace($env:REDIS_URL)) {
        $RedisUrl = $env:REDIS_URL
    }
}

if ([string]::IsNullOrWhiteSpace($RedisUrl)) {
    $redisUrlFromFile = Get-EnvValueFromFile -Path $envFilePath -Name "REDIS_URL"

    if (-not [string]::IsNullOrWhiteSpace($redisUrlFromFile)) {
        $RedisUrl = $redisUrlFromFile
    }
}

if ([string]::IsNullOrWhiteSpace($RedisCliCommand) -and -not [string]::IsNullOrWhiteSpace($env:REDIS_CLI_COMMAND)) {
    $RedisCliCommand = $env:REDIS_CLI_COMMAND
}

if (-not $PersistRedisUrl -and ($env:SAVE_REDIS_URL_TO_ENV -eq "1")) {
    $PersistRedisUrl = $true
}

if ([string]::IsNullOrWhiteSpace($RedisUrl) -and -not [string]::IsNullOrWhiteSpace($RedisCliCommand)) {
    $parsedRedisCli = Parse-RedisCliCommand -Command $RedisCliCommand

    if (-not [string]::IsNullOrWhiteSpace($parsedRedisCli.RedisUrl)) {
        $RedisUrl = $parsedRedisCli.RedisUrl
    }

    if ([string]::IsNullOrWhiteSpace($RedisHost) -and -not [string]::IsNullOrWhiteSpace($parsedRedisCli.RedisHost)) {
        $RedisHost = $parsedRedisCli.RedisHost
    }

    if ([string]::IsNullOrWhiteSpace($RedisPort) -and -not [string]::IsNullOrWhiteSpace($parsedRedisCli.RedisPort)) {
        $RedisPort = $parsedRedisCli.RedisPort
    }

    if ([string]::IsNullOrWhiteSpace($RedisPassword) -and -not [string]::IsNullOrWhiteSpace($parsedRedisCli.RedisPassword)) {
        $RedisPassword = $parsedRedisCli.RedisPassword
    }

    if (($RedisUsername -eq "default") -and -not [string]::IsNullOrWhiteSpace($parsedRedisCli.RedisUsername)) {
        $RedisUsername = $parsedRedisCli.RedisUsername
    }

    $redisScheme = $parsedRedisCli.Scheme
}
else {
    $redisScheme = "redis"
}

if ([string]::IsNullOrWhiteSpace($RedisUrl)) {
    if ([string]::IsNullOrWhiteSpace($RedisHost)) {
        $RedisHost = Read-RequiredValue -Prompt "Redis host"
    }

    if ([string]::IsNullOrWhiteSpace($RedisPort)) {
        $RedisPort = Read-RequiredValue -Prompt "Redis port"
    }

    if ([string]::IsNullOrWhiteSpace($RedisPassword)) {
        $secureRedisPassword = Read-Host -Prompt "Redis password" -AsSecureString
        $marshalPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureRedisPassword)

        try {
            $RedisPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($marshalPointer)
        }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($marshalPointer)
        }
    }

    $RedisUrl = Build-RedisUrl -RedisHost $RedisHost -RedisPort $RedisPort -RedisPassword $RedisPassword -RedisUsername $RedisUsername -Scheme $redisScheme
}

$env:REDIS_URL = $RedisUrl
$redactedRedisUrl = Get-RedactedRedisUrl -Url $RedisUrl

Write-Host "[INFO] DATABASE_URL carregado do ambiente/.env"
Write-Host "[INFO] REDIS_URL montado: $redactedRedisUrl"

if ($PersistRedisUrl) {
    Set-EnvValueInFile -Path $envFilePath -Name "REDIS_URL" -Value $RedisUrl
    Write-Host "[INFO] REDIS_URL salvo em $envFilePath"
}

if ($DryRun) {
    Write-Host "[INFO] Dry run ativo. Worker nao sera iniciado."
    exit 0
}

$workerCommand = if ($RunOnce) {
    "pnpm --filter @frescari/api run worker:lot-freshness:run-once"
}
else {
    "pnpm --filter @frescari/api run worker:lot-freshness"
}
Write-Host "[INFO] Iniciando worker: $workerCommand"

Push-Location $projectRoot

try {
    if ($RunOnce) {
        & pnpm.cmd --filter @frescari/api run worker:lot-freshness:run-once
    }
    else {
        & pnpm.cmd --filter @frescari/api run worker:lot-freshness
    }
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
