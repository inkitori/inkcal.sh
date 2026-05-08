#!/usr/bin/env bash
# release.sh — bump version, build, publish to GitHub, install locally.
#
# usage:
#   ./scripts/release.sh              # patch bump (0.1.0 -> 0.1.1)
#   ./scripts/release.sh minor        # minor bump (0.1.0 -> 0.2.0)
#   ./scripts/release.sh major        # major bump (0.1.0 -> 1.0.0)
#   ./scripts/release.sh 1.2.3        # explicit version
#   ./scripts/release.sh --local      # build + install locally only, no git/publish
#
# requires: gh (authenticated) for the GH_TOKEN to publish releases.

set -euo pipefail

cd "$(dirname "$0")/.."

LOCAL_ONLY=0
BUMP="patch"
for arg in "$@"; do
  case "$arg" in
    --local) LOCAL_ONLY=1 ;;
    patch|minor|major) BUMP="$arg" ;;
    [0-9]*.[0-9]*.[0-9]*) BUMP="$arg" ;;
    *) echo "unknown arg: $arg" >&2; exit 1 ;;
  esac
done

if [[ $LOCAL_ONLY -eq 0 ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "working tree is dirty — commit or stash first." >&2
    exit 1
  fi
fi

# bump version (npm version writes package.json + creates git tag if in repo)
if [[ $LOCAL_ONLY -eq 1 ]]; then
  NEW_VERSION="$(node -p "require('./package.json').version")"
  echo "==> local build at v$NEW_VERSION (no version bump)"
else
  NEW_VERSION="$(npm version "$BUMP" --no-git-tag-version | tr -d 'v')"
  echo "==> bumped to v$NEW_VERSION"
fi

echo "==> building..."
npm run build

if [[ $LOCAL_ONLY -eq 1 ]]; then
  npx electron-builder --mac dmg zip
else
  echo "==> publishing to GitHub release..."
  GH_TOKEN="$(gh auth token)" npx electron-builder --mac dmg zip --publish always
fi

# locate the .app — electron-builder puts it under release/mac-arm64 or release/mac
APP_PATH=""
for candidate in release/mac-arm64/inkcal.app release/mac/inkcal.app release/mac-universal/inkcal.app; do
  if [[ -d "$candidate" ]]; then
    APP_PATH="$candidate"
    break
  fi
done

if [[ -z "$APP_PATH" ]]; then
  echo "could not find built .app under release/" >&2
  exit 1
fi

echo "==> installing to /Applications..."
# clear out the new bundle path and any legacy inkcal.sh.app left from before the rename
rm -rf "/Applications/inkcal.app" "/Applications/inkcal.sh.app"
cp -R "$APP_PATH" /Applications/
# ad-hoc sign so macOS gatekeeper + auto-updater behave consistently
codesign --deep --force --sign - "/Applications/inkcal.app" >/dev/null 2>&1 || true

if [[ $LOCAL_ONLY -eq 0 ]]; then
  git add package.json package-lock.json 2>/dev/null || git add package.json
  git commit -m "release v$NEW_VERSION"
  git tag "v$NEW_VERSION"
  git push origin HEAD
  git push origin "v$NEW_VERSION"
  echo "==> done. v$NEW_VERSION published. existing installs will pick it up on next launch (or within 6h)."
else
  echo "==> done. installed locally at /Applications/inkcal.app"
fi
