#!/bin/bash
set -e

echo "Limpando portas antigas..."
for port in 5000 5173; do
  pid=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "Matando processo na porta $port (PID $pid)"
    kill -9 $pid
  fi
done

echo "Subindo API (porta 5000)..."
(
  cd "$(dirname "$0")/api-server"
  export $(grep -v '^#' .env | xargs)
  pnpm run dev > /tmp/api-server.log 2>&1
) &
API_PID=$!

echo "Aguardando API subir..."
sleep 5

echo "Subindo Gestor (porta 5173)..."
(
  cd "$(dirname "$0")/artifacts/gestor"
  unset PORT
  pnpm run dev > /tmp/miar-gestor.log 2>&1
) &
GESTOR_PID=$!

echo ""
echo "Tudo rodando."
echo "API log:      tail -f /tmp/api-server.log"
echo "Gestora log:  tail -f /tmp/miar-gestor.log"
echo "API PID: $API_PID | Gestora PID: $GESTOR_PID"
echo "Para parar tudo: kill -9 $API_PID $GESTOR_PID"

wait
