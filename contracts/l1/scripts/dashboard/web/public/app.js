/**
 * EnergyFi Integration Test Runner — Frontend
 * SSE 기반 자동화 테스트 뷰어
 */

// ── State ────────────────────────────────────────────────────────────────────
let suites = [];
let currentEventSource = null;
let timerInterval = null;
let startTime = null;
let totalExpected = 0;
let totalCompleted = 0;
let totalFailed = 0;
let isRunning = false;

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await refreshStatus();
  await loadSuites();
});

async function refreshStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    document.getElementById("networkBadge").textContent = data.network;
    document.getElementById("networkBadge").className = "badge badge-green";

    const p2 = data.phase2;
    const p2Badge = document.getElementById("phase2Badge");
    p2Badge.textContent = p2 ? "Phase 2: ON" : "Phase 2: OFF";
    p2Badge.className = p2 ? "badge badge-green" : "badge badge-muted";

    document.getElementById("connectionStatus").className = "connection-dot online";
  } catch {
    document.getElementById("connectionStatus").className = "connection-dot offline";
  }
}

async function loadSuites() {
  try {
    const res = await fetch("/verify/suites");
    suites = await res.json();
    renderSuiteNav();
    renderSuiteButtons();
  } catch (err) {
    console.error("Failed to load suites:", err);
  }
}

// ── Render Suite Nav ─────────────────────────────────────────────────────────
function renderSuiteNav() {
  const nav = document.getElementById("suiteNav");
  nav.innerHTML = '<div class="nav-section-title">Test Suites</div>';

  suites.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "suite-nav-item";
    item.id = `nav-${s.id}`;
    item.innerHTML = `
      <span class="nav-label">${i + 1}. ${s.label}</span>
      <span class="nav-meta">
        <span>${s.caseCount} cases</span>
        <span class="suite-status-badge status-pending" id="navStatus-${s.id}">대기</span>
      </span>
    `;
    item.onclick = () => scrollToSuite(s.id);
    nav.appendChild(item);
  });
}

function renderSuiteButtons() {
  const container = document.getElementById("suiteButtons");
  container.innerHTML = "";
  suites.forEach((s, i) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-sm";
    btn.textContent = `S${i + 1} ▶`;
    btn.title = s.label;
    btn.onclick = () => runSingleSuite(s.id);
    btn.id = `btnSuite-${s.id}`;
    container.appendChild(btn);
  });
}

function scrollToSuite(suiteId) {
  const card = document.getElementById(`card-${suiteId}`);
  if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Run All Suites ───────────────────────────────────────────────────────────
function runAllSuites() {
  if (isRunning) return;
  connectSSE("/verify/run-all", suites.reduce((sum, s) => sum + s.caseCount, 0));
}

function runSingleSuite(suiteId) {
  if (isRunning) return;
  const suite = suites.find(s => s.id === suiteId);
  connectSSE(`/verify/run/${suiteId}`, suite ? suite.caseCount : 0);
}

function connectSSE(url, expectedCases) {
  // Close any existing connection
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }

  // Reset state
  isRunning = true;
  totalCompleted = 0;
  totalFailed = 0;
  totalExpected = expectedCases || suites.reduce((sum, s) => sum + s.caseCount, 0);
  startTime = Date.now();

  // Reset UI
  document.getElementById("emptyState")?.remove();
  document.getElementById("summaryBar").style.display = "none";
  document.getElementById("btnRunAll").disabled = true;
  suites.forEach(s => {
    const btn = document.getElementById(`btnSuite-${s.id}`);
    if (btn) btn.disabled = true;
  });

  // Reset nav status
  suites.forEach(s => updateNavStatus(s.id, "pending"));

  // Clear results
  const results = document.getElementById("suiteResults");
  results.innerHTML = "";

  // Start timer
  updateTimer();
  timerInterval = setInterval(updateTimer, 100);

  // Update progress
  updateProgress();

  // Connect SSE
  currentEventSource = new EventSource(url);
  currentEventSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      handleEvent(event);
    } catch (err) {
      console.error("SSE parse error:", err);
    }
  };
  currentEventSource.onerror = () => {
    finishRun();
  };
}

// ── Event Handler ────────────────────────────────────────────────────────────
function handleEvent(event) {
  switch (event.type) {
    case "suite-start":
      handleSuiteStart(event);
      break;
    case "suite-end":
      handleSuiteEnd(event);
      break;
    case "case-start":
      handleCaseStart(event);
      break;
    case "pass":
      handlePass(event);
      break;
    case "fail":
      handleFail(event);
      break;
    case "gap":
      handleGap(event);
      break;
    case "setup-ok":
      handleSetupOk(event);
      break;
    case "summary":
      handleSummary(event);
      break;
    case "done":
      finishRun();
      break;
  }
}

