#!/usr/bin/env bash
# build.sh — Assembles the Vercel deployment in this folder.
#
#   public/        the Flutter web build, calling this site's own /api/<name>
#   public/field/  the scanner page (../field), served at /field/scan
#   backend/       the compiled game functions (functions/lib)
#
# Every run starts from empty output folders, so a file deleted from the
# sources is never deployed again.
#
# Run it as a file from Git Bash (`bash build.sh`), then deploy this folder
# with `vercel deploy --prod`. FLUTTER can point at flutter.bat when Flutter
# is not on PATH.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
root="$(dirname "$here")"
flutter="${FLUTTER:-flutter}"

# Refuse to delete anything unless this really is "treasure hunt/vercel".
if [ ! -f "$here/api/index.js" ] || [ ! -d "$root/functions/src" ] || [ ! -d "$root/flutter_app/lib" ]; then
  echo "build.sh: cannot find the project around $here. Run it as a file: bash build.sh" >&2
  exit 1
fi

# Generated folders only (all four are git-ignored).
rm -rf "$root/functions/lib" "$root/flutter_app/build/web" "$here/public" "$here/backend"

(cd "$root/functions" && npm run build)
# Git Bash would turn "/api" into a Windows path; these two switch that off.
(cd "$root/flutter_app" &&
  MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" \
    "$flutter" build web --dart-define=API_BASE=/api)

mkdir -p "$here/public/field" "$here/backend"
cp -r "$root/flutter_app/build/web/." "$here/public/"
cp -r "$root/field/." "$here/public/field/"
cp -r "$root/functions/lib/." "$here/backend/"

echo "Ready: deploy $here"
