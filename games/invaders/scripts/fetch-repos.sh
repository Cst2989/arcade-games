#!/usr/bin/env bash
# Fetches GitHub data for the curated repo list and writes static JSON.
#
# Reads:   scripts/repos.txt (one owner/name per line; # comments allowed)
# Writes:  public/data/repos.json
#          public/data/repos/<owner>__<name>.json
#          public/avatars/<login>.png
#
# Requires: bash, curl, jq, awk. GITHUB_TOKEN env var (PAT with public_repo).
#
# Usage:
#   GITHUB_TOKEN=ghp_xxx ./scripts/fetch-repos.sh           # incremental (skips fresh files)
#   GITHUB_TOKEN=ghp_xxx ./scripts/fetch-repos.sh --force   # re-fetch everything

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPOS_FILE="$SCRIPT_DIR/repos.txt"
DATA_DIR="$ROOT_DIR/public/data"
REPOS_DATA_DIR="$DATA_DIR/repos"
AVATARS_DIR="$ROOT_DIR/public/avatars"
INDEX_FILE="$DATA_DIR/repos.json"

FORCE=0
if [[ "${1:-}" == "--force" ]]; then FORCE=1; fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERROR: GITHUB_TOKEN env var is not set." >&2
  echo "Generate a personal access token at https://github.com/settings/tokens" >&2
  echo "(public_repo scope is sufficient), then re-run with:" >&2
  echo "  GITHUB_TOKEN=ghp_xxx $0" >&2
  exit 1
fi

for cmd in curl jq awk; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: required command '$cmd' not found in PATH." >&2
    exit 1
  fi
done

mkdir -p "$REPOS_DATA_DIR" "$AVATARS_DIR"

since_iso="$(date -u -v-365d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
  || date -u -d '365 days ago' '+%Y-%m-%dT%H:%M:%SZ')"

api() {
  local path="$1"
  curl -sS --fail-with-body \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com$path"
}

is_fresh() {
  local f="$1"
  [[ -f "$f" ]] && [[ $(($(date +%s) - $(stat -f %m "$f" 2>/dev/null \
    || stat -c %Y "$f"))) -lt 604800 ]]
}

download_avatar() {
  local login="$1" url="$2"
  local out="$AVATARS_DIR/$login.png"
  if [[ -f "$out" ]] && [[ "$FORCE" -eq 0 ]]; then return 0; fi
  curl -sSL "${url}?s=200" -o "$out" || {
    echo "  WARN: avatar download failed for $login" >&2
    rm -f "$out"
  }
}

fetch_commits() {
  local owner="$1" name="$2" login="$3"
  local page=1 acc='[]'
  while [[ $page -le 3 ]]; do
    local resp
    resp="$(api "/repos/$owner/$name/commits?author=$login&since=$since_iso&per_page=100&page=$page" || echo '[]')"
    local count
    count="$(echo "$resp" | jq 'length')"
    acc="$(jq -s '.[0] + .[1]' <(echo "$acc") <(echo "$resp"))"
    if [[ "$count" -lt 100 ]]; then break; fi
    page=$((page + 1))
  done
  echo "$acc"
}

