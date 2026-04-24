param(
  [string]$AppUrl = "https://app.snyper.com.br",
  [string]$ApiUrl = "https://api.snyper.com.br"
)

$ErrorActionPreference = "Stop"

function Test-Endpoint {
  param(
    [string]$Name,
    [string]$Url,
    [string]$Method = "GET",
    [int]$ExpectedStatus,
    [string]$Body = ""
  )

  try {
    if ($Method -eq "GET") {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method GET
    } else {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method $Method -ContentType "application/json" -Body $Body
    }

    $status = [int]$response.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode.value__
    } else {
      throw
    }
  }

  $ok = $status -eq $ExpectedStatus
  $label = if ($ok) { "OK" } else { "FAIL" }
  Write-Host "[$label] $Name -> $status (esperado: $ExpectedStatus)"

  if (-not $ok) {
    throw "Falha em $Name"
  }
}

Write-Host ""
Write-Host "Verificando deploy do Snyper..."
Write-Host "Frontend: $AppUrl"
Write-Host "Backend:  $ApiUrl"
Write-Host ""

Test-Endpoint -Name "API Health" -Url "$ApiUrl/health" -ExpectedStatus 200
Test-Endpoint -Name "API Auth Sem Token" -Url "$ApiUrl/auth/me" -ExpectedStatus 401
Test-Endpoint -Name "Frontend Home" -Url $AppUrl -ExpectedStatus 200

Write-Host ""
Write-Host "Checklist tecnico minimo aprovado."
