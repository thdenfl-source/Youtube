"use strict";

const $ = (sel) => document.querySelector(sel);

const searchForm = $("#search-form");
const urlInput = $("#url-input");
const searchBtn = $("#search-btn");
const errorEl = $("#error");

const resultEl = $("#result");
const thumbEl = $("#thumb");
const titleEl = $("#video-title");
const authorEl = $("#video-author");
const durationEl = $("#video-duration");

const tabs = document.querySelectorAll(".tab");
const videoPanel = $("#video-panel");
const audioPanel = $("#audio-panel");
const qualitySelect = $("#quality-select");
const downloadBtn = $("#download-btn");
const downloadHint = $("#download-hint");

let currentUrl = "";
let mode = "video"; // "video" | "audio"

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------
function setLoading(btn, loading) {
  const label = btn.querySelector(".btn-label");
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

// ---------------------------------------------------------------------------
// 영상 정보 불러오기
// ---------------------------------------------------------------------------
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");
  const url = urlInput.value.trim();
  if (!url) return;

  setLoading(searchBtn, true);
  resultEl.hidden = true;

  try {
    const res = await fetch("/api/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "영상 정보를 불러오지 못했습니다.");

    currentUrl = url;
    renderResult(data);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(searchBtn, false);
  }
});

function renderResult(data) {
  thumbEl.src = data.thumbnail || "";
  titleEl.textContent = data.title || "";
  authorEl.textContent = data.author || "";
  durationEl.textContent = data.duration
    ? `길이 ${formatDuration(data.duration)}`
    : "";

  // 화질 옵션 채우기
  qualitySelect.innerHTML = "";
  if (data.qualities && data.qualities.length) {
    for (const q of data.qualities) {
      const opt = document.createElement("option");
      opt.value = q.height;
      opt.textContent = `${q.label} (MP4)`;
      qualitySelect.appendChild(opt);
    }
  } else {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "최고 화질 (MP4)";
    qualitySelect.appendChild(opt);
  }

  resultEl.hidden = false;
  resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ---------------------------------------------------------------------------
// 탭 전환 (영상 / 음원)
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
// 다운로드
// ---------------------------------------------------------------------------
downloadBtn.addEventListener("click", () => {
  if (!currentUrl) return;

  const params = new URLSearchParams({ url: currentUrl, type: mode });
  if (mode === "video" && qualitySelect.value) {
    params.set("height", qualitySelect.value);
  }

  // 서버가 attachment 헤더로 응답하므로 브라우저가 파일로 저장한다.
  // (모바일 사파리/크롬 모두 동일하게 동작)
  setLoading(downloadBtn, true);
  downloadHint.hidden = false;

  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = `/api/download?${params.toString()}`;
  document.body.appendChild(iframe);

  // 변환에는 시간이 걸리므로 일정 시간 후 버튼 상태 복구
  setTimeout(() => {
    setLoading(downloadBtn, false);
    downloadHint.hidden = true;
    // iframe 은 다운로드가 시작된 뒤 정리
    setTimeout(() => iframe.remove(), 60000);
  }, 4000);
});
