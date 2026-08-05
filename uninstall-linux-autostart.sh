#!/bin/bash
# Linux 자동 실행 해제기
# 실행:  ./uninstall-linux-autostart.sh

SERVICE_NAME="youtube-downloader.service"
SERVICE="$HOME/.config/systemd/user/$SERVICE_NAME"

echo "== YouTube Downloader 자동 실행 해제 =="

if [ -f "$SERVICE" ]; then
  systemctl --user disable --now "$SERVICE_NAME" 2>/dev/null
  rm -f "$SERVICE"
  systemctl --user daemon-reload
  echo "✅ 자동 실행을 껐습니다. (앱 파일은 그대로 있습니다)"
else
  echo "자동 실행이 설정되어 있지 않습니다."
fi

read -r -p "엔터를 누르면 창이 닫힙니다."
