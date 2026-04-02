async function verifySmtp(host = "", port = 587, secure = false) {
  try {
    const data = await apiPost("/api/email/verify", { host: host || undefined, port, secure });
    alert(`SMTP 연결 성공: ${data.config.host}:${data.config.port}`);
  } catch (err) {
    alert(`SMTP 연결 실패: ${err.message}`);
  }
}

function setAdminSubTab(tab) {
  adminSubTab = tab || "grade_transport";
  renderAdmin();
}

function updateUserRole(id, role) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const user = state.users.find((u) => u.id === id);
  if (!user) return;
  user.role = ROLE_LABELS[role] ? role : "user";
  saveState();
  renderAdmin();
}

function toggleRolePermission(role, menu, checked) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  if (!ROLE_LABELS[role] || !MENU_ORDER.includes(menu)) return;
  const current = new Set(getRoleMenuPermissions(role));
  if (checked) current.add(menu);
  else current.delete(menu);
  if (role === "admin") current.add("admin");
  state.settings.roleMenuPermissions[role] = MENU_ORDER.filter((key) => current.has(key));
  saveState();
  renderAdmin();
  bootstrap();
}

function updateSettlementAccess(role, scope) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  if (!ROLE_LABELS[role]) return;
  if (!["own", "team", "all"].includes(scope)) return;
  state.settings.settlementAccessByRole[role] = scope;
  saveState();
  renderAdmin();
}

function openUsersBatchModal() {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const departmentOptions = getDepartmentNames().map((team) => `<option value="${esc(team)}"></option>`).join("");
  modal(`<div class="between"><h3 style="margin:0">사용자 추가</h3><button class="btn" onclick="closeModal()">닫기</button></div><div class="sub mt-10">여러 명을 한 번에 추가할 수 있습니다. (이름/권한/아이디/비밀번호/팀 필수)</div><div class="card mt-10" style="padding:10px;"><table><thead><tr><th>이름</th><th>권한</th><th>아이디</th><th>비밀번호</th><th>팀</th><th></th></tr></thead><tbody id="userBatchRows"></tbody></table><datalist id="departmentOptions">${departmentOptions}</datalist><div class="row mt-10"><button class="btn" onclick="appendUserBatchRow()">행 추가</button><button class="btn primary" onclick="saveUsersBatch()">일괄 생성</button></div></div>`);
  appendUserBatchRow();
}

function appendUserBatchRow() {
  const body = document.getElementById("userBatchRows");
  if (!body) return;
  const rowId = uid("row");
  const tr = document.createElement("tr");
  tr.id = rowId;
  tr.innerHTML = `<td><input class="ub_name" placeholder="홍길동" /></td><td><select class="ub_role"><option value="user">사용자</option><option value="team_leader">팀 리더</option><option value="admin">관리자</option></select></td><td><input class="ub_login" placeholder="honggildong" /></td><td><input class="ub_pw" type="password" placeholder="비밀번호" /></td><td><input class="ub_team" list="departmentOptions" placeholder="교육1팀" /></td><td><button class="btn" style="white-space:nowrap;" onclick="document.getElementById('${rowId}').remove()">삭제</button></td>`;
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
  state.settings.departments = [...new Set([...getDepartmentNames(), ...newUsers.map((u) => u.team)])].sort((a, b) => a.localeCompare(b, "ko"));
  saveState();
  closeModal();
  renderAdmin();
  alert(`${newUsers.length}명 계정이 생성되었습니다.`);
}

function openUserEditModal(userId) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const user = state.users.find((u) => u.id === userId);
  if (!user) return;
  const departmentOptions = getDepartmentNames().map((team) => `<option value="${esc(team)}"></option>`).join("");
  modal(`<div class="between"><h3 style="margin:0">사용자 정보 수정</h3><button class="btn" onclick="closeModal()">닫기</button></div><div class="form-grid mt-10"><div><label>이름</label><input id="user_edit_name" value="${esc(user.name || "")}" /></div><div><label>아이디</label><input id="user_edit_login" value="${esc(user.loginId || "")}" /></div><div><label>비밀번호</label><input id="user_edit_pw" type="password" placeholder="변경 시 입력" /></div><div><label>권한</label><select id="user_edit_role"><option value="user">사용자</option><option value="team_leader">팀 리더</option><option value="admin">관리자</option></select></div><div><label>팀</label><input id="user_edit_team" list="user_edit_departments" value="${esc(user.team || "")}" /></div></div><datalist id="user_edit_departments">${departmentOptions}</datalist><div class="row row-end mt-12"><button class="btn primary" onclick="saveUserEdit('${user.id}')">저장</button></div>`);
  document.getElementById("user_edit_role").value = user.role || "user";
}

function saveUserEdit(userId) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const user = state.users.find((u) => u.id === userId);
  if (!user) return;
  const nextName = v("user_edit_name");
  const nextLogin = v("user_edit_login");
  const nextPw = v("user_edit_pw");
  const nextRole = v("user_edit_role");
  const nextTeam = v("user_edit_team");
  if (!nextName || !nextLogin || !nextRole || !nextTeam) return alert("이름, 아이디, 권한, 팀은 필수입니다.");
  if (state.users.some((u) => u.id !== userId && u.loginId === nextLogin)) return alert("이미 사용 중인 아이디입니다.");
  user.name = nextName;
  user.loginId = nextLogin;
  user.role = ROLE_LABELS[nextRole] ? nextRole : "user";
  user.team = nextTeam;
  if (nextPw) user.password = nextPw;
  state.settings.departments = [...new Set([...getDepartmentNames(), nextTeam])].sort((a, b) => a.localeCompare(b, "ko"));
  saveState();
  closeModal();
  renderAdmin();
  bootstrap();
}

function addDepartment() {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const name = prompt("추가할 부서명을 입력하세요.");
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  if (getDepartmentNames().includes(trimmed)) return alert("이미 존재하는 부서입니다.");
  state.settings.departments = [...new Set([...getDepartmentNames(), trimmed])].sort((a, b) => a.localeCompare(b, "ko"));
  saveState();
  renderAdmin();
}

