function login() {
  const user = state.users.find((u) => u.loginId === v("loginId"));
  if (!user) return alert("존재하지 않는 계정입니다. admin 또는 manager1");
  if ((user.password || "") && user.password !== v("loginPw")) return alert("비밀번호가 올바르지 않습니다.");
  session.userId = user.id;
  localStorage.setItem("ims_current_user", user.id);
  bootstrap();
}
function logout() { session.userId = ""; localStorage.removeItem("ims_current_user"); bootstrap(); }
function openPage(name) {
  if (!canAccessMenu(name)) name = "dashboard";
  if (name === "instructors") selectedInstructorId = "";
  view = name;
  document.querySelectorAll(".menu-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === name));
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
  document.getElementById(`view-${name}`).classList.add("active");
  const map = { dashboard: ["대시보드", ""], instructors: ["강사 관리", ""], schedule: ["일정 관리", ""], settlement: ["출강·정산 관리", ""], settings: ["설정", ""], admin: ["관리자 설정", ""] };
  document.getElementById("pageTitle").textContent = map[name][0];
  document.getElementById("pageSub").textContent = map[name][1];
  renderAll();
}

function saveMySettings() {
  const user = getCurrentUser();
  if (!user) return;
  const name = v("my_name");
  const team = v("my_team");
  const currentPw = v("my_current_pw");
  const nextPw = v("my_next_pw");
  const nextPw2 = v("my_next_pw2");
  if (!name) return alert("이름은 필수입니다.");
  if (nextPw || nextPw2) {
    if ((user.password || "") && currentPw !== (user.password || "")) return alert("현재 비밀번호가 올바르지 않습니다.");
    if (nextPw !== nextPw2) return alert("새 비밀번호 확인이 일치하지 않습니다.");
    user.password = nextPw;
  }
  user.name = name;
  user.team = team || "-";
  saveState();
  renderSettings();
  bootstrap();
  alert("내 정보가 저장되었습니다.");
}
function renderSettings() {
  const root = document.getElementById("view-settings");
  if (!root) return;
  const user = getCurrentUser();
  if (!user) { root.innerHTML = ""; return; }
  root.innerHTML = `<div class="card mt-10"><h3 style="margin-top:0">내 계정 설정</h3><div class="form-grid mt-12"><div><label>아이디</label><div class="view-value">${esc(user.loginId || "-")}</div></div><div><label>권한</label><div class="view-value">${esc(roleLabel(user.role))}</div></div><div><label>이름</label><input id="my_name" value="${esc(user.name || "")}" /></div><div><label>팀</label><input id="my_team" value="${esc(user.team || "")}" /></div><div><label>현재 비밀번호</label><input id="my_current_pw" type="password" placeholder="현재 비밀번호" /></div><div><label>새 비밀번호</label><input id="my_next_pw" type="password" placeholder="변경 시 입력" /></div><div><label>새 비밀번호 확인</label><input id="my_next_pw2" type="password" placeholder="한번 더 입력" /></div></div><div class="row row-end mt-12"><button class="btn primary" onclick="saveMySettings()">저장</button></div></div>`;
}

function openUsersBatchModal() {
  if (!canAdmin()) return alert("권한이 없습니다.");
  modal(`<div class="between"><h3 style="margin:0">사용자 추가</h3><button class="btn" onclick="closeModal()">닫기</button></div><div class="sub mt-10">여러 명을 한 번에 추가할 수 있습니다. (이름/권한/아이디/비밀번호/팀 필수)</div><div class="card mt-10" style="padding:10px;"><table><thead><tr><th>이름</th><th>권한</th><th>아이디</th><th>비밀번호</th><th>팀</th><th></th></tr></thead><tbody id="userBatchRows"></tbody></table><div class="row mt-10"><button class="btn" onclick="appendUserBatchRow()">행 추가</button><button class="btn primary" onclick="saveUsersBatch()">일괄 생성</button></div></div>`);
  appendUserBatchRow();
}
function appendUserBatchRow() {
  const body = document.getElementById("userBatchRows");
  if (!body) return;
  const rowId = uid("row");
  const tr = document.createElement("tr");
  tr.id = rowId;
  tr.innerHTML = `<td><input class="ub_name" placeholder="홍길동" /></td><td><select class="ub_role"><option value="user">사용자</option><option value="team_leader">팀 리더</option><option value="admin">관리자</option></select></td><td><input class="ub_login" placeholder="honggildong" /></td><td><input class="ub_pw" type="password" placeholder="비밀번호" /></td><td><input class="ub_team" placeholder="교육1팀" /></td><td><button class="btn" style="white-space:nowrap;" onclick="document.getElementById('${rowId}').remove()">삭제</button></td>`;
  body.appendChild(tr);
}
function saveUsersBatch() {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const rows = [...document.querySelectorAll("#userBatchRows tr")];
  if (!rows.length) return alert("추가할 행이 없습니다.");
  const newUsers = [];
  for (const tr of rows) {
    const name = tr.querySelector(".ub_name")?.value?.trim() || "";
    const role = tr.querySelector(".ub_role")?.value || "user";
    const loginId = tr.querySelector(".ub_login")?.value?.trim() || "";
    const password = tr.querySelector(".ub_pw")?.value?.trim() || "";
    const team = tr.querySelector(".ub_team")?.value?.trim() || "";
    if (!name && !loginId && !password) continue;
    if (!name || !loginId || !password || !team) return alert("이름/권한/아이디/비밀번호/팀은 필수입니다.");
    if (state.users.some((u) => u.loginId === loginId) || newUsers.some((u) => u.loginId === loginId)) return alert(`중복 아이디: ${loginId}`);
    newUsers.push({ id: uid("u"), name, role, loginId, password, team });
  }
  if (!newUsers.length) return alert("입력된 사용자가 없습니다.");
  state.users.push(...newUsers);
  saveState();
  closeModal();
  renderAdmin();
  alert(`${newUsers.length}명 계정이 생성되었습니다.`);
}
function showGradeInstructors(encodedGradeName) {
  const gradeName = decodeURIComponent(encodedGradeName);
  const rows = state.instructors.filter((i) => i.grade === gradeName);
  modal(`<div class="between"><h3 style="margin:0">소속 강사 - ${esc(gradeName)}</h3><button class="btn" onclick="closeModal()">닫기</button></div><div class="card mt-10"><table><thead><tr><th>강사명</th><th>분야</th><th>연락처</th><th>이메일</th></tr></thead><tbody>${rows.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.field || "-")}</td><td>${esc(i.phone || "-")}</td><td>${esc(i.email || "-")}</td></tr>`).join("") || '<tr><td colspan="4" class="sub">해당 등급 소속 강사가 없습니다.</td></tr>'}</tbody></table></div>`);
}

function ensureDispatchForCompletedSchedule(scheduleId) {
  syncDispatchesFromSchedules(scheduleId);
}
function getLatestSuccessfulSettlementEmail(instructorId, month) {
  return state.settlementEmails
    .filter((email) => email.status === "success" && email.instructorId === instructorId && email.month === month)
    .slice()
    .sort((a, b) => `${b.at || ""}`.localeCompare(`${a.at || ""}`))[0] || null;
}
function syncDispatchesFromSchedules(onlyScheduleId = "") {
  const targets = state.schedules.filter((s) => isSettlementVisibleSchedule(s) && (!onlyScheduleId || s.id === onlyScheduleId));
  const targetPairs = new Set();
  targets.forEach((s) => {
    const instructorIds = getScheduleInstructorIds(s);
    instructorIds.forEach((instructorId) => targetPairs.add(`${s.id}__${instructorId}`));
  });
  state.dispatches = state.dispatches.filter((d) => {
    if (onlyScheduleId) {
      if (d.scheduleId !== onlyScheduleId) return true;
      return targetPairs.has(`${d.scheduleId}__${d.instructorId}`);
    }
    const sch = state.schedules.find((s) => s.id === d.scheduleId);
    if (!sch || !isSettlementVisibleSchedule(sch)) return false;
    return targetPairs.has(`${d.scheduleId}__${d.instructorId}`);
  });
  targets.forEach((s) => {
    const instructorIds = getScheduleInstructorIds(s);
    instructorIds.forEach((instructorId) => {
      const ins = state.instructors.find((i) => i.id === instructorId);
      if (!ins) return;
      const rule = getGradeRule(ins.grade);
      const unitType = ins.unitType === "day" ? "day" : (ins.unitType === "hour" ? "hour" : rule.unitType);
      const units = unitType === "day" ? 1 : Number(s.hours || durationHours(s.start || "09:00", s.end || "09:00") || 0);
      const region = s.region || defaultRegion();
      const key = `${s.id}__${instructorId}`;
      const existing = state.dispatches.find((d) => `${d.scheduleId}__${d.instructorId}` === key);
      const baseRate = Number(rule.rate || ins.baseRate || 0);
      const nextCore = {
        scheduleId: s.id,
        instructorId,
        date: s.date,
        units,
        customRate: baseRate,
        deductionRate: Number(ins.deductionRate || 3.3),
        region,
        transportCost: transportByRegion(region)
      };
      if (existing) {
        existing.scheduleId = nextCore.scheduleId;
        existing.instructorId = nextCore.instructorId;
        existing.date = nextCore.date;
        existing.region = nextCore.region;
        if (!existing.manualImport) {
          existing.units = nextCore.units;
          existing.customRate = nextCore.customRate;
          existing.deductionRate = nextCore.deductionRate;
          existing.transportCost = nextCore.transportCost;
          Object.assign(existing, calcDispatch(existing));
        }
      } else {
        const created = {
          id: uid("d"),
          ...nextCore,
          lodgingCost: 0,
          materialCost: 0,
          receiptUrl: "",
          note: "",
          modifiedAfterEmail: false,
          history: [{ at: nowIso(), by: getCurrentUser()?.name || "system", action: "생성" }]
        };
        Object.assign(created, calcDispatch(created));
        const latestMail = getLatestSuccessfulSettlementEmail(instructorId, toMonth(s.date));
        if (latestMail) {
          created.modifiedAfterEmail = true;
          state.auditLogs.push({
            id: uid("log"),
            type: "dispatch_modified_after_email",
            at: nowIso(),
            by: getCurrentUser()?.name || "system",
            managerId: s.managerId || "",
            dispatchId: created.id,
            date: created.date,
            targetName: nameOfInstructor(instructorId),
            detail: "발송 후 신규 일정 추가"
          });
        }
        state.dispatches.push(created);
      }
    });
  });
}

function openCurrentMonthSettlement() {
  settlementMonth = new Date().toISOString().slice(0, 7);
  settlementInstructorFilter = "";
  settlementManagerFilter = "";
  settlementCourseFilter = "";
  settlementDateFrom = "";
  settlementDateTo = "";
  settlementDateFromInput = "";
  settlementDateToInput = "";
  settlementSummarySearch = "";
  settlementSelectedInstructorIds = [];
  settlementRecentRange = null;
  openPage("settlement");
}

function showMonthlyActiveInstructors(monthKey) {
  const activeInstructorIds = [...new Set(state.schedules.filter((s) => !s.deleted && toMonth(s.date) === monthKey && ["draft", "confirmed", "completed"].includes(s.status)).map((s) => s.instructorId))];
  const rows = activeInstructorIds.map((id) => state.instructors.find((i) => i.id === id)).filter(Boolean);
  modal(`<div class="between"><h3 style="margin:0">${monthLabel(monthKey)} 진행 강사 (${rows.length}명)</h3><button class="btn" onclick="closeModal()">닫기</button></div><div class="card mt-10"><table><thead><tr><th>강사명</th><th>분야</th><th>연락처</th><th>이메일</th></tr></thead><tbody>${rows.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.field || "-")}</td><td>${esc(i.phone || "-")}</td><td>${esc(i.email || "-")}</td></tr>`).join("") || '<tr><td colspan="4" class="sub">해당 월 진행 강사가 없습니다.</td></tr>'}</tbody></table></div>`);
}

