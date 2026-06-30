"use strict";

// ---------------------------------------------------------------------------
//  우리 백엔드(server.js + yt-dlp)를 호출하는 버전.
//  - 같은 서버에서 열면 같은 출처(/api/*) 로 동작.
//  - GitHub Pages 등 다른 곳에서 열면 "백엔드 서버 주소"를 입력해 호출.
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
const backendInput = $("#backend-input");

const progressWrap = $("#progress-wrap");
const progressBar = $("#progress-bar");
const progressPhase = $("#progress-phase");
const progressPct = $("#progress-pct");

const LS_KEY = "backend_base";

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

// 백엔드 기본 주소 (비어있으면 같은 출처)
function apiBase() {
  return (localStorage.getItem(LS_KEY) || "").trim().replace(/\/+$/, "");
}

function setProgress(pct, phase) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  progressBar.style.width = `${p}%`;
  progressPct.textContent = `${p}%`;
  if (phase) progressPhase.textContent = phase;
}

function openModal() {
  backendInput.value = localStorage.getItem(LS_KEY) || "";
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

// 백엔드 주소 저장
backendInput.addEventListener("change", () => {
  const v = backendInput.value.trim();
  if (v) localStorage.setItem(LS_KEY, v);
  else localStorage.removeItem(LS_KEY);
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
  if (!/^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//.test(url)) {
    showError("올바른 YouTube 링크를 입력해 주세요.");
    return;
  }
  currentUrl = url;
  openModal();
});

// ---------------------------------------------------------------------------
// Go 버튼 → 작업 시작 → 진행률 → 완료 시 다운로드 폴더에 저장
// ---------------------------------------------------------------------------
function saveFile(jobId) {
  const a = document.createElement("a");
  a.href = `${apiBase()}/api/file/${jobId}`;
  a.setAttribute("download", "");
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

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
    const res = await fetch(`${apiBase()}/api/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "작업을 시작하지 못했습니다.");

    const jobId = data.jobId;

    activeSource = new EventSource(`${apiBase()}/api/progress/${jobId}`);
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
        setStatus("다운로드를 시작합니다… 기기의 다운로드 폴더를 확인하세요.");
        saveFile(jobId);
        if (activeSource) {
          activeSource.close();
          activeSource = null;
        }
        setTimeout(() => {
          setLoading(goBtn, false);
          closeModal();
        }, 2000);
      }
    };
    activeSource.onerror = () => {
      // 완료 후 연결 종료이거나 네트워크 오류
      if (activeSource) {
        activeSource.close();
        activeSource = null;
      }
      if (goBtn.disabled) {
        setStatus(
          "서버 연결이 끊겼습니다. 백엔드 서버 주소를 확인해 주세요.",
          "error"
        );
        setLoading(goBtn, false);
        progressWrap.hidden = true;
      }
    };
  } catch (err) {
    const msg =
      err instanceof TypeError
        ? "백엔드 서버에 연결하지 못했습니다. 고급 설정에서 서버 주소를 확인해 주세요."
        : err.message;
    setStatus(msg, "error");
    setLoading(goBtn, false);
    progressWrap.hidden = true;
  }
});
