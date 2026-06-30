import express from "express";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// yt-dlp / ffmpeg 실행 파일 경로 (환경변수로 덮어쓰기 가능)
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------------------------
// 유틸: 안전한 YouTube URL 검증
// ---------------------------------------------------------------------------
function isValidYouTubeUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    return (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be"
    );
  } catch {
    return false;
  }
}

// yt-dlp 를 실행하고 stdout(JSON)을 수집한다.
function runYtDlpJson(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || `yt-dlp 종료 코드 ${code}`));
      }
      resolve(stdout);
    });
  });
}

// ---------------------------------------------------------------------------
// POST /api/info  →  영상 정보 + 사용 가능한 화질 목록 반환
// ---------------------------------------------------------------------------
app.post("/api/info", async (req, res) => {
  const { url } = req.body || {};
  if (!isValidYouTubeUrl(url)) {
    return res.status(400).json({ error: "올바른 YouTube URL이 아닙니다." });
  }

  try {
    const raw = await runYtDlpJson([
      "--no-playlist",
      "--dump-single-json",
      url,
    ]);
    const data = JSON.parse(raw);

    // 화질(height) 기준으로 영상 포맷을 정리한다.
    const seen = new Map();
    for (const f of data.formats || []) {
      if (!f.height) continue; // 오디오 전용 포맷 제외
      const h = f.height;
      // 가장 좋은 fps/bitrate 1개만 화질별로 유지
      if (!seen.has(h)) {
        seen.set(h, {
          height: h,
          label: `${h}p${f.fps && f.fps > 30 ? f.fps : ""}`,
          ext: "mp4",
        });
      }
    }

    const qualities = [...seen.values()].sort((a, b) => b.height - a.height);

    res.json({
      id: data.id,
      title: data.title,
      author: data.uploader || data.channel || "",
      duration: data.duration, // 초
      thumbnail: data.thumbnail,
      qualities,
    });
  } catch (err) {
    console.error("[/api/info]", err.message);
    res
      .status(500)
      .json({ error: "영상 정보를 가져오지 못했습니다. URL을 확인해 주세요." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/download  →  선택한 화질 영상(mp4) 또는 오디오(mp3) 스트리밍
//   ?url=...&type=video&height=720
//   ?url=...&type=audio
// ---------------------------------------------------------------------------
app.get("/api/download", async (req, res) => {
  const { url, type = "video", height } = req.query;

  if (!isValidYouTubeUrl(url)) {
    return res.status(400).send("올바른 YouTube URL이 아닙니다.");
  }
  if (type !== "video" && type !== "audio") {
    return res.status(400).send("type은 video 또는 audio여야 합니다.");
  }

  // 파일명에 쓸 안전한 제목을 먼저 조회한다.
  let title = "youtube";
  try {
    const raw = await runYtDlpJson([
      "--no-playlist",
      "--print",
      "%(title)s",
      "--skip-download",
      url,
    ]);
    title = raw.trim() || title;
  } catch {
    /* 제목 조회 실패해도 다운로드는 진행 */
  }
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);

  const args = [
    "--no-playlist",
    "--ffmpeg-location",
    FFMPEG,
    "-o",
    "-", // stdout 으로 스트리밍
  ];

  if (type === "audio") {
    // 최고 음질 오디오 → mp3 변환
    args.push(
      "-f",
      "bestaudio/best",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0"
    );
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}.mp3`
    );
  } else {
    // 선택한 화질 이하 최고 영상 + 최고 오디오 → mp4 병합
    const h = parseInt(height, 10);
    const heightFilter = Number.isFinite(h) ? `[height<=${h}]` : "";
    args.push(
      "-f",
      `bestvideo${heightFilter}+bestaudio/best${heightFilter}`,
      "--merge-output-format",
      "mp4"
    );
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}.mp4`
    );
  }

  args.push(url);

  const child = spawn(YTDLP, args, { windowsHide: true });
  let stderr = "";

  child.stdout.pipe(res);
  child.stderr.on("data", (d) => (stderr += d));

  child.on("error", (err) => {
    console.error("[/api/download] spawn error", err.message);
    if (!res.headersSent) res.status(500).send("다운로드 실행에 실패했습니다.");
  });

  child.on("close", (code) => {
    if (code !== 0) {
      console.error("[/api/download] yt-dlp exit", code, stderr);
      // 이미 스트리밍이 시작된 경우 헤더를 다시 보낼 수 없으므로 연결만 종료
      if (!res.headersSent) res.status(500).send("다운로드에 실패했습니다.");
      else res.end();
    }
  });

  // 클라이언트가 연결을 끊으면 yt-dlp 프로세스도 종료
  req.on("close", () => {
    if (!child.killed) child.kill("SIGKILL");
  });
});

// 헬스 체크
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`YouTube Downloader → http://localhost:${PORT}`);
});
