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
VER=$(sed -n 's/.*AE_VERSION = "\([0-9.]*\)".*/\1/p' www/aurora-effects/aurora-effects.js | head -n 1)
cat <<EOT

  ✔ Theme:            themes/aurora.yaml
  ✔ Effects helper:   www/aurora-effects/aurora-effects.js
  ✔ Dashboard YAML:   aurora-dashboard.yaml (in /config)

  Finish in the UI (once):
   1. configuration.yaml must load themes:
        frontend:
          themes: !include_dir_merge_named themes
      then reload themes (Developer tools → YAML) or restart.
   2. Settings → Dashboards → ⋮ → Resources → Add:
        /local/aurora-effects/aurora-effects.js?v=${VER:-1}   (JavaScript module)
      Change the number after ?v= whenever you update the file, or the
      browser keeps the old one. (Skip this if you installed the helper via HACS.)
   3. Settings → Dashboards → Add dashboard → Raw editor →
      paste the content of aurora-dashboard.yaml.
   4. Create the dropdown helper input_select.sky_mode with the options
      Auto, Day, Dusk, Night (README, "The sky switch"). The sky buttons
      write to it; without it they do nothing.
   5. Adapt the few entities listed in the README table.

EOT
