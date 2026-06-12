#!/usr/bin/env bash
# Sync web app + shared config from canonical breadcrumbs-v2 into this Xcode mirror.
# Run from repo root: ./scripts/sync-from-canonical.sh
set -euo pipefail

CANONICAL_ROOT="${BREADCRUMBS_V2_ROOT:-$HOME/Developments/breadcrumbs-v2}"
MIRROR_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -d "$CANONICAL_ROOT/.git" ]]; then
  echo "Canonical clone not found at: $CANONICAL_ROOT" >&2
  echo "Clone with: git clone git@github.com:sakpase365-ai/breadcrumbs-v2.git \"$CANONICAL_ROOT\"" >&2
  exit 1
fi

echo "Pulling latest in $CANONICAL_ROOT ..."
git -C "$CANONICAL_ROOT" pull --ff-only

echo "Rsync canonical -> mirror ($MIRROR_ROOT) ..."
rsync -av --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude '.env.local' \
  --exclude 'ios/**/xcuserdata/' \
  --exclude 'ios/**/*.xcuserstate' \
  --exclude '.agents/' \
  --exclude '.claude/' \
  "$CANONICAL_ROOT/" "$MIRROR_ROOT/"

cd "$MIRROR_ROOT"
if git remote get-url canonical &>/dev/null; then
  git fetch canonical
  git reset --hard canonical/main
fi

echo "Done. Install deps if needed: cd \"$MIRROR_ROOT\" && npm install"
