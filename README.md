# 🎬 동영상 다운로더 (Mac)

링크를 붙여넣어 **MP4 영상**(화질 선택) 또는 **MP3 음원**으로 받는 간단한 로컬 웹앱입니다.
Mac에서 서버를 실행하고 브라우저(**http://localhost:3000**)에서 사용합니다.

**YouTube · Instagram(릴스) · Facebook · TikTok · X(트위터)** 등
`yt-dlp` 가 지원하는 사이트의 링크를 받을 수 있습니다.

## 사용법

1. 링크 붙여넣기 → **Down**
2. 팝업에서 **화질(MP4)** 또는 **MP3** 선택 → **Go**
3. 진행률이 차오르고, 완료되면 **다운로드 폴더에 저장** ✅

## 🍎 Mac 설치 · 실행

터미널(응용프로그램 → 유틸리티 → 터미널)에서 순서대로 실행하세요.

```bash
# 1) Homebrew (없으면) — https://brew.sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2) 필요한 도구 설치
brew install node yt-dlp ffmpeg git

# 3) 코드 내려받기
git clone https://github.com/thdenfl-source/Youtube.git
cd Youtube

# 4) 실행
npm install
npm start
```

브라우저에서 **http://localhost:3000** 접속.

> 💡 **더 쉽게:** `Youtube` 폴더의 **`start-mac.command` 더블클릭** → 서버가 켜지고
> 브라우저가 자동으로 열립니다. (처음엔 파일 오른쪽 클릭 → "열기")

### ⚡ 자동 실행 (터미널 없이, 로그인 시 자동 시작)

`install-mac-autostart.command` 를 **한 번만 더블클릭**하면 서버가 백그라운드에서
항상 실행되고 Mac 로그인 시 자동으로 시작됩니다. 이후로는 브라우저에서
**http://localhost:3000** 만 열면 됩니다. (끄기: `uninstall-mac-autostart.command`)

## 📱 같은 와이파이의 폰·태블릿에서 쓰기

Mac이 켜져 있고 같은 와이파이면, 폰/태블릿 브라우저에서 `http://<맥 IP>:3000` 으로
접속해 그대로 사용할 수 있습니다. (맥 IP: 시스템 설정 → Wi-Fi → 세부사항, 또는
터미널에서 `ipconfig getifaddr en0`)

## ⚙️ 환경 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `3000` | 서버 포트 |
| `YTDLP_PATH` | `yt-dlp` | yt-dlp 실행 파일 경로 |
| `FFMPEG_PATH` | `ffmpeg` | ffmpeg 실행 파일 경로 |

## ⚠️ 참고

- 특정 사이트가 갑자기 안 되면 `brew upgrade yt-dlp` 로 업데이트하세요
  (사이트가 자주 바뀌어 yt-dlp 최신화가 필요합니다).
- **인스타/페북의 공개** 게시물은 대체로 받아지지만, **비공개·로그인 필요** 영상은
  실패할 수 있습니다(사이트 정책).
- 본인이 권리를 가지고 있거나 저작권이 허용된 콘텐츠만 받으세요.

## 라이선스

MIT
