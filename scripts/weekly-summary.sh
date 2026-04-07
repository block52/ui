#!/bin/bash

# Weekly GitHub Summary Script
# Generates a summary of issues and commits from the last week
# and posts to Discord, Telegram, and/or X (Twitter)
# Optionally creates a GitHub release on specified repos

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOS=("block52/poker-vm" "block52/indexer" "block52/ui")
RELEASE_REPOS=("block52/pokerchain")
DRY_RUN=false
DAYS_AGO=7
SKIP_RELEASE=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-release)
            SKIP_RELEASE=true
            shift
            ;;
        [0-9]*)
            DAYS_AGO=$arg
            shift
            ;;
    esac
done

# Load environment variables from .env
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
else
    echo "Error: .env file not found in $SCRIPT_DIR"
    exit 1
fi

if [ -z "$DISCORD_WEBHOOK" ]; then
    echo "Error: DISCORD_WEBHOOK not set in .env"
    exit 1
fi

# Detect which platforms have credentials configured
HAS_TELEGRAM=false
HAS_X=false

if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    HAS_TELEGRAM=true
fi

if [ -n "$X_API_KEY" ] && [ -n "$X_API_SECRET" ] && [ -n "$X_ACCESS_TOKEN" ] && [ -n "$X_ACCESS_TOKEN_SECRET" ]; then
    HAS_X=true
fi

# Calculate date range
if [[ "$OSTYPE" == "darwin"* ]]; then
    SINCE_DATE=$(date -v-${DAYS_AGO}d +%Y-%m-%d)
else
    SINCE_DATE=$(date -d "${DAYS_AGO} days ago" +%Y-%m-%d)
fi

echo "Fetching GitHub activity since $SINCE_DATE..."

# Initialize variables to collect data from all repos
ALL_COMMITS=""
ALL_NEW_ISSUES=""
ALL_CLOSED_ISSUES=""
ALL_MERGED_PRS=""

# Loop through each repository
for REPO in "${REPOS[@]}"; do
    REPO_NAME=$(basename $REPO)
    echo "Processing $REPO..."

    # Fetch recent commits
    echo "  Fetching commits..."
    COMMITS=$(gh api repos/$REPO/commits \
        --jq ".[] | select(.commit.author.date >= \"${SINCE_DATE}\") | \"- [$REPO_NAME] \(.commit.message | split(\"\n\")[0]) (@\(.author.login // .commit.author.name))\"" \
        2>/dev/null | head -10)
    ALL_COMMITS="${ALL_COMMITS}${COMMITS}\n"

    # Fetch issues created in the last week
    echo "  Fetching new issues..."
    NEW_ISSUES=$(gh issue list --repo $REPO --state all --json number,title,state,createdAt,author \
        --jq ".[] | select(.createdAt >= \"${SINCE_DATE}\") | \"- [$REPO_NAME] #\(.number): \(.title) [\(.state)] (@\(.author.login))\"" \
        2>/dev/null | head -10)
    ALL_NEW_ISSUES="${ALL_NEW_ISSUES}${NEW_ISSUES}\n"

    # Fetch issues closed in the last week
    echo "  Fetching closed issues..."
    CLOSED_ISSUES=$(gh issue list --repo $REPO --state closed --json number,title,closedAt,author \
        --jq ".[] | select(.closedAt >= \"${SINCE_DATE}\") | \"- [$REPO_NAME] #\(.number): \(.title)\"" \
        2>/dev/null | head -10)
    ALL_CLOSED_ISSUES="${ALL_CLOSED_ISSUES}${CLOSED_ISSUES}\n"

    # Fetch PRs merged in the last week
    echo "  Fetching merged PRs..."
    MERGED_PRS=$(gh pr list --repo $REPO --state merged --json number,title,mergedAt,author \
        --jq ".[] | select(.mergedAt >= \"${SINCE_DATE}\") | \"- [$REPO_NAME] #\(.number): \(.title) (@\(.author.login))\"" \
        2>/dev/null | head -10)
    ALL_MERGED_PRS="${ALL_MERGED_PRS}${MERGED_PRS}\n"
