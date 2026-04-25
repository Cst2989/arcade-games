#!/usr/bin/env bash
# Finds X (twitter) handles for the top 5 contributors of every repo in the index.
#
# Reads:   public/data/repos.json (must exist — run fetch-repos.sh first)
# Writes:  public/data/twitter.md (markdown, grouped by repo)
#
# Requires: bash, curl, jq. GITHUB_TOKEN env var (for higher API rate limit).
#
# Usage:
#   GITHUB_TOKEN=ghp_xxx ./scripts/find-twitter.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INDEX_FILE="$ROOT_DIR/public/data/repos.json"
OUT_FILE="$ROOT_DIR/public/data/twitter.md"

if [[ ! -f "$INDEX_FILE" ]]; then
  echo "ERROR: $INDEX_FILE not found. Run scripts/fetch-repos.sh first." >&2
  exit 1
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERROR: GITHUB_TOKEN env var is not set." >&2
  echo "Same token as fetch-repos.sh works (public_repo scope)." >&2
  exit 1
fi

for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: required command '$cmd' not found in PATH." >&2
    exit 1
  fi
done

urlenc() {
  jq -rn --arg s "$1" '$s | @uri'
}

api() {
  local path="$1"
  curl -sS --fail-with-body \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com$path"
}

# Cache so we don't re-fetch the same login when it appears across multiple repos.
declare -A HANDLE_CACHE=()

lookup_handle() {
  local login="$1"
  if [[ -n "${HANDLE_CACHE[$login]+set}" ]]; then
    echo "${HANDLE_CACHE[$login]}"
    return
  fi
  local elogin user handle
  elogin="$(urlenc "$login")"
  user="$(api "/users/$elogin" 2>/dev/null || echo '{}')"
  handle="$(echo "$user" | jq -r '.twitter_username // ""')"
  HANDLE_CACHE[$login]="$handle"
  echo "$handle"
}

{
  echo "# X (Twitter) handles for top contributors"
  echo ""
  echo "_Generated $(date -u '+%Y-%m-%d %H:%M UTC') from \`public/data/repos.json\`._"
  echo ""
  echo "Send these folks the game so they can battle their own commits 🎮"
  echo ""

  total_repos="$(jq '.repos | length' "$INDEX_FILE")"
  for ((i = 0; i < total_repos; i++)); do
    owner="$(jq -r ".repos[$i].owner" "$INDEX_FILE")"
    name="$(jq -r ".repos[$i].name" "$INDEX_FILE")"
    echo "## $owner/$name"
    echo ""

    top5_logins="$(jq -r ".repos[$i].top5[].login" "$INDEX_FILE")"
    while IFS= read -r login; do
      [[ -z "$login" ]] && continue
      handle="$(lookup_handle "$login")"
      if [[ -n "$handle" ]]; then
        echo "- \`$login\` → [@${handle}](https://x.com/${handle})"
      else
        echo "- \`$login\` → _(no X handle on profile)_"
      fi
      sleep 0.1
    done <<< "$top5_logins"
    echo ""
  done
} > "$OUT_FILE"

found="$(grep -c '→ \[@' "$OUT_FILE" || true)"
missing="$(grep -c '_(no X handle' "$OUT_FILE" || true)"
echo "Wrote $OUT_FILE"
echo "  $found contributors with X handle"
echo "  $missing without"
