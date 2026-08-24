#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/server"
[ -d node_modules ] || npm install
node seed.js
node create_user.js
echo "Starting fbspider-clone on http://localhost:${PORT:-8080}"
exec node index.js
