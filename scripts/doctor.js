#!/usr/bin/env node
// Checks the system tools the karaoke pipeline shells out to and reports
// which stages are available. ffmpeg is required; everything else degrades
// gracefully (see CLAUDE.md — Product Principles).
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const checks = [
  {
    name: 'ffmpeg',
    required: true,
    hint: 'brew install ffmpeg',
    enables: 'all audio/video processing (required)'
  },
  {
    name: 'yt-dlp',
    required: false,
    hint: 'brew install yt-dlp',
    enables: 'YouTube audio + karaoke video download'
  },
  {
    name: 'demucs',
    required: false,
    hint: 'pipx install demucs   (or: pip install demucs)',
    enables: 'high-quality AI vocal separation ("fast" ffmpeg fallback works without it)'
  }
]

function which(tool) {
  try {
    return execSync(`command -v ${tool}`, { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

let requiredMissing = false
console.log('Karaokio doctor\n')

const nvmrcPath = path.join(__dirname, '..', '.nvmrc')
if (fs.existsSync(nvmrcPath)) {
  const wanted = fs.readFileSync(nvmrcPath, 'utf8').trim()
  const actual = process.versions.node.split('.')[0]
  const ok = wanted === actual
  console.log(`${ok ? '✅' : '⚠️ '} node v${process.versions.node} (${ok ? 'matches' : `expected v${wanted}, see .nvmrc`})`)
}

for (const check of checks) {
  const found = which(check.name)
  if (found) {
    console.log(`✅ ${check.name} — ${found}`)
  } else {
    const marker = check.required ? '❌' : '⚠️ '
    console.log(`${marker} ${check.name} — NOT FOUND. Enables: ${check.enables}`)
    console.log(`     install: ${check.hint}`)
    if (check.required) requiredMissing = true
  }
}

console.log('')
if (requiredMissing) {
  console.log('❌ Required tools are missing — the pipeline cannot run.')
  process.exit(1)
}
console.log('✅ Good to go. Missing optional tools just disable their stage.')