function openSettlementForInstructor(instructorId, monthKey) {
  settlementMonth = monthKey;
  settlementInstructorFilter = instructorId;
  settlementManagerFilter = "";
  settlementCourseFilter = "";
  settlementDateFrom = "";
  settlementDateTo = "";
  settlementDateFromInput = "";
  settlementDateToInput = "";
  settlementSummarySearch = "";
  settlementSelectedInstructorIds = [];
  settlementRecentRange = null;
  openPage("settlement");
}

function openSettlementForManagerMonth(managerId, monthKey) {
  settlementMonth = monthKey;
  settlementInstructorFilter = "";
  settlementManagerFilter = managerId || "";
  settlementCourseFilter = "";
  settlementDateFrom = "";
  settlementDateTo = "";
  settlementDateFromInput = "";
  settlementDateToInput = "";
  settlementSummarySearch = "";
  settlementSelectedInstructorIds = [];
  settlementRecentRange = null;
  openPage("settlement");
}

function openSettlementForInstructorAndManager(instructorId, managerId, monthKey) {
  settlementMonth = monthKey;
  settlementInstructorFilter = instructorId || "";
  settlementManagerFilter = managerId || "";
  settlementCourseFilter = "";
  settlementDateFrom = "";
  settlementDateTo = "";
  settlementDateFromInput = "";
  settlementDateToInput = "";
  settlementSummarySearch = "";
  settlementSelectedInstructorIds = [];
  settlementRecentRange = null;
  openPage("settlement");
}
function openSettlementRecentForInstructor(instructorId) {
  const now = new Date();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const to = now.toISOString().slice(0, 10);
  const from = oneMonthAgo.toISOString().slice(0, 10);
  settlementMonth = toMonth(to);
  settlementInstructorFilter = instructorId || "";
  settlementManagerFilter = "";
  settlementCourseFilter = "";
  settlementDateFrom = from;
  settlementDateTo = to;
  settlementDateFromInput = from;
  settlementDateToInput = to;
  settlementSummarySearch = "";
  settlementSelectedInstructorIds = [];
  settlementRecentRange = { from, to };
  openPage("settlement");
}
function closeInstructorDetail() {
  selectedInstructorId = "";
  renderInstructors();
}

