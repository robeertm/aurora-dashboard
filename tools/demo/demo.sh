#!/bin/sh
# Throwaway Home Assistant for the README pictures (see docker-compose.yml).
#   demo.sh up      build config, start, wait until the invented data is in
#   demo.sh shots   take the README screenshots (needs `up` first)
#   demo.sh down    stop and remove container, network and run/ folder
# Needs Docker, and: pip install playwright websockets pyyaml pillow
#                    playwright install webkit
set -eu
cd "$(dirname "$0")"
export PATH="$PATH:/Applications/Docker.app/Contents/Resources/bin"
case "${1:-}" in
  up)
    python3 fetch_cards.py
    python3 build_demo.py
    docker compose up -d
    python3 shots.py wait
    ;;
  shots) python3 shots.py shoot ;;
  down)
    docker compose down --remove-orphans --volumes
    rm -rf run
    ;;
  *) echo "usage: $0 up|shots|down" >&2; exit 2 ;;
esac