done

# Clean up the collected data (remove trailing newlines)
COMMITS=$(echo -e "$ALL_COMMITS" | grep -v '^$')
NEW_ISSUES=$(echo -e "$ALL_NEW_ISSUES" | grep -v '^$')
CLOSED_ISSUES=$(echo -e "$ALL_CLOSED_ISSUES" | grep -v '^$')
MERGED_PRS=$(echo -e "$ALL_MERGED_PRS" | grep -v '^$')

# Build the context for Claude - generate both full and tweet-length summaries
CONTEXT="Generate a weekly development summary for the Block52 project (poker-vm, indexer, and ui repositories).

You MUST output exactly two sections separated by the delimiter ---TWEET--- on its own line.

SECTION 1 (before the delimiter): A concise, engaging summary under 1800 characters for Discord/Telegram. Include:
1. **Highlights** - 2-3 key accomplishments
2. **New Features/Fixes** - Brief list of what was added/fixed
3. **Open Work** - What's in progress
Use emoji sparingly. Format with markdown.

SECTION 2 (after the delimiter): A single tweet under 270 characters summarizing the week's top achievement for X/Twitter. No markdown. Include a relevant hashtag.

## Commits (last $DAYS_AGO days):
$COMMITS

## New Issues Created:
$NEW_ISSUES

## Issues Closed:
$CLOSED_ISSUES

## PRs Merged:
$MERGED_PRS"

# Generate summary using Claude CLI
echo "Generating summary with Claude..."
FULL_OUTPUT=$(echo "$CONTEXT" | claude --print --dangerously-skip-permissions 2>/dev/null)

if [ -z "$FULL_OUTPUT" ]; then
    echo "Error: Failed to generate summary"
    exit 1
fi

# Parse the two sections
SUMMARY=$(echo "$FULL_OUTPUT" | sed '/^---TWEET---$/,$d')
TWEET=$(echo "$FULL_OUTPUT" | sed -n '/^---TWEET---$/,$ p' | tail -n +2 | sed '/^$/d')

# Fallback: if delimiter wasn't found, use full output for summary and truncate for tweet
if [ -z "$TWEET" ]; then
    SUMMARY="$FULL_OUTPUT"
    TWEET="${FULL_OUTPUT:0:270}"
fi

