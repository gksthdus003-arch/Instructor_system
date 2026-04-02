state.scheduleRequests = Array.isArray(state.scheduleRequests) ? state.scheduleRequests : [];
state.settings = state.settings || {};
state.settings.roleMenuPermissions = state.settings.roleMenuPermissions || {};
state.settings.roleMenuPermissions.instructor = Array.isArray(state.settings.roleMenuPermissions.instructor)
  ? state.settings.roleMenuPermissions.instructor
  : ["requests", "settings"];
state.users.forEach((user) => {
  if (user.linkedInstructorId) user.role = "instructor";
  if (!user.linkedInstructorId) user.linkedInstructorId = "";
});

let requestSelectedId = "";
let requestSelectedResponseKeys = [];
let requestCalendarMonth = new Date().toISOString().slice(0, 7);
let requestDetailViewMode = "calendar";
let requestEditingDates = [];
let requestEditingInstructorIds = [];
let requestInstructorSearch = "";
let requestEditingSourceId = "";
let requestModalDraftCache = null;

const originalRoleLabel = roleLabel;
roleLabel = function roleLabelWithInstructor(role) {
  if (role === "instructor") return "강사";
  return originalRoleLabel(role);
};

const originalGetRoleMenuPermissions = getRoleMenuPermissions;
getRoleMenuPermissions = function getRoleMenuPermissionsWithRequests(role) {
  if (role === "instructor") return ["requests", "settings"];
  const allowed = new Set(originalGetRoleMenuPermissions(role));
  if (["user", "team_leader", "admin", "total_leader"].includes(role)) allowed.add("requests");
  return [...allowed];
};

canAccessMenu = function canAccessMenuWithRequests(name) {
  const user = getCurrentUser();
  if (!user) return false;
  if (name === "requests") return getRoleMenuPermissions(user.role).includes("requests");
  if (!MENU_ORDER.includes(name)) return false;
  return getRoleMenuPermissions(user.role).includes(name);
};

