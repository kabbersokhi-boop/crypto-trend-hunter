#!/bin/bash

DIR="$HOME/trend-analyzer"

# Load env
if [ -f "$DIR/.env" ]; then
  export $(grep -v '^#' "$DIR/.env" | xargs)
fi

# Load nvm so node/npm/n8n are available
export NVM_DIR="$HOME/.config/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# Get full paths
NODE=$(which node)
NPM=$(which npm)
N8N=$(which n8n)

echo ""
echo "  ⚡ TrendAnalyzer starting..."
echo "  Backend  → http://localhost:3001"
echo "  Frontend → http://localhost:3000"
echo "  n8n      → http://localhost:5678"
echo ""

xfce4-terminal \
  --tab --title="Backend"  -e "bash -c 'export NVM_DIR=$HOME/.config/nvm; source $NVM_DIR/nvm.sh; cd $DIR/backend && node server.js; exec bash'" \
  --tab --title="Frontend" -e "bash -c 'export NVM_DIR=$HOME/.config/nvm; source $NVM_DIR/nvm.sh; cd $DIR/frontend && npm start; exec bash'" \
  --tab --title="n8n"      -e "bash -c 'export NVM_DIR=$HOME/.config/nvm; source $NVM_DIR/nvm.sh; n8n start; exec bash'" &

echo "  Terminals opening..."
echo "  Wait 15 seconds then open http://localhost:3000"
echo ""
