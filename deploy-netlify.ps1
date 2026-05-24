# TeamPulseAI Netlify deployment helper
# Usage:
# 1. Run `npm install` if not already installed
# 2. Run `npm run build`
# 3. Run `npx netlify login` and authenticate
# 4. Run this script: `./deploy-netlify.ps1`

npm run build
npx netlify deploy --prod --dir=client/dist
