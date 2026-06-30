"use strict";

// ---------------------------------------------------------------------------
//  백엔드 없이 동작하는 정적 버전
//  공개 cobalt 인스턴스(브라우저에서 직접 호출 가능, CORS 허용)에 요청해
//  다운로드 링크를 받아 기기 다운로드 폴더에 저장한다.
//  cobalt API 문서: https://github.com/imputnet/cobalt/blob/main/docs/api.md
// ---------------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);

const searchForm = $("#search-form");
const urlInput = $("#url-input");
const downBtn = $("#down-btn");
const errorEl = $("#error");

const modal = $("#modal");
const tabs = document.querySelectorAll(".tab");
const videoPanel = $("#video-panel");
const audioPanel = $("#audio-panel");
const qualitySelect = $("#quality-select");
const goBtn = $("#go-btn");
const statusEl = $("#status");
const instanceInput = $("#instance-input");

// 기본 공개 인스턴스 (죽으면 고급 설정에서 교체 가능, localStorage 저장)
const DEFAULT_INSTANCE = "https://cobalt-api.kwiatekmiki.com";
const LS_KEY = "cobalt_instance";

let currentUrl = "";
let mode = "video"; // "video" | "audio"

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

function getInstance() {
  const saved = (localStorage.getItem(LS_KEY) || "").trim();
  const base = saved || DEFAULT_INSTANCE;
  return base.replace(/\/+$/, ""); // 끝 슬래시 제거
}

function openModal() {
  instanceInput.value = localStorage.getItem(LS_KEY) || "";
  setStatus("");
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}

modal.addEventListener("click", (e) => {
  if (e.target.hasAttribute("data-close")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
});

// 인스턴스 주소 저장
instanceInput.addEventListener("change", () => {
  const v = instanceInput.value.trim();
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
// Go 버튼 → cobalt 에 요청 → 다운로드 링크로 저장
// ---------------------------------------------------------------------------
function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

goBtn.addEventListener("click", async () => {
  if (!currentUrl) return;

  const body = { url: currentUrl, filenameStyle: "basic" };
  if (mode === "audio") {
    body.downloadMode = "audio";
    body.audioFormat = "mp3";
  } else {
    body.downloadMode = "auto";
    body.videoQuality = qualitySelect.value;
  }

  setLoading(goBtn, true);
  setStatus("서버에 요청 중…");

  try {
    const res = await fetch(getInstance() + "/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("서버 응답을 해석할 수 없습니다. 다른 인스턴스로 바꿔보세요.");
    }

    if (data.status === "error") {
      const code = data.error?.code || "알 수 없는 오류";
      throw new Error(`다운로드를 가져오지 못했습니다 (${code}).`);
    }

    if (data.status === "tunnel" || data.status === "redirect") {
      setStatus("다운로드를 시작합니다… 기기의 다운로드 폴더를 확인하세요.");
      triggerDownload(data.url, data.filename);
      setTimeout(closeModal, 2500);
      return;
    }

    if (data.status === "picker" && Array.isArray(data.picker)) {
      // 여러 항목 중 형식에 맞는 것(또는 첫 번째)을 사용
      const item =
        data.picker.find(
          (p) => p.type === (mode === "audio" ? "audio" : "video")
        ) || data.picker[0];
      const link = item?.url || data.audio;
      if (!link) throw new Error("다운로드 항목을 찾지 못했습니다.");
      setStatus("다운로드를 시작합니다… 기기의 다운로드 폴더를 확인하세요.");
      triggerDownload(link, data.filename);
      setTimeout(closeModal, 2500);
      return;
    }

    throw new Error("예상치 못한 응답입니다. 다른 인스턴스로 바꿔보세요.");
  } catch (err) {
    // 네트워크/CORS 실패 등
    const msg =
      err instanceof TypeError
        ? "API 인스턴스에 연결하지 못했습니다. 고급 설정에서 다른 주소로 바꿔보세요."
        : err.message;
    setStatus(msg, "error");
  } finally {
    setLoading(goBtn, false);
  }
});
