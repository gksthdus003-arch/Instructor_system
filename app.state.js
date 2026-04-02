const STORAGE_KEY = window.IMS_CONFIG?.storageKey || "ims_app_v5";
const API_BASE_URL = window.IMS_CONFIG?.apiBaseUrl || window.location.origin;
const KRW = new Intl.NumberFormat("ko-KR");
const ROLE_LABELS = { user: "사용자", team_leader: "팀 리더", total_leader: "총괄 리더", admin: "관리자" };
const MENU_ORDER = ["dashboard", "instructors", "schedule", "settlement", "settings", "admin"];
const MENU_LABELS = {
  dashboard: "대시보드",
  instructors: "강사 관리",
  schedule: "일정 관리",
  settlement: "출강·정산 관리",
  settings: "설정",
  admin: "관리자 설정"
};
const seed = {
  users: [
    { id: "u1", loginId: "admin", password: "", name: "총괄 관리자", role: "admin", team: "운영관리" }
  ],
  settings: {
    gradeRules: {
      A: { unitType: "hour", rate: 300000 },
      B: { unitType: "hour", rate: 240000 },
      C: { unitType: "hour", rate: 180000 },
      FT: { unitType: "hour", rate: 420000 }
    },
    departments: ["운영관리"],
    gradeDefaultRate: { A: 300000, B: 240000, C: 180000, FT: 420000 },
    transportRateByRegion: { 수도권: 30000, 충청권: 50000, 영남권: 70000, 호남권: 70000, 제주권: 120000 },
    roleMenuPermissions: {
      user: ["dashboard", "instructors", "schedule", "settlement", "settings"],
      team_leader: ["dashboard", "instructors", "schedule", "settlement", "settings"],
      total_leader: ["dashboard", "instructors", "schedule", "settlement", "settings", "admin"],
      admin: ["dashboard", "instructors", "schedule", "settlement", "settings", "admin"]
    },
    settlementAccessByRole: {
      user: "own",
      team_leader: "team",
      total_leader: "all",
      admin: "all"
    }
  },
  instructors: [],
  schedules: [],
  dispatches: [],
  settlementEmails: [],
  auditLogs: []
};

