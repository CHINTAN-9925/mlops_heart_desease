#!/bin/sh
# Copy Next.js static assets into the shared volume so nginx can serve them
# directly without hitting the Node.js process.
set -e

echo "[entrypoint] Syncing /_next/static/ → /shared/static/"
mkdir -p /shared/static
cp -r /app/.next/static/. /shared/static/

echo "[entrypoint] Static files ready. Starting Next.js..."
exec "$@"