function removeDepartment(encodedName) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const name = decodeURIComponent(encodedName);
  if (state.users.some((u) => (u.team || "-") === name)) return alert("해당 부서 소속 사용자가 있어 삭제할 수 없습니다.");
  if (state.schedules.some((s) => scheduleDepartmentName(s) === name)) return alert("해당 부서 귀속 일정이 있어 삭제할 수 없습니다.");
  state.settings.departments = getDepartmentNames().filter((team) => team !== name);
  if (!state.settings.departments.length) state.settings.departments = ["기본부서"];
  saveState();
  renderAdmin();
}

function showGradeInstructors(encodedGradeName) {
  const gradeName = decodeURIComponent(encodedGradeName);
  const rows = state.instructors.filter((i) => i.grade === gradeName);
  modal(`<div class="between"><h3 style="margin:0">소속 강사 - ${esc(gradeName)}</h3><button class="btn" onclick="closeModal()">닫기</button></div><div class="card mt-10"><table><thead><tr><th>강사명</th><th>분야</th><th>연락처</th><th>이메일</th></tr></thead><tbody>${rows.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.field || "-")}</td><td>${esc(i.phone || "-")}</td><td>${esc(i.email || "-")}</td></tr>`).join("") || '<tr><td colspan="4" class="sub">해당 등급 소속 강사가 없습니다.</td></tr>'}</tbody></table></div>`);
}

function addGradeRule() {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const name = prompt("새 등급명을 입력하세요. (예: A+, S, FT)");
  if (!name) return;
  const rules = getGradeRulesMap();
  if (rules[name] != null) return alert("이미 존재하는 등급입니다.");
  state.settings.gradeRules[name] = { unitType: "hour", rate: 0 };
  normalizeSettingsSchema();
  saveState();
  renderAdmin();
}

function openGradeEditModal(encodedName) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const name = decodeURIComponent(encodedName);
  const rule = getGradeRule(name);
  const rate = Number(rule.rate || 0);
  const unitType = rule.unitType === "day" ? "day" : "hour";
  const key = encodeURIComponent(name);
  modal(`<div class="between"><h3 style="margin:0">강사료 기준 수정</h3><button class="btn" onclick="closeModal()">닫기</button></div><div class="form-grid mt-10"><div><label>등급명</label><input id="grade_edit_name" value="${esc(name)}" /></div><div><label>금액산정기준</label><select id="grade_edit_unit"><option value="hour">시간</option><option value="day">일</option></select></div><div><label>단가</label><input id="grade_edit_rate" type="number" value="${rate}" /></div></div><div class="row row-end mt-12"><button class="btn primary" onclick="saveGradeEdit('${key}')">저장</button></div>`);
  document.getElementById("grade_edit_unit").value = unitType;
}

function saveGradeEdit(encodedOldName) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const oldName = decodeURIComponent(encodedOldName);
  const nextName = v("grade_edit_name");
  const nextUnit = v("grade_edit_unit") === "day" ? "day" : "hour";
  const nextRate = Number(v("grade_edit_rate"));
  if (!nextName) return alert("등급명은 필수입니다.");
  const currentMap = getGradeRulesMap();
  if (oldName !== nextName && currentMap[nextName] != null) return alert("이미 존재하는 등급명입니다.");
  const rebuilt = {};
  Object.keys(currentMap).forEach((k) => {
    if (k === oldName) rebuilt[nextName] = { unitType: nextUnit, rate: nextRate };
    else rebuilt[k] = currentMap[k];
  });
  state.settings.gradeRules = rebuilt;
  state.instructors.forEach((i) => {
    if (i.grade === oldName || i.grade === nextName) {
      if (i.grade === oldName) i.grade = nextName;
      i.unitType = nextUnit;
      i.baseRate = nextRate;
    }
  });
  normalizeSettingsSchema();
  syncDispatchesFromSchedules();
  saveState();
  closeModal();
  renderAdmin();
}

function removeGradeRule(encodedName) {
  const name = decodeURIComponent(encodedName);
  if (!canAdmin()) return alert("권한이 없습니다.");
  const keys = Object.keys(getGradeRulesMap() || {});
  if (keys.length <= 1) return alert("최소 1개 등급은 유지되어야 합니다.");
  if (state.instructors.some((i) => i.grade === name)) return alert("해당 등급을 사용하는 강사가 있어 삭제할 수 없습니다.");
  delete state.settings.gradeRules[name];
  normalizeSettingsSchema();
  syncDispatchesFromSchedules();
  saveState();
  renderAdmin();
}

function addTransportRegion() {
  if (!canAdmin()) return alert("권한이 없습니다.");
  adminPendingTransportRow = true;
  renderAdmin();
}

function cancelTransportRow() {
  adminPendingTransportRow = false;
  renderAdmin();
}

function saveTransportRow() {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const key = v("transport_new_name");
  const fee = Number(v("transport_new_fee") || 0);
  if (!key) return alert("지역명을 입력하세요.");
  if (state.settings.transportRateByRegion[key] != null) return alert("이미 존재하는 지역명입니다.");
  state.settings.transportRateByRegion[key] = fee;
  adminPendingTransportRow = false;
  saveState();
  renderAdmin();
}

function openTransportEditModal(encodedRegion) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const region = decodeURIComponent(encodedRegion);
  const fee = Number(state.settings.transportRateByRegion[region] || 0);
  const key = encodeURIComponent(region);
  modal(`<div class="between"><h3 style="margin:0">교통비 기준 수정</h3><button class="btn" onclick="closeModal()">닫기</button></div><div class="form-grid mt-10"><div><label>지역명</label><input id="transport_edit_name" value="${esc(region)}" /></div><div><label>교통비</label><input id="transport_edit_fee" type="number" value="${fee}" /></div></div><div class="row row-end mt-12"><button class="btn primary" onclick="saveTransportEdit('${key}')">저장</button></div>`);
}

function saveTransportEdit(encodedOldRegion) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const oldRegion = decodeURIComponent(encodedOldRegion);
  const nextRegion = v("transport_edit_name");
  const nextFee = Number(v("transport_edit_fee"));
  if (!nextRegion) return alert("지역명은 필수입니다.");
  if (oldRegion !== nextRegion && state.settings.transportRateByRegion[nextRegion] != null) return alert("이미 존재하는 지역명입니다.");
  const currentMap = state.settings.transportRateByRegion || {};
  const rebuilt = {};
  Object.keys(currentMap).forEach((k) => {
    if (k === oldRegion) rebuilt[nextRegion] = nextFee;
    else rebuilt[k] = currentMap[k];
  });
  state.settings.transportRateByRegion = rebuilt;
  if (oldRegion !== nextRegion) {
    state.dispatches.forEach((d) => {
      if (d.region === oldRegion) d.region = nextRegion;
    });
  }
  saveState();
  closeModal();
  renderAdmin();
}

function removeTransportRegion(encodedKey) {
  const key = decodeURIComponent(encodedKey);
  if (!canAdmin()) return alert("권한이 없습니다.");
  delete state.settings.transportRateByRegion[key];
  if (!Object.keys(state.settings.transportRateByRegion).length) state.settings.transportRateByRegion.기본 = 0;
  saveState();
  renderAdmin();
}

function settlementScopeLabel(scope) {
  if (scope === "all") return "모든 과정";
  if (scope === "team") return "부서별 과정";
  return "본인 과정만";
}

function renderAdmin() {
  const user = getCurrentUser();
  const disabled = canAdmin() ? "" : "disabled";
  const gradeRules = getGradeRulesMap();
  const departments = getDepartmentNames();
  const gradeRows = Object.keys(gradeRules).map((k) => {
    const key = encodeURIComponent(k);
    const rule = gradeRules[k] || { unitType: "hour", rate: 0 };
    const unitLabel = rule.unitType === "day" ? "일" : "시간";
    return `<tr><td>${esc(k)}</td><td>${unitLabel}</td><td>${fmtMoney(rule.rate)}</td><td><button class="btn" onclick="showGradeInstructors('${key}')">소속 강사</button></td><td><button class="btn" onclick="openGradeEditModal('${key}')" ${disabled}>수정</button> <button class="btn" onclick="removeGradeRule('${key}')" ${disabled}>삭제</button></td></tr>`;
  }).join("");
  const transportRows = Object.keys(state.settings.transportRateByRegion).slice().sort((a, b) => a.localeCompare(b, "ko")).map((k) => {
    const key = encodeURIComponent(k);
    return `<tr><td>${esc(k)}</td><td>${fmtMoney(state.settings.transportRateByRegion[k])}</td><td><button class="btn" onclick="openTransportEditModal('${key}')" ${disabled}>수정</button> <button class="btn" onclick="removeTransportRegion('${key}')" ${disabled}>삭제</button></td></tr>`;
  }).join("");
  const mailRows = state.settlementEmails.slice().reverse().slice(0, 80).map((e) => `<tr><td>${toLocal(e.at)}</td><td>${esc(nameOfInstructor(e.instructorId))}</td><td>${esc(e.month)}</td><td>${fmtMoney(e.amount || 0)}</td><td>${e.status === "success" ? '<span class="text-ok">성공</span>' : '<span class="text-danger">실패</span>'}</td><td>${esc(e.message || "-")}</td></tr>`).join("");
  const usersRows = state.users
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"))
    .map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.loginId)}</td><td>${esc(roleLabel(u.role))}</td><td>${esc(u.team || "-")}</td><td>${esc(settlementScopeLabel(getSettlementAccessScope(u.role)))}</td><td><button class="btn" onclick="openUserEditModal('${u.id}')">수정</button></td></tr>`)
    .join("");
  const rolePermissionRows = Object.entries(ROLE_LABELS).map(([roleKey, roleName]) => {
    const allowed = new Set(getRoleMenuPermissions(roleKey));
    const checks = MENU_ORDER.map((menu) => {
      const fixedForAdmin = roleKey === "admin" && menu === "admin";
      return `<label style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;white-space:nowrap;"><input type="checkbox" ${allowed.has(menu) ? "checked" : ""} ${disabled} ${fixedForAdmin ? "disabled" : ""} onchange="toggleRolePermission('${roleKey}','${menu}', this.checked)" />${esc(MENU_LABELS[menu])}</label>`;
    }).join("");
    const scope = getSettlementAccessScope(roleKey);
    return `<tr><td style="white-space:nowrap;">${esc(roleName)}</td><td>${checks}</td><td><select ${disabled} onchange="updateSettlementAccess('${roleKey}', this.value)"><option value="own" ${scope === "own" ? "selected" : ""}>본인 과정만</option><option value="team" ${scope === "team" ? "selected" : ""}>부서별 과정만</option><option value="all" ${scope === "all" ? "selected" : ""}>모든 과정</option></select></td></tr>`;
  }).join("");
  const departmentRows = departments.map((teamName) => {
    const encoded = encodeURIComponent(teamName);
    const members = state.users.filter((u) => (u.team || "-") === teamName).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"))
      .map((u) => `${u.name}(${roleLabel(u.role)})`).join(", ");
    const scheduleCount = state.schedules.filter((s) => scheduleDepartmentName(s) === teamName && !s.deleted).length;
    return `<tr><td>${esc(teamName)}</td><td>${scheduleCount}건</td><td>${esc(members || "-")}</td><td><button class="btn" onclick="removeDepartment('${encoded}')" ${disabled}>삭제</button></td></tr>`;
  }).join("");
  const tabs = `<div class="card mt-10 subnav-card"><div class="subnav-row"><button class="btn ${adminSubTab === "grade_transport" ? "primary" : ""}" onclick="setAdminSubTab('grade_transport')">강사료/교통비 기준 관리</button><button class="btn ${adminSubTab === "org_chart" ? "primary" : ""}" onclick="setAdminSubTab('org_chart')">조직도 설정</button><button class="btn ${adminSubTab === "data_upload" ? "primary" : ""}" onclick="setAdminSubTab('data_upload')">데이터 업로드</button><button class="btn ${adminSubTab === "users_system" ? "primary" : ""}" onclick="setAdminSubTab('users_system')">시스템 설정</button></div></div>`;
  let content = "";
  if (adminSubTab === "grade_transport") {
    content = `<div class="card mt-12"><div class="between"><h3 style="margin:0">강사료 기준 관리</h3><button class="btn primary" onclick="addGradeRule()" ${disabled}>등급 추가</button></div><table class="mt-10"><thead><tr><th>등급명</th><th>금액산정기준</th><th>단가</th><th>소속 강사</th><th></th></tr></thead><tbody>${gradeRows || '<tr><td colspan="5" class="sub">등급 없음</td></tr>'}</tbody></table></div><div class="card mt-12"><div class="between"><h3 style="margin:0">교통비 기준표</h3><button class="btn primary" onclick="addTransportRegion()" ${disabled}>추가</button></div><table class="mt-10"><thead><tr><th>지역</th><th>교통비</th><th></th></tr></thead><tbody>${adminPendingTransportRow ? `<tr><td><input id="transport_new_name" placeholder="지역명" /></td><td><input id="transport_new_fee" type="number" placeholder="교통비" /></td><td><button class="btn primary" onclick="saveTransportRow()">저장</button> <button class="btn" onclick="cancelTransportRow()">취소</button></td></tr>` : ""}${transportRows || '<tr><td colspan="3" class="sub">지역 기준 없음</td></tr>'}</tbody></table></div>`;
  } else if (adminSubTab === "org_chart") {
    content = `<div class="card mt-12"><div class="between"><h3 style="margin:0">부서 관리</h3><button class="btn primary" onclick="addDepartment()" ${disabled}>부서 추가</button></div><table class="mt-10"><thead><tr><th>부서명</th><th>귀속 일정</th><th>구성원</th><th></th></tr></thead><tbody>${departmentRows || '<tr><td colspan="4" class="sub">부서 없음</td></tr>'}</tbody></table></div>`;
  } else if (adminSubTab === "data_upload") {
    content = `<div class="card mt-12"><div class="between"><div><h3 style="margin:0">데이터 업로드</h3><div class="sub mt-10">업로드할 데이터 종류를 먼저 선택한 뒤 파일을 반영합니다.</div></div></div><div class="grid-2 mt-12"><div class="card"><h3 style="margin-top:0">출강 내역</h3><div class="sub">출강 내역 엑셀을 업로드해 일정과 출강 내역을 반영합니다.</div><div class="row row-end mt-12"><button class="btn primary" onclick="openImportModalFor('dispatch')" ${disabled}>업로드</button></div></div><div class="card"><h3 style="margin-top:0">강사 정보</h3><div class="sub">강사 기본정보 엑셀을 업로드해 강사 데이터를 반영합니다.</div><div class="row row-end mt-12"><button class="btn primary" onclick="openImportModalFor('instructor')" ${disabled}>업로드</button></div></div></div></div>`;
  } else {
    content = `<div class="card mt-12"><h3 style="margin-top:0">현재 로그인</h3><div class="sub">${esc(user?.name || "-")} / ${esc(roleLabel(user?.role))} / ${esc(user?.team || "-")}</div></div><div class="card mt-12"><div class="between"><h3 style="margin:0">사용자 관리</h3><span class="sub">이름, 아이디, 비밀번호, 권한, 팀 수정 가능</span></div><table class="mt-10"><thead><tr><th>이름</th><th>아이디</th><th>권한</th><th>팀</th><th>정산 조회 범위</th><th></th></tr></thead><tbody>${usersRows}</tbody></table><div class="row row-end mt-12"><button class="btn primary" onclick="openUsersBatchModal()" ${disabled}>사용자 추가+</button></div></div><div class="card mt-12"><h3 style="margin-top:0">권한 관리 설정</h3><div class="sub">메뉴 접근 권한과 출강·정산 조회 범위를 함께 설정합니다.</div><table class="mt-10"><thead><tr><th style="width:160px;">권한</th><th>메뉴 접근</th><th style="width:220px;">출강·정산 조회 범위</th></tr></thead><tbody>${rolePermissionRows}</tbody></table></div>`;
  }
  document.getElementById("view-admin").innerHTML = `${tabs}${content}`;
}

