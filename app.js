"use strict";

const $ = (sel) => document.querySelector(sel);

const searchForm = $("#search-form");
const urlInput = $("#url-input");
const downBtn = $("#down-btn");
const errorEl = $("#error");

const modal = $("#modal");
const thumbEl = $("#thumb");
const titleEl = $("#modal-title");
const authorEl = $("#video-author");
const durationEl = $("#video-duration");
const formatSelect = $("#format-select");
const goBtn = $("#go-btn");
const goHint = $("#go-hint");
const progressWrap = $("#progress-wrap");
const progressBar = $("#progress-bar");
const progressPhase = $("#progress-phase");
const progressPct = $("#progress-pct");

let activeSource = null;

let currentUrl = "";

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------
function setLoading(btn, loading) {
  const label = btn.querySelector(".btn-label, .down-label");
  const spinner = btn.querySelector(".spinner");
  btn.disabled = loading;
  if (label) label.style.opacity = loading ? "0.5" : "1";
  if (spinner) spinner.hidden = !loading;
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = !msg;
}

function formatDuration(sec) {
  if (!sec && sec !== 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function openModal() {
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
  if (activeSource) {
    activeSource.close();
    activeSource = null;
  }
}

modal.addEventListener("click", (e) => {
  if (e.target.hasAttribute("data-close")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
});

// ---------------------------------------------------------------------------
// Down 버튼 → 링크 분석 → 선택 창 열기
// ---------------------------------------------------------------------------
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");
  const url = urlInput.value.trim();
  if (!url) return;

  setLoading(downBtn, true);

  try {
    const res = await fetch("/api/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "영상 정보를 불러오지 못했습니다.");

    currentUrl = url;
    renderOptions(data);
    openModal();
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(downBtn, false);
  }
});

function renderOptions(data) {
  thumbEl.src = data.thumbnail || "";
  titleEl.textContent = data.title || "";
  authorEl.textContent = data.author || "";
  durationEl.textContent = data.duration
    ? `길이 ${formatDuration(data.duration)}`
    : "";

  // 화질(MP4) 목록 + MP3 옵션을 하나의 선택지로 구성
  formatSelect.innerHTML = "";

  if (data.qualities && data.qualities.length) {
    for (const q of data.qualities) {
      const opt = document.createElement("option");
      opt.value = `video:${q.height}`;
      opt.textContent = `🎬 ${q.label} · MP4`;
      formatSelect.appendChild(opt);
    }
  } else {
    const opt = document.createElement("option");
    opt.value = "video:";
    opt.textContent = "🎬 최고 화질 · MP4";
    formatSelect.appendChild(opt);
  }

  // MP3 옵션
  const mp3 = document.createElement("option");
  mp3.value = "audio:";
  mp3.textContent = "🎵 MP3 음원 (320kbps)";
  formatSelect.appendChild(mp3);
}

// ---------------------------------------------------------------------------
// Go 버튼 → 작업 시작 → 진행률 표시 → 완료 시 다운로드 폴더에 저장
// ---------------------------------------------------------------------------
function setProgress(pct, phase) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  progressBar.style.width = `${p}%`;
  progressPct.textContent = `${p}%`;
  if (phase) progressPhase.textContent = phase;
}

function resetProgressUI() {
  if (activeSource) {
    activeSource.close();
    activeSource = null;
  }
  setLoading(goBtn, false);
  progressWrap.hidden = true;
  goHint.hidden = true;
  setProgress(0, "준비 중");
}

function saveFile(jobId) {
  // 서버가 Content-Disposition: attachment 로 응답하므로
  // 브라우저(PC/Mac/모바일)가 자동으로 '다운로드' 폴더에 저장한다.
  const a = document.createElement("a");
  a.href = `/api/file/${jobId}`;
  a.setAttribute("download", "");
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

goBtn.addEventListener("click", async () => {
  if (!currentUrl) return;

  const [type, height] = formatSelect.value.split(":");

  setLoading(goBtn, true);
  progressWrap.hidden = false;
  goHint.hidden = false;
  setProgress(0, "작업 시작 중");

  try {
    const res = await fetch("/api/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl, type, height }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "작업을 시작하지 못했습니다.");

    const jobId = data.jobId;

    // SSE 로 진행률 수신
    activeSource = new EventSource(`/api/progress/${jobId}`);
    activeSource.onmessage = (e) => {
      const evt = JSON.parse(e.data);
      if (evt.error) {
        showError(evt.error);
        resetProgressUI();
        return;
      }
      if (typeof evt.progress === "number") setProgress(evt.progress, evt.phase);
      if (evt.done) {
        setProgress(100, "완료");
        saveFile(jobId);
        // 잠시 완료 상태를 보여준 뒤 창 정리
        setTimeout(() => {
          resetProgressUI();
          closeModal();
        }, 1200);
      }
    };
    activeSource.onerror = () => {
      // 연결 종료(완료 후) 또는 네트워크 오류
      if (activeSource) {
        activeSource.close();
        activeSource = null;
      }
    };
  } catch (err) {
    showError(err.message);
    resetProgressUI();
  }
});
