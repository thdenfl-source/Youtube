#!/bin/bash
# ===========================================================================
#  Mac 자동 실행 설치기 (한 번만 더블클릭)
#  이 스크립트를 더블클릭하면:
#   - 서버가 백그라운드에서 항상 실행되고
#   - 맥을 켜거나 로그인할 때마다 자동으로 시작됩니다.
#  이후로는 터미널을 열 필요 없이 브라우저에서 http://localhost:3000 만 열면 됩니다.
# ===========================================================================

cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"
LABEL="com.youtube-downloader"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

echo "== YouTube Downloader 자동 실행 설치 =="
echo "앱 위치: $DIR"

# 필수 도구의 절대 경로 찾기
NODE="$(command -v node)"
YTDLP="$(command -v yt-dlp)"
FFMPEG="$(command -v ffmpeg)"

if [ -z "$NODE" ] || [ -z "$YTDLP" ] || [ -z "$FFMPEG" ]; then
  echo ""
  echo "[오류] node / yt-dlp / ffmpeg 중 일부가 설치되어 있지 않습니다."
  echo "먼저 아래를 실행해 설치하세요:"
  echo "  brew install node yt-dlp ffmpeg"
  read -r -p "엔터를 누르면 닫힙니다."
  exit 1
fi

# 의존성 설치 (최초 1회)
if [ ! -d node_modules ]; then
  echo "필요한 패키지를 설치합니다…"
  "$(dirname "$NODE")/npm" install || { echo "npm install 실패"; read -r; exit 1; }
fi

BINDIR="$(dirname "$NODE")"

mkdir -p "$HOME/Library/LaunchAgents"

# LaunchAgent plist 작성
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE</string>
        <string>$DIR/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$DIR</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>3000</string>
        <key>YTDLP_PATH</key>
        <string>$YTDLP</string>
        <key>FFMPEG_PATH</key>
        <string>$FFMPEG</string>
        <key>PATH</key>
        <string>$BINDIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$DIR/server.log</string>
    <key>StandardErrorPath</key>
    <string>$DIR/server.log</string>
</dict>
</plist>
PLISTEOF

# 기존 것이 있으면 내리고 다시 로드
launchctl unload "$PLIST" 2>/dev/null
launchctl load -w "$PLIST" 2>/dev/null

sleep 2

echo ""
echo "✅ 설치 완료!"
echo "   - 서버가 지금부터 백그라운드에서 항상 실행됩니다."
echo "   - 맥을 켤 때마다 자동으로 시작됩니다."
echo "   - 이제 브라우저에서 http://localhost:3000 만 열면 됩니다."
echo ""
echo "끄고 싶을 땐 uninstall-mac-autostart.command 를 더블클릭하세요."
echo ""

# 브라우저 열기
open "http://localhost:3000"

read -r -p "엔터를 누르면 이 창이 닫힙니다. (서버는 계속 실행됩니다)"
