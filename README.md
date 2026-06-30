# 🎬 YouTube 다운로더 웹앱

화질을 골라 **MP4 영상**으로 받거나 **MP3 음원**으로 변환해 다운로드할 수 있는 반응형 웹앱입니다.
**PC · Mac · 모바일(iOS/Android)** 어디서든 브라우저 하나로 동작합니다.

## 🚦 두 가지 동작 모드

이 저장소에는 두 가지 방식이 들어 있습니다.

1. **정적 모드 (GitHub Pages, 백엔드 불필요)** — `index.html` + `app.js` 가
   공개 [cobalt](https://cobalt.tools) 인스턴스를 브라우저에서 직접 호출해
   다운로드합니다. 서버를 띄울 필요가 없어 GitHub Pages 에서 바로 동작합니다.
   - ⚠️ 공개 인스턴스는 YouTube 차단 등으로 **수시로 끊길 수 있습니다.**
     동작하지 않으면 옵션 창의 **고급 설정**에서
     [instances.cobalt.best](https://instances.cobalt.best) 의 살아있는 주소로
     교체하세요.
2. **자체 서버 모드 (가장 안정적)** — `server.js` + `yt-dlp` + `ffmpeg`.
   아래 "실행 방법" 참고. 직접 호스팅하면 가장 안정적으로 동작합니다.

## ✨ 기능

- 🔗 YouTube 링크 붙여넣기 → 영상 정보 미리보기 (썸네일/제목/길이)
- 🎞️ **화질 선택** (1080p, 720p, 480p … 영상별 제공 화질 자동 감지)
- 🎵 **MP3 변환** (최고 음질 오디오 추출, 320kbps)
- 📊 **실시간 진행률 표시** (서버의 yt-dlp 진행률을 SSE로 막대 그래프 표시)
- 💾 완료 시 **각 기기의 다운로드 폴더에 자동 저장**
- 📱 모바일 / 데스크톱 모두 대응하는 반응형 다크 UI

## 🧱 기술 구성

| 영역 | 사용 기술 |
| --- | --- |
| 프런트엔드 | HTML + CSS + Vanilla JS (반응형) |
| 백엔드 | Node.js + Express |
| 다운로드 엔진 | [yt-dlp](https://github.com/yt-dlp/yt-dlp) |
| 미디어 변환 | [ffmpeg](https://ffmpeg.org/) (MP3 변환 / 영상·오디오 병합) |

> 브라우저만으로는 YouTube 다운로드가 불가능하기 때문에(CORS·서명 URL 제약),
> 실제 다운로드는 서버의 `yt-dlp` 가 처리합니다.

## 🚀 실행 방법

### 1) 사전 요구 사항

- **Node.js 18+**
- **yt-dlp** 와 **ffmpeg** 가 설치되어 PATH 에 있어야 합니다.

```bash
# macOS (Homebrew)
brew install yt-dlp ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Windows (winget)
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

### 2) 설치 & 실행

```bash
npm install
npm start
```

브라우저에서 **http://localhost:3000** 접속.

### 3) Docker 로 실행 (yt-dlp·ffmpeg 자동 포함)

```bash
docker build -t youtube-downloader .
docker run -p 3000:3000 youtube-downloader
```

## ⚙️ 환경 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `3000` | 서버 포트 |
| `YTDLP_PATH` | `yt-dlp` | yt-dlp 실행 파일 경로 |
| `FFMPEG_PATH` | `ffmpeg` | ffmpeg 실행 파일 경로 |

## 📡 API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `POST` | `/api/info` | `{ url }` → 영상 정보 + 사용 가능한 화질 목록 |
| `POST` | `/api/prepare` | `{ url, type, height }` → 다운로드 작업 시작, `jobId` 반환 |
| `GET` | `/api/progress/:id` | SSE 로 실시간 진행률(`progress`, `phase`, `done`) 전송 |
| `GET` | `/api/file/:id` | 완료된 파일을 다운로드 폴더로 저장 (전송 후 임시파일 정리) |
| `GET` | `/api/download` | (단순 스트리밍) `?url=&type=video&height=720` 또는 `?url=&type=audio` |
| `GET` | `/api/health` | 상태 확인 |

## ⚠️ 주의

본인이 권리를 가지고 있거나 저작권자가 허용한 콘텐츠만 내려받으세요.
이 프로젝트는 학습·개인용 목적으로 제공되며, 사용에 대한 책임은 사용자에게 있습니다.

## 📄 라이선스

MIT