function getDepartmentMembers(name) {
  return state.users
    .filter((u) => (u.team || "-") === name)
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
}

function getDepartmentSchedules(name) {
  return state.schedules
    .filter((s) => scheduleDepartmentName(s) === name && !s.deleted)
    .slice()
    .sort((a, b) => `${b.date || ""}${b.start || ""}`.localeCompare(`${a.date || ""}${a.start || ""}`));
}

let departmentModalMemberTab = "members";
let departmentModalDraft = null;

function getDepartmentDraft(name) {
  const members = getDepartmentMembers(name);
  return {
    originalName: name,
    name,
    memberIds: members.map((u) => u.id),
    leaderIds: members.filter((u) => u.role === "team_leader").map((u) => u.id)
  };
}

function ensureDepartmentDraft(encodedName) {
  const name = decodeURIComponent(encodedName);
  if (!departmentModalDraft || departmentModalDraft.originalName !== name) {
    departmentModalDraft = getDepartmentDraft(name);
  }
  return departmentModalDraft;
}

function setDepartmentMemberTab(tab, encodedName, editMode = false) {
  departmentModalMemberTab = tab === "leaders" ? "leaders" : "members";
  openDepartmentModal(encodedName, !!editMode);
}

function setDepartmentDraftName(value) {
  if (!departmentModalDraft) return;
  departmentModalDraft.name = String(value || "");
}

