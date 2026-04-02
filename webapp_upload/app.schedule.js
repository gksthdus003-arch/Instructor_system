function openScheduleModal(id = "", presetDate = "", editable = true, useDraft = false) {
  const t = state.schedules.find((s) => s.id === id) || null;
  const draft = useDraft ? scheduleModalDraft : null;
  if (useDraft) scheduleModalDraft = null;
  const isExisting = Boolean(t);
  const isEditMode = isExisting ? editable : true;
  const me = getCurrentUser();
  const managerId = draft?.managerId || t?.managerId || me?.id || state.users[0]?.id || "";
  const managerName = nameOfUser(managerId);
  const ownerTeam = draft?.ownerTeam || t?.ownerTeam || me?.team || teamOfUser(managerId) || "-";
  const instructorOptions = state.instructors.map((i) => `<option value="${esc(i.name)}"></option>`).join("");
  editingScheduleInstructorIds = draft?.instructorIds ? [...draft.instructorIds] : getScheduleInstructorIds(t);
  editingScheduleStatus = draft?.status || (t?.status === "confirmed" ? "confirmed" : "draft");
  const dateValue = draft?.date || t?.date || presetDate || "";
  editingScheduleAdditionalDates = draft?.additionalDates ? [...draft.additionalDates] : [];
  const startValue = draft?.start || t?.start || "09:00";
  const endValue = draft?.end || t?.end || addHoursToTime(startValue, Number(draft?.hours || getScheduleHours(t) || 1));
  const hoursValue = Number(draft?.hours || getScheduleHours({ start: startValue, end: endValue, hours: draft?.hours || t?.hours }) || 1);
  const regionValue = draft?.region || t?.region || defaultRegion();
  const courseValue = draft?.course || t?.course || "";
  const clientValue = draft?.clientName || t?.clientName || "";
  const statusView = scheduleBadge(editingScheduleStatus);
  const instructorView = esc((draft?.instructorIds || getScheduleInstructorIds(t)).map((x) => nameOfInstructor(x)).join(", ") || "-");
  modal(`<div class="between"><h3 style="margin:0">${t ? "일정 상세" : "일정 등록"}</h3><span class="plain-close" onclick="closeModal()" title="닫기">×</span></div><div class="mt-10" style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;"><input id="sc_id" type="hidden" value="${esc(t?.id || "")}" /><input id="sc_owner_team" type="hidden" value="${esc(ownerTeam)}" />${!isExisting && isEditMode ? `<input id="sc_date" type="hidden" value="${esc(dateValue)}" /><div style="grid-column:span 3;"><label>일정</label><div id="sc_date_tags" class="row"></div><div class="row mt-10"><input id="sc_extra_date" type="date" onchange="addScheduleAdditionalDateFromInput(this.value)" /></div></div>` : `<div style="grid-column:span 3;"><label>일정</label>${isEditMode ? `<input id="sc_date" type="date" value="${dateValue}" />` : `<div class="view-value">${esc(dateValue)}</div>`}</div>`}<div style="grid-column:span 3;"><label>상태</label>${isEditMode ? `<div id="sc_status_buttons" class="row"></div>` : `<div class="view-value">${statusView}</div>`}</div><div style="grid-column:span 3;"><label>고객사명</label>${isEditMode ? `<input id="sc_client_name" value="${esc(clientValue)}" />` : `<div class="view-value">${esc(clientValue || "-")}</div>`}</div><div style="grid-column:span 3;"><label>과정명</label>${isEditMode ? `<input id="sc_course" value="${esc(courseValue)}" />` : `<div class="view-value">${esc(courseValue || "-")}</div>`}</div><div style="grid-column:span 3;"><label>부서</label><div class="view-value">${esc(ownerTeam)}</div></div><div style="grid-column:span 3;"><label>담당자</label><div class="view-value">${esc(managerName)}</div><input id="sc_manager" type="hidden" value="${esc(managerId)}" /></div><div style="grid-column:1/-1;"><label>강사</label>${isEditMode ? `<div id="sc_ins_tags" class="row"></div><div class="row mt-10"><input id="sc_ins_input" placeholder="강사명 입력" list="scInsList" oninput="onScheduleInstructorInput()" /></div><datalist id="scInsList">${instructorOptions}</datalist>` : `<div class="view-value">${instructorView}</div>`}</div><div style="grid-column:span 2;"><label>시작 시간</label>${isEditMode ? `<input id="sc_start" type="time" value="${esc(startValue)}" />` : `<div class="view-value">${esc(startValue)}</div>`}</div><div style="grid-column:span 2;"><label>종료 시간</label>${isEditMode ? `<input id="sc_end" type="time" value="${esc(endValue)}" />` : `<div class="view-value">${esc(endValue)}</div>`}</div><div style="grid-column:span 2;"><label>시간</label><div id="sc_hours_view" class="view-value">${hoursValue}시간</div></div><div style="grid-column:span 3;"><label>지역</label>${isEditMode ? `<select id="sc_region">${Object.keys(state.settings.transportRateByRegion).map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("")}</select>` : `<div class="view-value">${esc(regionValue)}</div>`}</div><div style="grid-column:1/-1;"><label>중복 체크</label><div id="scheduleConflict" class="sub">${isEditMode ? "자동 확인" : "-"}</div></div></div><div class="row row-end mt-12">${isExisting ? `<button class="btn" onclick="openScheduleModal('${t.id}','',true)">수정</button><button class="btn danger" onclick="deleteSchedule('${t.id}')">삭제</button><button class="btn primary" ${isEditMode ? "" : "disabled"} onclick="saveSchedule('${t.id}')">저장</button>` : `<button class="btn primary" onclick="saveSchedule('')">저장</button>`}</div>`);
  if (!isEditMode) return;
  renderScheduleStatusButtons();
  renderScheduleInstructorTags();
  renderScheduleDateTags();
  const input = document.getElementById("sc_ins_input");
  if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addScheduleInstructorByName(input.value); } });
  document.getElementById("sc_region").value = regionValue;
  ["sc_date", "sc_start", "sc_end", "sc_ins_input"].forEach((x) => document.getElementById(x)?.addEventListener("input", () => {
    syncScheduleHoursPreview();
    checkConflict(t?.id || "");
  }));
  syncScheduleHoursPreview();
  checkConflict(t?.id || "");
}
function getScheduleTimeRange() {
  const start = v("sc_start") || "09:00";
  const end = v("sc_end") || start;
  const hours = durationHours(start, end);
  return { start, end, hours };
}
function syncScheduleHoursPreview() {
  const box = document.getElementById("sc_hours_view");
  if (!box) return;
  const { start, end, hours } = getScheduleTimeRange();
  box.textContent = start < end ? `${hours}시간` : "시간을 확인해주세요.";
}
function renderScheduleStatusButtons() {
  const root = document.getElementById("sc_status_buttons");
  if (!root) return;
  root.innerHTML = `
    <button class="btn ${editingScheduleStatus === "draft" ? "status-btn-draft active" : "status-btn-draft"}" onclick="setScheduleStatus('draft')">가안</button>
    <button class="btn ${editingScheduleStatus === "confirmed" ? "status-btn-confirmed active" : "status-btn-confirmed"}" onclick="setScheduleStatus('confirmed')">확정</button>
  `;
}
function setScheduleStatus(status) {
  editingScheduleStatus = status;
  renderScheduleStatusButtons();
}
function renderScheduleInstructorTags() {
  const box = document.getElementById("sc_ins_tags");
  if (!box) return;
  box.innerHTML = editingScheduleInstructorIds.map((id) => `<span class="status-pill st-neutral">${esc(nameOfInstructor(id))} <span style="margin-left:6px;cursor:pointer;" onclick="removeScheduleInstructor('${id}')">x</span></span>`).join("") || '<span class="sub">선택된 강사 없음</span>';
}
function renderScheduleDateTags() {
  const box = document.getElementById("sc_date_tags");
  if (!box) return;
  const rows = getCurrentScheduleDates()
    .map((date) => `<span class="status-pill st-neutral">${esc(date)} <span style="margin-left:6px;cursor:pointer;" onclick="removeScheduleAdditionalDate('${date}')">x</span></span>`);
  box.innerHTML = rows.join("") || '<span class="sub">추가된 날짜 없음</span>';
}
function addScheduleAdditionalDateFromInput(nextDate = "") {
  const input = document.getElementById("sc_extra_date");
  if (!nextDate) return;
  const currentDates = getCurrentScheduleDates();
  if (!currentDates.length) {
    const base = document.getElementById("sc_date");
    if (base) base.value = nextDate;
  } else if (!currentDates.includes(nextDate)) {
    editingScheduleAdditionalDates.push(nextDate);
  }
  editingScheduleAdditionalDates = [...new Set(editingScheduleAdditionalDates)].sort();
  if (input) input.value = "";
  renderScheduleDateTags();
  checkConflict();
}
function removeScheduleAdditionalDate(date) {
  const currentDates = getCurrentScheduleDates().filter((item) => item !== date);
  const base = document.getElementById("sc_date");
  if (base) base.value = currentDates[0] || "";
  editingScheduleAdditionalDates = currentDates.slice(1);
  renderScheduleDateTags();
  checkConflict();
}
function addScheduleInstructorByName(rawName = "") {
  const name = String(rawName || "").trim();
  if (!name) return;
  const target = state.instructors.find((i) => i.name === name || i.name.includes(name));
  if (!target) return;
  if (!editingScheduleInstructorIds.includes(target.id)) editingScheduleInstructorIds.push(target.id);
  const input = document.getElementById("sc_ins_input");
  if (input) input.value = "";
  renderScheduleInstructorTags();
  checkConflict();
}
function onScheduleInstructorInput() {
  const input = document.getElementById("sc_ins_input");
  const typed = input?.value?.trim() || "";
  if (!typed) return;
  const exact = state.instructors.find((i) => i.name === typed);
  if (exact) addScheduleInstructorByName(typed);
}
function removeScheduleInstructor(id) {
  editingScheduleInstructorIds = editingScheduleInstructorIds.filter((x) => x !== id);
  renderScheduleInstructorTags();
  checkConflict();
}
function getCurrentScheduleDates() {
  return [...new Set([v("sc_date"), ...editingScheduleAdditionalDates].filter(Boolean))].sort();
}
function findScheduleConflictByDate(date, editId = "") {
  const { start, end } = getScheduleTimeRange();
  const current = { date, start, end, instructorIds: editingScheduleInstructorIds };
  return state.schedules.find((s) => {
    if (s.deleted || ["canceled", "deleted"].includes(s.status) || s.id === editId) return false;
    if (s.date !== current.date || !(current.start < s.end && s.start < current.end)) return false;
    const otherIds = getScheduleInstructorIds(s);
    return current.instructorIds.some((instructorId) => otherIds.includes(instructorId));
  }) || null;
}
function checkConflict(editId = "") {
  const conflicts = getCurrentScheduleDates().map((date) => findScheduleConflictByDate(date, editId)).filter(Boolean);
  const box = document.getElementById("scheduleConflict");
  if (!box) return conflicts[0] || null;
  if (conflicts.length) {
    const lines = [...new Set(conflicts.map((conflict) => formatScheduleConflictLine(conflict)))];
    box.innerHTML = `<span class="text-danger">${lines.map((line) => `[중복] ${esc(line)}`).join("<br/>")}</span>`;
    return conflicts[0];
  }
  box.innerHTML = '<span class="text-ok">중복 없음</span>';
  return null;
}
function saveSchedule(id) {
  if (!editingScheduleInstructorIds.length) return alert("강사를 1명 이상 선택해주세요.");
  const { start, end, hours } = getScheduleTimeRange();
  if (!(hours > 0) || !(start < end)) return alert("시작 시간과 종료 시간을 확인해주세요.");
  const dates = id ? [v("sc_date")] : getCurrentScheduleDates();
  if (!dates.length) return alert("일정을 1개 이상 추가해주세요.");
  const items = dates.map((date) => ({
    course: v("sc_course"),
    clientName: v("sc_client_name"),
    date,
    hours,
    start,
    end,
    managerId: v("sc_manager"),
    instructorId: editingScheduleInstructorIds[0],
    instructorIds: [...editingScheduleInstructorIds],
    ownerTeam: v("sc_owner_team") || getCurrentUser()?.team || "-",
    status: editingScheduleStatus,
    region: v("sc_region") || defaultRegion(),
    deleted: false
  }));
  if (!items[0]?.course) return alert("과정명은 필수입니다.");
  const conflicts = dates.map((date) => findScheduleConflictByDate(date, id)).filter(Boolean);
  if (conflicts.length) {
    const lines = [...new Set(conflicts.map((conflict) => formatScheduleConflictLine(conflict)))];
    return openScheduleConflictModal(lines, items, id);
  }
  commitScheduleSave(items, id);
}
function deleteSchedule(id) {
  const s = state.schedules.find((x) => x.id === id); if (!s) return;
  s.deleted = true; s.status = "deleted";
  syncDispatchesFromSchedules(s.id);
  state.auditLogs.push({ id: uid("log"), type: "schedule_deleted", at: nowIso(), by: getCurrentUser()?.name || "-", detail: `${s.date} ${s.course} 삭제` });
  saveState(); closeModal(); renderAll();
}
function renderSchedule() {
  const monthSelector = `<div class="row"><button class="btn" onclick="shiftScheduleMonth(-1)">이전</button><input class="sch-month-input" type="month" value="${scheduleCalendarMonth}" onchange="setScheduleCalendarMonth(this.value)" /><button class="btn" onclick="shiftScheduleMonth(1)">다음</button></div>`;
  if (!scheduleDateFromInput && scheduleDateFrom) scheduleDateFromInput = scheduleDateFrom;
  if (!scheduleDateToInput && scheduleDateTo) scheduleDateToInput = scheduleDateTo;
  const filterBadge = (scheduleDateFrom || scheduleDateTo) ? '<span class="status-pill st-info">필터 적용중</span>' : "";
  document.getElementById("view-schedule").innerHTML = `<div class="between schedule-topbar"><div></div><div class="row"><button class="btn primary" onclick="openScheduleModal('','',true)">일정 등록</button><div class="view-toggle"><button class="btn ${scheduleViewMode === "list" ? "primary" : ""}" onclick="setScheduleViewMode('list')">☰</button><button class="btn ${scheduleViewMode === "calendar" ? "primary" : ""}" onclick="setScheduleViewMode('calendar')">📅</button></div></div></div><div class="card"><div class="schedule-filter-top"><label>일정 ${filterBadge}</label><div class="schedule-date-line"><input id="sch_date_from" type="date" value="${scheduleDateFromInput}" oninput="setScheduleDateInput('from',this.value)" /><span>~</span><input id="sch_date_to" type="date" value="${scheduleDateToInput}" oninput="setScheduleDateInput('to',this.value)" /><div class="schedule-date-actions"><button class="btn" onclick="applyScheduleDateRange()">적용</button><button class="btn" onclick="resetScheduleFilters()">초기화</button></div></div></div><div class="schedule-filter-bottom mt-10"><label>검색</label><input id="sch_search_input" value="${esc(scheduleSearchQuery)}" placeholder="고객사, 과정명, 강사, 담당자, 지역, 상태 검색" oninput="setScheduleSearchInput(this.value)" oncompositionstart="setScheduleSearchCompositionStart()" oncompositionend="setScheduleSearchCompositionEnd(this.value)" /></div></div><div id="scheduleContentRoot"></div>`;
  renderScheduleContentOnly();
}
function setScheduleViewMode(mode) {
  if (scheduleViewMode === mode) return;
  scheduleViewMode = mode;
  renderSchedule();
}
function setScheduleSearchInput(value) {
  scheduleSearchQuery = value;
  if (!scheduleSearchComposing) {
    if (String(value || "").trim()) scheduleViewMode = "list";
    renderScheduleContentOnly();
  }
}
function setScheduleSearchCompositionStart() { scheduleSearchComposing = true; }
function setScheduleSearchCompositionEnd(value) {
  scheduleSearchComposing = false;
  scheduleSearchQuery = value;
  if (String(value || "").trim()) scheduleViewMode = "list";
  renderScheduleContentOnly();
}
function applyScheduleDateRange() {
  scheduleDateFrom = scheduleDateFromInput;
  scheduleDateTo = scheduleDateToInput;
  renderSchedule();
}
function resetScheduleFilters() {
  scheduleDateFrom = "";
  scheduleDateTo = "";
  scheduleDateFromInput = "";
  scheduleDateToInput = "";
  scheduleSearchQuery = "";
  const from = document.getElementById("sch_date_from");
  const to = document.getElementById("sch_date_to");
  const q = document.getElementById("sch_search_input");
  if (from) from.value = "";
  if (to) to.value = "";
  if (q) q.value = "";
  renderSchedule();
}
function setScheduleDateInput(type, value) {
  if (type === "from") scheduleDateFromInput = value;
  if (type === "to") scheduleDateToInput = value;
}
function shiftScheduleMonth(delta) {
  scheduleCalendarMonth = monthDiff(scheduleCalendarMonth, delta);
  renderScheduleContentOnly();
}
function setScheduleCalendarMonth(month) {
  if (!month) return;
  scheduleCalendarMonth = month;
  renderScheduleContentOnly();
}
function getScheduleFilteredRows() {
  const rows = getVisibleSchedules().filter((s) => !s.deleted).slice().sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const monthRows = rows.filter((s) => toMonth(s.date) === scheduleCalendarMonth);
  const rangedRows = monthRows.filter((s) => {
    if (scheduleDateFrom && s.date < scheduleDateFrom) return false;
    if (scheduleDateTo && s.date > scheduleDateTo) return false;
    return true;
  });
  const q = String(scheduleSearchQuery || "").trim().toLowerCase();
  return q ? rangedRows.filter((s) => getScheduleSearchText(s).includes(q)) : rangedRows;
}
function renderScheduleContentOnly() {
  const root = document.getElementById("scheduleContentRoot");
  if (!root) return;
  const filtered = getScheduleFilteredRows();
  selectedScheduleIds = selectedScheduleIds.filter((id) => filtered.some((schedule) => schedule.id === id));
  const q = String(scheduleSearchQuery || "").trim();
  const monthSelector = `<div class="row"><button class="btn" onclick="shiftScheduleMonth(-1)">이전</button><input class="sch-month-input" type="month" value="${scheduleCalendarMonth}" onchange="setScheduleCalendarMonth(this.value)" /><button class="btn" onclick="shiftScheduleMonth(1)">다음</button></div>`;
  const encodedIds = encodeURIComponent(JSON.stringify(filtered.map((schedule) => schedule.id)));
  const allChecked = !!filtered.length && filtered.every((schedule) => selectedScheduleIds.includes(schedule.id));
  const renderedList = `<div class="card mt-10"><div class="between">${monthSelector}<div class="row">${canAdmin() ? `<button class="btn danger" onclick="deleteSelectedSchedules()" ${selectedScheduleIds.length ? "" : "disabled"}>선택 삭제</button>` : ""}</div></div><table class="dash-table schedule-list mt-10"><thead><tr>${canAdmin() ? `<th><input type="checkbox" ${allChecked ? "checked" : ""} onchange="toggleScheduleSelectAll(this.checked,'${encodedIds}')" /></th>` : ""}<th>일자</th><th>과정</th><th>시간</th><th>담당자 / 부서</th><th>강사</th><th>상태</th><th>지역</th><th></th></tr></thead><tbody>${filtered.map((s) => {
    const ins = getScheduleInstructorNames(s).join(", ") || "-";
    const checkCell = canAdmin() ? `<td class="select-cell"><label class="select-hitbox" onclick="event.stopPropagation()"><input type="checkbox" ${selectedScheduleIds.includes(s.id) ? "checked" : ""} onclick="event.stopPropagation()" onchange="toggleScheduleSelection('${s.id}',this.checked)" /></label></td>` : "";
    return `<tr onclick="openScheduleModal('${s.id}','',false)" style="cursor:pointer;">${checkCell}<td>${highlightText(s.date, q)}</td><td>${highlightText(s.course, q)}<div class="sub">${highlightText(s.clientName || "-", q)}</div></td><td>${getScheduleHours(s)}시간</td><td>${highlightText(scheduleManagerDisplay(s), q)}</td><td>${highlightText(ins, q)}</td><td>${scheduleBadge(s.status)}</td><td>${highlightText(s.region || "-", q)}</td><td><button class="btn" onclick="event.stopPropagation(); openScheduleModal('${s.id}','',false)">상세</button></td></tr>`;
  }).join("") || `<tr><td colspan="${canAdmin() ? 9 : 8}" class="sub">일정 없음</td></tr>`}</tbody></table></div>`;
  const m = monthStart(scheduleCalendarMonth);
  const y = m.getFullYear();
  const mo = m.getMonth();
  const firstWeekday = new Date(y, mo, 1).getDay();
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(`<div class="sch-cal-cell is-empty"></div>`);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${scheduleCalendarMonth}-${String(day).padStart(2, "0")}`;
    const dayItems = filtered.filter((s) => s.date === date);
    cells.push(`<div class="sch-cal-cell"><button class="sch-cal-add" onclick="openScheduleModal('','${date}',true)">+</button><div class="sch-cal-day">${day}</div><div class="sch-cal-list">${dayItems.map((s) => { const instructorNames = getScheduleInstructorNames(s).join(", ") || "-"; return `<button class="sch-cal-item ${s.status === "draft" ? "is-draft" : s.status === "confirmed" ? "is-confirmed" : ""}" title="${esc(`${instructorNames} / ${s.course}`)}" onclick="openScheduleModal('${s.id}','',false)">${esc(instructorNames)} | ${esc(s.course)}</button>`; }).join("")}</div></div>`);
  }
  const renderedCalendar = `<div class="card mt-10"><div class="between">${monthSelector}</div><div class="sch-cal-week"><div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div></div><div class="sch-cal-grid">${cells.join("")}</div></div>`;
  root.innerHTML = (scheduleViewMode === "list" || q) ? renderedList : renderedCalendar;
  enhanceSortableTables(document.getElementById("view-schedule"));
}
function openCourseManagementFromSchedule(scheduleId) {
  const s = state.schedules.find((x) => x.id === scheduleId);
  alert(`과정 관리 메뉴는 준비 중입니다.\n선택 일정: ${s?.course || "-"}`);
}

function focusScheduleDatePicker(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.focus();
  if (typeof input.showPicker === "function") input.showPicker();
}

function enhanceScheduleModalDateInputs() {
  ["sc_date", "sc_extra_date"].forEach((id) => {
    const input = document.getElementById(id);
    if (!input || input.dataset.clickReady === "true") return;
    const container = input.parentElement;
    if (container) {
      container.style.cursor = "pointer";
      container.onclick = () => focusScheduleDatePicker(id);
    }
    input.dataset.clickReady = "true";
  });
}

function buildScheduleDepartmentFilter() {
  return ['<option value="">전체 부서</option>', ...getDepartmentNames().map((team) => `<option value="${esc(team)}" ${scheduleDepartmentFilter === team ? "selected" : ""}>${esc(team)}</option>`)].join("");
}

function changeScheduleDepartmentFilter(value) {
  scheduleDepartmentFilter = value || "";
  renderScheduleContentOnly();
}

const originalOpenScheduleModal = openScheduleModal;
openScheduleModal = function openScheduleModalWithDateClick(id = "", presetDate = "", editable = true, useDraft = false) {
  originalOpenScheduleModal(id, presetDate, editable, useDraft);
  enhanceScheduleModalDateInputs();
};

const originalRenderSchedule = renderSchedule;
renderSchedule = function renderScheduleWithDepartmentFilter() {
  originalRenderSchedule();
  const filterBottom = document.querySelector("#view-schedule .schedule-filter-bottom");
  if (!filterBottom || document.getElementById("sch_department_filter") || !canAdmin()) return;
  filterBottom.innerHTML = `<div style="min-width:180px;"><label>부서 필터</label><select id="sch_department_filter" onchange="changeScheduleDepartmentFilter(this.value)">${buildScheduleDepartmentFilter()}</select></div><div style="flex:1;min-width:220px;"><label>검색</label><input id="sch_search_input" value="${esc(scheduleSearchQuery)}" placeholder="고객사, 과정명, 강사, 담당자, 지역, 상태 검색" oninput="setScheduleSearchInput(this.value)" oncompositionstart="setScheduleSearchCompositionStart()" oncompositionend="setScheduleSearchCompositionEnd(this.value)" /></div>`;
};

const originalGetScheduleFilteredRows = getScheduleFilteredRows;
getScheduleFilteredRows = function getScheduleFilteredRowsWithDepartmentFilter() {
  const activeDepartmentFilter = canAdmin() ? scheduleDepartmentFilter : "";
  return originalGetScheduleFilteredRows().filter((schedule) => !activeDepartmentFilter || scheduleDepartmentName(schedule) === activeDepartmentFilter);
};

const originalResetScheduleFilters = resetScheduleFilters;
resetScheduleFilters = function resetScheduleFiltersWithDepartment() {
  scheduleDepartmentFilter = "";
  originalResetScheduleFilters();
};

let selectedScheduleIds = [];

function toggleScheduleSelection(scheduleId, checked) {
  const set = new Set(selectedScheduleIds);
  if (checked) set.add(scheduleId);
  else set.delete(scheduleId);
  selectedScheduleIds = [...set];
}

function toggleScheduleSelectAll(checked, encodedIds) {
  const ids = JSON.parse(decodeURIComponent(encodedIds || "%5B%5D"));
  selectedScheduleIds = checked ? ids : [];
  renderScheduleContentOnly();
}

function deleteSelectedSchedules() {
  if (!selectedScheduleIds.length) return alert("삭제할 일정을 선택해주세요.");
  state.schedules.forEach((schedule) => {
    if (!selectedScheduleIds.includes(schedule.id)) return;
    schedule.deleted = true;
    schedule.status = "deleted";
    syncDispatchesFromSchedules(schedule.id);
  });
  selectedScheduleIds = [];
  saveState();
  renderAll();
}
