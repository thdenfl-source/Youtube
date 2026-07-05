#!/bin/bash
# Mac 자동 실행 해제기 (더블클릭)
# 백그라운드 자동 실행을 중지하고 로그인 시 자동 시작을 끕니다.

LABEL="com.youtube-downloader"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

echo "== YouTube Downloader 자동 실행 해제 =="

if [ -f "$PLIST" ]; then
  launchctl unload "$PLIST" 2>/dev/null
  rm -f "$PLIST"
  echo "✅ 자동 실행을 껐습니다. (앱 파일은 그대로 있습니다)"
else
  echo "자동 실행이 설정되어 있지 않습니다."
fi

read -r -p "엔터를 누르면 창이 닫힙니다."