openPage = function openPageWithRequests(name) {
  if (!canAccessMenu(name)) name = getRoleMenuPermissions(getCurrentUser()?.role || "")[0] || "dashboard";
  if (name === "instructors") selectedInstructorId = "";
  if (name !== "requests") requestSelectedResponseKeys = [];
  view = name;
  document.querySelectorAll(".menu-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === name));
  document.querySelectorAll(".section").forEach((section) => section.classList.remove("active"));
  document.getElementById(`view-${name}`)?.classList.add("active");
  const map = {
    dashboard: ["대시보드", ""],
    instructors: ["강사 관리", ""],
    requests: ["강의 일정 요청", ""],
    schedule: ["일정 관리", ""],
    settlement: ["출강·정산 관리", ""],
    settings: ["설정", ""],
    admin: ["관리자 설정", ""]
  };
  document.getElementById("pageTitle").textContent = map[name]?.[0] || "";
  document.getElementById("pageSub").textContent = map[name]?.[1] || "";
  if (location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
  renderAll();
};

function applyRequestHashView() {
  const rawHash = String(window.location.hash || "").replace(/^#/, "");
  if (rawHash.startsWith("requests/")) {
    view = "requests";
    requestSelectedId = decodeURIComponent(rawHash.split("/")[1] || "");
  } else if (rawHash === "requests") {
    view = "requests";
  }
  if (rawHash === "requests" || rawHash.startsWith("requests/")) {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
}

function canManageRequests(user = getCurrentUser()) {
  return !!user && user.role !== "instructor";
}

function getVisibleScheduleRequests(user = getCurrentUser()) {
  const current = user || getCurrentUser();
  if (!current) return [];
  return state.scheduleRequests
    .filter((request) => {
      if (current.role === "instructor") return request.instructorIds.includes(current.linkedInstructorId);
      if (["admin", "total_leader"].includes(current.role)) return true;
      return request.managerId === current.id || request.ownerTeam === (current.team || "-");
    })
    .slice()
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

function getRequestInstructorUser(instructorId = "") {
  return state.users.find((user) => user.linkedInstructorId === instructorId) || null;
}

function findRequestResponse(request, instructorId, date) {
  return (request.responses || []).find((item) => item.instructorId === instructorId && item.date === date) || null;
}

function requestStatusLabel(status = "") {
  if (status === "available") return '<span class="status-pill st-ok">가능</span>';
  if (status === "unavailable") return '<span class="status-pill st-neutral">불가</span>';
  if (status === "hold") return '<span class="status-pill st-warn">보류</span>';
  return '<span class="status-pill st-neutral">미회신</span>';
}

function requestResponseKey(requestId, instructorId, date) {
  return `${requestId}__${instructorId}__${date}`;
}

function parseRequestResponseKey(key = "") {
  const [requestId, instructorId, date] = String(key || "").split("__");
  return { requestId, instructorId, date };
}

function defaultRequestVisibility() {
  return {
    course: true,
    clientName: false,
    hours: false,
    requiredCount: false,
    ownerTeam: false,
    managerName: false,
    message: true
  };
}

function buildRequestPublicSummary(request) {
  const visibility = { ...defaultRequestVisibility(), ...(request.visibility || {}) };
  const lines = [
    `일정: ${(request.requestedDates || []).join(", ") || "-"}`,
    `지역: ${request.region || "-"}`
  ];
  if (visibility.course && request.course) lines.push(`과정명: ${request.course}`);
  if (visibility.clientName && request.clientName) lines.push(`고객사: ${request.clientName}`);
  if (visibility.hours && (request.start || request.end)) lines.push(`시간: ${request.start || "-"} ~ ${request.end || "-"}${request.hours ? ` (${request.hours}시간)` : ""}`);
  if (visibility.requiredCount && request.requiredCount) lines.push(`필요 인원: ${request.requiredCount}명`);
  if (visibility.ownerTeam && request.ownerTeam) lines.push(`부서: ${request.ownerTeam}`);
  if (visibility.managerName && request.managerId) lines.push(`담당자: ${nameOfUser(request.managerId)}`);
  if (visibility.message && request.message) lines.push(`메시지: ${request.message}`);
  return lines;
}

function renderRequests() {
  const root = document.getElementById("view-requests");
  if (!root) return;
  const user = getCurrentUser();
  if (!user || !canAccessMenu("requests")) {
    root.innerHTML = "";
    return;
  }

  const requests = getVisibleScheduleRequests(user);
  if (!requestSelectedId && requests.length) requestSelectedId = requests[0].id;
  if (requestSelectedId && !requests.some((request) => request.id === requestSelectedId)) requestSelectedId = requests[0]?.id || "";
  const selectedRequest = requests.find((request) => request.id === requestSelectedId) || null;
  if (selectedRequest && selectedRequest.requestedDates?.[0]) requestCalendarMonth = toMonth(selectedRequest.requestedDates[0]);

  root.innerHTML = `
    <div class="request-layout mt-10">
      <div class="card request-sidebar">
        <div class="between">
          <h3 style="margin:0">과정 요청 목록</h3>
          ${canManageRequests(user) ? `<button class="btn primary" onclick="openScheduleRequestModal()">일정 회신 요청</button>` : ""}
        </div>
        ${renderRequestListTable(requests, user)}
      </div>
      <div class="request-main">
        ${selectedRequest ? renderRequestDetail(selectedRequest, user) : '<div class="card"><div class="sub">강의 일정 요청을 선택하면 상세 화면이 표시됩니다.</div></div>'}
      </div>
    </div>
  `;
}

function renderRequestListTable(requests, user) {
  const rows = requests.map((request) => {
    const responseCount = (request.responses || []).filter((item) => item.status === "available").length;
    const className = request.id === requestSelectedId ? "request-row is-active" : "request-row";
    return `<tr class="${className}" onclick="selectScheduleRequest('${request.id}')"><td>${esc(request.course || "-")}</td><td>${esc((request.requestedDates || []).join(", "))}</td><td>${esc(request.region || "-")}</td><td>${request.instructorIds.length}명</td><td>${responseCount}건</td></tr>`;
  }).join("");
  return `<table class="mt-10"><thead><tr><th>과정</th><th>요청 일정</th><th>지역</th><th>대상</th><th>가능 응답</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="sub">요청 없음</td></tr>'}</tbody></table>`;
}

function selectScheduleRequest(requestId) {
  requestSelectedId = requestId;
  requestSelectedResponseKeys = [];
  const request = state.scheduleRequests.find((item) => item.id === requestId);
  if (request?.requestedDates?.[0]) requestCalendarMonth = toMonth(request.requestedDates[0]);
  renderRequests();
}

function renderRequestDetail(request, user) {
  return canManageRequests(user) ? renderManagerRequestDetail(request) : renderInstructorRequestDetail(request, user);
}

function renderManagerRequestDetail(request) {
  const rows = buildRequestResponseRows(request);
  const selectableKeys = rows.filter((row) => row.status === "available" && !row.registeredAt).map((row) => row.key);
  const encodedKeys = encodeURIComponent(JSON.stringify(selectableKeys));
  const allChecked = selectableKeys.length > 0 && selectableKeys.every((key) => requestSelectedResponseKeys.includes(key));
  const responseContent = requestDetailViewMode === "calendar"
    ? renderRequestCalendar(request)
    : renderRequestResponseTable(rows, allChecked, encodedKeys);
  return `
    <div class="card">
      <div class="between request-detail-top">
        <div>
          <h3 style="margin:0">${esc(request.course || "강의 일정 요청")}</h3>
          <div class="sub mt-10">${esc(request.ownerTeam || "-")} / 담당자 ${esc(nameOfUser(request.managerId))} / 생성 ${toLocal(request.createdAt)}</div>
        </div>
        <div class="row">
          <button class="btn" onclick="openScheduleRequestModal('${request.id}')">수정</button>
          <button class="btn primary" onclick="openRequestSendPreview('${request.id}')">발송</button>
          <button class="btn" onclick="resendScheduleRequestEmails('${request.id}')">재발송</button>
          <button class="btn primary" onclick="registerSelectedRequestResponses('${request.id}')" ${requestSelectedResponseKeys.length ? "" : "disabled"}>일정으로 등록</button>
        </div>
      </div>
      <div class="request-summary-grid mt-12">
        <div><label>고객사</label><div class="view-value">${esc(request.clientName || "-")}</div></div>
        <div><label>지역</label><div class="view-value">${esc(request.region || "-")}</div></div>
        <div><label>시간</label><div class="view-value">${esc(`${request.start || "-"} ~ ${request.end || "-"}${request.hours ? ` (${request.hours}시간)` : ""}`)}</div></div>
        <div><label>필요 인원</label><div class="view-value">${esc(`${request.requiredCount || 1}명`)}</div></div>
        <div style="grid-column:1/-1;"><label>요청 일정</label><div class="view-value">${esc((request.requestedDates || []).join(", ") || "-")}</div></div>
        <div style="grid-column:1/-1;"><label>메시지</label><div class="view-value">${esc(request.message || "-")}</div></div>
      </div>
    </div>
    <div class="card mt-12">
      <div class="between">
        <h3 style="margin:0">응답 현황</h3>
        <div class="row">
          ${requestDetailViewMode === "calendar" ? renderRequestMonthPicker() : ""}
          <div class="view-toggle">
            <button class="btn ${requestDetailViewMode === "list" ? "primary" : ""}" onclick="setRequestDetailViewMode('list')">☰</button>
            <button class="btn ${requestDetailViewMode === "calendar" ? "primary" : ""}" onclick="setRequestDetailViewMode('calendar')">📅</button>
          </div>
        </div>
      </div>
      ${responseContent}
    </div>
  `;
}

function renderRequestResponseTable(rows, allChecked, encodedKeys) {
  return `<table class="mt-12">
    <thead>
      <tr>
        <th class="select-cell"><input type="checkbox" ${allChecked ? "checked" : ""} onchange="toggleRequestSelectAll(this.checked,'${encodedKeys}')" /></th>
        <th>일자</th>
        <th>강사</th>
        <th>상태</th>
        <th>회신 시각</th>
        <th>쪽지</th>
        <th>등록</th>
      </tr>
    </thead>
    <tbody>${rows.map((row) => renderRequestResponseRow(row)).join("") || '<tr><td colspan="7" class="sub">응답 데이터 없음</td></tr>'}</tbody>
  </table>`;
}

function buildRequestResponseRows(request) {
  const instructors = request.instructorIds.map((id) => state.instructors.find((item) => item.id === id)).filter(Boolean);
  const rows = [];
  (request.requestedDates || []).forEach((date) => {
    instructors.forEach((instructor) => {
      const response = findRequestResponse(request, instructor.id, date);
      rows.push({
        key: requestResponseKey(request.id, instructor.id, date),
        requestId: request.id,
        instructorId: instructor.id,
        instructorName: instructor.name,
        date,
        status: response?.status || "",
        note: response?.note || "",
        respondedAt: response?.respondedAt || "",
        registeredAt: response?.registeredAt || "",
        registeredScheduleId: response?.registeredScheduleId || ""
      });
    });
  });
  return rows.sort((left, right) => `${left.date}${left.instructorName}`.localeCompare(`${right.date}${right.instructorName}`, "ko"));
}

function renderRequestResponseRow(row) {
  const checkable = row.status === "available" && !row.registeredAt;
  return `<tr>
    <td class="select-cell">${checkable ? `<label class="select-hitbox"><input type="checkbox" ${requestSelectedResponseKeys.includes(row.key) ? "checked" : ""} onchange="toggleRequestResponseSelection('${row.key}',this.checked)" /></label>` : ""}</td>
    <td>${esc(row.date)}</td>
    <td>${esc(row.instructorName)}</td>
    <td>${requestStatusLabel(row.status)}</td>
    <td>${row.respondedAt ? esc(toLocal(row.respondedAt)) : '<span class="sub">미회신</span>'}</td>
    <td>${esc(row.note || "-")}</td>
    <td>${row.registeredAt ? `<span class="status-pill st-info">등록됨</span><div class="sub mt-10">${esc(toLocal(row.registeredAt))}</div>` : '<span class="sub">대기</span>'}</td>
  </tr>`;
}

function renderInstructorRequestDetail(request, user) {
  const instructorId = user.linkedInstructorId;
  const note = (request.responses || []).find((item) => item.instructorId === instructorId && item.note)?.note || "";
  const summaryLines = buildRequestPublicSummary(request);
  return `
    <div class="card">
      <div class="between">
        <div>
          <h3 style="margin:0">${esc(request.course || "강의 일정 요청")}</h3>
          <div class="sub mt-10">요청 담당자 ${esc(nameOfUser(request.managerId))} / 부서 ${esc(request.ownerTeam || "-")}</div>
        </div>
        <span class="status-pill st-info">${(request.requestedDates || []).length}개 일정</span>
      </div>
      <div class="request-mail-card mt-12">
        <div class="request-mail-title">강의 일정 회신 요청</div>
        <div class="request-mail-body">${summaryLines.map((line) => `<div>${esc(line)}</div>`).join("")}</div>
      </div>
      <table class="mt-12">
        <thead><tr><th>일자</th><th>지역</th><th>응답</th></tr></thead>
        <tbody>
          ${(request.requestedDates || []).map((date) => {
            const response = findRequestResponse(request, instructorId, date);
            return `<tr><td>${esc(date)}</td><td>${esc(request.region || "-")}</td><td><select id="req_resp_${escAttr(date)}"><option value="">미선택</option><option value="available" ${response?.status === "available" ? "selected" : ""}>가능</option><option value="unavailable" ${response?.status === "unavailable" ? "selected" : ""}>불가</option><option value="hold" ${response?.status === "hold" ? "selected" : ""}>보류</option></select></td></tr>`;
          }).join("")}
        </tbody>
      </table>
      <div class="mt-12">
        <label>회신 쪽지</label>
        <textarea id="req_response_note">${esc(note)}</textarea>
      </div>
      <div class="row row-end mt-12">
        <button class="btn primary" onclick="saveScheduleRequestResponse('${request.id}')">회신 저장</button>
      </div>
    </div>
  `;
}

function escAttr(value = "") {
  return String(value || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function renderRequestMonthPicker() {
  return `<button class="btn" onclick="shiftRequestMonth(-1)">이전</button><input class="sch-month-input" type="month" value="${requestCalendarMonth}" onchange="changeRequestMonth(this.value)" /><button class="btn" onclick="shiftRequestMonth(1)">다음</button>`;
}

function shiftRequestMonth(delta) {
  requestCalendarMonth = monthDiff(requestCalendarMonth || new Date().toISOString().slice(0, 7), delta);
  renderRequests();
}

function changeRequestMonth(month) {
  requestCalendarMonth = month || requestCalendarMonth;
  renderRequests();
}

function setRequestDetailViewMode(mode) {
  if (!["calendar", "list"].includes(mode) || requestDetailViewMode === mode) return;
  requestDetailViewMode = mode;
  renderRequests();
}

function renderRequestCalendar(request) {
  const monthKey = requestCalendarMonth || toMonth(request.requestedDates?.[0] || new Date().toISOString().slice(0, 10));
  const base = monthStart(monthKey);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let index = 0; index < firstWeekday; index++) cells.push('<div class="request-cal-cell is-empty"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${monthKey}-${String(day).padStart(2, "0")}`;
    const responses = (request.responses || []).filter((item) => item.date === date);
    const requested = (request.requestedDates || []).includes(date);
    const responseLines = responses.map((item) => {
      const cls = item.status === "available" ? "is-available" : item.status === "unavailable" ? "is-unavailable" : "is-hold";
      return `<div class="request-cal-pill ${cls}">${esc(nameOfInstructor(item.instructorId))}</div>`;
    }).join("");
    cells.push(`<div class="request-cal-cell ${requested ? "is-requested" : ""}"><div class="request-cal-day">${day}</div><div class="request-cal-pills">${responseLines || (requested ? '<div class="sub">요청 발송</div>' : "")}</div></div>`);
  }
  return `<div class="request-cal-week mt-12"><div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div></div><div class="request-cal-grid">${cells.join("")}</div>`;
}

function openScheduleRequestModal(requestId = "") {
  if (!canManageRequests()) return alert("沅뚰븳???놁뒿?덈떎.");
  const request = state.scheduleRequests.find((item) => item.id === requestId) || null;
  if (requestEditingSourceId !== requestId) {
    requestEditingSourceId = requestId;
    requestEditingDates = request ? [...(request.requestedDates || [])] : [];
    requestEditingInstructorIds = request ? [...(request.instructorIds || [])] : [];
    requestInstructorSearch = "";
  }
  const visibility = { ...defaultRequestVisibility(), ...(request?.visibility || {}) };
  const instructorTags = requestEditingInstructorIds.map((id) => `<span class="status-pill st-neutral">${esc(nameOfInstructor(id))} <span style="margin-left:6px;cursor:pointer;" onclick="removeRequestInstructor('${id}')">x</span></span>`).join("") || '<span class="sub">?좏깮??媛뺤궗 ?놁쓬</span>';
  const dateTags = requestEditingDates.map((date) => `<span class="status-pill st-neutral">${esc(date)} <span style="margin-left:6px;cursor:pointer;" onclick="removeRequestDate('${date}')">x</span></span>`).join("") || '<span class="sub">추가된 일정 없음</span>';
  const instructorOptions = getFilteredInstructorsForRequest().map((instructor) => `<option value="${esc(instructor.name)}"></option>`).join("");
  modal(`
    <div class="between"><h3 style="margin:0">${request ? "媛뺤쓽 ?쇱젙 ?붿껌 ?섏젙" : "媛뺤쓽 ?쇱젙 ?붿껌"}</h3><button class="btn" onclick="closeModal()">?リ린</button></div>
    <div class="form-grid mt-12">
      <div><label>怨쇱젙紐?<input type="checkbox" id="req_vis_course" ${visibility.course ? "checked" : ""} /> 怨듦컻</label><input id="req_course" value="${esc(request?.course || "")}" /></div>
      <div><label>怨좉컼?щ챸 <input type="checkbox" id="req_vis_client" ${visibility.clientName ? "checked" : ""} /> 怨듦컻</label><input id="req_client" value="${esc(request?.clientName || "")}" /></div>
      <div><label>?쒓컙 <input type="checkbox" id="req_vis_hours" ${visibility.hours ? "checked" : ""} /> 怨듦컻</label><input id="req_hours" type="number" min="0.5" step="0.5" value="${Number(request?.hours || 1)}" /></div>
      <div><label>?꾩슂 ?몄썝 <input type="checkbox" id="req_vis_required" ${visibility.requiredCount ? "checked" : ""} /> 怨듦컻</label><input id="req_required" type="number" min="1" step="1" value="${Number(request?.requiredCount || 1)}" /></div>
      <div><label>吏??/label><select id="req_region">${Object.keys(state.settings.transportRateByRegion).map((region) => `<option value="${esc(region)}" ${request?.region === region ? "selected" : ""}>${esc(region)}</option>`).join("")}</select></div>
      <div><label>遺??<input type="checkbox" id="req_vis_team" ${visibility.ownerTeam ? "checked" : ""} /> 怨듦컻</label><input id="req_team" value="${esc(request?.ownerTeam || getCurrentUser()?.team || "-")}" /></div>
      <div><label>?대떦??<input type="checkbox" id="req_vis_manager" ${visibility.managerName ? "checked" : ""} /> 怨듦컻</label><input id="req_manager_name" value="${esc(nameOfUser(request?.managerId || getCurrentUser()?.id || "") || getCurrentUser()?.name || "-")}" disabled /></div>
      <div style="grid-column:1/-1;"><label>?붿껌 硫붿떆吏 <input type="checkbox" id="req_vis_message" ${visibility.message ? "checked" : ""} /> 怨듦컻</label><textarea id="req_message">${esc(request?.message || "")}</textarea></div>
      <div style="grid-column:1/-1;"><label>?붿껌 ?쇱젙</label><div id="req_date_tags" class="row">${dateTags}</div><div class="row mt-10"><input id="req_date_input" type="date" /><button class="btn" onclick="addRequestDate()">?쇱옄 異붽?</button></div></div>
      <div style="grid-column:1/-1;"><label>???媛뺤궗</label><div id="req_instructor_tags" class="row">${instructorTags}</div><div class="row mt-10"><input id="req_instructor_search" placeholder="媛뺤궗紐??낅젰" list="reqInstructorList" value="${esc(requestInstructorSearch)}" /><datalist id="reqInstructorList">${instructorOptions}</datalist><button class="btn" onclick="addRequestInstructor()">媛뺤궗 異붽?</button></div></div>
    </div>
    <div class="row row-end mt-12"><button class="btn primary" onclick="saveScheduleRequest('${request?.id || ""}')">${request ? "저장" : "저장 후 발송"}</button></div>
  `);
}

function getRequestModalDraft() {
  if (!document.getElementById("req_course") && requestModalDraftCache) return requestModalDraftCache;
  return {
    course: document.getElementById("req_course")?.value || "",
    clientName: document.getElementById("req_client")?.value || "",
    start: document.getElementById("req_start")?.value || "09:00",
    end: document.getElementById("req_end")?.value || "10:00",
    requiredCount: document.getElementById("req_required")?.value || "1",
    region: document.getElementById("req_region")?.value || defaultRegion(),
    ownerTeam: document.getElementById("req_team")?.value || getCurrentUser()?.team || "-",
    message: document.getElementById("req_message")?.value || "",
    visibility: {
      course: document.getElementById("req_vis_course")?.checked ?? true,
      clientName: document.getElementById("req_vis_client")?.checked ?? false,
      hours: document.getElementById("req_vis_hours")?.checked ?? false,
      requiredCount: document.getElementById("req_vis_required")?.checked ?? false,
      ownerTeam: document.getElementById("req_vis_team")?.checked ?? false,
      managerName: document.getElementById("req_vis_manager")?.checked ?? false,
      message: document.getElementById("req_vis_message")?.checked ?? true
    }
  };
}

function buildRequestModalState(requestId = "") {
  const request = state.scheduleRequests.find((item) => item.id === requestId) || null;
  const draft = getRequestModalDraft();
  const useDraft = requestEditingSourceId === requestId && ((document.getElementById("req_course") || document.getElementById("req_message")) || requestModalDraftCache);
  return {
    request,
    values: {
      course: useDraft ? draft.course : (request?.course || ""),
      clientName: useDraft ? draft.clientName : (request?.clientName || ""),
      start: useDraft ? draft.start : (request?.start || "09:00"),
      end: useDraft ? draft.end : (request?.end || addHoursToTime(request?.start || "09:00", Number(request?.hours || 1))),
      requiredCount: Number(useDraft ? draft.requiredCount : (request?.requiredCount || 1)),
      region: useDraft ? draft.region : (request?.region || defaultRegion()),
      ownerTeam: useDraft ? draft.ownerTeam : (request?.ownerTeam || getCurrentUser()?.team || "-"),
      message: useDraft ? draft.message : (request?.message || "")
    },
    visibility: useDraft ? draft.visibility : { ...defaultRequestVisibility(), ...(request?.visibility || {}) }
  };
}

function renderRequestDateTags() {
  const box = document.getElementById("req_date_tags");
  if (!box) return;
  box.innerHTML = requestEditingDates.map((date) => `<span class="status-pill st-neutral">${esc(date)} <span style="margin-left:6px;cursor:pointer;" onclick="removeRequestDate('${date}')">x</span></span>`).join("") || '<span class="sub">추가된 일정 없음</span>';
}

function renderRequestInstructorTags() {
  const box = document.getElementById("req_instructor_tags");
  if (!box) return;
  box.innerHTML = requestEditingInstructorIds.map((id) => `<span class="status-pill st-neutral">${esc(nameOfInstructor(id))} <span style="margin-left:6px;cursor:pointer;" onclick="removeRequestInstructor('${id}')">x</span></span>`).join("") || '<span class="sub">선택된 강사 없음</span>';
}

function renderRequestInstructorSelectOptions() {
  const select = document.getElementById("req_instructor_select");
  if (!select) return;
  const query = String(document.getElementById("req_instructor_search")?.value || "").trim().toLowerCase();
  const candidates = state.instructors
    .filter((instructor) => !requestEditingInstructorIds.includes(instructor.id))
    .filter((instructor) => !query || String(instructor.name || "").toLowerCase().includes(query))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "ko"));
  select.innerHTML = candidates.map((instructor) => `<option value="${instructor.id}">${esc(instructor.name)}${instructor.email ? ` / ${esc(instructor.email)}` : ""}</option>`).join("");
  if (select.options.length) select.selectedIndex = 0;
}

function focusRequestDatePicker() {
  const input = document.getElementById("req_date_input");
  if (!input) return;
  input.focus();
  if (typeof input.showPicker === "function") input.showPicker();
}
function focusRequestTimePicker(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.focus();
  if (typeof input.showPicker === "function") input.showPicker();
  else input.click();
}

function addRequestDate(nextDate = "", keepOpen = true) {
  const value = nextDate || v("req_date_input");
  if (!value) return;
  if (!requestEditingDates.includes(value)) requestEditingDates.push(value);
  requestEditingDates = [...new Set(requestEditingDates)].sort();
  const input = document.getElementById("req_date_input");
  if (input) input.value = "";
  renderRequestDateTags();
  if (keepOpen) setTimeout(() => focusRequestDatePicker(), 0);
}

function removeRequestDate(date) {
  requestEditingDates = requestEditingDates.filter((item) => item !== date);
  renderRequestDateTags();
}

function addRequestInstructor() {
  const select = document.getElementById("req_instructor_select");
  const search = document.getElementById("req_instructor_search");
  const targetId = select?.value || "";
  if (!targetId) return;
  if (!requestEditingInstructorIds.includes(targetId)) requestEditingInstructorIds.push(targetId);
  if (search) {
    search.value = "";
    requestInstructorSearch = "";
    search.focus();
  }
  renderRequestInstructorTags();
  renderRequestInstructorSelectOptions();
}

function removeRequestInstructor(instructorId) {
  requestEditingInstructorIds = requestEditingInstructorIds.filter((id) => id !== instructorId);
  renderRequestInstructorTags();
  renderRequestInstructorSelectOptions();
}

function getRequestTimeRange() {
  const start = v("req_start") || requestModalDraftCache?.start || "09:00";
  const end = v("req_end") || requestModalDraftCache?.end || start;
  const hours = durationHours(start, end);
  return { start, end, hours };
}

function syncRequestHoursPreview() {
  const box = document.getElementById("req_hours_preview");
  if (!box) return;
  const { start, end, hours } = getRequestTimeRange();
  box.textContent = start < end ? `${hours}시간` : "시간을 확인해주세요.";
}

function buildScheduleRequestPayload(requestId = "", selectedDates = null) {
  const existing = state.scheduleRequests.find((item) => item.id === requestId) || null;
  const course = v("req_course") || requestModalDraftCache?.course || existing?.course || "";
  const region = v("req_region") || requestModalDraftCache?.region || existing?.region || defaultRegion();
  const start = v("req_start") || requestModalDraftCache?.start || existing?.start || "09:00";
  const end = v("req_end") || requestModalDraftCache?.end || existing?.end || addHoursToTime(existing?.start || "09:00", Number(existing?.hours || 1));
  const hours = durationHours(start, end);
  const requiredCount = Number(v("req_required") || requestModalDraftCache?.requiredCount || existing?.requiredCount || 1);
  const ownerTeam = v("req_team") || requestModalDraftCache?.ownerTeam || existing?.ownerTeam || getCurrentUser()?.team || "-";
  const requestedDates = Array.isArray(selectedDates) ? selectedDates : [...requestEditingDates];

  if (!course) {
    alert("과정명은 필수입니다.");
    return null;
  }
  const fallbackDates = existing?.requestedDates || [];
  const fallbackInstructorIds = existing?.instructorIds || [];
  const finalDates = requestedDates.length ? requestedDates : fallbackDates;
  const finalInstructorIds = requestEditingInstructorIds.length ? [...requestEditingInstructorIds] : [...fallbackInstructorIds];

  if (!finalDates.length) {
    alert("요청 일자를 1개 이상 추가해주세요.");
    setTimeout(() => focusRequestDatePicker(), 0);
    return null;
  }
  if (!finalInstructorIds.length) {
    alert("대상 강사를 1명 이상 선택해주세요.");
    return null;
  }
  if (!(hours > 0) || !(start < end)) {
    alert("시작 시간과 종료 시간을 확인해주세요.");
    return null;
  }

  return {
    id: requestId || uid("rq"),
    course,
    clientName: v("req_client") || requestModalDraftCache?.clientName || existing?.clientName || "",
    start,
    end,
    hours,
    requiredCount,
    region,
    ownerTeam,
    managerId: existing?.managerId || getCurrentUser()?.id || "",
    message: v("req_message") || requestModalDraftCache?.message || existing?.message || "",
    requestedDates: [...finalDates].sort(),
    instructorIds: finalInstructorIds,
    visibility: {
      course: document.getElementById("req_vis_course")?.checked ?? requestModalDraftCache?.visibility?.course ?? true,
      clientName: document.getElementById("req_vis_client")?.checked ?? requestModalDraftCache?.visibility?.clientName ?? false,
      hours: document.getElementById("req_vis_hours")?.checked ?? requestModalDraftCache?.visibility?.hours ?? false,
      requiredCount: document.getElementById("req_vis_required")?.checked ?? requestModalDraftCache?.visibility?.requiredCount ?? false,
      ownerTeam: document.getElementById("req_vis_team")?.checked ?? requestModalDraftCache?.visibility?.ownerTeam ?? false,
      managerName: document.getElementById("req_vis_manager")?.checked ?? requestModalDraftCache?.visibility?.managerName ?? false,
      message: document.getElementById("req_vis_message")?.checked ?? requestModalDraftCache?.visibility?.message ?? true
    },
    responses: existing?.responses || [],
    draftScheduleIdsByDate: existing?.draftScheduleIdsByDate || {},
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
    status: existing?.status || "open"
  };
}

function upsertScheduleRequest(next) {
  const existing = state.scheduleRequests.find((item) => item.id === next.id);
  if (existing) Object.assign(existing, next);
  else state.scheduleRequests.push(next);
  syncRequestDraftSchedules(existing || next);
  return existing || next;
}

function findRequestScheduleConflicts(payload) {
  return (payload.requestedDates || []).map((date) => {
    const start = payload.start || "09:00";
    const end = payload.end || addHoursToTime(start, Number(payload.hours || 0));
    const conflicts = state.schedules.filter((schedule) => {
      if (!schedule || schedule.deleted) return false;
      if (schedule.sourceRequestId === payload.id) return false;
      if (schedule.date !== date) return false;
      if (!(start < schedule.end && schedule.start < end)) return false;
      const otherInstructorIds = getScheduleInstructorIds(schedule);
      return payload.instructorIds.some((instructorId) => otherInstructorIds.includes(instructorId));
    });
    return {
      date,
      conflicts,
      conflictText: conflicts.length ? [...new Set(conflicts.map((conflict) => formatScheduleConflictLine(conflict)))].join("<br/>") : ""
    };
  });
}

function reopenScheduleRequestModal(requestId = "") {
  closeModal();
  openScheduleRequestModal(requestId);
}

function openRequestSendPreview(requestId = "") {
  requestModalDraftCache = getRequestModalDraft();
  const payload = buildScheduleRequestPayload(requestId);
  if (!payload) return;
  const rows = findRequestScheduleConflicts(payload);
  const encodedId = escAttr(requestId || "");
  modal(`
    <div class="between"><h3 style="margin:0">발송 전 일정 확인</h3><button class="btn" onclick="reopenScheduleRequestModal('${encodedId}')">닫기</button></div>
    <div class="sub mt-10">등록될 일정과 중복 여부를 확인한 뒤 발송할 일정을 선택해 주세요.</div>
    <table class="mt-12">
      <thead><tr><th class="select-cell"></th><th>일자</th><th>강사</th><th>시간</th><th>중복 경고</th></tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td class="select-cell"><label class="select-hitbox"><input type="checkbox" class="req-send-row" value="${escAttr(row.date)}" checked /></label></td>
            <td>${esc(row.date)}</td>
            <td>${esc(payload.instructorIds.map((id) => nameOfInstructor(id)).join(", ") || "-")}</td>
            <td>${esc(`${payload.start || "09:00"} ~ ${payload.end || addHoursToTime(payload.start || "09:00", Number(payload.hours || 0))}`)}</td>
            <td>${row.conflicts.length ? `<span class="status-pill st-danger">중복 ${row.conflicts.length}건</span><div class="sub mt-10">${row.conflictText}</div>` : '<span class="status-pill st-ok">중복 없음</span>'}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="row row-end mt-12">
      <button class="btn" onclick="reopenScheduleRequestModal('${encodedId}')">취소</button>
      <button class="btn primary" onclick="confirmScheduleRequestSend('${encodedId}')">선택 일정 저장 후 발송</button>
    </div>
  `);
}

async function confirmScheduleRequestSend(requestId = "") {
  const selectedDates = [...document.querySelectorAll(".req-send-row:checked")].map((input) => input.value);
  if (!selectedDates.length) return alert("발송할 일정을 1개 이상 선택해주세요.");
  const payload = buildScheduleRequestPayload(requestId, selectedDates);
  if (!payload) return;
  const savedRequest = upsertScheduleRequest(payload);
  requestEditingSourceId = "";
  requestEditingDates = [];
  requestEditingInstructorIds = [];
  requestInstructorSearch = "";
  requestModalDraftCache = null;
  requestSelectedId = savedRequest.id;
  saveState();
  closeModal();
  renderRequests();
  await sendScheduleRequestEmails(savedRequest);
}

function buildScheduleFromRequest(request, date, instructorIds, status = "draft") {
  const uniqueInstructorIds = [...new Set((instructorIds || []).filter(Boolean))];
  return {
    course: request.course,
    clientName: request.clientName,
    date,
    hours: Number(request.hours || 0),
    start: request.start || "09:00",
    end: request.end || addHoursToTime(request.start || "09:00", Number(request.hours || 0)),
    managerId: request.managerId,
    instructorId: uniqueInstructorIds[0] || "",
    instructorIds: uniqueInstructorIds,
    ownerTeam: request.ownerTeam || getCurrentUser()?.team || "-",
    status,
    region: request.region || defaultRegion(),
    deleted: false,
    sourceRequestId: request.id
  };
}

function syncRequestDraftSchedules(request) {
  const existingMap = { ...(request.draftScheduleIdsByDate || {}) };
  const nextMap = {};

  (request.requestedDates || []).forEach((date) => {
    const scheduleId = existingMap[date] || "";
    let schedule = state.schedules.find((item) => item.id === scheduleId && !item.deleted);
    if (!schedule) {
      schedule = state.schedules.find((item) => item.sourceRequestId === request.id && item.date === date && !item.deleted) || null;
    }
    const nextScheduleData = buildScheduleFromRequest(request, date, request.instructorIds, "draft");
    if (schedule) {
      Object.assign(schedule, nextScheduleData, { status: schedule.status === "confirmed" ? "confirmed" : "draft", deleted: false });
    } else {
      schedule = { id: uid("s"), ...nextScheduleData };
      state.schedules.push(schedule);
    }
    nextMap[date] = schedule.id;
    syncDispatchesFromSchedules(schedule.id);
  });

  Object.entries(existingMap).forEach(([date, scheduleId]) => {
    if (nextMap[date]) return;
    const schedule = state.schedules.find((item) => item.id === scheduleId);
    if (!schedule || schedule.sourceRequestId !== request.id) return;
    if (schedule.status === "confirmed") return;
    schedule.deleted = true;
    schedule.status = "deleted";
    syncDispatchesFromSchedules(schedule.id);
  });

  request.draftScheduleIdsByDate = nextMap;
}

function backToRequestList() {
  requestSelectedId = "";
  requestSelectedResponseKeys = [];
  if (location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
  renderRequests();
}

renderRequests = function renderRequestsAsPages() {
  const root = document.getElementById("view-requests");
  if (!root) return;
  const user = getCurrentUser();
  if (!user || !canAccessMenu("requests")) {
    root.innerHTML = "";
    return;
  }
  const requests = getVisibleScheduleRequests(user);
  const selectedRequest = requests.find((request) => request.id === requestSelectedId) || null;
  if (!selectedRequest) {
    root.innerHTML = `
      <div class="card mt-10">
        <div class="between">
          <div>
            <h3 style="margin:0">과정 요청 목록</h3>
          </div>
          ${canManageRequests(user) ? `<button class="btn primary" onclick="openScheduleRequestModal()">일정 회신 요청</button>` : ""}
        </div>
        ${renderRequestListTable(requests, user)}
      </div>
    `;
    return;
  }
  root.innerHTML = `
    <div class="card mt-10">
      <div class="between">
        <div>
          <button class="btn" onclick="backToRequestList()">목록으로</button>
        </div>
        <div class="sub">${esc(selectedRequest.course || "-")}</div>
      </div>
    </div>
    <div class="mt-12">
      ${renderRequestDetail(selectedRequest, user)}
    </div>
  `;
};

selectScheduleRequest = function selectScheduleRequestAsPage(requestId) {
  requestSelectedId = requestId;
  requestSelectedResponseKeys = [];
  const request = state.scheduleRequests.find((item) => item.id === requestId);
  if (request?.requestedDates?.[0]) requestCalendarMonth = toMonth(request.requestedDates[0]);
  if (location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
  renderRequests();
};

openPage = function openPageWithRequestListDefault(name) {
  if (!canAccessMenu(name)) name = getRoleMenuPermissions(getCurrentUser()?.role || "")[0] || "dashboard";
  if (name === "instructors") selectedInstructorId = "";
  if (name === "requests") {
    requestSelectedId = "";
  } else {
    requestSelectedResponseKeys = [];
  }
  view = name;
  document.querySelectorAll(".menu-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === name));
  document.querySelectorAll(".section").forEach((section) => section.classList.remove("active"));
  document.getElementById(`view-${name}`)?.classList.add("active");
  const map = {
    dashboard: ["대시보드", ""],
    instructors: ["강사 관리", ""],
    requests: ["강의 일정 요청", ""],
    schedule: ["일정 관리", ""],
    settlement: ["출강·정산 관리", ""],
    settings: ["설정", ""],
    admin: ["관리자 설정", ""]
  };
  document.getElementById("pageTitle").textContent = map[name]?.[0] || "";
  document.getElementById("pageSub").textContent = map[name]?.[1] || "";
  if (location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
  renderAll();
};

function attachRequestModalBehaviors() {
  const dateInput = document.getElementById("req_date_input");
  const dateRow = document.getElementById("req_date_entry_row");
  if (dateInput && !dateInput.dataset.bound) {
    dateInput.dataset.bound = "true";
    dateInput.addEventListener("input", () => addRequestDate(dateInput.value, true));
    dateInput.addEventListener("click", () => focusRequestDatePicker());
  }
  if (dateRow && !dateRow.dataset.bound) {
    dateRow.dataset.bound = "true";
    dateRow.addEventListener("click", () => focusRequestDatePicker());
  }
  const search = document.getElementById("req_instructor_search");
  const select = document.getElementById("req_instructor_select");
  ["req_start", "req_end"].forEach((id) => {
    const input = document.getElementById(id);
    if (!input || input.dataset.bound) return;
    input.dataset.bound = "true";
    input.addEventListener("click", () => focusRequestTimePicker(id));
    input.addEventListener("input", () => syncRequestHoursPreview());
    const wrapper = input.parentElement;
    if (wrapper && !wrapper.dataset.bound) {
      wrapper.dataset.bound = "true";
      wrapper.style.cursor = "pointer";
      wrapper.addEventListener("click", (event) => {
        if (event.target === input) return;
        focusRequestTimePicker(id);
      });
    }
  });
  if (search && !search.dataset.bound) {
    search.dataset.bound = "true";
    search.addEventListener("input", () => {
      requestInstructorSearch = search.value || "";
      renderRequestInstructorSelectOptions();
    });
    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addRequestInstructor();
      }
    });
  }
  if (select && !select.dataset.bound) {
    select.dataset.bound = "true";
    select.addEventListener("dblclick", () => addRequestInstructor());
    select.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addRequestInstructor();
      }
    });
  }
  renderRequestDateTags();
  renderRequestInstructorTags();
  renderRequestInstructorSelectOptions();
  syncRequestHoursPreview();
}

openScheduleRequestModal = function openScheduleRequestModalImproved(requestId = "") {
  if (!canManageRequests()) return alert("권한이 없습니다.");
  const { request, values, visibility } = buildRequestModalState(requestId);
  if (requestEditingSourceId !== requestId) {
    requestEditingSourceId = requestId;
    requestEditingDates = request ? [...(request.requestedDates || [])] : [];
    requestEditingInstructorIds = request ? [...(request.instructorIds || [])] : [];
    requestInstructorSearch = "";
    requestModalDraftCache = null;
  }
  modal(`
    <div class="between"><h3 style="margin:0">${request ? "강의 일정 요청 수정" : "강의 일정 요청"}</h3><button class="btn" onclick="closeModal()">닫기</button></div>
    <div class="form-grid request-modal-form mt-12" style="grid-template-columns:repeat(4,minmax(0,1fr));">
      <div style="grid-column:1 / span 2;grid-row:1;"><label>부서</label><input id="req_team" value="${esc(values.ownerTeam)}" /></div>
      <div style="grid-column:3 / span 2;grid-row:1;"><label>담당자</label><input id="req_manager_name" value="${esc(nameOfUser(request?.managerId || getCurrentUser()?.id || "") || getCurrentUser()?.name || "-")}" disabled /></div>
      <div style="grid-column:1 / span 1;grid-row:2;"><label>고객사명</label><input id="req_client" value="${esc(values.clientName)}" /></div>
      <div style="grid-column:2 / span 3;grid-row:2;"><label>과정명</label><input id="req_course" value="${esc(values.course)}" /></div>
      <div style="grid-column:1 / -1;grid-row:3;">
        <label>일정</label>
        <div id="req_date_tags" class="row"></div>
        <div id="req_date_entry_row" class="request-inline-entry mt-10">
          <input id="req_date_input" type="date" />
        </div>
      </div>
      <div style="grid-column:1 / span 1;grid-row:4;"><label>시작 시간</label><input id="req_start" type="time" value="${esc(values.start || "09:00")}" /></div>
      <div style="grid-column:2 / span 1;grid-row:4;"><label>종료 시간</label><input id="req_end" type="time" value="${esc(values.end || "10:00")}" /></div>
      <div style="grid-column:3 / span 1;grid-row:4;"><label>지역</label><select id="req_region">${Object.keys(state.settings.transportRateByRegion).map((region) => `<option value="${esc(region)}" ${values.region === region ? "selected" : ""}>${esc(region)}</option>`).join("")}</select></div>
      <div style="grid-column:4 / span 1;grid-row:4;"><label>필요 인원</label><input id="req_required" type="number" min="1" step="1" value="${Number(values.requiredCount || 1)}" /></div>
      <div style="grid-column:1 / span 2;grid-row:5;"><label>시간</label><div id="req_hours_preview" class="view-value">-</div></div>
      <div style="grid-column:1 / -1;grid-row:6;">
        <label>대상 강사</label>
        <div id="req_instructor_tags" class="row"></div>
        <div class="request-instructor-entry mt-10" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-items:start;">
          <input id="req_instructor_search" placeholder="강사명 검색" value="${esc(requestInstructorSearch)}" style="grid-column:1 / span 2;" />
          <select id="req_instructor_select" size="6" style="grid-column:3 / span 2;"></select>
        </div>
      </div>
      <div style="grid-column:1 / -1;grid-row:7;"><label>요청 메시지</label><textarea id="req_message">${esc(values.message)}</textarea></div>
    </div>
    <div class="card mt-12 request-visibility-card request-visibility-section">
      <div><b>강사 공개 항목</b></div>
      <div class="request-visibility-grid mt-12">
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_course" ${visibility.course ? "checked" : ""} /> 과정명</label>
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_client" ${visibility.clientName ? "checked" : ""} /> 고객사명</label>
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_hours" ${visibility.hours ? "checked" : ""} /> 시간</label>
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_required" ${visibility.requiredCount ? "checked" : ""} /> 필요 인원</label>
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_team" ${visibility.ownerTeam ? "checked" : ""} /> 부서</label>
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_manager" ${visibility.managerName ? "checked" : ""} /> 담당자</label>
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_message" ${visibility.message ? "checked" : ""} /> 요청 메시지</label>
      </div>
      <div class="sub mt-10">날짜와 지역은 항상 공개됩니다.</div>
    </div>
    <div class="row row-end mt-12">
      <button class="btn primary" onclick="saveScheduleRequest('${request?.id || ""}')">저장</button>
    </div>
  `);
  attachRequestModalBehaviors();
};

renderInstructorRequestDetail = function renderInstructorRequestDetailAsFields(request, user) {
  const instructorId = user.linkedInstructorId;
  const note = (request.responses || []).find((item) => item.instructorId === instructorId && item.note)?.note || "";
  const visibility = { ...defaultRequestVisibility(), ...(request.visibility || {}) };
  const fields = [
    { label: "요청 담당자", value: nameOfUser(request.managerId) || "-" },
    { label: "부서", value: request.ownerTeam || "-" },
    { label: "지역", value: request.region || "-" },
    { label: "요청 일정", value: (request.requestedDates || []).join(", ") || "-" },
    visibility.course ? { label: "과정명", value: request.course || "-" } : null,
    visibility.clientName ? { label: "고객사", value: request.clientName || "-" } : null,
    visibility.hours ? { label: "시간", value: `${request.start || "-"} ~ ${request.end || "-"}${request.hours ? ` (${request.hours}시간)` : ""}` } : null,
    visibility.requiredCount ? { label: "필요 인원", value: `${request.requiredCount || 1}명` } : null,
    visibility.message ? { label: "요청 메시지", value: request.message || "-" } : null
  ].filter(Boolean);
  return `
    <div class="card">
      <div class="between">
        <div>
          <h3 style="margin:0">${esc(request.course || "강의 일정 회신 요청")}</h3>
          <div class="sub mt-10">요청된 일정 정보를 확인하고 날짜별 응답을 선택해 주세요.</div>
        </div>
        <span class="status-pill st-info">${(request.requestedDates || []).length}개 일정</span>
      </div>
      <div class="request-detail-fields mt-12">
        ${fields.map((field) => `<div class="request-detail-field ${field.label === "요청 메시지" ? "is-wide" : ""}"><label>${esc(field.label)}</label><div class="view-value">${esc(field.value)}</div></div>`).join("")}
      </div>
      <table class="mt-12">
        <thead><tr><th>일자</th><th>지역</th><th>응답</th></tr></thead>
        <tbody>
          ${(request.requestedDates || []).map((date) => {
            const response = findRequestResponse(request, instructorId, date);
            return `<tr><td>${esc(date)}</td><td>${esc(request.region || "-")}</td><td><select id="req_resp_${escAttr(date)}"><option value="">미선택</option><option value="available" ${response?.status === "available" ? "selected" : ""}>가능</option><option value="unavailable" ${response?.status === "unavailable" ? "selected" : ""}>불가</option><option value="hold" ${response?.status === "hold" ? "selected" : ""}>보류</option></select></td></tr>`;
          }).join("")}
        </tbody>
      </table>
      <div class="mt-12">
        <label>회신 쪽지</label>
        <textarea id="req_response_note">${esc(note)}</textarea>
      </div>
      <div class="row row-end mt-12">
        <button class="btn primary" onclick="saveScheduleRequestResponse('${request.id}')">회신 저장</button>
      </div>
    </div>
  `;
};

function getFilteredInstructorsForRequest() {
  const query = String(requestInstructorSearch || "").trim().toLowerCase();
  return state.instructors.filter((instructor) => !query || String(instructor.name || "").toLowerCase().includes(query)).sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "ko"));
}

