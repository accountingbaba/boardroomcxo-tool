#!/bin/bash
# BoardroomCXO — one-command deploy to Cloudflare Pages

echo "🚀 Deploying BoardroomCXO Content Tool..."

# Load nvm and switch to Node v20
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use v20.20.2 --silent

# Deploy
npm run deploy

echo "✅ Done."