function addDepartmentMemberToDraft(encodedName) {
  const draft = ensureDepartmentDraft(encodedName);
  const userId = v("department_member_select");
  if (!userId) return openDepartmentModal(encodedName, true, "추가할 사용자를 선택해주세요.");
  if (!draft.memberIds.includes(userId)) draft.memberIds.push(userId);
  const user = state.users.find((item) => item.id === userId);
  if (user?.role === "team_leader" && !draft.leaderIds.includes(userId)) draft.leaderIds.push(userId);
  openDepartmentModal(encodedName, true);
}

function removeDepartmentMemberFromDraft(encodedName, userId) {
  const draft = ensureDepartmentDraft(encodedName);
  draft.memberIds = draft.memberIds.filter((id) => id !== userId);
  draft.leaderIds = draft.leaderIds.filter((id) => id !== userId);
  openDepartmentModal(encodedName, true);
}

function toggleDepartmentLeaderDraft(encodedName, userId, checked) {
  const draft = ensureDepartmentDraft(encodedName);
  if (!draft.memberIds.includes(userId)) draft.memberIds.push(userId);
  if (checked && !draft.leaderIds.includes(userId)) draft.leaderIds.push(userId);
  if (!checked) draft.leaderIds = draft.leaderIds.filter((id) => id !== userId);
  openDepartmentModal(encodedName, true);
}

