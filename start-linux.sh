#!/bin/bash
# Linux 실행기.
# 터미널에서: ./start-linux.sh  (또는 파일 관리자에서 실행)
# 서버가 켜지고 브라우저가 열립니다. (이 창을 닫으면 서버가 종료됩니다)

cd "$(dirname "$0")" || exit 1

echo "== YouTube Downloader 시작 =="

# 필수 도구 확인
missing=""
command -v node >/dev/null 2>&1 || missing="$missing nodejs"
command -v yt-dlp >/dev/null 2>&1 || missing="$missing yt-dlp"
command -v ffmpeg >/dev/null 2>&1 || missing="$missing ffmpeg"

if [ -n "$missing" ]; then
  echo ""
  echo "[설치 필요] 다음이 없습니다:$missing"
  echo "README 의 'Linux 에서 실행' 안내대로 설치한 뒤 다시 실행하세요."
  read -r -p "엔터를 누르면 창이 닫힙니다."
  exit 1
fi

# 의존성 설치 (최초 1회)
if [ ! -d node_modules ]; then
  echo "필요한 패키지를 설치합니다…"
  npm install || { echo "npm install 실패"; read -r; exit 1; }
fi

# 3초 뒤 브라우저 열기
( sleep 3; xdg-open "http://localhost:3000" >/dev/null 2>&1 ) &

echo "브라우저에서 http://localhost:3000 이 열립니다. (이 창을 닫으면 서버가 종료됩니다)"
npm start
