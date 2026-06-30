import express from "express";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
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

// ===========================================================================
//  진행률 표시 다운로드 (job 기반)
//  1) POST /api/prepare    → 다운로드 작업 시작, jobId 반환
//  2) GET  /api/progress/:id → SSE 로 실시간 진행률 전송
//  3) GET  /api/file/:id   → 완료된 파일을 다운로드 폴더로 저장
// ===========================================================================
const jobs = new Map(); // jobId → { status, progress, phase, dir, filePath, filename, mime, error, listeners, child }

function sanitizeTitle(title) {
  return (title || "youtube").replace(/[\\/:*?"<>|]/g, "_").slice(0, 120) || "youtube";
}

function emit(job, event) {
  for (const send of job.listeners) send(event);
}

function cleanupJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  try {
    if (job.dir && fs.existsSync(job.dir))
      fs.rmSync(job.dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  jobs.delete(jobId);
}

app.post("/api/prepare", async (req, res) => {
  const { url, type = "video", height } = req.body || {};

  if (!isValidYouTubeUrl(url)) {
    return res.status(400).json({ error: "올바른 YouTube URL이 아닙니다." });
  }
  if (type !== "video" && type !== "audio") {
    return res.status(400).json({ error: "type은 video 또는 audio여야 합니다." });
  }

  // 제목 조회 (파일명용)
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
    /* 제목 조회 실패해도 진행 */
  }
  const safeTitle = sanitizeTitle(title);

  const jobId = crypto.randomUUID();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ytdl-"));
  const outTemplate = path.join(dir, "download.%(ext)s");

  const args = [
    "--no-playlist",
    "--newline", // 진행률을 줄 단위로 출력
    "--ffmpeg-location",
    FFMPEG,
    "-o",
    outTemplate,
  ];

  let ext, mime;
  if (type === "audio") {
    args.push(
      "-f",
      "bestaudio/best",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0"
    );
    ext = "mp3";
    mime = "audio/mpeg";
  } else {
    const h = parseInt(height, 10);
    const heightFilter = Number.isFinite(h) ? `[height<=${h}]` : "";
    args.push(
      "-f",
      `bestvideo${heightFilter}+bestaudio/best${heightFilter}/best`,
      "--merge-output-format",
      "mp4"
    );
    ext = "mp4";
    mime = "video/mp4";
  }
  args.push(url);

  const job = {
    status: "running", // running | done | error
    progress: 0,
    phase: "준비 중",
    dir,
    filePath: null,
    filename: `${safeTitle}.${ext}`,
    mime,
    error: null,
    listeners: new Set(),
    child: null,
  };
  jobs.set(jobId, job);

  const child = spawn(YTDLP, args, { windowsHide: true });
  job.child = child;
  let stderr = "";

  const handleLine = (chunk) => {
    const text = chunk.toString();
    // [download]  23.4% of ...
    const m = text.match(/\[download\]\s+([\d.]+)%/);
    if (m) {
      job.progress = Math.min(99, parseFloat(m[1]));
      job.phase = "다운로드 중";
      emit(job, { progress: job.progress, phase: job.phase });
    } else if (/\[(ExtractAudio|Merger|VideoConvertor)\]/.test(text)) {
      job.phase = type === "audio" ? "MP3 변환 중" : "병합 중";
      emit(job, { progress: job.progress, phase: job.phase });
    }
  };

  child.stdout.on("data", handleLine);
  child.stderr.on("data", (d) => {
    stderr += d;
    handleLine(d);
  });

  child.on("error", (err) => {
    job.status = "error";
    job.error = "다운로드 실행에 실패했습니다 (yt-dlp 설치 확인).";
    console.error("[/api/prepare] spawn error", err.message);
    emit(job, { error: job.error });
  });

  child.on("close", (code) => {
    if (job.status === "error") return;
    if (code !== 0) {
      job.status = "error";
      job.error = "다운로드에 실패했습니다.";
      console.error("[/api/prepare] yt-dlp exit", code, stderr);
      emit(job, { error: job.error });
      return;
    }
    // 완료된 파일 찾기
    try {
      const files = fs.readdirSync(dir);
      if (!files.length) throw new Error("결과 파일이 없습니다.");
      job.filePath = path.join(dir, files[0]);
      job.status = "done";
      job.progress = 100;
      emit(job, { progress: 100, phase: "완료", done: true });
    } catch (err) {
      job.status = "error";
      job.error = "결과 파일을 찾지 못했습니다.";
      console.error("[/api/prepare]", err.message);
      emit(job, { error: job.error });
    }
  });

  res.json({ jobId });
});

app.get("/api/progress/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).end();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // 현재 상태 즉시 전송
  if (job.status === "error") send({ error: job.error });
  else if (job.status === "done")
    send({ progress: 100, phase: "완료", done: true });
  else send({ progress: job.progress, phase: job.phase });

  job.listeners.add(send);
  req.on("close", () => job.listeners.delete(send));
});

app.get("/api/file/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).send("작업을 찾을 수 없습니다.");
  if (job.status !== "done" || !job.filePath) {
    return res.status(409).send("아직 준비되지 않았습니다.");
  }

  res.setHeader("Content-Type", job.mime);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(job.filename)}`
  );

  const stream = fs.createReadStream(job.filePath);
  stream.pipe(res);
  // 전송이 끝나면 임시 파일/작업 정리
  stream.on("close", () => cleanupJob(req.params.id));
  stream.on("error", () => {
    if (!res.headersSent) res.status(500).end();
    cleanupJob(req.params.id);
  });
});

// 헬스 체크
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`YouTube Downloader → http://localhost:${PORT}`);
});