# Aggregate commits into a 365-day daily array + biggestCommit.
aggregate_jq='
  def days_back(n): [range(0; n) | now - (. * 86400) | strftime("%Y-%m-%dT00:00:00Z") | .[:10]];
  . as $commits
  | (days_back(365) | reverse) as $window
  | reduce $commits[] as $c (
      {};
      . + (
        $c.commit.author.date[0:10] as $d
        | { ($d): ((.[$d] // 0) + 1) }
      )
    ) as $byDay
  | { daily: ( $window | map({ date: ., count: ($byDay[.] // 0) }) ) }
  | . as $base
  | ( $commits
      | group_by(.commit.author.date[0:10])
      | map({ date: (.[0].commit.author.date[0:10]), commits: ., count: length })
      | max_by(.count // 0)
    ) as $busiest
  | $base + (
      if $busiest == null then { biggestCommit: null }
      else
        ($busiest.commits | max_by(.commit.message | length)) as $chosen
        | { biggestCommit: {
              sha: ($chosen.sha[0:7]),
              date: $busiest.date,
              message: (($chosen.commit.message // "") | split("\n")[0] | gsub("^\\s+|\\s+$"; "")),
              commitsThatDay: $busiest.count,
            } }
      end
    )
'

declare -a REPO_TUPLES=()

while IFS= read -r line; do
  line="${line%%#*}"
  line="$(echo "$line" | awk '{$1=$1; print}')"
  [[ -z "$line" ]] && continue
  if [[ ! "$line" =~ ^[[:alnum:]_.-]+/[[:alnum:]_.-]+$ ]]; then
    echo "skip (invalid format): $line" >&2
    continue
  fi
  owner="${line%/*}"
  name="${line#*/}"
  out="$REPOS_DATA_DIR/${owner}__${name}.json"

  if is_fresh "$out" && [[ "$FORCE" -eq 0 ]]; then
    echo "[$owner/$name] fresh, skipping"
    total="$(jq '[.contributors[].totalCommits] | add' "$out")"
    REPO_TUPLES+=("$owner|$name|$total|$out")
    continue
  fi

  echo "[$owner/$name] fetching repo metadata"
  repo_json="$(api "/repos/$owner/$name")"
  language="$(echo "$repo_json" | jq -r '.language // ""')"

  echo "[$owner/$name] fetching contributors"
  contribs="$(api "/repos/$owner/$name/contributors?per_page=30")"
  candidates="$(echo "$contribs" | jq -c '.[:10] | map({login, avatar_url})')"

  ranked='[]'
  for row in $(echo "$candidates" | jq -c '.[]'); do
    login="$(echo "$row" | jq -r '.login')"
    avatar_url="$(echo "$row" | jq -r '.avatar_url')"
    echo "  · $login: commits"
    commits="$(fetch_commits "$owner" "$name" "$login")"
    aggregated="$(echo "$commits" | jq "$aggregate_jq")"
    total="$(echo "$aggregated" | jq '[.daily[].count] | add')"
    if [[ "$total" -le 0 ]]; then continue; fi
    echo "  · $login: profile + avatar"
    user="$(api "/users/$login" || echo '{}')"
    download_avatar "$login" "$avatar_url"
    profile="$(echo "$user" | jq '{
      location: (.location // ""),
      followers: (.followers // 0),
      publicRepos: (.public_repos // 0),
      joinedYear: ((.created_at // "2010-01-01")[:4] | tonumber),
      bio: (.bio // "")
    }')"
    contributor_obj="$(jq -n \
      --arg login "$login" \
      --arg avatarPath "avatars/$login.png" \
      --argjson totalCommits "$total" \
      --argjson agg "$aggregated" \
      --argjson profile "$profile" \
      '{ login: $login, avatarPath: $avatarPath, totalCommits: $totalCommits,
         daily: $agg.daily, biggestCommit: $agg.biggestCommit, profile: $profile }')"
    ranked="$(jq -c --argjson c "$contributor_obj" '. + [$c]' <(echo "$ranked"))"
    sleep 0.3
  done

  count="$(echo "$ranked" | jq 'length')"
  if [[ "$count" -lt 5 ]]; then
    echo "[$owner/$name] WARN: only $count contributors with last-year commits, skipping repo" >&2
    continue
  fi

  # Sort desc by totalCommits, take top 5, then reverse to weakest-first.
  top5="$(echo "$ranked" | jq -c 'sort_by(-.totalCommits) | .[:5] | reverse')"
  total_repo="$(echo "$top5" | jq '[.[].totalCommits] | add')"

  jq -n \
    --arg owner "$owner" \
    --arg name "$name" \
    --arg language "$language" \
    --argjson contributors "$top5" \
    '{ owner: $owner, name: $name, language: $language, contributors: $contributors }' \
    > "$out"
  echo "[$owner/$name] wrote $out"

  REPO_TUPLES+=("$owner|$name|$total_repo|$out")
  sleep 1
done < "$REPOS_FILE"

# Build index, sorted desc by totalContributions.
echo "[index] writing $INDEX_FILE"
index_entries='[]'
for tup in "${REPO_TUPLES[@]}"; do
  IFS='|' read -r owner name total file <<< "$tup"
  contributors="$(jq -c '.contributors' "$file")"
  language="$(jq -r '.language' "$file")"
  description=""
  top5="$(echo "$contributors" | jq -c '
    [.[] | { login, avatarPath, contributions: .totalCommits }]
    | sort_by(-.contributions)
    | (.[0] |= (. + { isBoss: true }))
    | .[1:] |= map(. + { isBoss: false })
  ')"
  entry="$(jq -n \
    --arg owner "$owner" \
    --arg name "$name" \
    --arg language "$language" \
    --arg description "$description" \
    --argjson totalContributions "$total" \
    --argjson top5 "$top5" \
    '{ owner: $owner, name: $name, language: $language, description: $description,
       totalContributions: $totalContributions, top5: $top5 }')"
  index_entries="$(jq -c --argjson e "$entry" '. + [$e]' <(echo "$index_entries"))"
done

jq -n \
  --arg generatedAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
  --argjson repos "$(echo "$index_entries" | jq 'sort_by(-.totalContributions)')" \
  '{ generatedAt: $generatedAt, repos: $repos }' \
  > "$INDEX_FILE"

echo "Done. ${#REPO_TUPLES[@]} repos in index."
