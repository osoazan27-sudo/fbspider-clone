#!/usr/bin/env bash
# Build the standalone app and publish it to Cloudflare Pages and/or Netlify.
#
# GitHub Actions can't allocate a runner on this account (startup_failure), so
# Pages never publishes — these two hosts take a direct upload with no build
# step, which is why we deploy straight from here.
#
# Usage:
#   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... ./deploy.sh cf
#   NETLIFY_AUTH_TOKEN=...                             ./deploy.sh netlify
#   (both env sets present)                            ./deploy.sh all
set -euo pipefail

cd "$(dirname "$0")/web"
TARGET="${1:-all}"
NETLIFY_SITE_ID="${NETLIFY_SITE_ID:-e5bcbfeb-3808-4c0a-8e58-672d326a14e3}"
CF_PROJECT="${CF_PROJECT:-fbspider}"

echo "==> building (standalone, root base)"
rm -rf dist-upload
VITE_STANDALONE=1 npx vite build --outDir dist-upload --logLevel error
cp dist-upload/index.html dist-upload/404.html
touch dist-upload/.nojekyll
printf '/*  /index.html  200\n' > dist-upload/_redirects   # SPA fallback (Netlify)
echo "    built $(find dist-upload -type f | wc -l) files"

deploy_cf() {
  : "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
  : "${CLOUDFLARE_ACCOUNT_ID:?set CLOUDFLARE_ACCOUNT_ID}"
  echo "==> Cloudflare Pages ($CF_PROJECT)"
  CI=1 npx --yes wrangler pages deploy dist-upload \
    --project-name="$CF_PROJECT" --branch=main --commit-dirty=true
}

deploy_netlify() {
  : "${NETLIFY_AUTH_TOKEN:?set NETLIFY_AUTH_TOKEN}"
  echo "==> Netlify ($NETLIFY_SITE_ID)"
  # deploy the DIRECTORY, never a zip: PowerShell's Compress-Archive writes
  # backslash entry names, which Netlify unpacks as literal root filenames and
  # every /assets/* 404s into the SPA fallback (served as text/html).
  CI=1 npx --yes netlify deploy --prod --dir=dist-upload \
    --site="$NETLIFY_SITE_ID" --no-build
}

case "$TARGET" in
  cf|cloudflare) deploy_cf ;;
  netlify|nl)    deploy_netlify ;;
  all)           deploy_cf; deploy_netlify ;;
  *) echo "usage: $0 [cf|netlify|all]" >&2; exit 2 ;;
esac

echo
echo "done. verify with:"
echo "  cd _recon && BASE_URL=https://fbspider.pages.dev/ node verify_modules.js"