function renderDepartmentMemberManager(encodedName, draft, editMode) {
  const memberSet = new Set(draft.memberIds);
  const members = state.users
    .filter((u) => memberSet.has(u.id))
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  const leaders = members.filter((u) => draft.leaderIds.includes(u.id));
  const candidates = state.users
    .filter((u) => !memberSet.has(u.id))
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
  const tabButton = (tab, label) => `<button class="btn ${departmentModalMemberTab === tab ? "primary" : ""}" onclick="setDepartmentMemberTab('${tab}','${encodedName}',${editMode ? "true" : "false"})">${label}</button>`;
  const membersContent = editMode
    ? `<table class="mt-10"><thead><tr><th>이름</th><th>권한</th><th></th></tr></thead><tbody>${members.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(roleLabel(u.role))}</td><td><button class="btn" onclick="removeDepartmentMemberFromDraft('${encodedName}','${u.id}')">삭제</button></td></tr>`).join("") || '<tr><td colspan="3" class="sub">구성원 없음</td></tr>'}</tbody></table><div class="row mt-12"><select id="department_member_select"><option value="">사용자 선택</option>${candidates.map((u) => `<option value="${u.id}">${esc(`${u.name} / ${roleLabel(u.role)} / ${u.team || "-"}`)}</option>`).join("")}</select><button class="btn primary" onclick="addDepartmentMemberToDraft('${encodedName}')">구성원 추가</button></div>`
    : `<div class="view-value mt-10" style="align-items:flex-start;">${esc(members.map((u) => `${u.name}(${roleLabel(u.role)})`).join(", ") || "구성원 없음")}</div>`;
  const leadersContent = editMode
    ? `<table class="mt-10"><thead><tr><th>이름</th><th>현재 권한</th><th>팀 리더</th></tr></thead><tbody>${members.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(roleLabel(u.role))}</td><td>${u.role === "admin" ? '<span class="sub">관리자 유지</span>' : `<input type="checkbox" ${draft.leaderIds.includes(u.id) ? "checked" : ""} onchange="toggleDepartmentLeaderDraft('${encodedName}','${u.id}', this.checked)" />`}</td></tr>`).join("") || '<tr><td colspan="3" class="sub">구성원 없음</td></tr>'}</tbody></table>`
    : `<div class="view-value mt-10" style="align-items:flex-start;">${esc(leaders.map((u) => `${u.name}(${roleLabel(u.role)})`).join(", ") || "팀 리더 없음")}</div>`;
  return `<div class="card mt-12"><div class="between"><h3 style="margin:0">구성원 관리</h3><div class="row">${tabButton("members", "구성원")} ${tabButton("leaders", "팀 리더")}</div></div>${departmentModalMemberTab === "leaders" ? leadersContent : membersContent}</div>`;
}

function openDepartmentCreateModal(errorMessage = "", draftName = "") {
  if (!canAdmin()) return alert("권한이 없습니다.");
  modal(`<div class="between"><h3 style="margin:0">부서 추가</h3><span class="plain-close" onclick="closeModal()" title="닫기">×</span></div><div class="form-grid mt-10"><div style="grid-column:1/-1;"><label>부서명</label><input id="department_new_name" value="${esc(draftName)}" placeholder="예: 교육2팀" /></div></div>${errorMessage ? `<div class="text-danger sub mt-10">${esc(errorMessage)}</div>` : '<div class="sub mt-10">시스템 팝업 대신 웹앱 내부 팝업에서 바로 등록합니다.</div>'}<div class="row row-end mt-12"><button class="btn" onclick="closeModal()">취소</button><button class="btn primary" onclick="saveDepartmentCreate()">저장</button></div>`);
  document.getElementById("department_new_name")?.focus();
}

function saveDepartmentCreate() {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const trimmed = v("department_new_name");
  if (!trimmed) return openDepartmentCreateModal("부서명을 입력해주세요.");
  if (getDepartmentNames().includes(trimmed)) return openDepartmentCreateModal("이미 존재하는 부서입니다.", trimmed);
  state.settings.departments = [...new Set([...getDepartmentNames(), trimmed])].sort((a, b) => a.localeCompare(b, "ko"));
  saveState();
  renderAdmin();
  openDepartmentModal(encodeURIComponent(trimmed), false);
}

function openDepartmentModal(encodedName, editMode = false, errorMessage = "") {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const name = decodeURIComponent(encodedName);
  if (!editMode) departmentModalDraft = null;
  const draft = editMode ? ensureDepartmentDraft(encodedName) : getDepartmentDraft(name);
  const memberCount = draft.memberIds.length;
  const schedules = getDepartmentSchedules(name);
  const canDelete = !memberCount && !schedules.length;
  const memberManager = renderDepartmentMemberManager(encodedName, draft, editMode);
  modal(`<div class="between"><h3 style="margin:0">부서 정보</h3><span class="plain-close" onclick="closeModal()" title="닫기">×</span></div><div class="form-grid mt-10"><div style="grid-column:1/-1;"><label>부서명</label>${editMode ? `<input id="department_edit_name" value="${esc(draft.name)}" oninput="setDepartmentDraftName(this.value)" />` : `<div class="view-value">${esc(name)}</div>`}</div><div><label>소속 사용자</label><div class="view-value">${memberCount}명</div></div></div>${memberManager}${errorMessage ? `<div class="text-danger sub mt-10">${esc(errorMessage)}</div>` : '<div class="sub mt-10">읽기 모드에서 먼저 확인하고, 수정 버튼을 눌러 편집할 수 있습니다.</div>'}<div class="row row-end mt-12"><button class="btn" onclick="closeModal()">닫기</button><button class="btn" onclick="openDepartmentModal('${encodedName}', true)">수정</button><button class="btn danger" onclick="deleteDepartmentFromModal('${encodedName}')" ${canDelete ? "" : "disabled"}>삭제</button><button class="btn primary" ${editMode ? "" : "disabled"} onclick="saveDepartmentEdit('${encodedName}')">저장</button></div>`);
  if (editMode) document.getElementById("department_edit_name")?.focus();
}