function addRequestDate(nextDate = "", keepOpen = true) {
  const value = nextDate || v("req_date_input");
  if (!value) return;
  if (!requestEditingDates.includes(value)) requestEditingDates.push(value);
  requestEditingDates = [...new Set(requestEditingDates)].sort();
  const input = document.getElementById("req_date_input");
  if (input) input.value = "";
  renderRequestDateTags();
  if (keepOpen) setTimeout(() => focusRequestDatePicker(), 0);
}

function removeRequestDate(date) {
  requestEditingDates = requestEditingDates.filter((item) => item !== date);
  renderRequestDateTags();
}

function addRequestInstructor() {
  const select = document.getElementById("req_instructor_select");
  const search = document.getElementById("req_instructor_search");
  const targetId = select?.value || "";
  if (!targetId) return;
  if (!requestEditingInstructorIds.includes(targetId)) requestEditingInstructorIds.push(targetId);
  requestInstructorSearch = "";
  if (search) {
    search.value = "";
    search.focus();
  }
  renderRequestInstructorTags();
  renderRequestInstructorSelectOptions();
}

function removeRequestInstructor(instructorId) {
  requestEditingInstructorIds = requestEditingInstructorIds.filter((id) => id !== instructorId);
  renderRequestInstructorTags();
  renderRequestInstructorSelectOptions();
}

