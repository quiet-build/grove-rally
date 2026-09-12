#!/bin/sh
# Copies Trigger Rally Content for local play only. Do not commit or deploy.
set -e
SRC="${TRIGGER_RALLY_SRC:-/tmp/TriggerRally/server/public/a}"
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/public/tr"
if [ ! -d "$SRC" ]; then
  echo "Missing Trigger Rally assets at $SRC. Clone CodeArtemis/TriggerRally and set TRIGGER_RALLY_SRC." >&2
  exit 1
fi
mkdir -p "$DEST/tracks" "$DEST/textures/miramar-z-512" "$DEST/meshes" "$DEST/scenery/tree36" "$DEST/scenery/wood_el1"
cp "$SRC/tracks/nice.png" "$DEST/tracks/"
cp "$SRC/textures/dirt.jpg" "$SRC/textures/dust.png" "$SRC/textures/rock.jpg" "$SRC/textures/heightdetail1.jpg" "$SRC/textures/archtex.jpg" "$SRC/textures/chevron.jpg" "$DEST/textures/"
cp "$SRC/textures/miramar-z-512/"*.jpg "$DEST/textures/miramar-z-512/"
cp "$SRC/meshes/car1-body.json" "$SRC/meshes/car1-wheel.json" "$SRC/meshes/car1-diff.jpg" "$SRC/meshes/arch.r54.js" "$SRC/meshes/chevron.r54.js" "$DEST/meshes/"
cp "$SRC/scenery/tree36/"* "$DEST/scenery/tree36/"
cp "$SRC/scenery/wood_el1/"* "$DEST/scenery/wood_el1/"
echo "Local Content ready in public/tr (gitignored)."