function saveDepartmentEdit(encodedOldName) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const oldName = decodeURIComponent(encodedOldName);
  const draft = ensureDepartmentDraft(encodedOldName);
  const nextName = String(draft.name || "").trim();
  if (!nextName) return openDepartmentModal(encodedOldName, true, "부서명을 입력해주세요.");
  if (oldName !== nextName && getDepartmentNames().includes(nextName)) return openDepartmentModal(encodedOldName, true, "이미 존재하는 부서명입니다.");
  const memberIds = new Set(draft.memberIds);
  const leaderIds = new Set(draft.leaderIds.filter((id) => memberIds.has(id)));
  state.users.forEach((u) => {
    const wasOldDepartmentMember = (u.team || "-") === oldName;
    const isNextDepartmentMember = memberIds.has(u.id);
    if (isNextDepartmentMember) u.team = nextName;
    else if (wasOldDepartmentMember) u.team = "-";
    if (u.role !== "admin") {
      if (isNextDepartmentMember && leaderIds.has(u.id)) u.role = "team_leader";
      else if (wasOldDepartmentMember || isNextDepartmentMember) u.role = "user";
    }
  });
  state.schedules.forEach((s) => {
    if (scheduleDepartmentName(s) === oldName) s.ownerTeam = nextName;
  });
  const renamed = getDepartmentNames().map((team) => (team === oldName ? nextName : team)).filter(Boolean);
  state.settings.departments = [...new Set(renamed)].sort((a, b) => a.localeCompare(b, "ko"));
  departmentModalDraft = null;
  saveState();
  renderAdmin();
  openDepartmentModal(encodeURIComponent(nextName), false);
}

function deleteDepartmentFromModal(encodedName) {
  departmentModalDraft = null;
  closeModal();
  removeDepartment(encodedName);
}

function buildOrgChartUserManagementCard() {
  const disabled = canAdmin() ? "" : "disabled";
  const usersRows = state.users
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"))
    .map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.loginId)}</td><td>${esc(roleLabel(u.role))}</td><td>${esc(u.team || "-")}</td><td>${esc(settlementScopeLabel(getSettlementAccessScope(u.role)))}</td><td><button class="btn" onclick="openUserEditModal('${u.id}')">수정</button></td></tr>`)
    .join("");
  return `<div class="card mt-12 org-user-management-card"><div class="between"><div><h3 style="margin:0">사용자 관리</h3></div><button class="btn primary" onclick="openUsersBatchModal()" ${disabled}>사용자 추가+</button></div><table class="mt-10"><thead><tr><th>이름</th><th>아이디</th><th>권한</th><th>부서</th><th>정산 조회 범위</th><th></th></tr></thead><tbody>${usersRows || '<tr><td colspan="6" class="sub">사용자 없음</td></tr>'}</tbody></table></div>`;
}

function enhanceDepartmentAdminView() {
  const root = document.getElementById("view-admin");
  if (!root) return;
  const systemUserCard = root.querySelector('button[onclick="openUsersBatchModal()"]')?.closest(".card");
  if (adminSubTab === "users_system" && systemUserCard) {
    systemUserCard.remove();
    return;
  }
  if (adminSubTab !== "org_chart") return;
  const addButton = root.querySelector('button[onclick="addDepartment()"]');
  if (addButton) addButton.setAttribute("onclick", "openDepartmentCreateModal()");
  const table = root.querySelector("table");
  if (!table) return;
  const rows = [...table.querySelectorAll("tbody tr")];
  rows.forEach((row) => {
    const firstCell = row.children[0];
    if (!firstCell || row.querySelector(".sub")) return;
    const departmentName = firstCell.textContent.trim();
    if (!departmentName) return;
    const encodedName = encodeURIComponent(departmentName);
    row.style.cursor = "pointer";
    row.onclick = () => openDepartmentModal(encodedName, false);
    const actionButton = row.querySelector("button");
    if (actionButton) {
      actionButton.disabled = false;
      actionButton.textContent = "상세";
      actionButton.onclick = (event) => {
        event.stopPropagation();
        openDepartmentModal(encodedName, false);
      };
    }
  });
  if (!root.querySelector(".department-guide")) {
    const heading = root.querySelector("h3");
    if (heading?.parentElement) {
      const guide = document.createElement("div");
      guide.className = "sub mt-10 department-guide";
      guide.textContent = "리스트를 클릭하면 부서 정보를 확인하고 수정할 수 있습니다.";
      heading.parentElement.insertAdjacentElement("afterend", guide);
    }
  }
  if (!root.querySelector(".org-user-management-card")) {
    root.insertAdjacentHTML("beforeend", buildOrgChartUserManagementCard());
  }
}

function buildOrgChartUserManagementCard() {
  const disabled = canAdmin() ? "" : "disabled";
  const usersRows = state.users
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"))
    .map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.loginId)}</td><td>${esc(roleLabel(u.role))}</td><td>${esc(u.team || "-")}</td><td>${esc(settlementScopeLabel(getSettlementAccessScope(u.role)))}</td><td><button class="btn" onclick="openUserEditModal('${u.id}')">수정</button></td></tr>`)
    .join("");
  return `<div class="card mt-12 org-user-management-card"><div class="between"><div><h3 style="margin:0">사용자 관리</h3></div><button class="btn primary" onclick="openUsersBatchModal()" ${disabled}>사용자 추가+</button></div><table class="mt-10"><thead><tr><th>이름</th><th>아이디</th><th>권한</th><th>부서</th><th>정산 조회 범위</th><th></th></tr></thead><tbody>${usersRows || '<tr><td colspan="6" class="sub">사용자 없음</td></tr>'}</tbody></table></div>`;
}