# Truncate if too long for Discord (2000 char limit)
if [ ${#SUMMARY} -gt 1950 ]; then
    SUMMARY="${SUMMARY:0:1947}..."
fi

# Truncate tweet if over 280 chars
if [ ${#TWEET} -gt 280 ]; then
    TWEET="${TWEET:0:277}..."
fi

# Preview summaries
echo ""
echo "========== FULL SUMMARY (Discord/Telegram) =========="
echo "$SUMMARY"
echo "======================================================"
echo ""
echo "========== TWEET (X/Twitter) =========="
echo "$TWEET"
echo "========================================"
echo "Characters: ${#TWEET}/280"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo "[DRY RUN] Skipping all posts."
    echo ""
    echo "[DRY RUN] Would create releases for: ${RELEASE_REPOS[*]}"
    for REPO in "${RELEASE_REPOS[@]}"; do
        LATEST=$(gh release view --repo "$REPO" --json tagName --jq '.tagName' 2>/dev/null || echo "none")
        echo "  $REPO: latest release is $LATEST"
    done
    exit 0
fi

# --- Post to Discord ---
read -p "Post to Discord? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Posting to Discord..."
    ESCAPED_SUMMARY=$(echo "$SUMMARY" | jq -Rs .)
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -d "{\"content\": $ESCAPED_SUMMARY}" \
        "$DISCORD_WEBHOOK")
    if [ "$RESPONSE" -ge 200 ] && [ "$RESPONSE" -lt 300 ]; then
        echo "Posted to Discord!"
    else
        echo "Error posting to Discord (HTTP $RESPONSE)"
    fi
else
    echo "Skipped Discord."
fi

# --- Post to Telegram ---
if [ "$HAS_TELEGRAM" = true ]; then
    read -p "Post to Telegram? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Posting to Telegram..."
        # Strip markdown formatting for Telegram plain text
        TG_TEXT=$(echo "$SUMMARY" | sed 's/\*\*//g; s/\*//g; s/^## /\n/g; s/^# /\n/g')
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="$TELEGRAM_CHAT_ID" \
            --data-urlencode text="$TG_TEXT")
        if [ "$RESPONSE" -ge 200 ] && [ "$RESPONSE" -lt 300 ]; then
            echo "Posted to Telegram!"
        else
            echo "Error posting to Telegram (HTTP $RESPONSE)"
        fi
    else
        echo "Skipped Telegram."
    fi
else
    echo "Telegram not configured (skipping)."
fi

# --- Post to X (Twitter) ---
post_to_x() {
    local TWEET_TEXT="$1"

    # OAuth 1.0a parameters
    local NONCE=$(openssl rand -hex 16)
    local TIMESTAMP=$(date +%s)
    local METHOD="POST"
    local URL="https://api.twitter.com/2/tweets"

    # Build the tweet JSON body
    local BODY=$(jq -nc --arg text "$TWEET_TEXT" '{"text": $text}')

    # Percent-encode function
    percent_encode() {
        local string="$1"
        printf '%s' "$string" | curl -Gso /dev/null -w '%{url_effective}' --data-urlencode @- '' | cut -c 3-
    }

    # OAuth parameters (sorted alphabetically)
    local OAUTH_PARAMS="oauth_consumer_key=$(percent_encode "$X_API_KEY")"
    OAUTH_PARAMS="${OAUTH_PARAMS}&oauth_nonce=$(percent_encode "$NONCE")"
    OAUTH_PARAMS="${OAUTH_PARAMS}&oauth_signature_method=HMAC-SHA1"
    OAUTH_PARAMS="${OAUTH_PARAMS}&oauth_timestamp=${TIMESTAMP}"
    OAUTH_PARAMS="${OAUTH_PARAMS}&oauth_token=$(percent_encode "$X_ACCESS_TOKEN")"
    OAUTH_PARAMS="${OAUTH_PARAMS}&oauth_version=1.0"

    # Build signature base string
    local SIG_BASE="${METHOD}&$(percent_encode "$URL")&$(percent_encode "$OAUTH_PARAMS")"

    # Build signing key
    local SIGNING_KEY="$(percent_encode "$X_API_SECRET")&$(percent_encode "$X_ACCESS_TOKEN_SECRET")"

    # Generate HMAC-SHA1 signature
    local SIGNATURE=$(printf '%s' "$SIG_BASE" | openssl dgst -sha1 -hmac "$SIGNING_KEY" -binary | base64)

    # Build Authorization header
    local AUTH_HEADER="OAuth "
    AUTH_HEADER="${AUTH_HEADER}oauth_consumer_key=\"$(percent_encode "$X_API_KEY")\", "
    AUTH_HEADER="${AUTH_HEADER}oauth_nonce=\"$(percent_encode "$NONCE")\", "
    AUTH_HEADER="${AUTH_HEADER}oauth_signature=\"$(percent_encode "$SIGNATURE")\", "
    AUTH_HEADER="${AUTH_HEADER}oauth_signature_method=\"HMAC-SHA1\", "
    AUTH_HEADER="${AUTH_HEADER}oauth_timestamp=\"${TIMESTAMP}\", "
    AUTH_HEADER="${AUTH_HEADER}oauth_token=\"$(percent_encode "$X_ACCESS_TOKEN")\", "
    AUTH_HEADER="${AUTH_HEADER}oauth_version=\"1.0\""

    # Post the tweet
    local RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST "$URL" \
        -H "Authorization: ${AUTH_HEADER}" \
        -H "Content-Type: application/json" \
        -d "$BODY")

    local HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    local RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
        echo "Posted to X!"
        local TWEET_ID=$(echo "$RESPONSE_BODY" | jq -r '.data.id // empty')
        if [ -n "$TWEET_ID" ]; then
            echo "Tweet URL: https://x.com/i/web/status/$TWEET_ID"
        fi
    else
        echo "Error posting to X (HTTP $HTTP_CODE)"
        echo "$RESPONSE_BODY" | jq '.detail // .errors // .' 2>/dev/null || echo "$RESPONSE_BODY"
    fi
}

if [ "$HAS_X" = true ]; then
    read -p "Post to X (Twitter)? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Posting to X..."
        post_to_x "$TWEET"
    else
        echo "Skipped X."
    fi
else
    echo "X (Twitter) not configured (skipping)."
fi

# --- Create GitHub Releases ---
if [ "$SKIP_RELEASE" = false ]; then
    echo ""
    echo "========== GitHub Releases =========="
    for REPO in "${RELEASE_REPOS[@]}"; do
        REPO_NAME=$(basename "$REPO")

        # Get the latest release tag
        LATEST_TAG=$(gh release view --repo "$REPO" --json tagName --jq '.tagName' 2>/dev/null || echo "")
        if [ -z "$LATEST_TAG" ]; then
            echo "[$REPO_NAME] No existing releases found. Skipping."
            continue
        fi

        # Check if main is ahead of the latest release
        COMPARE=$(gh api "repos/$REPO/compare/${LATEST_TAG}...main" --jq '{ahead: .ahead_by, status: .status}' 2>/dev/null)
        AHEAD=$(echo "$COMPARE" | jq -r '.ahead')
        STATUS=$(echo "$COMPARE" | jq -r '.status')

        if [ "$AHEAD" = "0" ] || [ "$STATUS" = "identical" ]; then
            echo "[$REPO_NAME] $LATEST_TAG is up to date with main. No release needed."
            continue
        fi

        echo "[$REPO_NAME] $LATEST_TAG is $AHEAD commit(s) behind main."

        # Get commits since last release for release notes
        RELEASE_COMMITS=$(gh api "repos/$REPO/compare/${LATEST_TAG}...main" \
            --jq '.commits[] | "- \(.commit.message | split("\n")[0])"' 2>/dev/null)

        # Calculate next version tag (bump patch)
        # Supports v0.1.58 -> v0.1.59, v1.2.3 -> v1.2.4, etc.
        NEXT_TAG=$(echo "$LATEST_TAG" | awk -F. '{OFS="."; $NF=$NF+1; print}')

        # Build release notes
        RELEASE_BODY="## What's Changed

${RELEASE_COMMITS}

**Full Changelog**: https://github.com/${REPO}/compare/${LATEST_TAG}...${NEXT_TAG}"

        echo ""
        echo "  Latest:  $LATEST_TAG"
        echo "  Next:    $NEXT_TAG"
        echo "  Commits:"
        echo "$RELEASE_COMMITS" | sed 's/^/    /'
        echo ""

        read -p "Create release $NEXT_TAG for $REPO_NAME? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Creating release $NEXT_TAG..."
            gh release create "$NEXT_TAG" \
                --repo "$REPO" \
                --title "$NEXT_TAG" \
                --notes "$RELEASE_BODY" \
                --target main
            echo "Release created: https://github.com/$REPO/releases/tag/$NEXT_TAG"
        else
            echo "Skipped release for $REPO_NAME."
        fi
    done
else
    echo "Skipping releases (--skip-release)."
fi

echo ""
echo "Done!"