let state = loadState();
state.meta = state.meta || {};
let stateNeedsBootstrapSave = false;
if (!state.meta.importedSchedulesConfirmed) {
  state.schedules.forEach((schedule) => {
    if (schedule?.importedFromExcel && !schedule.deleted) schedule.status = "confirmed";
  });
  state.meta.importedSchedulesConfirmed = true;
  stateNeedsBootstrapSave = true;
}
if (!state.meta.instructorSpecializationsCleared) {
  state.instructors.forEach((instructor) => {
    instructor.field = "";
    instructor.specialization = "";
    instructor.specializations = [];
  });
  state.meta.instructorSpecializationsCleared = true;
  stateNeedsBootstrapSave = true;
}
if (!state.meta.demoAprilSchedulesForTestHansoyeon) {
  state.meta.demoAprilSchedulesForTestHansoyeon = true;
  stateNeedsBootstrapSave = true;
}
if (!state.meta.aprilSchedulesAndRequestsCleared) {
  const aprilScheduleIds = new Set(
    state.schedules
      .filter((schedule) => String(schedule?.date || "").startsWith("2026-04"))
      .map((schedule) => schedule.id)
  );
  state.schedules = state.schedules.filter((schedule) => !aprilScheduleIds.has(schedule.id));
  state.dispatches = state.dispatches.filter((dispatch) => !aprilScheduleIds.has(dispatch.scheduleId) && !String(dispatch?.date || "").startsWith("2026-04"));
  state.scheduleRequests = [];
  state.meta.aprilSchedulesAndRequestsCleared = true;
  stateNeedsBootstrapSave = true;
}
normalizeSettingsSchema();
if (stateNeedsBootstrapSave) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
let session = { userId: localStorage.getItem("ims_current_user") || "" };
let view = "dashboard";
let settlementMonth = "";
let settlementInstructorFilter = "";
let settlementManagerFilter = "";
let settlementCourseFilter = "";
let settlementCourseComposing = false;
let settlementDateFrom = "";
let settlementDateTo = "";
let settlementDateFromInput = "";
let settlementDateToInput = "";
let settlementSelectedInstructorIds = [];
let settlementEmailSending = false;
let settlementSummarySearch = "";
let settlementSummaryComposing = false;
let settlementRecentRange = null;
let settlementShowAllRows = false;
let settlementSortKey = "date";
let settlementSortDirection = "asc";
let settlementSubTab = "dispatch_list";
let settlementPeriodMode = "";
let userScheduleAlertCollapsed = false;
let selectedInstructorId = "";
let dispatchReceiptDraft = null;
let instructorFilter = { q: "", grade: "", specializationList: [], limit: "default", ratingMin: 0 };
let instructorSearchComposing = false;
let editingInstructorSpecializations = [];
let scheduleViewMode = "calendar";
let scheduleSearchQuery = "";
let scheduleDepartmentFilter = "";
let scheduleCalendarMonth = new Date().toISOString().slice(0, 7);
let editingScheduleInstructorIds = [];
let editingScheduleStatus = "draft";
let scheduleSearchComposing = false;
let scheduleDateFrom = "";
let scheduleDateTo = "";
let scheduleDateFromInput = "";
let scheduleDateToInput = "";
let pendingScheduleSave = null;
let pendingScheduleDraft = null;
let scheduleModalDraft = null;
let editingScheduleAdditionalDates = [];
let alertPanelOpen = false;
let alertReadKeys = [];
let adminSubTab = "grade_transport";
let adminPendingTransportRow = false;

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(seed);
  try {
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(seed),
      ...parsed,
      settings: {
        ...structuredClone(seed).settings,
        ...(parsed.settings || {}),
        gradeRules: { ...(seed.settings?.gradeRules || {}), ...(parsed.settings?.gradeRules || {}) },
        gradeDefaultRate: { ...seed.settings.gradeDefaultRate, ...(parsed.settings?.gradeDefaultRate || {}) },
        transportRateByRegion: { ...seed.settings.transportRateByRegion, ...(parsed.settings?.transportRateByRegion || {}) }
      }
    };
  } catch {
    return structuredClone(seed);
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function uid(prefix = "id") { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`; }
function v(id) { return document.getElementById(id)?.value?.trim() || ""; }
function fmtMoney(n) { return `${KRW.format(Math.round(Number(n || 0)))}원`; }
function toLocal(iso) { return iso ? new Date(iso).toLocaleString("ko-KR") : "-"; }
function getCurrentUser() { return state.users.find((u) => u.id === session.userId) || null; }
function canAdmin() { return ["admin", "total_leader"].includes(getCurrentUser()?.role); }
function isTeamLeader(user = getCurrentUser()) { return user?.role === "team_leader"; }
function isRegularUser(user = getCurrentUser()) { return user?.role === "user"; }
function roleLabel(role) { return ROLE_LABELS[role] || role || "-"; }
function defaultRolePermissions() {
  return {
    user: ["dashboard", "instructors", "schedule", "settlement", "settings"],
    team_leader: ["dashboard", "instructors", "schedule", "settlement", "settings"],
    total_leader: ["dashboard", "instructors", "schedule", "settlement", "settings", "admin"],
    admin: ["dashboard", "instructors", "schedule", "settlement", "settings", "admin"]
  };
}
function getRoleMenuPermissions(role) {
  const map = state.settings?.roleMenuPermissions || {};
  const fallback = defaultRolePermissions();
  const key = role || "user";
  const allowed = Array.isArray(map[key]) ? map[key] : fallback[key];
  const safe = (allowed || []).filter((menu) => MENU_ORDER.includes(menu));
  if (["admin", "total_leader"].includes(key) && !safe.includes("admin")) safe.push("admin");
  return [...new Set(safe)];
}
function canAccessMenu(name) {
  const user = getCurrentUser();
  if (!user) return false;
  if (!MENU_ORDER.includes(name)) return false;
  return getRoleMenuPermissions(user.role).includes(name);
}
function nameOfInstructor(id) { return state.instructors.find((i) => i.id === id)?.name || "-"; }
function nameOfUser(id) { return state.users.find((u) => u.id === id)?.name || "-"; }
function teamOfUser(userId) { return state.users.find((u) => u.id === userId)?.team || "-"; }
function getDepartmentNames() {
  const configured = Array.isArray(state.settings?.departments) ? state.settings.departments : [];
  const fromUsers = state.users.map((u) => u.team || "-");
  const fromSchedules = state.schedules.map((s) => scheduleDepartmentName(s));
  return [...new Set([...configured, ...fromUsers, ...fromSchedules].filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
}
function scheduleDepartmentName(schedule) { return schedule?.ownerTeam || schedule?.team || teamOfUser(schedule?.managerId) || "-"; }
function scheduleManagerDisplay(schedule) { return `${nameOfUser(schedule?.managerId)} / ${scheduleDepartmentName(schedule)}`; }
function defaultSettlementAccessByRole() {
  return { user: "own", team_leader: "team", total_leader: "all", admin: "all" };
}
function getSettlementAccessScope(role) {
  const saved = state.settings?.settlementAccessByRole || {};
  const defaults = defaultSettlementAccessByRole();
  return saved[role] || defaults[role] || "own";
}
function canViewScheduleByUser(schedule, user = getCurrentUser()) {
  if (!schedule || schedule.deleted || !user) return false;
  if (user.role === "instructor") return getScheduleInstructorIds(schedule).includes(user.linkedInstructorId);
  return true;
}
function canViewDispatchByUser(dispatch, user = getCurrentUser()) {
  const schedule = state.schedules.find((s) => s.id === dispatch?.scheduleId);
  if (!schedule || !user) return false;
  const scope = getSettlementAccessScope(user.role);
  const ownerTeam = scheduleDepartmentName(schedule);
  if (scope === "all") return true;
  if (scope === "team") return ownerTeam === (user.team || "-");
  return schedule.managerId === user.id && ownerTeam === (user.team || "-");
}
function getVisibleSchedules(user = getCurrentUser()) { return state.schedules.filter((schedule) => canViewScheduleByUser(schedule, user)); }
function getVisibleDispatches(user = getCurrentUser()) { return state.dispatches.filter((dispatch) => canViewDispatchByUser(dispatch, user)); }
function nowIso() { return new Date().toISOString(); }
function toMonth(dateLike) { return String(dateLike || "").slice(0, 7); }
function monthStart(monthKey) { return new Date(`${monthKey}-01T00:00:00`); }
function monthLabel(monthKey) { return `${Number(monthKey.slice(5, 7))}월`; }
function monthDiff(baseMonth, delta) {
  const d = monthStart(baseMonth);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function parseSortableValue(raw = "") {
  const text = String(raw || "").trim();
  if (!text) return { type: "text", value: "" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return { type: "date", value: text };
  const normalizedNumber = text.replace(/[^\d.-]/g, "");
  if (normalizedNumber && /^-?\d+(\.\d+)?$/.test(normalizedNumber)) return { type: "number", value: Number(normalizedNumber) };
  return { type: "text", value: text.toLowerCase() };
}
function compareSortableText(left, right) {
  const a = parseSortableValue(left);
  const b = parseSortableValue(right);
  if (a.type === b.type) {
    if (a.value < b.value) return -1;
    if (a.value > b.value) return 1;
    return 0;
  }
  return String(a.value).localeCompare(String(b.value), "ko");
}
function updateSortableHeaderState(table, activeIndex, direction) {
  [...table.querySelectorAll("thead th")].forEach((th, index) => {
    const label = th.dataset.sortLabel || th.textContent.trim();
    if (!label) return;
    th.dataset.sortLabel = label;
    if (index !== activeIndex) th.innerHTML = th.innerHTML.replace(/\s[↑↓]$/, "");
    if (index === activeIndex) th.innerHTML = `${esc(label)} ${direction === "asc" ? "↑" : "↓"}`;
  });
}
function enhanceSortableTables(root = document) {
  root.querySelectorAll("table").forEach((table) => {
    if (table.classList.contains("settlement-table")) return;
    const headers = [...table.querySelectorAll("thead th")];
    headers.forEach((th, index) => {
      if (th.dataset.sortReady === "true") return;
      if (th.querySelector("input, button, select") || th.getAttribute("onclick") || !th.textContent.trim() || /관리/.test(th.textContent.trim())) return;
      th.dataset.sortReady = "true";
      th.dataset.sortLabel = th.textContent.trim();
      th.style.cursor = "pointer";
      th.addEventListener("click", () => {
        const tbody = table.querySelector("tbody");
        if (!tbody) return;
        const rows = [...tbody.querySelectorAll("tr")];
        const sortableRows = rows.filter((row) => row.children.length > index && !(row.children.length === 1 && row.querySelector(".sub")));
        const fillerRows = rows.filter((row) => !sortableRows.includes(row));
        const nextDirection = table.dataset.sortIndex === String(index) && table.dataset.sortDirection === "asc" ? "desc" : "asc";
        sortableRows.sort((left, right) => {
          const result = compareSortableText(left.children[index]?.textContent || "", right.children[index]?.textContent || "");
          return nextDirection === "asc" ? result : -result;
        });
        tbody.innerHTML = "";
        [...sortableRows, ...fillerRows].forEach((row) => tbody.appendChild(row));
        table.dataset.sortIndex = String(index);
        table.dataset.sortDirection = nextDirection;
        updateSortableHeaderState(table, index, nextDirection);
      });
    });
  });
}
function pctDelta(current, prev) {
  if (!prev) return 0;
  return ((current - prev) / prev) * 100;
}
function esc(s = "") { return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
function fmtPhone(raw = "") {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length >= 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  return raw;
}
function highlightText(text = "", keyword = "") {
  const raw = String(text || "");
  const q = String(keyword || "").trim();
  if (!q) return esc(raw);
  const lowerRaw = raw.toLowerCase();
  const lowerQ = q.toLowerCase();
  let cursor = 0;
  let out = "";
  while (cursor < raw.length) {
    const idx = lowerRaw.indexOf(lowerQ, cursor);
    if (idx < 0) {
      out += esc(raw.slice(cursor));
      break;
    }
    out += esc(raw.slice(cursor, idx));
    out += `<mark class="search-hit">${esc(raw.slice(idx, idx + q.length))}</mark>`;
    cursor = idx + q.length;
  }
  return out;
}
function durationHours(start, end) { const [sh, sm] = start.split(":").map(Number); const [eh, em] = end.split(":").map(Number); return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60); }
function isConflict(a, b) { return a.date === b.date && a.instructorId === b.instructorId && a.start < b.end && b.start < a.end; }
function transportByRegion(region) { return Number(state.settings.transportRateByRegion[region] || 0); }
function defaultRegion() { return Object.keys(state.settings.transportRateByRegion)[0] || "기본"; }
function addHoursToTime(start, hours) {
  const [h, m] = String(start || "09:00").split(":").map(Number);
  const total = h * 60 + m + Math.round(Number(hours || 0) * 60);
  const hh = Math.floor(Math.max(total, 0) / 60) % 24;
  const mm = Math.max(total, 0) % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function getScheduleInstructorIds(s) {
  if (!s) return [];
  if (Array.isArray(s.instructorIds) && s.instructorIds.length) return [...new Set(s.instructorIds)];
  return s.instructorId ? [s.instructorId] : [];
}
function getScheduleInstructorNames(s) {
  return getScheduleInstructorIds(s).map((id) => nameOfInstructor(id)).filter((n) => n && n !== "-");
}
function getScheduleHours(s) {
  if (Number(s?.hours || 0) > 0) return Number(s.hours);
  if (s?.start && s?.end) return durationHours(s.start, s.end);
  return 0;
}
function getGradeRulesMap() {
  const rules = state.settings?.gradeRules || {};
  const legacy = state.settings?.gradeDefaultRate || {};
  const keys = [...new Set([...Object.keys(legacy), ...Object.keys(rules)])];
  const out = {};
  keys.forEach((k) => {
    const raw = rules[k];
    if (raw && typeof raw === "object") out[k] = { unitType: raw.unitType === "day" ? "day" : "hour", rate: Number(raw.rate || 0) };
    else out[k] = { unitType: "hour", rate: Number(legacy[k] || 0) };
  });
  if (!Object.keys(out).length) out.A = { unitType: "hour", rate: 0 };
  return out;
}
function getGradeRule(grade) {
  const rules = getGradeRulesMap();
  return rules[grade] || { unitType: "hour", rate: 0 };
}
function normalizeSettingsSchema() {
  const rules = getGradeRulesMap();
  state.settings.gradeRules = rules;
  state.settings.gradeDefaultRate = Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, Number(v.rate || 0)]));
  const rolePermissions = defaultRolePermissions();
  const savedPermissions = state.settings.roleMenuPermissions || {};
  state.settings.roleMenuPermissions = {
    user: Array.isArray(savedPermissions.user) ? savedPermissions.user.filter((m) => MENU_ORDER.includes(m)) : rolePermissions.user,
    team_leader: Array.isArray(savedPermissions.team_leader) ? savedPermissions.team_leader.filter((m) => MENU_ORDER.includes(m)) : rolePermissions.team_leader,
    total_leader: Array.isArray(savedPermissions.total_leader) ? savedPermissions.total_leader.filter((m) => MENU_ORDER.includes(m)) : rolePermissions.total_leader,
    admin: Array.isArray(savedPermissions.admin) ? savedPermissions.admin.filter((m) => MENU_ORDER.includes(m)) : rolePermissions.admin
  };
  state.settings.departments = [...new Set((Array.isArray(state.settings.departments) ? state.settings.departments : []).filter(Boolean))];
  const savedSettlementAccess = state.settings.settlementAccessByRole || {};
  const defaultSettlementAccess = defaultSettlementAccessByRole();
  state.settings.settlementAccessByRole = {
    user: ["own", "team", "all"].includes(savedSettlementAccess.user) ? savedSettlementAccess.user : defaultSettlementAccess.user,
    team_leader: ["own", "team", "all"].includes(savedSettlementAccess.team_leader) ? savedSettlementAccess.team_leader : defaultSettlementAccess.team_leader,
    total_leader: ["own", "team", "all"].includes(savedSettlementAccess.total_leader) ? savedSettlementAccess.total_leader : defaultSettlementAccess.total_leader,
    admin: ["own", "team", "all"].includes(savedSettlementAccess.admin) ? savedSettlementAccess.admin : defaultSettlementAccess.admin
  };
  if (!state.settings.roleMenuPermissions.admin.includes("admin")) state.settings.roleMenuPermissions.admin.push("admin");
  if (!state.settings.roleMenuPermissions.total_leader.includes("admin")) state.settings.roleMenuPermissions.total_leader.push("admin");
  state.users.forEach((u) => {
    if (u.role === "manager") u.role = "team_leader";
    if (!ROLE_LABELS[u.role]) u.role = "user";
    if (!u.team) u.team = "-";
  });
  state.schedules.forEach((s) => {
    if (!s.ownerTeam) s.ownerTeam = s.team || teamOfUser(s.managerId) || "-";
    delete s.team;
  });
  state.settings.departments = [...new Set([...state.settings.departments, ...state.users.map((u) => u.team || "-"), ...state.schedules.map((s) => s.ownerTeam || "-")].filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  state.instructors.forEach((i) => {
    const rule = getGradeRule(i.grade);
    i.unitType = i.unitType === "day" ? "day" : (i.unitType === "hour" ? "hour" : rule.unitType);
    if (!Number.isFinite(Number(i.baseRate)) || Number(i.baseRate) <= 0) i.baseRate = Number(rule.rate || 0);
  });
}
function scheduleBadge(status) {
  if (status === "draft") return '<span class="status-pill st-warn">가안</span>';
  if (status === "confirmed") return '<span class="status-pill st-info">확정</span>';
  return `<span class="status-pill st-neutral">${esc(status || "-")}</span>`;
}
function getScheduleSearchText(s) {
  const names = getScheduleInstructorNames(s).join(" ");
  return [s.date, s.course, s.clientName || "", names, nameOfUser(s.managerId), scheduleDepartmentName(s), s.region, s.status].join(" ").toLowerCase();
}
function isSettlementVisibleSchedule(s) {
  return !s.deleted && ["draft", "confirmed", "completed"].includes(s.status);
}
function scheduleManagerIdOfDispatch(d) {
  return state.schedules.find((s) => s.id === d.scheduleId)?.managerId || "";
}
function scheduleDepartmentOfDispatch(d) {
  return scheduleDepartmentName(state.schedules.find((s) => s.id === d.scheduleId));
}
function formatScheduleConflictLine(conflict) {
  const d = new Date(`${conflict.date}T00:00:00`);
  const dateLabel = `${String(d.getFullYear()).slice(2)}년 ${String(d.getMonth() + 1).padStart(2, "0")}월 ${String(d.getDate()).padStart(2, "0")}일`;
  const firstInstructorId = getScheduleInstructorIds(conflict)[0];
  const firstInstructor = state.instructors.find((i) => i.id === firstInstructorId);
  return `${dateLabel} ｜ ${firstInstructor?.name || "-"} 강사 ｜ 담당자 ${nameOfUser(conflict.managerId)} / ${scheduleDepartmentName(conflict)}`;
}
function commitScheduleSave(items, id = "") {
  const list = Array.isArray(items) ? items : [items];
  const savedIds = [];
  if (id) {
    Object.assign(state.schedules.find((s) => s.id === id), list[0]);
    savedIds.push(id);
  } else {
    list.forEach((item) => {
      const created = { id: uid("s"), ...item };
      state.schedules.push(created);
      savedIds.push(created.id);
    });
  }
  savedIds.forEach((savedId) => syncDispatchesFromSchedules(savedId));
  saveState();
  renderAll();
  if (id) openScheduleModal(id, "", false);
  else closeModal();
}
function openScheduleConflictModal(conflictLines, items, id) {
  const lines = Array.isArray(conflictLines) ? conflictLines : [conflictLines];
  const display = lines.map((line) => `<div><b>${esc(line)}</b></div>`).join("");
  pendingScheduleSave = { items, id };
  pendingScheduleDraft = {
    id: id || "",
    date: v("sc_date"),
    additionalDates: [...editingScheduleAdditionalDates],
    course: v("sc_course"),
    hours: Number(v("sc_hours") || 0),
    managerId: v("sc_manager"),
    region: v("sc_region") || defaultRegion(),
    status: editingScheduleStatus,
    instructorIds: [...editingScheduleInstructorIds]
  };
  modal(`<div class="between"><h3 style="margin:0">중복 일정 확인</h3><span class="plain-close" onclick="cancelScheduleConflictModal()" title="닫기">×</span></div><div class="card mt-10"><div style="font-size:20px;line-height:1;">⚠️</div><div class="mt-10">충돌되는 일정이 있습니다.</div><div class="mt-10">${display}</div><div class="mt-10">그래도 등록하시겠습니까?</div><div class="row row-end mt-12"><button class="btn" onclick="cancelScheduleConflictModal()">아니오</button><button class="btn primary" onclick="confirmScheduleConflictModal()">예</button></div></div>`);
}
function confirmScheduleConflictModal() {
  if (!pendingScheduleSave) return closeModal();
  const { items, id } = pendingScheduleSave;
  pendingScheduleSave = null;
  pendingScheduleDraft = null;
  commitScheduleSave(items, id);
}
function cancelScheduleConflictModal() {
  const draft = pendingScheduleDraft;
  pendingScheduleSave = null;
  pendingScheduleDraft = null;
  closeModal();
  if (draft) {
    scheduleModalDraft = draft;
    openScheduleModal(draft.id || "", draft.date || "", true, true);
  }
}
function normalizeSpecializations(raw) {
  const src = Array.isArray(raw) ? raw.join(",") : String(raw || "");
  const items = src.split(",").map((x) => x.trim()).filter(Boolean);
  return [...new Set(items)];
}
function getInstructorSpecializations(ins) {
  if (!ins) return [];
  if (Array.isArray(ins.specializations) && ins.specializations.length) return normalizeSpecializations(ins.specializations);
  return normalizeSpecializations(ins.specialization || ins.field || "");
}
function getAllSpecializationOptions() {
  return [...new Set(state.instructors.flatMap((i) => getInstructorSpecializations(i)))].sort((a, b) => a.localeCompare(b, "ko"));
}
function calcDispatch(item) {
  const basePay = Number(item.customRate || 0) * Number(item.units || 0);
  const transportCost = Number(item.transportCost || 0);
  const lodgingCost = Number(item.lodgingCost || 0);
  const materialCost = Number(item.materialCost || 0);
  const taxable = basePay + transportCost;
  const deduction = Math.round(taxable * (Number(item.deductionRate || 0) / 100));
  const net = taxable - deduction + lodgingCost + materialCost;
  return { basePay, gross: basePay + transportCost + lodgingCost + materialCost, deduction, net };
}
function buildNotifications() {
  const today = new Date().toISOString().slice(0, 10);
  const delayed = state.schedules.filter((s) => !s.deleted && s.status === "confirmed" && s.date < today)
    .map((s) => ({ key: `delayed_${s.id}`, at: `${s.date}T09:00:00`, text: `[일정지연] ${s.date} ${s.course} / 담당 ${nameOfUser(s.managerId)}` }));
  const modified = state.dispatches.filter((d) => !d.deleted && d.modifiedAfterEmail)
    .map((d) => ({ key: `dispatch_mod_${d.id}`, at: `${d.date}T18:00:00`, text: `[발송후수정] ${d.date} ${nameOfInstructor(d.instructorId)} 출강내역 수정됨` }));
  const logs = state.auditLogs.filter((l) => l.type === "dispatch_modified_after_email")
    .map((l) => ({ key: `audit_${l.id}`, at: l.at, text: `[수정이력] ${l.detail}` }));
  return [...delayed, ...modified, ...logs].sort((a, b) => `${b.at}`.localeCompare(`${a.at}`)).slice(0, 30);
}
function refreshAlertBadge() {
  const btn = document.getElementById("alertBtn");
  if (!btn) return;
  const notes = buildNotifications();
  const unread = notes.filter((n) => !alertReadKeys.includes(n.key)).length;
  btn.textContent = `알림 ${unread}건`;
}
function markAllAlertsRead() {
  alertReadKeys = buildNotifications().map((n) => n.key);
  refreshAlertBadge();
  renderAlertPanel();
}
function renderAlertPanel() {
  const panel = document.getElementById("alertPanel");
  if (!panel) return;
  const notes = buildNotifications();
  panel.innerHTML = `<div class="between"><b>알림</b><button class="btn" style="padding:6px 10px;" onclick="markAllAlertsRead()">모두확인</button></div><div class="mt-10">${notes.map((n) => `<div class="alert-item ${alertReadKeys.includes(n.key) ? "" : "is-unread"}"><div>${esc(n.text)}</div><div class="sub mt-10">${toLocal(n.at)}</div></div>`).join("") || '<div class="sub">알림이 없습니다.</div>'}</div>`;
}
function toggleAlertPanel(e) {
  if (e?.stopPropagation) e.stopPropagation();
  const panel = document.getElementById("alertPanel");
  if (!panel) return;
  alertPanelOpen = !alertPanelOpen;
  panel.classList.toggle("hidden", !alertPanelOpen);
  if (alertPanelOpen) renderAlertPanel();
}
function modal(inner) { document.getElementById("modalRoot").innerHTML = `<div class="modal"><div class="modal-box">${inner}</div></div>`; }
function closeModal() { document.getElementById("modalRoot").innerHTML = ""; }