function toggleUserScheduleAlert() {
  userScheduleAlertCollapsed = !userScheduleAlertCollapsed;
  renderDashboard();
}

function buildMonthlyCourseRows(schedules, dispatches, monthKey) {
  const grouped = {};
  schedules.filter((s) => toMonth(s.date) === monthKey).forEach((schedule) => {
    const courseName = schedule.course || "-";
    if (!grouped[courseName]) grouped[courseName] = { course: courseName, assignmentCount: 0, instructorIds: new Set(), amount: 0 };
    const instructorIds = getScheduleInstructorIds(schedule);
    grouped[courseName].assignmentCount += instructorIds.length || 1;
    instructorIds.forEach((id) => {
      if (id) grouped[courseName].instructorIds.add(id);
    });
  });
  dispatches.filter((d) => toMonth(d.date) === monthKey).forEach((dispatch) => {
    const schedule = state.schedules.find((s) => s.id === dispatch.scheduleId);
    const courseName = schedule?.course || "-";
    if (!grouped[courseName]) grouped[courseName] = { course: courseName, assignmentCount: 0, instructorIds: new Set(), amount: 0 };
    grouped[courseName].amount += Number(dispatch.net || 0);
    if (dispatch.instructorId) grouped[courseName].instructorIds.add(dispatch.instructorId);
  });
  return Object.values(grouped)
    .map((item) => ({
      course: item.course,
      assignmentCount: item.assignmentCount,
      instructorCount: item.instructorIds.size,
      amount: item.amount
    }))
    .sort((a, b) => b.amount - a.amount || b.assignmentCount - a.assignmentCount || a.course.localeCompare(b.course, "ko"));
}

