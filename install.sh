#!/bin/sh
# Aurora Dashboard installer — run inside your Home Assistant /config directory:
#   curl -fsSL https://raw.githubusercontent.com/robeertm/aurora-dashboard/main/install.sh | sh
set -e
REPO="https://raw.githubusercontent.com/robeertm/aurora-dashboard/main"
if [ ! -f configuration.yaml ]; then
  echo "✗ Please run this inside your Home Assistant config directory (where configuration.yaml lives)."
  exit 1
fi
mkdir -p themes www/aurora-effects
curl -fsSL "$REPO/themes/aurora.yaml" -o themes/aurora.yaml
curl -fsSL "$REPO/dist/aurora-effects.js" -o www/aurora-effects/aurora-effects.js
curl -fsSL "$REPO/dashboard/aurora.yaml" -o aurora-dashboard.yaml
cat <<'EOT'

  ✔ Theme:            themes/aurora.yaml
  ✔ Effects helper:   www/aurora-effects/aurora-effects.js
  ✔ Dashboard YAML:   aurora-dashboard.yaml (in /config)

  Finish in the UI (once):
   1. configuration.yaml must load themes:
        frontend:
          themes: !include_dir_merge_named themes
      then reload themes (Developer tools → YAML) or restart.
   2. Settings → Dashboards → ⋮ → Resources → Add:
        /local/aurora-effects/aurora-effects.js   (JavaScript module)
      (skip this if you installed the helper via HACS)
   3. Settings → Dashboards → Add dashboard → Raw editor →
      paste the content of aurora-dashboard.yaml.
   4. Adapt the few entities listed in the README table.

EOT
