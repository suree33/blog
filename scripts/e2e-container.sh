#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

image=$(awk '$1 == "image:" && $2 ~ /^mcr\.microsoft\.com\/playwright:/ { print $2 }' .github/workflows/ci.yml)
if [[ ! $image =~ ^mcr\.microsoft\.com/playwright:v[^[:space:]]+-noble@sha256:[[:xdigit:]]{64}$ ]]; then
  echo 'Expected one digest-pinned Playwright Noble image in .github/workflows/ci.yml.' >&2
  exit 1
fi

pnpm_version=$(node -p "require('./package.json').devEngines.packageManager.version")
mkdir -p node_modules

exec docker run --rm --init --ipc=host --platform=linux/amd64 --env CI=true --env TZ=UTC \
  --mount "type=bind,src=$PWD,dst=/work" \
  --mount type=volume,dst=/work/node_modules,volume-nocopy \
  --workdir /work "$image" bash -euc '
    uid=$1
    gid=$2
    pnpm_version=$3
    shift 3

    apt-get update
    apt-get install -y fonts-noto-cjk
    npm install --global "pnpm@$pnpm_version"

    export HOME=$(mktemp -d)
    chown "$uid:$gid" "$HOME" node_modules
    exec setpriv --reuid "$uid" --regid "$gid" --clear-groups bash -euc '\''
      pnpm install --frozen-lockfile
      exec pnpm "$@"
    '\'' bash "$@"
  ' bash "$(id -u)" "$(id -g)" "$pnpm_version" "$@"
