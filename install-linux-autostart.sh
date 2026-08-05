#!/bin/bash
# ===========================================================================
#  Linux 자동 실행 설치기 (한 번만 실행)
#  systemd 사용자 서비스로 등록 → 로그인 시 백그라운드 자동 시작.
#  이후로는 터미널 없이 브라우저에서 http://localhost:3000 만 열면 됩니다.
#  실행:  ./install-linux-autostart.sh
# ===========================================================================

cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"
SERVICE_NAME="youtube-downloader.service"
SERVICE="$HOME/.config/systemd/user/$SERVICE_NAME"

echo "== YouTube Downloader 자동 실행 설치 =="
echo "앱 위치: $DIR"

NODE="$(command -v node)"
YTDLP="$(command -v yt-dlp)"
FFMPEG="$(command -v ffmpeg)"

if [ -z "$NODE" ] || [ -z "$YTDLP" ] || [ -z "$FFMPEG" ]; then
  echo ""
  echo "[오류] node / yt-dlp / ffmpeg 중 일부가 설치되어 있지 않습니다."
  echo "README 의 'Linux 에서 실행' 안내대로 먼저 설치하세요."
  read -r -p "엔터를 누르면 닫힙니다."
  exit 1
fi

# 의존성 설치 (최초 1회)
if [ ! -d node_modules ]; then
  echo "필요한 패키지를 설치합니다…"
  npm install || { echo "npm install 실패"; read -r; exit 1; }
fi

BINDIR="$(dirname "$NODE")"

mkdir -p "$HOME/.config/systemd/user"

cat > "$SERVICE" <<SERVICEEOF
[Unit]
Description=YouTube Downloader
After=network-online.target

[Service]
ExecStart=$NODE $DIR/server.js
WorkingDirectory=$DIR
Environment=PORT=3000
Environment=YTDLP_PATH=$YTDLP
Environment=FFMPEG_PATH=$FFMPEG
Environment=PATH=$BINDIR:/usr/local/bin:/usr/bin:/bin
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
SERVICEEOF

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE_NAME"

# 로그아웃 상태에서도 계속 돌게 하려면 linger 활성화 (실패해도 무방)
loginctl enable-linger "$USER" >/dev/null 2>&1

sleep 2

echo ""
echo "✅ 설치 완료!"
echo "   - 서버가 백그라운드에서 항상 실행됩니다."
echo "   - 로그인 시 자동으로 시작됩니다."
echo "   - 이제 브라우저에서 http://localhost:3000 만 열면 됩니다."
echo ""
echo "상태 확인:  systemctl --user status $SERVICE_NAME"
echo "끄기:       ./uninstall-linux-autostart.sh"
echo ""

xdg-open "http://localhost:3000" >/dev/null 2>&1

read -r -p "엔터를 누르면 이 창이 닫힙니다. (서버는 계속 실행됩니다)"