async function saveScheduleRequest(requestId = "") {
  const next = buildScheduleRequestPayload(requestId);
  if (!next) return;
  const savedRequest = upsertScheduleRequest(next);
  requestEditingSourceId = "";
  requestEditingDates = [];
  requestEditingInstructorIds = [];
  requestInstructorSearch = "";
  requestModalDraftCache = null;
  requestSelectedId = savedRequest.id;
  saveState();
  closeModal();
  renderRequests();
  alert("강의 일정 요청을 저장했습니다.");
}

async function sendScheduleRequestEmails(request) {
  const actionUrl = `${window.location.origin}/app/`;
  const summary = `${request.course || "강의 일정"} 일정 회신 요청이 도착했습니다. 시스템에서 가능한 일정을 확인해 주세요.`;
  const failures = [];
  for (const instructorId of request.instructorIds) {
    const instructor = state.instructors.find((item) => item.id === instructorId);
    if (!instructor?.email) {
      failures.push(`${instructor?.name || "이름 없음"}: 이메일 없음`);
      continue;
    }
    try {
      await apiPost("/api/email/request-notice", {
        to: instructor.email,
        instructorId,
        requestId: request.id,
        subject: `[강의 일정 요청] ${request.course}`,
        summary,
        message: request.message,
        senderName: getCurrentUser()?.name || "운영 담당자",
        actionUrl
      });
    } catch (error) {
      failures.push(`${instructor.name}: ${error.message}`);
    }
  }
  if (failures.length) alert(`일부 메일 발송에 실패했습니다.\n${failures.join("\n")}`);
}

