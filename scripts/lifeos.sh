#!/usr/bin/env bash
#
# LifeOS — local dev runner
#
# Usage:
#   scripts/lifeos.sh start          Start backend (:8001) and frontend (:5174)
#   scripts/lifeos.sh stop           Stop both
#   scripts/lifeos.sh restart        Stop then start
#   scripts/lifeos.sh status         Show what's running
#   scripts/lifeos.sh logs           Tail both logs (Ctrl-C to exit)
#   scripts/lifeos.sh logs backend   Tail backend only
#   scripts/lifeos.sh logs frontend  Tail frontend only
#
# Processes are detached via nohup so they outlive the shell and Kiro.
# Logs and PIDs are written under ~/.lifeos-dev/.

set -euo pipefail

# ---------- config ----------
BACKEND_HOST="127.0.0.1"
BACKEND_PORT="8001"
FRONTEND_PORT="5174"

# ---------- paths (absolute, resolved from this script's location) ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV_UVICORN="$REPO_ROOT/.venv/bin/uvicorn"
FRONTEND_DIR="$REPO_ROOT/frontend"

RUN_DIR="$HOME/.lifeos-dev"
mkdir -p "$RUN_DIR"
BACKEND_LOG="$RUN_DIR/backend.log"
FRONTEND_LOG="$RUN_DIR/frontend.log"
BACKEND_PID="$RUN_DIR/backend.pid"
FRONTEND_PID="$RUN_DIR/frontend.pid"

# ---------- helpers ----------
color() { printf '\033[%sm%s\033[0m' "$1" "$2"; }
ok()    { echo "$(color '32;1' '✓') $*"; }
warn()  { echo "$(color '33;1' '!') $*"; }
err()   { echo "$(color '31;1' '✗') $*" >&2; }
info()  { echo "$(color '36' 'i') $*"; }

is_alive() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

read_pid() {
  local file="$1"
  [[ -f "$file" ]] && cat "$file" 2>/dev/null || true
}

pid_on_port() {
  lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -1 || true
}

# ---------- start ----------
start_backend() {
  local existing_pid
  existing_pid="$(read_pid "$BACKEND_PID")"
  if is_alive "$existing_pid"; then
    warn "backend already running (PID $existing_pid)"
    return 0
  fi

  local port_pid
  port_pid="$(pid_on_port "$BACKEND_PORT")"
  if [[ -n "$port_pid" ]]; then
    err "port $BACKEND_PORT is held by PID $port_pid (not ours). Stop it first."
    return 1
  fi

  if [[ ! -x "$VENV_UVICORN" ]]; then
    err "uvicorn not found at $VENV_UVICORN. Activate the venv and install requirements first."
    return 1
  fi

  info "starting backend on $BACKEND_HOST:$BACKEND_PORT ..."
  (
    cd "$REPO_ROOT"
    nohup "$VENV_UVICORN" backend.main:app \
      --host "$BACKEND_HOST" --port "$BACKEND_PORT" --reload \
      >"$BACKEND_LOG" 2>&1 &
    echo "$!" >"$BACKEND_PID"
    disown 2>/dev/null || true
  )

  sleep 2
  local pid
  pid="$(read_pid "$BACKEND_PID")"
  if is_alive "$pid"; then
    ok "backend started (PID $pid)  → http://$BACKEND_HOST:$BACKEND_PORT"
    info "logs: $BACKEND_LOG"
  else
    err "backend failed to start — check $BACKEND_LOG"
    return 1
  fi
}

