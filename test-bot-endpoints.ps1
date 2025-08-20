Write-Host "Testing Bot Endpoints..." -ForegroundColor Green

$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NzdkNzc1MzE1NTk1NDExNWNlYTIwYWEiLCJpYXQiOjE3NTU3MTc4NDYsImV4cCI6MTc4NzI1Mzg0Nn0.wRfOAl44A3RSue2kgGduwp42D6FWlJ1IJyJSO2Wh4hA"

$headers = @{
    "Authorization" = "Bearer $token"
}

Write-Host "`n1. Testing /estado endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/agencias/v1/bot-reservas-pendientes/estado" -Method POST -Headers $headers
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n2. Testing /ejecutar-manualmente endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/agencias/v1/bot-reservas-pendientes/ejecutar-manualmente" -Method POST -Headers $headers
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Testing /diagnostico endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/agencias/v1/bot-reservas-pendientes/diagnostico" -Method POST -Headers $headers
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest completed!" -ForegroundColor Green