let currentSuiteId = null;

function handleSuiteStart(event) {
  // If we were in auto-setup mode, mark setup card as done
  if (currentSuiteId === "auto-setup") {
    const stats = document.getElementById("stats-auto-setup");
    if (stats) stats.innerHTML = '<span class="stat-pass">완료</span>';
  }

  currentSuiteId = event.suiteId;
  updateNavStatus(event.suiteId, "running");

  const results = document.getElementById("suiteResults");
  const card = document.createElement("div");
  card.className = "suite-card";
  card.id = `card-${event.suiteId}`;
  card.innerHTML = `
    <div class="suite-card-header" onclick="toggleSuiteBody('${event.suiteId}')">
      <div class="suite-header-left">
        <span class="suite-toggle" id="toggle-${event.suiteId}">&#9660;</span>
        <span>${event.label}</span>
      </div>
      <div class="suite-header-stats" id="stats-${event.suiteId}">
        <span class="stat-pass">0 pass</span>
        <span class="stat-fail">0 fail</span>
        <span class="stat-gap">0 gap</span>
      </div>
    </div>
    <div class="suite-card-body" id="body-${event.suiteId}"></div>
  `;
  results.appendChild(card);

  // Auto-scroll
  card.scrollIntoView({ behavior: "smooth", block: "start" });

  // Highlight nav
  document.querySelectorAll(".suite-nav-item").forEach(el => el.classList.remove("active"));
  const navItem = document.getElementById(`nav-${event.suiteId}`);
  if (navItem) navItem.classList.add("active");
}

function handleSuiteEnd(event) {
  updateNavStatus(event.suiteId, event.failed > 0 ? "failed" : "passed");
  updateSuiteStats(event.suiteId, event.passed, event.failed, event.gaps);
}

function handleCaseStart(event) {
  // If no suite yet (setup phase), show in setup card
  if (!currentSuiteId) {
    ensureSetupCard();
    currentSuiteId = "auto-setup";
  }
  const body = document.getElementById(`body-${currentSuiteId}`);
  if (!body) return;

  // Remove previous running indicator
  const prevRunning = body.querySelector(".case-running");
  if (prevRunning) prevRunning.remove();

  const row = document.createElement("div");
  row.className = "case-row case-running";
  row.id = `case-running-${currentSuiteId}`;
  row.innerHTML = `
    <span class="case-icon">&#9675;</span>
    <span class="case-label">${escapeHtml(event.label)}</span>
    <span class="case-kind kind-${event.kind}">${event.kind}</span>
  `;
  body.appendChild(row);
  scrollToBottom(body);
}

function handlePass(event) {
  totalCompleted++;
  updateProgress();
  replaceRunningRow("pass", event);
}

function handleFail(event) {
  totalCompleted++;
  totalFailed++;
  updateProgress();

  // If no suite yet (setup phase failure), show in setup card
  if (!currentSuiteId) {
    ensureSetupCard();
    currentSuiteId = "auto-setup";
  }

  replaceRunningRow("fail", event);

  // Add fail detail
  const body = document.getElementById(`body-${currentSuiteId}`);
  if (!body) return;

  const detail = document.createElement("div");
  detail.className = "fail-detail";
  let html = `<div class="fail-reason">${escapeHtml(event.reason)}</div>`;
  if (event.logs && event.logs.length > 0) {
    const logId = `logs-${Date.now()}`;
    html += `<span class="fail-logs-toggle" onclick="toggleLogs('${logId}')">로그 펼치기</span>`;
    html += `<div class="fail-logs" id="${logId}">${event.logs.map(escapeHtml).join("\n")}</div>`;
  }
  detail.innerHTML = html;
  body.appendChild(detail);
}

function handleGap(event) {
  totalCompleted++;
  updateProgress();
  replaceRunningRow("gap", event);

  if (!currentSuiteId) return;
  const body = document.getElementById(`body-${currentSuiteId}`);
  if (!body) return;

  const detail = document.createElement("div");
  detail.className = "gap-detail";
  detail.textContent = event.detail;
  body.appendChild(detail);
}