start_frontend() {
  local existing_pid
  existing_pid="$(read_pid "$FRONTEND_PID")"
  if is_alive "$existing_pid"; then
    warn "frontend already running (PID $existing_pid)"
    return 0
  fi

  local port_pid
  port_pid="$(pid_on_port "$FRONTEND_PORT")"
  if [[ -n "$port_pid" ]]; then
    err "port $FRONTEND_PORT is held by PID $port_pid (not ours). Stop it first."
    return 1
  fi

  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    err "$FRONTEND_DIR/node_modules missing. Run 'npm install' in frontend/ first."
    return 1
  fi

  info "starting frontend on :$FRONTEND_PORT ..."
  (
    cd "$FRONTEND_DIR"
    nohup npm run dev -- --port "$FRONTEND_PORT" --strictPort \
      >"$FRONTEND_LOG" 2>&1 &
    echo "$!" >"$FRONTEND_PID"
    disown 2>/dev/null || true
  )

  sleep 3
  local pid
  pid="$(read_pid "$FRONTEND_PID")"
  if is_alive "$pid"; then
    ok "frontend started (PID $pid)  → http://localhost:$FRONTEND_PORT"
    info "logs: $FRONTEND_LOG"
  else
    err "frontend failed to start — check $FRONTEND_LOG"
    return 1
  fi
}

# ---------- stop ----------
stop_one() {
  local name="$1" pid_file="$2" port="$3"
  local pid
  pid="$(read_pid "$pid_file")"

  if is_alive "$pid"; then
    info "stopping $name (PID $pid) ..."
    kill "$pid" 2>/dev/null || true
    # give it a moment to clean up, then force kill child/reloader too
    for _ in 1 2 3 4 5; do
      sleep 0.4
      is_alive "$pid" || break
    done
    if is_alive "$pid"; then
      warn "$name still alive, sending SIGKILL"
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
    ok "$name stopped"
  else
    warn "$name not running (no alive PID in $pid_file)"
    rm -f "$pid_file"
  fi

  # Sweep any stragglers on the port (uvicorn's --reload spawns a child worker
  # that may outlive the parent, and orphaned vite processes can happen too).
  local stragglers
  stragglers="$(pid_on_port "$port")"
  if [[ -n "$stragglers" ]]; then
    warn "port $port still held by PID $stragglers — killing"
    kill -9 "$stragglers" 2>/dev/null || true
  fi
}

# ---------- status ----------
status_one() {
  local name="$1" pid_file="$2" port="$3" url="$4"
  local pid port_pid
  pid="$(read_pid "$pid_file")"
  port_pid="$(pid_on_port "$port")"

  if is_alive "$pid"; then
    ok "$name: running (PID $pid)   port $port   $url"
  elif [[ -n "$port_pid" ]]; then
    warn "$name: port $port held by PID $port_pid (not managed by this script)"
  else
    info "$name: stopped"
  fi
}

# ---------- logs ----------
logs() {
  local which="${1:-all}"
  case "$which" in
    backend)  tail -n 50 -F "$BACKEND_LOG" ;;
    frontend) tail -n 50 -F "$FRONTEND_LOG" ;;
    all|"")   tail -n 50 -F "$BACKEND_LOG" "$FRONTEND_LOG" ;;
    *) err "unknown log target: $which (use backend|frontend|all)"; exit 2 ;;
  esac
}

# ---------- dispatch ----------
case "${1:-}" in
  start)
    start_backend
    start_frontend
    ;;
  stop)
    stop_one "backend"  "$BACKEND_PID"  "$BACKEND_PORT"
    stop_one "frontend" "$FRONTEND_PID" "$FRONTEND_PORT"
    ;;
  restart)
    "$0" stop
    sleep 1
    "$0" start
    ;;
  status)
    status_one "backend"  "$BACKEND_PID"  "$BACKEND_PORT"  "http://$BACKEND_HOST:$BACKEND_PORT"
    status_one "frontend" "$FRONTEND_PID" "$FRONTEND_PORT" "http://localhost:$FRONTEND_PORT"
    ;;
  logs)
    logs "${2:-all}"
    ;;
  ""|-h|--help|help)
    sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    err "unknown command: $1"
    echo "Run '$0 help' for usage."
    exit 2
    ;;
esac