async function resendScheduleRequestEmails(requestId) {
  const request = state.scheduleRequests.find((item) => item.id === requestId);
  if (!request) return;
  await sendScheduleRequestEmails(request);
}

function saveScheduleRequestResponse(requestId) {
  const request = state.scheduleRequests.find((item) => item.id === requestId);
  const user = getCurrentUser();
  if (!request || !user?.linkedInstructorId) return;
  const note = v("req_response_note");
  request.responses = (request.responses || []).filter((item) => !(item.instructorId === user.linkedInstructorId && (request.requestedDates || []).includes(item.date)));
  (request.requestedDates || []).forEach((date) => {
    const status = document.getElementById(`req_resp_${date}`)?.value || "";
    if (!status) return;
    request.responses.push({
      instructorId: user.linkedInstructorId,
      date,
      status,
      note,
      respondedAt: nowIso(),
      registeredAt: "",
      registeredScheduleId: ""
    });
  });
  saveState();
  renderRequests();
  alert("회신이 저장되었습니다.");
}

function toggleRequestResponseSelection(key, checked) {
  const set = new Set(requestSelectedResponseKeys);
  if (checked) set.add(key);
  else set.delete(key);
  requestSelectedResponseKeys = [...set];
  renderRequests();
}

function toggleRequestSelectAll(checked, encodedKeys) {
  const keys = JSON.parse(decodeURIComponent(encodedKeys || "%5B%5D"));
  requestSelectedResponseKeys = checked ? keys : [];
  renderRequests();
}