function handleSetupOk(event) {
  // If no suite is running yet, create auto-setup card
  if (!currentSuiteId) {
    ensureSetupCard();
    currentSuiteId = "auto-setup";
  }

  const body = document.getElementById(`body-${currentSuiteId}`);
  if (!body) return;

  // Remove running indicator
  const running = body.querySelector(".case-running");
  if (running) running.remove();

  const row = document.createElement("div");
  row.className = "case-row case-setup";
  row.innerHTML = `
    <span class="case-icon">&#9881;</span>
    <span class="case-label">${escapeHtml(event.label)}</span>
    <span class="case-kind kind-verify">setup</span>
  `;
  body.appendChild(row);
  scrollToBottom(body);
}

function ensureSetupCard() {
  if (document.getElementById("card-auto-setup")) return;
  const results = document.getElementById("suiteResults");
  const card = document.createElement("div");
  card.className = "suite-card";
  card.id = "card-auto-setup";
  card.innerHTML = `
    <div class="suite-card-header" onclick="toggleSuiteBody('auto-setup')">
      <div class="suite-header-left">
        <span class="suite-toggle" id="toggle-auto-setup">&#9660;</span>
        <span>자동 셋업 (Phase 1 데이터 + P-256 키)</span>
      </div>
      <div class="suite-header-stats" id="stats-auto-setup">
        <span class="stat-pass">진행 중...</span>
      </div>
    </div>
    <div class="suite-card-body" id="body-auto-setup"></div>
  `;
  results.appendChild(card);
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleSummary(event) {
  const bar = document.getElementById("summaryBar");
  bar.style.display = "flex";
  document.getElementById("summaryPassed").textContent = event.totalPassed;
  document.getElementById("summaryFailed").textContent = event.totalFailed;
  document.getElementById("summaryGaps").textContent = event.totalGaps;

  const elapsed = startTime ? ((Date.now() - startTime) / 1000).toFixed(1) : "--";
  document.getElementById("summaryTime").textContent = `${elapsed}s`;
}

function finishRun() {
  isRunning = false;
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Re-enable buttons
  document.getElementById("btnRunAll").disabled = false;
  suites.forEach(s => {
    const btn = document.getElementById(`btnSuite-${s.id}`);
    if (btn) btn.disabled = false;
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function replaceRunningRow(type, event) {
  if (!currentSuiteId) return;
  const body = document.getElementById(`body-${currentSuiteId}`);
  if (!body) return;

  // Remove running indicator
  const running = body.querySelector(".case-running");
  if (running) running.remove();

  const icons = { pass: "&#10003;", fail: "&#10007;", gap: "&#9888;" };
  const row = document.createElement("div");
  row.className = `case-row case-${type}`;
  row.innerHTML = `
    <span class="case-icon">${icons[type]}</span>
    <span class="case-label">${escapeHtml(event.label)}</span>
    <span class="case-kind kind-${event.kind || "verify"}">${event.kind || "verify"}</span>
  `;
  body.appendChild(row);
}

function updateNavStatus(suiteId, status) {
  const badge = document.getElementById(`navStatus-${suiteId}`);
  if (!badge) return;
  const labels = { pending: "대기", running: "실행 중", passed: "통과", failed: "실패", skipped: "스킵" };
  badge.textContent = labels[status] || status;
  badge.className = `suite-status-badge status-${status}`;
}

function updateSuiteStats(suiteId, passed, failed, gaps) {
  const stats = document.getElementById(`stats-${suiteId}`);
  if (!stats) return;
  stats.innerHTML = `
    <span class="stat-pass">${passed} pass</span>
    <span class="stat-fail">${failed} fail</span>
    <span class="stat-gap">${gaps} gap</span>
  `;
}

function updateProgress() {
  const expected = totalExpected || 1;
  const pct = Math.min(100, (totalCompleted / expected) * 100);
  const bar = document.getElementById("progressBar");
  bar.style.width = `${pct}%`;
  bar.className = totalFailed > 0 ? "progress-bar has-fail" : "progress-bar";
  document.getElementById("totalProgress").textContent = `${totalCompleted} / ${totalExpected}`;
}

function updateTimer() {
  if (!startTime) return;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  document.getElementById("timerDisplay").textContent = `${elapsed}s`;
}

function toggleLogs(logId) {
  const el = document.getElementById(logId);
  if (el) el.classList.toggle("open");
}

function toggleSuiteBody(suiteId) {
  const body = document.getElementById(`body-${suiteId}`);
  const toggle = document.getElementById(`toggle-${suiteId}`);
  if (!body) return;
  body.classList.toggle("collapsed");
  if (toggle) toggle.classList.toggle("collapsed");
}

function scrollToBottom(container) {
  if (!container || container.classList.contains("collapsed")) return;
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
