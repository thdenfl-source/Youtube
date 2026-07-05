#!/bin/bash
# Mac 더블클릭 실행기.
# Finder 에서 이 파일을 더블클릭하면 서버가 켜지고 브라우저가 열립니다.
# (최초 1회는 README 의 안내대로 yt-dlp / ffmpeg / node 설치가 필요합니다.)

cd "$(dirname "$0")" || exit 1

echo "== YouTube Downloader 시작 =="

# 필수 도구 확인
missing=""
command -v node >/dev/null 2>&1 || missing="$missing node"
command -v yt-dlp >/dev/null 2>&1 || missing="$missing yt-dlp"
command -v ffmpeg >/dev/null 2>&1 || missing="$missing ffmpeg"

if [ -n "$missing" ]; then
  echo ""
  echo "[설치 필요] 다음 도구가 없습니다:$missing"
  echo "터미널에 아래 한 줄을 붙여넣어 설치한 뒤 다시 실행하세요:"
  echo ""
  echo "  brew install$missing"
  echo ""
  echo "(Homebrew 가 없다면 https://brew.sh 안내대로 먼저 설치)"
  read -r -p "엔터를 누르면 창이 닫힙니다."
  exit 1
fi

# 의존성 설치 (최초 1회)
if [ ! -d node_modules ]; then
  echo "필요한 패키지를 설치합니다…"
  npm install || { echo "npm install 실패"; read -r; exit 1; }
fi

# 3초 뒤 브라우저 열기
( sleep 3; open "http://localhost:3000" ) &

echo "브라우저에서 http://localhost:3000 이 열립니다. (이 창을 닫으면 서버가 종료됩니다)"
npm start
