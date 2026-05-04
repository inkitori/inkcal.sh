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
for candidate in release/mac-arm64/inkcal.sh.app release/mac/inkcal.sh.app release/mac-universal/inkcal.sh.app; do
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
rm -rf "/Applications/inkcal.sh.app"
cp -R "$APP_PATH" /Applications/
# ad-hoc sign so macOS gatekeeper + auto-updater behave consistently
codesign --deep --force --sign - "/Applications/inkcal.sh.app" >/dev/null 2>&1 || true

if [[ $LOCAL_ONLY -eq 0 ]]; then
  git add package.json package-lock.json 2>/dev/null || git add package.json
  git commit -m "release v$NEW_VERSION"
  git tag "v$NEW_VERSION"
  git push origin HEAD
  git push origin "v$NEW_VERSION"

  # write release notes that highlight the .dmg and bury the auto-updater plumbing.
  # commits since the previous tag (or last 20 if no prior tag exists) become the changelog.
  PREV_TAG="$(git describe --tags --abbrev=0 "v$NEW_VERSION^" 2>/dev/null || echo '')"
  if [[ -n "$PREV_TAG" ]]; then
    CHANGELOG="$(git log --pretty=format:'- %s' "$PREV_TAG..v$NEW_VERSION")"
  else
    CHANGELOG="$(git log --pretty=format:'- %s' -n 20 "v$NEW_VERSION")"
  fi
  DMG_URL="https://github.com/inkitori/inkcal.sh/releases/download/v$NEW_VERSION/inkcal.sh-$NEW_VERSION-arm64.dmg"
  NOTES=$(cat <<EOF
## Download

[**inkcal.sh-$NEW_VERSION-arm64.dmg**]($DMG_URL) — apple silicon. drag into /Applications.

(installed copies update automatically — no need to re-download for patches.)

## Changes

$CHANGELOG

---

<sub>the \`.zip\`, \`.blockmap\`, and \`latest-mac.yml\` files are used by the in-app auto-updater. ignore them unless you're debugging.</sub>
EOF
)
  echo "==> writing release notes..."
  gh release edit "v$NEW_VERSION" --notes "$NOTES" --repo inkitori/inkcal.sh >/dev/null

  # electron-builder uploaded as a *draft* so you can verify before going public.
  # to publish: open https://github.com/inkitori/inkcal.sh/releases and hit "Publish release"
  # on the v$NEW_VERSION draft. or from the cli:
  #   gh release edit v$NEW_VERSION --draft=false --repo inkitori/inkcal.sh
  echo "==> done. v$NEW_VERSION uploaded as a DRAFT release with notes — publish it on github to roll out."
else
  echo "==> done. installed locally at /Applications/inkcal.sh.app"
fi
