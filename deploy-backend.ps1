# TeamPulseAI backend deployment helper for Render
# Usage:
# 1. Connect your GitHub repository to Render at https://dashboard.render.com.
# 2. Use the existing `render.yaml` in this repository root for service configuration.
# 3. Add the required environment variables in the Render service settings.
# 4. Deploy from Render.

if (-not (Test-Path "./render.yaml")) {
    Write-Error "render.yaml not found in the repository root."
    exit 1
}

Write-Host "================================================================="
Write-Host "TeamPulseAI backend deploy helper"
Write-Host "================================================================="
Write-Host "Repository remote: https://github.com/Srija-techie/Project-TeamPulseAI"
Write-Host "Netlify frontend URL: https://teampulseai-final-20260524.netlify.app"
Write-Host ""
Write-Host "Render backend deploy steps:"
Write-Host "  1) Go to https://dashboard.render.com and log in."
Write-Host "  2) Create a new Web Service and connect this GitHub repository."
Write-Host "  3) Make sure Render uses the included render.yaml file."
Write-Host "  4) Set these environment variables in Render:"
Write-Host "       NODE_ENV=production"
Write-Host "       PORT=3000"
Write-Host "       CLIENT_URL=https://teampulseai-final-20260524.netlify.app"
Write-Host "       MONGO_URI=<your MongoDB connection string>"
Write-Host "       GEMINI_API_KEY=<your Gemini API key>"
Write-Host "       SMTP_HOST=<host>"
Write-Host "       SMTP_PORT=<port>"
Write-Host "       SMTP_USER=<user>"
Write-Host "       SMTP_PASS=<pass>"
Write-Host "       SMTP_FROM=<from email>"
Write-Host "  5) Deploy the service and wait for Render to complete the build."
Write-Host ""
Write-Host "If you want, paste your Render service name or token and I can help complete the deploy steps."