function renderDashboard() {
  const root = document.getElementById("view-dashboard");
  const user = getCurrentUser();
  const active = getVisibleSchedules(user).filter((s) => !s.deleted && ["draft", "confirmed", "completed"].includes(s.status));
  const completed = active.filter((s) => s.status === "completed");
  const delayed = active.filter((s) => s.status === "confirmed" && s.date < new Date().toISOString().slice(0, 10));
  const missingDispatch = completed.filter((s) => !state.dispatches.find((d) => d.scheduleId === s.id));
  const month = new Date().toISOString().slice(0, 7);
  const monthDispatch = getVisibleDispatches(user).filter((d) => (d.date || "").startsWith(month));
  const monthNet = monthDispatch.reduce((sum, d) => sum + d.net, 0);
  const myNet = monthDispatch.filter((d) => {
    const schedule = state.schedules.find((s) => s.id === d.scheduleId);
    if (isTeamLeader(user)) return scheduleDepartmentName(schedule) === (user?.team || "-");
    return schedule?.managerId === user?.id && scheduleDepartmentName(schedule) === (user?.team || "-");
  }).reduce((sum, d) => sum + d.net, 0);
  const warnCount = delayed.length + missingDispatch.length + getVisibleDispatches(user).filter((d) => d.modifiedAfterEmail).length;
  refreshAlertBadge();
  if (canAdmin()) {
    const monthStartDate = monthStart(month);
    const overdueUnconfirmed = state.schedules.filter((s) => !s.deleted && new Date(`${s.date}T00:00:00`) < monthStartDate && !["confirmed", "completed"].includes(s.status));
    const overdueMissingPay = state.schedules.filter((s) => !s.deleted && new Date(`${s.date}T00:00:00`) < monthStartDate && s.status === "completed" && !state.dispatches.find((d) => d.scheduleId === s.id));
    const overdueItems = [
      ...overdueUnconfirmed.map((s) => ({ type: "확정 필요", schedule: s })),
      ...overdueMissingPay.map((s) => ({ type: "강사료 미작성", schedule: s }))
    ];

    const prevMonth = monthDiff(month, -1);
    const prevNet = state.dispatches.filter((d) => toMonth(d.date) === prevMonth).reduce((sum, d) => sum + d.net, 0);
    const netDiff = monthNet - prevNet;
    const netDiffPct = pctDelta(monthNet, prevNet);

    const activeInstructorIdsThisMonth = [...new Set(active.filter((s) => toMonth(s.date) === month).flatMap((s) => getScheduleInstructorIds(s)))];
    const activeInstructorCount = activeInstructorIdsThisMonth.length;
    const monthlyCourseRows = buildMonthlyCourseRows(active, monthDispatch, month);
    const monthlyCourseCount = monthlyCourseRows.length;

    const trendMonths = [-5, -4, -3, -2, -1, 0].map((d) => monthDiff(month, d));
    const trendData = trendMonths.map((m) => ({ month: m, total: state.dispatches.filter((d) => toMonth(d.date) === m).reduce((sum, d) => sum + d.net, 0) }));
    const trendMax = Math.max(...trendData.map((t) => t.total), 1);
    const currentTrendPct = pctDelta(trendData[trendData.length - 1].total, trendData[trendData.length - 2]?.total || 0);

    const monthCourseTableRows = monthlyCourseRows.map((course) => `<tr><td class="cell-mid-left">${esc(course.course)}</td><td class="cell-center">${course.assignmentCount}건</td><td class="cell-center">${course.instructorCount}명</td><td class="cell-amount"><b>${fmtMoney(course.amount)}</b></td></tr>`);

    root.innerHTML = `
      ${overdueItems.length ? `<div class="card" style="border-color:#fecaca;background:#fff7f7;"><div class="between"><h3 style="margin:0">정산 내역 미작성/미확정 지연 건</h3><span class="badge b-danger">${overdueItems.length}건</span></div><table class="mt-10"><thead><tr><th>구분</th><th>일정</th><th>담당자</th></tr></thead><tbody>${overdueItems.map((x) => `<tr><td>${x.type}</td><td>${x.schedule.date} ${esc(x.schedule.course)} / ${esc(nameOfInstructor(x.schedule.instructorId))}</td><td>${esc(nameOfUser(x.schedule.managerId))}</td></tr>`).join("")}</tbody></table></div>` : ""}
      <div class="grid-3 mt-12">
        <div class="card hero-kpi">
          <div class="kpi-title">이번 달 총 정산액</div>
          <div class="kpi-value" style="cursor:pointer;" onclick="openCurrentMonthSettlement()">${fmtMoney(monthNet)}</div>
          <div class="sub ${netDiff >= 0 ? "text-ok" : "text-danger"}">${netDiff >= 0 ? "+" : ""}${netDiffPct.toFixed(1)}% (${netDiff >= 0 ? "+" : ""}${fmtMoney(netDiff)}) ${netDiff >= 0 ? "증가" : "감소"}</div>
        </div>
        <div class="card hero-kpi">
          <div class="kpi-title">이번 달 진행 강사 수</div>
          <div class="kpi-value" style="cursor:pointer;" onclick="showMonthlyActiveInstructors('${month}')">${activeInstructorCount}명</div>
          <div class="sub">클릭 시 강사 목록 팝업</div>
        </div>
        <div class="card hero-kpi">
          <div class="kpi-title">이번 달 과정 수</div>
          <div class="kpi-value">${monthlyCourseCount}개</div>
          <div class="sub">이번 달 진행 과정 기준</div>
        </div>
      </div>
      <div class="grid-3 mt-12">
        <div class="card" style="grid-column: span 2;">
          <div class="between"><h3 style="margin-top:0">월별 정산액 추이</h3><span class="sub">최근 6개월</span></div>
          <div style="height:220px;display:flex;align-items:flex-end;gap:16px;padding:8px 6px 0;">
            ${trendData.map((t, idx) => {
              const h = Math.max(8, Math.round((t.total / trendMax) * 150));
              const isCurrent = idx === trendData.length - 1;
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;"><div class="sub" style="height:16px;">${isCurrent ? `${currentTrendPct >= 0 ? "+" : ""}${currentTrendPct.toFixed(1)}%` : ""}</div><div style="width:100%;max-width:56px;height:${h}px;border-radius:10px 10px 0 0;background:${isCurrent ? "#2563eb" : "#cbd5e1"};"></div><div class="sub">${monthLabel(t.month)}</div></div>`;
            }).join("")}
          </div>
        </div>
        <div class="card">
          <h3 style="margin-top:0">요약</h3>
          <div class="sub">미작성/미확정 지연: <b>${overdueItems.length}건</b></div>
          <div class="sub mt-10">일정 지연 알림: <b>${delayed.length}건</b></div>
          <div class="sub mt-10">발송 후 수정: <b>${state.dispatches.filter((d) => d.modifiedAfterEmail).length}건</b></div>
        </div>
      </div>
      <div class="card mt-12">
        <h3 style="margin-top:0">이번 달 진행 과정 리스트</h3>
        <table class="dash-table">
          <thead><tr><th>과정명</th><th>총 일정 개수</th><th>투입 강사 수</th><th>총 정산금액</th></tr></thead>
          <tbody>${monthCourseTableRows.join("") || '<tr><td colspan="4" class="sub">데이터 없음</td></tr>'}</tbody>
        </table>
      </div>
    `;
    return;
  }

  const mySchedules = active.filter((s) => s.managerId === user?.id && toMonth(s.date) === month);
  const myNeedConfirm = mySchedules.filter((s) => !["confirmed", "completed"].includes(s.status));
  const myDispatches = monthDispatch.filter((d) => {
    const sch = state.schedules.find((s) => s.id === d.scheduleId);
    return sch?.managerId === user?.id;
  });
  const myCourseRowsData = buildMonthlyCourseRows(mySchedules, myDispatches, month);
  const myCourseRows = myCourseRowsData.map((course) => `<tr><td class="cell-mid-left">${esc(course.course)}</td><td class="cell-center">${course.assignmentCount}건</td><td class="cell-center">${course.instructorCount}명</td><td class="cell-amount"><b>${fmtMoney(course.amount)}</b></td></tr>`);
  root.innerHTML = `
    <div class="card">
      <div class="between">
        <h3 style="margin:0">일정 확인 필요</h3>
        <button class="btn" onclick="toggleUserScheduleAlert()">${userScheduleAlertCollapsed ? "펼치기" : "접기"}</button>
      </div>
      ${userScheduleAlertCollapsed ? "" : `<table class="mt-10 dash-table"><colgroup><col class="col-date"/><col class="col-course"/><col class="col-instructor"/><col class="col-state"/></colgroup><thead><tr><th>일자</th><th>과정</th><th>강사</th><th>상태</th></tr></thead><tbody>${myNeedConfirm.map((s) => `<tr><td class="cell-date">${s.date}</td><td class="cell-course">${esc(s.course)}</td><td class="cell-instructor">${esc(nameOfInstructor(s.instructorId))}</td><td class="cell-state"><span class="status-pill st-warn">${s.status === "draft" ? "가안" : s.status}</span></td></tr>`).join("") || '<tr><td colspan="4" class="sub">확인 필요한 일정이 없습니다.</td></tr>'}</tbody></table>`}
    </div>
    <div class="grid-3 mt-12">
      <div class="card hero-kpi"><div class="kpi-title">이번 달 내 과정 정산액</div><div class="kpi-value" style="cursor:pointer;" onclick="openSettlementForManagerMonth('${user?.id || ""}','${month}')">${fmtMoney(myNet)}</div></div>
      <div class="card hero-kpi"><div class="kpi-title">이번 달 진행 일정</div><div class="kpi-value">${mySchedules.length}개</div></div>
      <div class="card hero-kpi"><div class="kpi-title">이번 달 내 과정</div><div class="kpi-value">${myCourseRowsData.length}개</div></div>
    </div>
    <div class="card mt-12">
      <h3 style="margin-top:0">이번 달 진행 과정 리스트</h3>
      <table class="dash-table">
        <thead><tr><th>과정명</th><th>총 일정 개수</th><th>투입 강사 수</th><th>총 정산금액</th></tr></thead>
        <tbody>${myCourseRows.join("") || '<tr><td colspan="4" class="sub">진행 과정 데이터가 없습니다.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function setInstructorFilter(key, value) { instructorFilter[key] = key === "ratingMin" ? Number(value || 0) : value; refreshInstructorListOnly(); }
