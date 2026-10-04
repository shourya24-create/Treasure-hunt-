#!/usr/bin/env bash
# build.sh — Assembles the Vercel deployment in this folder.
#
#   public/   the Flutter web build, calling this site's own /api/<name>
#   backend/  the compiled game functions (functions/lib)
#
# Run from Git Bash, then deploy this folder with `vercel deploy --prod`.
# FLUTTER can point at flutter.bat when Flutter is not on PATH.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(dirname "$here")"
flutter="${FLUTTER:-flutter}"

(cd "$root/functions" && npm run build)
# Git Bash would turn "/api" into a Windows path; these two switch that off.
(cd "$root/flutter_app" &&
  MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"     "$flutter" build web --dart-define=API_BASE=/api)

mkdir -p "$here/public" "$here/backend"
cp -r "$root/flutter_app/build/web/." "$here/public/"
cp -r "$root/functions/lib/." "$here/backend/"

echo "Ready: deploy $here"
