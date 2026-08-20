"use strict";

// ---------------------------------------------------------------------------
//  로컬 백엔드(server.js + yt-dlp)를 호출하는 프런트엔드.
//  흐름: POST /api/prepare → SSE /api/progress/:id → /api/file/:id 저장
// ---------------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);

const searchForm = $("#search-form");
const urlInput = $("#url-input");
const errorEl = $("#error");

const modal = $("#modal");
const tabs = document.querySelectorAll(".tab");
const videoPanel = $("#video-panel");
const audioPanel = $("#audio-panel");
const qualitySelect = $("#quality-select");
const goBtn = $("#go-btn");
const statusEl = $("#status");

const progressWrap = $("#progress-wrap");
const progressBar = $("#progress-bar");
const progressPhase = $("#progress-phase");
const progressPct = $("#progress-pct");

let currentUrl = "";
let mode = "video"; // "video" | "audio"
let activeSource = null;

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

function setStatus(msg, kind) {
  statusEl.textContent = msg || "";
  statusEl.hidden = !msg;
  statusEl.classList.toggle("status-error", kind === "error");
}

function setProgress(pct, phase) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  progressBar.style.width = `${p}%`;
  progressPct.textContent = `${p}%`;
  if (phase) progressPhase.textContent = phase;
}

function openModal() {
  setStatus("");
  progressWrap.hidden = true;
  setProgress(0, "준비 중");
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
// 탭 전환
// ---------------------------------------------------------------------------
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    mode = tab.dataset.mode;
    videoPanel.hidden = mode !== "video";
    audioPanel.hidden = mode !== "audio";
  });
});

// ---------------------------------------------------------------------------
// Down 버튼 → 링크 확인 후 옵션 창 열기
// ---------------------------------------------------------------------------
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  showError("");
  const url = urlInput.value.trim();
  if (!url) return;
  if (!/^https?:\/\/.+/i.test(url)) {
    showError("http:// 또는 https:// 로 시작하는 링크를 입력해 주세요.");
    return;
  }
  currentUrl = url;
  openModal();
});

// ---------------------------------------------------------------------------
// 완료된 파일을 다운로드 폴더에 저장한다.
//   숨긴 iframe 으로 attachment 응답을 불러오면, 사용자 제스처와 무관하게
//   브라우저(Safari 포함)가 안정적으로 다운로드한다. (a.click() 은 Safari 에서
//   제스처가 끊기면 무시될 수 있어 iframe 을 사용)
// ---------------------------------------------------------------------------
function saveFile(jobId) {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = `/api/file/${jobId}`;
  document.body.appendChild(iframe);
  setTimeout(() => iframe.remove(), 120000);
}

// ---------------------------------------------------------------------------
// Go 버튼 → 작업 시작 → 진행률 → 완료 시 다운로드 폴더에 저장
// ---------------------------------------------------------------------------
goBtn.addEventListener("click", async () => {
  if (!currentUrl) return;

  const q = qualitySelect.value;
  const body = { url: currentUrl, type: mode };
  if (mode === "video" && q && q !== "max") body.height = q;

  setLoading(goBtn, true);
  progressWrap.hidden = false;
  setStatus("");
  setProgress(0, "작업 시작 중");

  try {
    const res = await fetch("/api/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "작업을 시작하지 못했습니다.");

    const jobId = data.jobId;

    activeSource = new EventSource(`/api/progress/${jobId}`);
    activeSource.onmessage = (e) => {
      const evt = JSON.parse(e.data);
      if (evt.error) {
        setStatus(evt.error, "error");
        setLoading(goBtn, false);
        progressWrap.hidden = true;
        if (activeSource) {
          activeSource.close();
          activeSource = null;
        }
        return;
      }
      if (typeof evt.progress === "number") setProgress(evt.progress, evt.phase);
      if (evt.done) {
        setProgress(100, "완료");
        setStatus("다운로드를 시작합니다… 다운로드 폴더를 확인하세요.");
        saveFile(jobId);
        if (activeSource) {
          activeSource.close();
          activeSource = null;
        }
        setTimeout(() => {
          setLoading(goBtn, false);
          closeModal();
        }, 2500);
      }
    };
    activeSource.onerror = () => {
      if (activeSource) {
        activeSource.close();
        activeSource = null;
      }
      if (goBtn.disabled) {
        setStatus("서버 연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.", "error");
        setLoading(goBtn, false);
        progressWrap.hidden = true;
      }
    };
  } catch (err) {
    const msg =
      err instanceof TypeError
        ? "서버에 연결하지 못했습니다. 서버가 실행 중인지 확인해 주세요."
        : err.message;
    setStatus(msg, "error");
    setLoading(goBtn, false);
    progressWrap.hidden = true;
  }
});