function registerSelectedRequestResponses(requestId) {
  const request = state.scheduleRequests.find((item) => item.id === requestId);
  if (!request) return;
  const selectedRows = requestSelectedResponseKeys.map(parseRequestResponseKey).filter((item) => item.requestId === requestId);
  if (!selectedRows.length) return alert("일정으로 등록할 응답을 선택해주세요.");

  const groupedByDate = selectedRows.reduce((acc, row) => {
    if (!acc[row.date]) acc[row.date] = [];
    acc[row.date].push(row.instructorId);
    return acc;
  }, {});
  let createdCount = 0;
  Object.entries(groupedByDate).forEach(([date, instructorIds]) => {
    const uniqueInstructorIds = [...new Set(instructorIds)];
    const linkedScheduleId = request.draftScheduleIdsByDate?.[date] || "";
    const existingSchedule = state.schedules.find((item) => item.id === linkedScheduleId && !item.deleted);
    const nextScheduleData = buildScheduleFromRequest(request, date, uniqueInstructorIds, "confirmed");
    const schedule = existingSchedule || { id: uid("s"), ...nextScheduleData };
    Object.assign(schedule, nextScheduleData, { status: "confirmed", deleted: false });
    if (!existingSchedule) state.schedules.push(schedule);
    request.draftScheduleIdsByDate = request.draftScheduleIdsByDate || {};
    request.draftScheduleIdsByDate[date] = schedule.id;
    syncDispatchesFromSchedules(schedule.id);
    createdCount += 1;
    (request.responses || []).forEach((response) => {
      if (response.date !== date || !uniqueInstructorIds.includes(response.instructorId)) return;
      response.registeredAt = nowIso();
      response.registeredScheduleId = schedule.id;
    });
  });
  request.status = "registered";
  request.updatedAt = nowIso();
  requestSelectedResponseKeys = [];
  saveState();
  renderAll();
  openPage("schedule");
  alert(`${createdCount}건의 일정을 확정으로 변경했습니다.`);
}

