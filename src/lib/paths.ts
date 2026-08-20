import path from 'path'

// Central path resolution for everything the pipeline writes to disk.
//
// Precedence, highest first:
//   1. The specific env var (KARAOKE_DB_PATH, UPLOAD_DIR, ...) — what tests
//      and .env.local use.
//   2. DATA_ROOT/<name> — one env var that relocates the whole data tree.
//      This is how the container points everything at the EFS mount (/data)
//      without burning an env-var slot per directory.
//   3. <cwd>/<name> — local development default.
export function resolveDataPath(envVar: string, name: string): string {
  const specific = process.env[envVar]
  if (specific) return specific
  const dataRoot = process.env.DATA_ROOT
  if (dataRoot) return path.join(dataRoot, name)
  return path.join(process.cwd(), name)
}