const originalRenderAdmin = renderAdmin;
renderAdmin = function renderAdminWithDepartmentEnhancements() {
  originalRenderAdmin();
  if (adminSubTab === "users_system") {
    const root = document.getElementById("view-admin");
    const userTable = root?.querySelectorAll(".card table")[0];
    if (userTable && !userTable.dataset.bulkReady) {
      const users = state.users.slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
      adminSelectedUserIds = adminSelectedUserIds.filter((id) => users.some((user) => user.id === id));
      const encodedIds = encodeURIComponent(JSON.stringify(users.map((user) => user.id)));
      const allChecked = !!users.length && users.every((user) => adminSelectedUserIds.includes(user.id));
      const headRow = userTable.querySelector("thead tr");
      if (headRow) headRow.insertAdjacentHTML("afterbegin", `<th class="select-cell"><label class="select-hitbox"><input type="checkbox" ${allChecked ? "checked" : ""} onchange="toggleAdminUserSelectAll(this.checked,'${encodedIds}')" /></label></th>`);
      [...userTable.querySelectorAll("tbody tr")].forEach((row, index) => {
        if (row.querySelector(".sub")) return;
        const user = users[index];
        if (!user) return;
        row.insertAdjacentHTML("afterbegin", `<td class="select-cell"><label class="select-hitbox" onclick="event.stopPropagation()"><input type="checkbox" ${adminSelectedUserIds.includes(user.id) ? "checked" : ""} onclick="event.stopPropagation()" onchange="toggleAdminUserSelection('${user.id}',this.checked)" /></label></td>`);
      });
      userTable.dataset.bulkReady = "true";
      userTable.closest(".card")?.querySelector(".row.row-end.mt-12")?.insertAdjacentHTML("afterbegin", `<button class="btn danger" onclick="deleteSelectedUsers()" ${adminSelectedUserIds.length ? "" : "disabled"}>선택 삭제</button>`);
    }
  }
  if (adminSubTab === "org_chart") {
    const root = document.getElementById("view-admin");
    const departmentCard = [...(root?.querySelectorAll(".card") || [])].find((card) => /부서/.test(card.textContent || ""));
    const departmentTable = departmentCard?.querySelector("table");
    if (departmentTable && !departmentTable.dataset.bulkReady) {
      const departmentNames = getDepartmentNames();
      adminSelectedDepartmentNames = adminSelectedDepartmentNames.filter((name) => departmentNames.includes(name));
      const encodedNames = encodeURIComponent(JSON.stringify(departmentNames));
      const allChecked = !!departmentNames.length && departmentNames.every((name) => adminSelectedDepartmentNames.includes(name));
      departmentTable.querySelector("thead tr")?.insertAdjacentHTML("afterbegin", `<th class="select-cell"><label class="select-hitbox"><input type="checkbox" ${allChecked ? "checked" : ""} onchange="toggleAdminDepartmentSelectAll(this.checked,'${encodedNames}')" /></label></th>`);
      [...departmentTable.querySelectorAll("tbody tr")].forEach((row, index) => {
        if (row.querySelector(".sub")) return;
        const departmentName = departmentNames[index];
        if (!departmentName) return;
        row.insertAdjacentHTML("afterbegin", `<td class="select-cell"><label class="select-hitbox" onclick="event.stopPropagation()"><input type="checkbox" ${adminSelectedDepartmentNames.includes(departmentName) ? "checked" : ""} onclick="event.stopPropagation()" onchange="toggleAdminDepartmentSelection('${departmentName}',this.checked)" /></label></td>`);
      });
      departmentTable.dataset.bulkReady = "true";
      departmentCard?.querySelector(".between")?.insertAdjacentHTML("beforeend", `<button class="btn danger" onclick="deleteSelectedDepartments()" ${adminSelectedDepartmentNames.length ? "" : "disabled"}>선택 삭제</button>`);
    }
  }
  enhanceDepartmentAdminView();
  enhanceSortableTables(document.getElementById("view-admin"));
};

addDepartment = function addDepartmentWithModal() {
  openDepartmentCreateModal();
};

function freezeManagedSchedulesToTeam(userId, teamName) {
  state.schedules.forEach((schedule) => {
    if (schedule.managerId !== userId) return;
    if (schedule.ownerTeam) return;
    schedule.ownerTeam = teamName || "-";
  });
}

const originalSaveUserEdit = saveUserEdit;
saveUserEdit = function saveUserEditWithFrozenOwnership(userId) {
  const user = state.users.find((u) => u.id === userId);
  const nextTeam = v("user_edit_team");
  if (user && nextTeam && (user.team || "-") !== nextTeam) {
    freezeManagedSchedulesToTeam(user.id, user.team || "-");
  }
  return originalSaveUserEdit(userId);
};

const originalSaveDepartmentEdit = saveDepartmentEdit;
saveDepartmentEdit = function saveDepartmentEditWithFrozenOwnership(encodedOldName) {
  const oldName = decodeURIComponent(encodedOldName);
  const draft = ensureDepartmentDraft(encodedOldName);
  const memberIds = new Set(draft?.memberIds || []);
  state.users.forEach((u) => {
    const currentTeam = u.team || "-";
    const willBelongToDepartment = memberIds.has(u.id);
    const movingOutFromOldTeam = currentTeam === oldName && !willBelongToDepartment;
    const movingIntoDepartment = currentTeam !== oldName && willBelongToDepartment;
    if (movingOutFromOldTeam || movingIntoDepartment) {
      freezeManagedSchedulesToTeam(u.id, currentTeam);
    }
  });
  return originalSaveDepartmentEdit(encodedOldName);
};

function buildUserRoleOptions(selectedRole = "user") {
  return Object.entries(ROLE_LABELS).map(([roleKey, roleName]) => `<option value="${roleKey}" ${selectedRole === roleKey ? "selected" : ""}>${esc(roleName)}</option>`).join("");
}

const originalToggleRolePermission = toggleRolePermission;
toggleRolePermission = function toggleRolePermissionWithTotalLeader(role, menu, checked) {
  originalToggleRolePermission(role, menu, checked);
  if (role === "total_leader") {
    const current = new Set(getRoleMenuPermissions(role));
    current.add("admin");
    state.settings.roleMenuPermissions[role] = MENU_ORDER.filter((key) => current.has(key));
    saveState();
    renderAdmin();
    bootstrap();
  }
};

appendUserBatchRow = function appendUserBatchRowWithTotalLeader() {
  const body = document.getElementById("userBatchRows");
  if (!body) return;
  const rowId = uid("row");
  const tr = document.createElement("tr");
  tr.id = rowId;
  tr.innerHTML = `<td><input class="ub_name" placeholder="이름" /></td><td><select class="ub_role">${buildUserRoleOptions("user")}</select></td><td><input class="ub_login" placeholder="honggildong" /></td><td><input class="ub_pw" type="password" placeholder="비밀번호" /></td><td><input class="ub_team" list="departmentOptions" placeholder="교육1팀" /></td><td><button class="btn" style="white-space:nowrap;" onclick="document.getElementById('${rowId}').remove()">삭제</button></td>`;
  body.appendChild(tr);
};