const originalOpenInstructorModal = openInstructorModal;
openInstructorModal = function openInstructorModalWithAccessButton(id = "") {
  originalOpenInstructorModal(id);
  if (!id || !canAdmin()) return;
  const row = document.querySelector("#modalRoot .row.row-end.mt-12");
  if (!row || row.querySelector(".js-instructor-account-btn")) return;
  row.insertAdjacentHTML("afterbegin", `<button class="btn js-instructor-account-btn" onclick="openInstructorAccountModal('${id}')">${getRequestInstructorUser(id) ? "계정 관리" : "계정 생성"}</button>`);
};

function suggestInstructorLoginId(instructor) {
  const emailPrefix = String(instructor?.email || "").split("@")[0];
  const base = (emailPrefix || String(instructor?.name || "").replace(/\s+/g, "").toLowerCase() || `ins_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, "");
  let candidate = base || `ins_${Date.now()}`;
  let suffix = 1;
  while (state.users.some((user) => user.loginId === candidate && user.linkedInstructorId !== instructor.id)) candidate = `${base}${suffix++}`;
  return candidate;
}

function openInstructorAccountModal(instructorId) {
  const instructor = state.instructors.find((item) => item.id === instructorId);
  if (!instructor) return;
  const user = getRequestInstructorUser(instructorId);
  modal(`
    <div class="between"><h3 style="margin:0">${user ? "강사 계정 관리" : "강사 계정 생성"}</h3><button class="btn" onclick="closeModal()">닫기</button></div>
    <div class="form-grid mt-12">
      <div><label>강사명</label><div class="view-value">${esc(instructor.name)}</div></div>
      <div><label>이메일</label><div class="view-value">${esc(instructor.email || "-")}</div></div>
      <div><label>아이디</label><input id="req_account_login" value="${esc(user?.loginId || suggestInstructorLoginId(instructor))}" /></div>
      <div><label>비밀번호</label><input id="req_account_password" type="password" placeholder="${user ? "변경 시에만 입력" : "초기 비밀번호"}" /></div>
    </div>
    <div class="row row-end mt-12"><button class="btn primary" onclick="saveInstructorAccount('${instructorId}')">${user ? "저장" : "계정 생성"}</button></div>
  `);
}

function saveInstructorAccount(instructorId) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const instructor = state.instructors.find((item) => item.id === instructorId);
  if (!instructor) return;
  const loginId = v("req_account_login");
  const password = v("req_account_password");
  if (!loginId) return alert("아이디를 입력해주세요.");
  const existing = getRequestInstructorUser(instructorId);
  if (state.users.some((user) => user.loginId === loginId && user.id !== existing?.id)) return alert("이미 사용 중인 아이디입니다.");
  if (existing) {
    existing.loginId = loginId;
    existing.name = instructor.name;
    existing.role = "instructor";
    existing.linkedInstructorId = instructorId;
    if (password) existing.password = password;
  } else {
    if (!password) return alert("초기 비밀번호를 입력해주세요.");
    state.users.push({ id: uid("u"), loginId, password, name: instructor.name, role: "instructor", team: instructor.category || "강사", linkedInstructorId: instructorId });
  }
  saveState();
  closeModal();
  renderInstructors();
  alert(existing ? "강사 계정을 수정했습니다." : "강사 계정을 생성했습니다.");
}

function openScheduleRequestModal(requestId = "") {
  if (!canManageRequests()) return alert("沅뚰븳???놁뒿?덈떎.");
  const request = state.scheduleRequests.find((item) => item.id === requestId) || null;
  if (requestEditingSourceId !== requestId) {
    requestEditingSourceId = requestId;
    requestEditingDates = request ? [...(request.requestedDates || [])] : [];
    requestEditingInstructorIds = request ? [...(request.instructorIds || [])] : [];
    requestInstructorSearch = "";
  }
  const visibility = { ...defaultRequestVisibility(), ...(request?.visibility || {}) };
  const instructorTags = requestEditingInstructorIds.map((id) => `<span class="status-pill st-neutral">${esc(nameOfInstructor(id))} <span style="margin-left:6px;cursor:pointer;" onclick="removeRequestInstructor('${id}')">x</span></span>`).join("") || '<span class="sub">?좏깮??媛뺤궗 ?놁쓬</span>';
  const dateTags = requestEditingDates.map((date) => `<span class="status-pill st-neutral">${esc(date)} <span style="margin-left:6px;cursor:pointer;" onclick="removeRequestDate('${date}')">x</span></span>`).join("") || '<span class="sub">추가된 일정 없음</span>';
  const instructorOptions = getFilteredInstructorsForRequest().map((instructor) => `<option value="${esc(instructor.name)}"></option>`).join("");
  modal(`
    <div class="between"><h3 style="margin:0">${request ? "媛뺤쓽 ?쇱젙 ?붿껌 ?섏젙" : "媛뺤쓽 ?쇱젙 ?붿껌"}</h3><button class="btn" onclick="closeModal()">?リ린</button></div>
    <div class="form-grid mt-12">
      <div><label>怨쇱젙紐?/label><input id="req_course" value="${esc(request?.course || "")}" /></div>
      <div><label>怨좉컼?щ챸</label><input id="req_client" value="${esc(request?.clientName || "")}" /></div>
      <div><label>?쒓컙</label><input id="req_hours" type="number" min="0.5" step="0.5" value="${Number(request?.hours || 1)}" /></div>
      <div><label>?꾩슂 ?몄썝</label><input id="req_required" type="number" min="1" step="1" value="${Number(request?.requiredCount || 1)}" /></div>
      <div><label>吏??/label><select id="req_region">${Object.keys(state.settings.transportRateByRegion).map((region) => `<option value="${esc(region)}" ${request?.region === region ? "selected" : ""}>${esc(region)}</option>`).join("")}</select></div>
      <div><label>遺??/label><input id="req_team" value="${esc(request?.ownerTeam || getCurrentUser()?.team || "-")}" /></div>
      <div><label>?대떦??/label><input id="req_manager_name" value="${esc(nameOfUser(request?.managerId || getCurrentUser()?.id || "") || getCurrentUser()?.name || "-")}" disabled /></div>
      <div style="grid-column:1/-1;"><label>?붿껌 硫붿떆吏</label><textarea id="req_message">${esc(request?.message || "")}</textarea></div>
      <div style="grid-column:1/-1;"><label>?붿껌 ?쇱젙</label><div id="req_date_tags" class="row">${dateTags}</div><div class="row mt-10"><input id="req_date_input" type="date" /><button class="btn" onclick="addRequestDate()">?쇱옄 異붽?</button></div></div>
      <div style="grid-column:1/-1;"><label>???媛뺤궗</label><div id="req_instructor_tags" class="row">${instructorTags}</div><div class="row mt-10"><input id="req_instructor_search" placeholder="媛뺤궗紐??낅젰" list="reqInstructorList" value="${esc(requestInstructorSearch)}" /><datalist id="reqInstructorList">${instructorOptions}</datalist><button class="btn" onclick="addRequestInstructor()">媛뺤궗 異붽?</button></div></div>
    </div>
    <div class="card mt-12 request-visibility-card">
      <div><b>媛뺤궗 怨듦컻 ??ぉ</b></div>
      <div class="request-visibility-grid mt-12">
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_course" ${visibility.course ? "checked" : ""} /> 怨쇱젙紐?/label>
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_client" ${visibility.clientName ? "checked" : ""} /> 怨좉컼?щ챸</label>
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_hours" ${visibility.hours ? "checked" : ""} /> ?쒓컙</label>
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_required" ${visibility.requiredCount ? "checked" : ""} /> ?꾩슂 ?몄썝</label>
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_team" ${visibility.ownerTeam ? "checked" : ""} /> 遺??/label>
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_manager" ${visibility.managerName ? "checked" : ""} /> ?대떦??/label>
        <label class="request-visibility-item"><input type="checkbox" id="req_vis_message" ${visibility.message ? "checked" : ""} /> ?붿껌 硫붿떆吏</label>
      </div>
      <div class="sub mt-10">?좎쭨? 吏??? ??긽 怨듦컻?⑸땲??</div>
    </div>
    <div class="row row-end mt-12"><button class="btn primary" onclick="saveScheduleRequest('${request?.id || ""}')">${request ? "저장" : "저장 후 발송"}</button></div>
  `);
}




