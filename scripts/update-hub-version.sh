#!/usr/bin/env bash
# Atualiza version.json com o commit atual (rodar antes de commit/push)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node -e "
const { execSync } = require('child_process');
const fs = require('fs');
const commit = execSync('git rev-parse --short HEAD').toString().trim();
const message = execSync('git log -1 --format=%s').toString().trim();
const date = execSync('git log -1 --format=%ci').toString().trim();
const data = { commit, message, date };
fs.writeFileSync('version.json', JSON.stringify(data, null, 2) + '\n');
console.log('version.json ->', commit, '-', message);
"