openUserEditModal = function openUserEditModalWithDepartmentSelect(userId) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const user = state.users.find((u) => u.id === userId);
  if (!user) return;
  const departmentOptions = getDepartmentNames().map((team) => `<option value="${esc(team)}" ${user.team === team ? "selected" : ""}>${esc(team)}</option>`).join("");
  modal(`<div class="between"><h3 style="margin:0">사용자 정보 수정</h3><button class="btn" onclick="closeModal()">닫기</button></div><div class="form-grid mt-10"><div><label>이름</label><input id="user_edit_name" value="${esc(user.name || "")}" /></div><div><label>아이디</label><input id="user_edit_login" value="${esc(user.loginId || "")}" /></div><div><label>비밀번호</label><input id="user_edit_pw" type="password" placeholder="변경 시에만 입력" /></div><div><label>권한</label><select id="user_edit_role">${buildUserRoleOptions(user.role || "user")}</select></div><div><label>부서</label><select id="user_edit_team"><option value="">부서 선택</option>${departmentOptions}</select></div></div><div class="row row-end mt-12"><button class="btn primary" onclick="saveUserEdit('${user.id}')">저장</button></div>`);
};

function enhanceAdminUserTables(root = document.getElementById("view-admin")) {
  if (!root) return;
  const userCards = [...root.querySelectorAll(".card")].filter((card) => /사용자 관리/.test(card.textContent || ""));
  userCards.forEach((card) => {
    const rows = [...card.querySelectorAll("tbody tr")];
    rows.forEach((row) => {
      const editButton = row.querySelector('button[onclick*="openUserEditModal"]');
      if (!editButton || row.querySelector(".sub")) return;
      const match = editButton.getAttribute("onclick")?.match(/openUserEditModal\('([^']+)'\)/);
      const userId = match?.[1];
      if (!userId) return;
      row.style.cursor = "pointer";
      row.onclick = () => openUserEditModal(userId);
      editButton.onclick = (event) => {
        event.stopPropagation();
        openUserEditModal(userId);
      };
    });
  });
}

const originalBuildOrgChartUserManagementCard = buildOrgChartUserManagementCard;
buildOrgChartUserManagementCard = function buildOrgChartUserManagementCardClickable() {
  return originalBuildOrgChartUserManagementCard();
};

const originalEnhanceDepartmentAdminView = enhanceDepartmentAdminView;
enhanceDepartmentAdminView = function enhanceDepartmentAdminViewWithUserRows() {
  originalEnhanceDepartmentAdminView();
  enhanceAdminUserTables();
};

const originalOpenDepartmentModal = openDepartmentModal;
openDepartmentModal = function openDepartmentModalWithForcedDelete(encodedName, editMode = false, errorMessage = "") {
  originalOpenDepartmentModal(encodedName, editMode, errorMessage);
  const deleteButton = [...document.querySelectorAll("#modalRoot .btn.danger")].find((button) => /삭제/.test(button.textContent || ""));
  if (deleteButton) deleteButton.disabled = false;
};

removeDepartment = function removeDepartmentWithReassignment(encodedName) {
  if (!canAdmin()) return alert("권한이 없습니다.");
  const name = decodeURIComponent(encodedName);
  deleteDepartmentByName(name);
  saveState();
  renderAdmin();
};
let adminSelectedUserIds = [];
let adminSelectedDepartmentNames = [];

function toggleAdminUserSelection(userId, checked) {
  const set = new Set(adminSelectedUserIds);
  if (checked) set.add(userId);
  else set.delete(userId);
  adminSelectedUserIds = [...set];
}

function toggleAdminUserSelectAll(checked, encodedIds) {
  const ids = JSON.parse(decodeURIComponent(encodedIds || "%5B%5D"));
  adminSelectedUserIds = checked ? ids : [];
  renderAdmin();
}

function getDepartmentReplacementName(deletingNames = []) {
  const blocked = new Set(deletingNames);
  let fallback = getDepartmentNames().find((name) => !blocked.has(name));
  if (!fallback) fallback = "미지정부서";
  state.settings.departments = [...new Set([...(state.settings.departments || []), fallback])].sort((a, b) => a.localeCompare(b, "ko"));
  return fallback;
}

function deleteDepartmentByName(name) {
  const fallback = getDepartmentReplacementName([name]);
  state.users.forEach((user) => {
    if ((user.team || "-") === name) user.team = fallback;
  });
  state.schedules.forEach((schedule) => {
    if (scheduleDepartmentName(schedule) === name) schedule.ownerTeam = fallback;
  });
  state.settings.departments = getDepartmentNames().filter((team) => team !== name);
}

function deleteSelectedUsers() {
  if (!adminSelectedUserIds.length) return alert("삭제할 사용자를 선택해주세요.");
  const currentUserId = getCurrentUser()?.id;
  if (adminSelectedUserIds.includes(currentUserId)) return alert("현재 로그인한 계정은 삭제할 수 없습니다.");
  const fallback = getDepartmentReplacementName([]);
  state.schedules.forEach((schedule) => {
    if (adminSelectedUserIds.includes(schedule.managerId)) {
      schedule.managerId = currentUserId || schedule.managerId;
      schedule.ownerTeam = fallback;
    }
  });
  state.users = state.users.filter((user) => !adminSelectedUserIds.includes(user.id));
  adminSelectedUserIds = [];
  saveState();
  renderAdmin();
  bootstrap();
}

function toggleAdminDepartmentSelection(name, checked) {
  const set = new Set(adminSelectedDepartmentNames);
  if (checked) set.add(name);
  else set.delete(name);
  adminSelectedDepartmentNames = [...set];
}

function toggleAdminDepartmentSelectAll(checked, encodedNames) {
  const names = JSON.parse(decodeURIComponent(encodedNames || "%5B%5D"));
  adminSelectedDepartmentNames = checked ? names : [];
  renderAdmin();
}

function deleteSelectedDepartments() {
  if (!adminSelectedDepartmentNames.length) return alert("삭제할 부서를 선택해주세요.");
  [...new Set(adminSelectedDepartmentNames)].forEach((name) => deleteDepartmentByName(name));
  adminSelectedDepartmentNames = [];
  saveState();
  renderAdmin();
}
