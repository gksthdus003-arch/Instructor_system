function receiptLink(url = "") {
  if (!url) return "-";
  const label = url.split("/").pop() || "첨부파일";
  const href = /^https?:/i.test(url) ? url : `${window.IMS_CONFIG?.apiBaseUrl || API_BASE_URL}${url}`;
  return `<a href="${esc(href)}" target="_blank" rel="noreferrer">${esc(label)}</a>`;
}
function renderDispatchReceiptDraftInfo(existingUrl = "") {
  const box = document.getElementById("dp_receipt_info");
  if (!box) return;
  if (dispatchReceiptDraft?.name) {
    box.innerHTML = `<span class="status-pill st-info">${esc(dispatchReceiptDraft.name)}</span>`;
    return;
  }
  box.innerHTML = existingUrl ? `<span class="sub">현재 첨부: ${receiptLink(existingUrl)}</span>` : '<span class="sub">첨부된 영수증 없음</span>';
}
function handleDispatchReceiptFile(file) {
  if (!file) {
    dispatchReceiptDraft = null;
    renderDispatchReceiptDraftInfo(document.getElementById("dp_receipt_current")?.value || "");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    dispatchReceiptDraft = { name: file.name, dataUrl: String(reader.result || "") };
    renderDispatchReceiptDraftInfo(document.getElementById("dp_receipt_current")?.value || "");
  };
  reader.readAsDataURL(file);
}
async function uploadDispatchReceipt() {
  if (!dispatchReceiptDraft?.dataUrl) return null;
  const data = await apiPost("/api/uploads/receipt", { filename: dispatchReceiptDraft.name, dataUrl: dispatchReceiptDraft.dataUrl });
  return data.url || "";
}
function openDispatchModal(id, editMode = false) {
  const d = state.dispatches.find((x) => x.id === id && !x.deleted); if (!d) return;
  const ins = state.instructors.find((i) => i.id === d.instructorId);
  const schedule = state.schedules.find((x) => x.id === d.scheduleId);
  const isEditMode = !!editMode;
  dispatchReceiptDraft = null;
  const regionOptions = Object.keys(state.settings.transportRateByRegion).map((r) => `<option value="${esc(r)}">${esc(r)} (${fmtMoney(state.settings.transportRateByRegion[r])})</option>`).join("");
  const regionText = `${d.region || defaultRegion()} (${fmtMoney(transportByRegion(d.region || defaultRegion()))})`;
  modal(`<div class="between"><h3 style="margin:0">출강내역 상세</h3><span class="plain-close" onclick="closeModal()" title="닫기">×</span></div><div class="sub mt-10">강사 기준: ${esc(ins?.name || "-")} / ${esc(ins?.grade || "-")} / ${esc(ins?.unitType || "-")} / ${fmtMoney(ins?.baseRate || 0)} / 공제 ${ins?.deductionRate || 0}%</div><div class="form-grid mt-10"><div><label>담당자 / 부서</label><div class="view-value">${esc(scheduleManagerDisplay(schedule))}</div></div><div><label>과정명</label><div class="view-value">${esc(schedule?.course || "-")}</div></div><div><label>시간</label>${isEditMode ? `<input id="dp_units" type="number" step="0.5" value="${d.units}" />` : `<div class="view-value">${d.units}</div>`}</div><div><label>강사료</label>${isEditMode ? `<input id="dp_rate" type="number" value="${d.customRate}" />` : `<div class="view-value">${fmtMoney(d.customRate)}</div>`}</div><div><label>공제율</label>${isEditMode ? `<select id="dp_ded"><option value="3.3">3.3</option><option value="8.8">8.8</option><option value="10">10</option></select>` : `<div class="view-value">${d.deductionRate}%</div>`}</div><div><label>지역</label>${isEditMode ? `<select id="dp_region" onchange="applyRegionCost()">${regionOptions}</select>` : `<div class="view-value">${esc(regionText)}</div>`}</div><div><label>교통비</label>${isEditMode ? `<input id="dp_transport" type="number" value="${d.transportCost}" />` : `<div class="view-value">${fmtMoney(d.transportCost)}</div>`}</div><div><label>숙박비</label>${isEditMode ? `<input id="dp_lodging" type="number" value="${d.lodgingCost}" />` : `<div class="view-value">${fmtMoney(d.lodgingCost)}</div>`}</div><div><label>교보재비</label>${isEditMode ? `<input id="dp_material" type="number" value="${d.materialCost}" />` : `<div class="view-value">${fmtMoney(d.materialCost)}</div>`}</div><div><label>영수증 첨부</label>${isEditMode ? `<input id="dp_receipt_current" type="hidden" value="${esc(d.receiptUrl || "")}" /><input id="dp_receipt_file" type="file" accept=\".pdf,image/*\" onchange="handleDispatchReceiptFile(this.files[0])" /><div id="dp_receipt_info" class="mt-10"></div>` : `<div class="view-value">${receiptLink(d.receiptUrl || "")}</div>`}</div><div style="grid-column:1/-1"><label>비고</label>${isEditMode ? `<textarea id="dp_note">${esc(d.note || "")}</textarea>` : `<div class="view-value">${esc(d.note || "-")}</div>`}</div></div><div class="row row-end mt-12">${isEditMode ? `<button class="btn" onclick="applyRegionCost()">지역 기준 교통비 적용</button>` : ""}<button class="btn" onclick="openDispatchModal('${id}', true)">수정</button><button class="btn danger" onclick="deleteDispatch('${id}')">삭제</button><button class="btn primary" ${isEditMode ? "" : "disabled"} onclick="saveDispatch('${id}')">저장</button></div>`);
  if (isEditMode) {
    document.getElementById("dp_ded").value = String(d.deductionRate || 3.3);
    document.getElementById("dp_region").value = d.region || defaultRegion();
    renderDispatchReceiptDraftInfo(d.receiptUrl || "");
  }
}
function applyRegionCost() { const region = v("dp_region"); document.getElementById("dp_transport").value = String(transportByRegion(region)); }
function formatSettlementDate(dateText = "") {
  const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateText || "-";
  return `${match[2]}월 ${match[3]}일`;
}
function shortenSettlementName(name = "", max = 5) {
  const text = String(name || "");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
function renderSettlementManagerCell(schedule) {
  return `<td class="settlement-manager-cell"><div>${esc(nameOfUser(schedule?.managerId) || "-")}</div><div class="sub">${esc(scheduleDepartmentName(schedule))}</div></td>`;
}
function renderSettlementTransportCell(dispatch) {
  return `<td class="settlement-cost-cell"><div>${fmtMoney(dispatch.transportCost || 0)}</div><div class="sub">${esc(dispatch.region || "-")}</div></td>`;
}
function renderSettlementExpenseCell(dispatch) {
  const lodging = Number(dispatch.lodgingCost || 0);
  const material = Number(dispatch.materialCost || 0);
  return `<td class="settlement-cost-cell"><div>숙박 ${fmtMoney(lodging)}</div><div>교보재 ${fmtMoney(material)}</div></td>`;
}
function renderSettlementCourseCell(schedule, dispatch, query = "") {
  const course = highlightText(schedule?.course || "-", query);
  const note = String(dispatch?.note || "").trim();
  return `<td class="settlement-course-cell"><div>${course}</div>${note ? `<div class="settlement-note-text">${esc(note)}</div>` : ""}</td>`;
}
function describeDispatchChange(current, next) {
  const amountChanged = ["units", "customRate", "deductionRate", "transportCost", "lodgingCost", "materialCost"]
    .some((key) => Number(current[key] || 0) !== Number(next[key] || 0));
  if (amountChanged) return "금액 수정";
  const scheduleChanged = ["region", "receiptUrl", "note"].some((key) => String(current[key] || "") !== String(next[key] || ""));
  if (scheduleChanged) return "상세 수정";
  return "출강내역 수정";
}
async function saveDispatch(id) {
  const d = state.dispatches.find((x) => x.id === id && !x.deleted); if (!d) return;
  const next = { units: Number(v("dp_units")), customRate: Number(v("dp_rate")), deductionRate: Number(v("dp_ded")), region: v("dp_region"), transportCost: Number(v("dp_transport")), lodgingCost: Number(v("dp_lodging")), materialCost: Number(v("dp_material")), receiptUrl: document.getElementById("dp_receipt_current")?.value || d.receiptUrl || "", note: v("dp_note") };
  if (dispatchReceiptDraft?.dataUrl) {
    try {
      next.receiptUrl = await uploadDispatchReceipt();
    } catch (err) {
      return alert(`영수증 업로드 실패: ${err.message}`);
    }
  }
  if ((next.lodgingCost > 0 || next.materialCost > 0) && !next.receiptUrl) return alert("숙박비/교보재비 입력 시 영수증 첨부가 필요합니다.");
  const actionDetail = describeDispatchChange(d, next);
  Object.assign(d, next, calcDispatch(next));
  d.history = d.history || [];
  d.history.push({ at: nowIso(), by: getCurrentUser()?.name || "system", action: "수정" });
  const mailed = state.settlementEmails.some((e) => e.status === "success" && (e.dispatchIds || []).includes(d.id));
  if (mailed) {
    d.modifiedAfterEmail = true;
    const sch = state.schedules.find((x) => x.id === d.scheduleId);
    state.auditLogs.push({ id: uid("log"), type: "dispatch_modified_after_email", at: nowIso(), by: getCurrentUser()?.name || "-", managerId: sch?.managerId || "", dispatchId: d.id, date: d.date, targetName: nameOfInstructor(d.instructorId), detail: actionDetail });
  }
  saveState(); renderAll(); openDispatchModal(id, false);
}
function deleteDispatch(id) {
  const d = state.dispatches.find((x) => x.id === id && !x.deleted); if (!d) return;
  const sch = state.schedules.find((x) => x.id === d.scheduleId);
  const mailed = state.settlementEmails.some((e) => e.status === "success" && (e.dispatchIds || []).includes(d.id));
  d.deleted = true;
  d.history = d.history || [];
  d.history.push({ at: nowIso(), by: getCurrentUser()?.name || "system", action: "삭제" });
  if (mailed) {
    state.auditLogs.push({ id: uid("log"), type: "dispatch_modified_after_email", at: nowIso(), by: getCurrentUser()?.name || "-", managerId: sch?.managerId || "", dispatchId: d.id, date: d.date, targetName: nameOfInstructor(d.instructorId), detail: "출강내역 삭제" });
  }
  saveState();
  closeModal();
  renderAll();
}

function buildMonthlySettlement(month) {
  const grouped = {};
  state.dispatches.filter((d) => !d.deleted && d.date?.startsWith(month)).forEach((d) => {
    if (!grouped[d.instructorId]) grouped[d.instructorId] = { gross: 0, deduction: 0, net: 0, dispatchIds: [] };
    grouped[d.instructorId].gross += Number(d.gross || 0);
    grouped[d.instructorId].deduction += Number(d.deduction || 0);
    grouped[d.instructorId].net += Number(d.net || 0);
    grouped[d.instructorId].dispatchIds.push(d.id);
  });
  return grouped;
}
function changeSettlementMonth(m) {
  settlementMonth = m || "";
  settlementPeriodMode = "month";
  settlementRecentRange = null;
  settlementShowAllRows = false;
  settlementSelectedInstructorIds = [];
  settlementSummarySearch = "";
  renderSettlement();
}
function shiftSettlementMonth(delta) {
  changeSettlementMonth(monthDiff(settlementMonth || new Date().toISOString().slice(0, 7), delta));
}
function setSettlementSubTab(tab) {
  settlementSubTab = tab === "mail_management" ? "mail_management" : "dispatch_list";
  if (settlementSubTab === "mail_management") {
    settlementInstructorFilter = "";
    settlementManagerFilter = "";
    settlementCourseFilter = "";
    settlementShowAllRows = false;
    selectedDispatchIds = [];
  }
  renderSettlement();
}
function getSettlementQuickMonths() {
  const base = new Date(`${settlementMonth || new Date().toISOString().slice(0, 7)}-01T00:00:00`);
  return Array.from({ length: 6 }, (_, index) => {
    const d = new Date(base.getFullYear(), base.getMonth() - index, 1);
    return d.toISOString().slice(0, 7);
  });
}
function changeSettlementInstructor(instructorId) { settlementInstructorFilter = instructorId || ""; settlementShowAllRows = false; settlementSelectedInstructorIds = []; renderSettlement(); }
function changeSettlementManager(managerId) { settlementManagerFilter = managerId || ""; settlementShowAllRows = false; settlementSelectedInstructorIds = []; renderSettlement(); }
function changeSettlementCourseFilter(q) {
  settlementCourseFilter = q || "";
  settlementShowAllRows = false;
  if (!settlementCourseComposing) renderSettlementBodyOnly();
}
function setSettlementCourseCompositionStart() { settlementCourseComposing = true; }
function setSettlementCourseCompositionEnd(q) {
  settlementCourseComposing = false;
  settlementCourseFilter = q || "";
  settlementShowAllRows = false;
  renderSettlementBodyOnly();
}
function setSettlementDateInput(kind, value) {
  if (kind === "from") settlementDateFromInput = value || "";
  else settlementDateToInput = value || "";
}
function applySettlementDateRange() {
  settlementPeriodMode = "range";
  settlementDateFrom = settlementDateFromInput || "";
  settlementDateTo = settlementDateToInput || "";
  settlementRecentRange = null;
  settlementShowAllRows = false;
  settlementSelectedInstructorIds = [];
  renderSettlementBodyOnly();
}
function clearSettlementDateRange() {
  settlementDateFrom = "";
  settlementDateTo = "";
  settlementDateFromInput = "";
  settlementDateToInput = "";
  settlementPeriodMode = "";
  settlementRecentRange = null;
  settlementShowAllRows = false;
  settlementSelectedInstructorIds = [];
  settlementSummarySearch = "";
  const from = document.getElementById("st_date_from");
  const to = document.getElementById("st_date_to");
  if (from) from.value = "";
  if (to) to.value = "";
  renderSettlementBodyOnly();
}
function changeSettlementSummarySearch(q) {
  settlementSummarySearch = q || "";
  if (!settlementSummaryComposing) renderSettlementBodyOnly();
}
function setSettlementSummaryCompositionStart() { settlementSummaryComposing = true; }
function setSettlementSummaryCompositionEnd(q) {
  settlementSummaryComposing = false;
  settlementSummarySearch = q || "";
  renderSettlementBodyOnly();
}
function clearSettlementRecentRange() { settlementRecentRange = null; settlementShowAllRows = false; renderSettlement(); }
function toggleSettlementShowAll() { settlementShowAllRows = !settlementShowAllRows; renderSettlementBodyOnly(); }
function toggleSettlementSort(key) {
  if (settlementSortKey === key) settlementSortDirection = settlementSortDirection === "asc" ? "desc" : "asc";
  else {
    settlementSortKey = key;
    settlementSortDirection = "asc";
  }
  renderSettlementBodyOnly();
}
function settlementSortLabel(key, label) {
  const arrow = settlementSortKey === key ? (settlementSortDirection === "asc" ? " ↑" : " ↓") : "";
  return `${label}${arrow}`;
}
function settlementSortValue(dispatch, key) {
  const schedule = state.schedules.find((s) => s.id === dispatch.scheduleId);
  if (key === "date") return dispatch.date || "";
  if (key === "instructor") return nameOfInstructor(dispatch.instructorId) || "";
  if (key === "manager") return scheduleManagerDisplay(schedule) || "";
  if (key === "course") return schedule?.course || "";
  if (key === "basePay") return Number(dispatch.basePay || 0);
  if (key === "cost") return Number(dispatch.transportCost || 0) + Number(dispatch.lodgingCost || 0) + Number(dispatch.materialCost || 0);
  if (key === "deduction") return Number(dispatch.deduction || 0);
  if (key === "net") return Number(dispatch.net || 0);
  return dispatch.date || "";
}
function toggleSettlementInstructorSelection(instructorId, checked) {
  if (!canAdmin()) return;
  const set = new Set(settlementSelectedInstructorIds);
  if (checked) set.add(instructorId);
  else set.delete(instructorId);
  settlementSelectedInstructorIds = [...set];
}
function toggleSettlementSelectAll(checked, encodedIds) {
  if (!canAdmin()) return;
  const ids = JSON.parse(decodeURIComponent(encodedIds || "%5B%5D"));
  settlementSelectedInstructorIds = checked ? [...new Set(ids)] : [];
  renderSettlementBodyOnly();
}
let selectedDispatchIds = [];
function toggleDispatchSelection(dispatchId, checked) {
  if (!canAdmin()) return;
  const set = new Set(selectedDispatchIds);
  if (checked) set.add(dispatchId);
  else set.delete(dispatchId);
  selectedDispatchIds = [...set];
}
function toggleDispatchSelectAll(checked, encodedIds) {
  if (!canAdmin()) return;
  const ids = JSON.parse(decodeURIComponent(encodedIds || "%5B%5D"));
  selectedDispatchIds = checked ? ids : [];
  renderSettlementBodyOnly();
}
function deleteSelectedDispatches() {
  if (!canAdmin()) return;
  if (!selectedDispatchIds.length) return alert("삭제할 출강내역을 선택해주세요.");
  state.dispatches.forEach((dispatch) => {
    if (!selectedDispatchIds.includes(dispatch.id) || dispatch.deleted) return;
    dispatch.deleted = true;
    dispatch.history = dispatch.history || [];
    dispatch.history.push({ at: nowIso(), by: getCurrentUser()?.name || "system", action: "삭제" });
  });
  selectedDispatchIds = [];
  saveState();
  renderAll();
}
function sendSelectedSettlementEmails() {
  if (!canAdmin()) return;
  const ids = [...new Set(settlementSelectedInstructorIds)];
  if (!ids.length) return alert("메일 발송할 강사를 먼저 선택해주세요.");
  sendBulkEmail(ids);
}
function exportCsv() {
  if (!canAdmin()) return alert("관리자만 CSV 다운로드가 가능합니다.");
  const month = v("st_month") || settlementMonth;
  const rangeFrom = settlementDateFrom || settlementRecentRange?.from || "";
  const rangeTo = settlementDateTo || settlementRecentRange?.to || "";
  const rows = state.dispatches.filter((d) => {
    if (d.deleted) return false;
    if (settlementPeriodMode === "month" && month) return d.date?.startsWith(month);
    if (rangeFrom && d.date < rangeFrom) return false;
    if (rangeTo && d.date > rangeTo) return false;
    return true;
  }).map((d) => {
    const s = state.schedules.find((x) => x.id === d.scheduleId);
    return [d.date, nameOfInstructor(d.instructorId), s?.course || "", d.units, d.basePay || 0, d.transportCost, d.lodgingCost, d.materialCost, d.deduction, d.net, d.region || "", d.receiptUrl || "", d.modifiedAfterEmail ? "Y" : "N"].join(",");
  });
  const blob = new Blob([["일자,강사,과정,수량,강사료,교통비,숙박비,교보재비,공제,실수령,지역,영수증,발송후수정", ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `settlement_${month}.csv`; a.click(); URL.revokeObjectURL(url);
}
async function loadServerLogs() {
  try {
    const data = await apiGet("/api/email/logs");
    return (data.logs || []).slice(0, 20).map((x) => ({ at: x.sentAt, instructorName: nameOfInstructor(x.instructorId), status: x.status === "sent" ? "success" : "fail", message: x.errorMessage || (x.status === "sent" ? "발송 완료" : "발송 실패") }));
  } catch { return []; }
}
async function sendBulkEmail(targetInstructorIds = null) {
  if (!canAdmin()) return alert("관리자만 메일 발송이 가능합니다.");
  const month = v("st_month") || settlementMonth;
  const groupedAll = buildMonthlySettlement(month);
  const filtered = targetInstructorIds && targetInstructorIds.length
    ? Object.fromEntries(Object.entries(groupedAll).filter(([instructorId]) => targetInstructorIds.includes(instructorId)))
    : groupedAll;
  const grouped = filtered;
  const entries = Object.entries(filtered);
  if (!entries.length) return alert("해당 월 정산 데이터가 없습니다.");
  const firstDay = new Date(`${month}-01T00:00:00`);
  const periodStart = `${month}-01`;
  const periodEnd = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).toISOString().slice(0, 10);
  const instructors = [];
  const itemsByInstructor = {};
  const missingBirth = [];
  entries.forEach(([instructorId, val]) => {
    const ins = state.instructors.find((i) => i.id === instructorId); if (!ins) return;
    if (!ins.birthYYMMDD) { missingBirth.push(ins.name || instructorId); return; }
    instructors.push({
      id: ins.id,
      name: ins.name,
      email: ins.email || "",
      birthYYMMDD: ins.birthYYMMDD,
      withholding: String(ins.deductionRate ?? 3.3),
      qualifier: ins.category === "FT" ? "FT" : "강사"
    });
    itemsByInstructor[ins.id] = val.dispatchIds.map((dispatchId) => {
      const d = state.dispatches.find((x) => x.id === dispatchId); const s = state.schedules.find((x) => x.id === d?.scheduleId);
      return {
        date: d?.date || "",
        client: s?.clientName || "",
        manager: nameOfUser(s?.managerId) || "",
        course: s?.course || "",
        unit: ins.unitType === "day" ? "일" : ins.unitType === "month" ? "월" : "시간",
        qty: Number(d?.units || 0),
        unitPrice: Number(d?.customRate || 0),
        transport: Number(d?.transportCost || 0),
        lodging: Number(d?.lodgingCost || 0),
        materials: Number(d?.materialCost || 0),
        note: d?.note || ""
      };
    });
  });
  if (missingBirth.length) return alert(`생년월일(YYMMDD) 누락 강사: ${missingBirth.join(", ")}`);
  settlementEmailSending = true;
  renderSettlementBodyOnly();
  try {
    const data = await apiPost("/api/email/send-batch", { periodStart, periodEnd, instructors, itemsByInstructor });
    (data.results || []).forEach((r) => {
      const dispatchIds = grouped[r.instructorId]?.dispatchIds || [];
      state.settlementEmails.push({ id: uid("mail"), month, instructorId: r.instructorId, dispatchIds, amount: grouped[r.instructorId]?.net || 0, pdfPassword: state.instructors.find((i) => i.id === r.instructorId)?.birthYYMMDD || "", status: r.status === "sent" ? "success" : "fail", at: nowIso(), message: r.error || (r.status === "sent" ? "발송 완료" : "발송 실패") });
      if (r.status === "sent") dispatchIds.forEach((id) => { const d = state.dispatches.find((x) => x.id === id); if (d) d.modifiedAfterEmail = false; });
    });
    saveState(); await renderSettlement(); renderDashboard();
    const s = (data.results || []).filter((r) => r.status === "sent").length;
    const f = (data.results || []).filter((r) => r.status !== "sent").length;
    settlementSelectedInstructorIds = [];
    alert(`메일 발송 완료 (성공 ${s}건 / 실패 ${f}건)`);
  } catch (err) { alert(`백엔드 호출 실패: ${err.message}`); }
  finally {
    settlementEmailSending = false;
    renderSettlementBodyOnly();
  }
}
async function openSettlementLogsModal() {
  if (!canAdmin()) return;
  const logs = [...state.settlementEmails.slice().reverse().map((e) => ({ at: e.at, instructorName: nameOfInstructor(e.instructorId), status: e.status, message: e.message })), ...(await loadServerLogs())].slice(0, 50);
  modal(`<div class="between"><h3 style="margin:0">메일 발송 로그</h3><button class="btn" onclick="closeModal()">닫기</button></div><div class="card mt-10"><table><thead><tr><th>시각</th><th>강사</th><th>결과</th></tr></thead><tbody>${logs.map((e) => `<tr><td>${toLocal(e.at)}</td><td>${esc(e.instructorName || "-")}</td><td>${e.status === "success" ? '<span class="text-ok">성공</span>' : '<span class="text-danger">실패</span>'}<div class="sub">${esc(e.message || "")}</div></td></tr>`).join("") || '<tr><td colspan="3" class="sub">로그 없음</td></tr>'}</tbody></table></div>`);
}
async function renderSettlement() {
  syncDispatchesFromSchedules();
  const month = settlementMonth;
  const user = getCurrentUser();
  const isAdmin = canAdmin();
  if (!isAdmin) settlementManagerFilter = "";
  if (!settlementDateFromInput && settlementDateFrom) settlementDateFromInput = settlementDateFrom;
  if (!settlementDateToInput && settlementDateTo) settlementDateToInput = settlementDateTo;
  const settlementTabs = `
    <div class="card mt-10 subnav-card">
      <div class="subnav-row">
        <button class="btn ${settlementSubTab === "dispatch_list" ? "primary" : ""}" onclick="setSettlementSubTab('dispatch_list')">출강 내역 목록</button>
        <button class="btn ${settlementSubTab === "mail_management" ? "primary" : ""}" onclick="setSettlementSubTab('mail_management')">강사료 내역 발송 관리</button>
      </div>
    </div>
  `;
  const monthSelector = `<div class="row"><button class="btn" onclick="shiftSettlementMonth(-1)">이전</button><input id="st_month" class="sch-month-input" type="month" value="${month}" onchange="changeSettlementMonth(this.value)" /><button class="btn" onclick="shiftSettlementMonth(1)">다음</button></div>`;
  const periodFilterLine = `
    <div class="settlement-period-row mt-10">
      <div class="settlement-period-cell ${settlementPeriodMode === "range" ? "filter-disabled" : ""}">
        <label>조회 월</label>
        ${monthSelector}
      </div>
      <div class="settlement-period-cell ${settlementPeriodMode === "month" ? "filter-disabled" : ""}">
        <label>일정</label>
        <div class="schedule-date-line"><input id="st_date_from" type="date" value="${settlementDateFromInput}" oninput="setSettlementDateInput('from',this.value)" /><span>~</span><input id="st_date_to" type="date" value="${settlementDateToInput}" oninput="setSettlementDateInput('to',this.value)" /><div class="schedule-date-actions"><button class="btn" onclick="applySettlementDateRange()">적용</button><button class="btn" onclick="clearSettlementDateRange()">초기화</button></div></div>
      </div>
    </div>
  `;
  document.getElementById("view-settlement").innerHTML = `
    ${settlementTabs}
    ${settlementSubTab === "dispatch_list" ? `
      <div class="card mt-12 settlement-filter-card">
        <div class="between settlement-list-toolbar">
          <h3 style="margin:0">출강 내역 목록</h3>
          ${isAdmin ? `<button class="btn danger" onclick="deleteSelectedDispatches()" ${selectedDispatchIds.length ? "" : "disabled"}>선택 삭제</button>` : ""}
        </div>
        ${periodFilterLine}
        <div class="row mt-10">
          ${isAdmin ? `<div style="min-width:140px;"><label>담당자 필터</label><select id="st_manager_filter" onchange="changeSettlementManager(this.value)"></select></div>` : ""}
          <div style="min-width:140px;"><label>강사 필터</label><select id="st_instructor_filter" onchange="changeSettlementInstructor(this.value)"></select></div>
          <div style="min-width:220px; flex:1;"><label>과정명 필터</label><input id="st_course_filter" value="${esc(settlementCourseFilter)}" placeholder="과정명 검색" oninput="changeSettlementCourseFilter(this.value)" oncompositionstart="setSettlementCourseCompositionStart()" oncompositionend="setSettlementCourseCompositionEnd(this.value)" /></div>
          ${isAdmin ? `<div class="row row-end" style="margin-left:auto;"><button class="btn" onclick="exportCsv()">CSV 다운로드</button></div>` : ""}
        </div>
        <div id="settlementListRoot" class="mt-12"></div>
      </div>
    ` : `
      <div class="card mt-12 settlement-filter-card">
        <h3 style="margin-top:0">강사료 내역 발송 관리</h3>
        <div class="settlement-period-cell mt-10">
          <label>조회 월</label>
          ${monthSelector}
        </div>
      </div>
      <div id="settlementSummaryRoot"></div>
    `}
  `;
  renderSettlementBodyOnly();
}

function renderSettlementBodyOnly() {
  const listRoot = document.getElementById("settlementListRoot");
  const summaryRoot = document.getElementById("settlementSummaryRoot");
  if (!listRoot && !summaryRoot) return;
  const month = settlementMonth;
  const user = getCurrentUser();
  const isAdmin = canAdmin();
  const rangeFrom = settlementDateFrom || settlementRecentRange?.from || "";
  const rangeTo = settlementDateTo || settlementRecentRange?.to || "";
  let baseRows = getVisibleDispatches().filter((d) => !d.deleted);
  if (settlementPeriodMode === "month" && month) {
    baseRows = baseRows.filter((d) => d.date?.startsWith(month));
  } else if (settlementPeriodMode === "range") {
    if (rangeFrom) baseRows = baseRows.filter((d) => d.date >= rangeFrom);
    if (rangeTo) baseRows = baseRows.filter((d) => d.date <= rangeTo);
  }
  const roleRows = baseRows.filter((d) => canViewDispatchByUser(d, user));
  const managerIds = [...new Set(roleRows.map((d) => scheduleManagerIdOfDispatch(d)).filter(Boolean))];
  const instructorIds = [...new Set(roleRows.map((d) => d.instructorId))];
  const managerSelect = document.getElementById("st_manager_filter");
  if (managerSelect && isAdmin) managerSelect.innerHTML = `<option value="">전체</option>${managerIds.map((id) => `<option value="${id}" ${settlementManagerFilter === id ? "selected" : ""}>${esc(nameOfUser(id))}</option>`).join("")}`;
  const instructorSelect = document.getElementById("st_instructor_filter");
  if (instructorSelect) instructorSelect.innerHTML = `<option value="">전체</option>${instructorIds.map((id) => `<option value="${id}" ${settlementInstructorFilter === id ? "selected" : ""}>${esc(nameOfInstructor(id))}</option>`).join("")}`;
  const q = String(settlementCourseFilter || "").trim();
  const rows = roleRows.filter((d) => {
    const managerId = scheduleManagerIdOfDispatch(d);
    const schedule = state.schedules.find((s) => s.id === d.scheduleId);
    const courseText = String(schedule?.course || "").toLowerCase();
    const courseQ = q.toLowerCase();
    if (settlementInstructorFilter && d.instructorId !== settlementInstructorFilter) return false;
    if (isAdmin && settlementManagerFilter && managerId !== settlementManagerFilter) return false;
    if (courseQ && !courseText.includes(courseQ)) return false;
    return true;
  }).slice().sort((a, b) => {
    const left = settlementSortValue(a, settlementSortKey);
    const right = settlementSortValue(b, settlementSortKey);
    let order = 0;
    if (typeof left === "number" && typeof right === "number") order = left - right;
    else order = String(left).localeCompare(String(right), "ko");
    if (order === 0) order = `${a.date}`.localeCompare(`${b.date}`) || `${nameOfInstructor(a.instructorId)}`.localeCompare(`${nameOfInstructor(b.instructorId)}`, "ko");
    return settlementSortDirection === "asc" ? order : -order;
  });
  const visibleRows = settlementShowAllRows ? rows : rows.slice(0, 5);
  selectedDispatchIds = selectedDispatchIds.filter((id) => rows.some((dispatch) => dispatch.id === id));
  const grouped = rows.reduce((acc, d) => {
    if (!acc[d.instructorId]) acc[d.instructorId] = { gross: 0, deduction: 0, net: 0, dispatchIds: [] };
    acc[d.instructorId].gross += Number(d.gross || 0);
    acc[d.instructorId].deduction += Number(d.deduction || 0);
    acc[d.instructorId].net += Number(d.net || 0);
    acc[d.instructorId].dispatchIds.push(d.id);
    return acc;
  }, {});
  const summaryKeys = Object.keys(grouped);
  settlementSelectedInstructorIds = settlementSelectedInstructorIds.filter((id) => summaryKeys.includes(id));
  const allChecked = !!summaryKeys.length && summaryKeys.every((id) => settlementSelectedInstructorIds.includes(id));
  const summaryRows = summaryKeys.map((k) => {
    const latestMail = state.settlementEmails.filter((e) => e.month === month && e.instructorId === k).slice(-1)[0];
    const mailStatus = latestMail ? (latestMail.status === "success" ? '<span class="status-pill st-ok">발송완료</span>' : '<span class="status-pill st-danger">발송실패</span>') : '<span class="status-pill st-warn">발송전</span>';
    const checkCell = isAdmin ? `<td><input type="checkbox" ${settlementSelectedInstructorIds.includes(k) ? "checked" : ""} onchange="toggleSettlementInstructorSelection('${k}',this.checked)" /></td>` : "";
    return `<tr>${checkCell}<td>${esc(nameOfInstructor(k))}</td><td>${fmtMoney(grouped[k].gross)}</td><td>${fmtMoney(grouped[k].deduction)}</td><td><b>${fmtMoney(grouped[k].net)}</b></td><td>${grouped[k].dispatchIds.length}</td><td>${mailStatus}</td></tr>`;
  });
  const summaryQ = String(settlementSummarySearch || "").trim().toLowerCase();
  const filteredSummaryRows = summaryRows.filter((rowHtml, idx) => {
    if (!summaryQ) return true;
    const name = nameOfInstructor(summaryKeys[idx]).toLowerCase();
    return name.includes(summaryQ);
  });
  const auditRows = state.auditLogs.filter((l) => l.type === "dispatch_modified_after_email").filter((l) => {
    if (isAdmin) return true;
    const dispatch = state.dispatches.find((d) => d.id === l.dispatchId);
    const schedule = state.schedules.find((s) => s.id === dispatch?.scheduleId);
    const ownerTeam = scheduleDepartmentName(schedule);
    if (isTeamLeader(user)) return ownerTeam === (user?.team || "-");
    if (l.managerId) return l.managerId === user?.id && ownerTeam === (user?.team || "-");
    return l.by === user?.name && ownerTeam === (user?.team || "-");
  }).filter((l) => {
    const logDate = String(l.date || (String(l.detail || "").match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || ""));
    if (!logDate) return true;
    if (rangeFrom && logDate < rangeFrom) return false;
    if (rangeTo && logDate > rangeTo) return false;
    return toMonth(logDate) === month;
  }).slice().reverse();
  const normalizedAuditRows = auditRows.map((log) => ({
    ...log,
    targetName: log.targetName || nameOfInstructor(state.dispatches.find((d) => d.id === log.dispatchId)?.instructorId) || "-"
  }));
  const selectedCount = settlementSelectedInstructorIds.length;
  const encodedSummaryIds = encodeURIComponent(JSON.stringify(summaryKeys));
  const encodedDispatchIds = encodeURIComponent(JSON.stringify(rows.map((dispatch) => dispatch.id)));
  const allDispatchesChecked = !!rows.length && rows.every((dispatch) => selectedDispatchIds.includes(dispatch.id));
  if (listRoot) listRoot.innerHTML = `
    <div class="settlement-list-card">
      <table class="mt-10 settlement-table"><thead><tr>${isAdmin ? `<th class="select-cell"><label class="select-hitbox"><input type="checkbox" ${allDispatchesChecked ? "checked" : ""} onchange="toggleDispatchSelectAll(this.checked,'${encodedDispatchIds}')" /></label></th>` : ""}<th class="sortable" onclick="toggleSettlementSort('date')">${settlementSortLabel("date", "일자")}</th><th class="sortable" onclick="toggleSettlementSort('instructor')">${settlementSortLabel("instructor", "강사")}</th><th class="sortable" onclick="toggleSettlementSort('manager')">${settlementSortLabel("manager", "담당자/부서")}</th><th class="sortable" onclick="toggleSettlementSort('course')">${settlementSortLabel("course", "과정명")}</th><th class="sortable" onclick="toggleSettlementSort('basePay')">${settlementSortLabel("basePay", "강사료")}</th><th class="sortable" onclick="toggleSettlementSort('cost')">${settlementSortLabel("cost", "교통비")}</th><th>실비</th><th class="sortable" onclick="toggleSettlementSort('deduction')">${settlementSortLabel("deduction", "공제")}</th><th class="sortable" onclick="toggleSettlementSort('net')">${settlementSortLabel("net", "실지급액")}</th><th class="settlement-action-head"><div class="settlement-action-head-inner"><span>수정</span>${rows.length > 5 ? `<button class="btn settlement-toggle-btn" onclick="event.stopPropagation(); toggleSettlementShowAll()" title="${settlementShowAllRows ? "5개만 보기" : "펼쳐서 보기"}">${settlementShowAllRows ? "∧" : "∨"}</button>` : ""}</div></th></tr></thead><tbody>${visibleRows.map((d) => { const s = state.schedules.find((x) => x.id === d.scheduleId); const checkCell = isAdmin ? `<td class="select-cell"><label class="select-hitbox" onclick="event.stopPropagation()"><input type="checkbox" ${selectedDispatchIds.includes(d.id) ? "checked" : ""} onclick="event.stopPropagation()" onchange="toggleDispatchSelection('${d.id}',this.checked)" /></label></td>` : ""; return `<tr onclick="openDispatchModal('${d.id}')" style="cursor:pointer;">${checkCell}<td class="settlement-date-cell">${formatSettlementDate(d.date)}</td><td class="settlement-instructor-cell" title="${esc(nameOfInstructor(d.instructorId))}">${esc(shortenSettlementName(nameOfInstructor(d.instructorId)))}</td>${renderSettlementManagerCell(s)}${renderSettlementCourseCell(s, d, q)}<td class="settlement-amount-cell">${fmtMoney(d.basePay)}</td>${renderSettlementTransportCell(d)}${renderSettlementExpenseCell(d)}<td class="settlement-amount-cell">${fmtMoney(d.deduction)}<div class="sub">(${d.deductionRate}%)</div></td><td class="settlement-amount-cell"><b>${fmtMoney(d.net)}</b>${d.modifiedAfterEmail ? '<div class="text-danger sub">발송 후 수정됨</div>' : ''}</td><td><button class="btn" onclick="event.stopPropagation(); openDispatchModal('${d.id}', true)">수정</button></td></tr>`; }).join("") || `<tr><td colspan="${isAdmin ? 11 : 10}" class="sub">데이터 없음</td></tr>`}</tbody></table>
    </div>
  `;
  if (summaryRoot) summaryRoot.innerHTML = `
    <div class="card mt-12 settlement-summary-card">
      <div class="between" style="flex-wrap:wrap;"><h3 style="margin-top:0">강사료 내역 발송 관리 <span class="sub" style="margin-left:8px;">${isAdmin ? "전체 부서 기준" : isTeamLeader(user) ? "현재 부서 담당 과정 취합" : "본인 담당 + 현재 부서 귀속 과정만 취합"}</span></h3><div class="row">${isAdmin ? `<span class="sub">선택 ${selectedCount}명</span><button class="btn primary" onclick="sendSelectedSettlementEmails()" ${settlementEmailSending ? "disabled" : ""}>${settlementEmailSending ? "발송 중..." : "선택 강사 이메일 발송"}</button><button class="btn" onclick="openSettlementLogsModal()">발송 로그</button>` : ""}</div></div>
      <div class="row mt-10"><div style="min-width:220px;max-width:320px;"><label>강사명 검색</label><input value="${esc(settlementSummarySearch)}" placeholder="강사명 입력" oninput="changeSettlementSummarySearch(this.value)" oncompositionstart="setSettlementSummaryCompositionStart()" oncompositionend="setSettlementSummaryCompositionEnd(this.value)" /></div></div>
      <div class="settlement-summary-scroll">
        <table><thead><tr>${isAdmin ? `<th><input type="checkbox" ${allChecked ? "checked" : ""} onchange="toggleSettlementSelectAll(this.checked,'${encodedSummaryIds}')" /></th>` : ""}<th>강사</th><th>총액</th><th>공제</th><th>실지급액</th><th>건수</th><th>발송현황</th></tr></thead><tbody>${filteredSummaryRows.join("") || `<tr><td colspan="${isAdmin ? 7 : 6}" class="sub">요약 없음</td></tr>`}</tbody></table>
      </div>
    </div>
    <div class="card mt-12 settlement-audit-card">
      <h3 style="margin-top:0">발송 후 수정 이력</h3>
      <table><thead><tr><th>시각</th><th>사용자</th><th>대상자</th><th>상세</th></tr></thead><tbody>${normalizedAuditRows.map((l) => `<tr><td>${toLocal(l.at)}</td><td>${esc(l.by)}</td><td>${esc(l.targetName || "-")}</td><td>${esc(l.detail)}</td></tr>`).join("") || '<tr><td colspan="4" class="sub">이력 없음</td></tr>'}</tbody></table>
    </div>
  `;
  enhanceSortableTables(document.getElementById("view-settlement"));
}

let importModalTab = "dispatch";
let importModalLockedTab = "";
let dispatchImportPreview = null;
let instructorImportPreview = null;
let importModalErrorMessage = "";
let importApplyOptions = {
  autoCreateDepartments: true,
  autoCreateManagers: true,
  autoCreateInstructors: true,
  duplicateMode: "update",
  periodSplitMode: "equal",
  dispatchScheduleStatus: "confirmed"
};

function createDispatchImportKey(row) {
  return [row.date, row.instructorName, row.clientName, row.courseName, row.managerName].map((item) => String(item || "").trim()).join("::");
}

function createInstructorImportKey(row) {
  return String(row.name || "").trim().toLowerCase();
}

function getActiveImportPreview() {
  return importModalTab === "dispatch" ? dispatchImportPreview : instructorImportPreview;
}

function getImportTabLabel(tab) {
  return tab === "dispatch" ? "출강내역" : "강사정보";
}

function setImportModalTab(tab) {
  importModalTab = tab === "instructor" ? "instructor" : "dispatch";
  openImportModal();
}
function openImportModalFor(tab) {
  importModalLockedTab = tab === "instructor" ? "instructor" : "dispatch";
  importModalTab = importModalLockedTab;
  importModalErrorMessage = "";
  openImportModal();
}

function toggleImportOption(key, checked) {
  importApplyOptions[key] = !!checked;
}

function changeImportScheduleStatus(value) {
  importApplyOptions.dispatchScheduleStatus = value === "draft" ? "draft" : "confirmed";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

async function handleImportFile(file) {
  if (!file) return;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const url = importModalTab === "dispatch" ? "/api/uploads/dispatch-import-preview" : "/api/uploads/instructor-import-preview";
    const preview = await apiPost(url, { filename: file.name, dataUrl });
    preview.issues = Array.isArray(preview.issues) ? preview.issues : [];
    if (importModalTab === "dispatch") dispatchImportPreview = preview;
    else instructorImportPreview = preview;
    importModalErrorMessage = "";
    openImportModal();
  } catch (err) {
    importModalErrorMessage = err.message || "업로드 미리보기를 생성하지 못했습니다.";
    openImportModal();
  }
}

function updateImportPreviewWarnings(preview) {
  preview.issues = Array.isArray(preview.issues) ? preview.issues : [];
  preview.rows = Array.isArray(preview.rows) ? preview.rows : [];
  preview.rowCount = preview.rows.length;
  preview.warnings = preview.issues.map((issue) => `${issue.sourceRow}행: ${issue.message}`);
}

function parseImportNumber(value) {
  const raw = String(value ?? "").replace(/,/g, "").replace(/\s+/g, "").trim();
  if (!raw) return 0;
  const number = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function buildImportIsoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function expandImportDateRange(startYear, startMonth, startDay, endYear, endMonth, endDay) {
  const dates = [];
  const current = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  while (current <= end) {
    dates.push(buildImportIsoDate(current.getFullYear(), current.getMonth() + 1, current.getDate()));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function extractImportYear() {
  const preview = getActiveImportPreview();
  const sheetName = String(preview?.sheetName || "");
  const match = sheetName.match(/(20\d{2})/);
  return Number(match?.[1] || new Date().getFullYear());
}

function buildDispatchImportDateList(text, year = extractImportYear()) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const compact = raw.replace(/\s+/g, "");
  const listParts = compact.split(",").map((item) => item.trim()).filter(Boolean);
  if (listParts.length > 1) {
    const expanded = listParts.flatMap((part) => buildDispatchImportDateList(part, year));
    return expanded.length === listParts.length ? [...new Set(expanded)] : [];
  }
  let match = compact.match(/^(\d{1,2})월(\d{1,2})일$/);
  if (match) return [buildImportIsoDate(year, Number(match[1]), Number(match[2]))];
  match = compact.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match) return [buildImportIsoDate(year, Number(match[1]), Number(match[2]))];
  match = compact.match(/^(\d{1,2})\/(\d{1,2})[-~](\d{1,2})\/(\d{1,2})$/);
  if (match) return expandImportDateRange(year, Number(match[1]), Number(match[2]), year, Number(match[3]), Number(match[4]));
  match = compact.match(/^(\d{1,2})월(\d{1,2})일[-~](\d{1,2})월(\d{1,2})일$/);
  if (match) return expandImportDateRange(year, Number(match[1]), Number(match[2]), year, Number(match[3]), Number(match[4]));
  match = compact.match(/^(\d{1,2})월(\d{1,2})일[-~](\d{1,2})일$/);
  if (match) return expandImportDateRange(year, Number(match[1]), Number(match[2]), year, Number(match[1]), Number(match[3]));
  match = compact.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return [buildImportIsoDate(Number(match[1]), Number(match[2]), Number(match[3]))];
  return [];
}

function splitImportInteger(total, count) {
  const size = Math.max(Number(count || 0), 1);
  const base = Math.floor(Number(total || 0) / size);
  let remainder = Math.round(Number(total || 0) - base * size);
  return Array.from({ length: size }, () => {
    const value = base + (remainder > 0 ? 1 : remainder < 0 ? -1 : 0);
    if (remainder > 0) remainder -= 1;
    if (remainder < 0) remainder += 1;
    return value;
  });
}

function splitImportHalfUnits(totalUnits, count) {
  const size = Math.max(Number(count || 0), 1);
  const totalHalfUnits = Math.round(Number(totalUnits || 0) * 2);
  const baseHalfUnits = Math.floor(totalHalfUnits / size);
  let remainder = totalHalfUnits - baseHalfUnits * size;
  const parts = Array.from({ length: size }, () => baseHalfUnits);
  let left = 0;
  let right = size - 1;
  while (remainder > 0 && left <= right) {
    parts[right] += 1;
    remainder -= 1;
    if (remainder <= 0) break;
    parts[left] += 1;
    remainder -= 1;
    left += 1;
    right -= 1;
  }
  return parts.map((value) => value / 2);
}

function parseDispatchIssueRows(raw, sourceRow) {
  const department = String(raw.department || "").trim();
  const instructorName = String(raw.instructorName || "").trim();
  const dateText = String(raw.dateText || "").trim();
  const courseName = String(raw.courseName || "").trim();
  const managerName = String(raw.managerName || "").trim();
  if (!department || !instructorName || !dateText || !courseName || !managerName) {
    throw new Error("필수값을 모두 입력해 주세요.");
  }
  const dates = buildDispatchImportDateList(dateText);
  if (!dates.length) throw new Error("날짜 형식을 해석하지 못했습니다.");
  const timeText = String(raw.timeText || "").trim();
  const isDay = /day/i.test(timeText);
  const unitsRaw = isDay ? (parseImportNumber(timeText) || 1) : parseImportNumber(timeText);
  const splitCount = dates.length;
  const pay = parseImportNumber(raw.pay);
  const tax = parseImportNumber(raw.tax);
  const net = parseImportNumber(raw.net);
  const transportCost = parseImportNumber(raw.transportCost);
  const lodgingCost = parseImportNumber(raw.lodgingCost);
  const materialCost = parseImportNumber(raw.materialCost);
  const deductionRate = parseImportNumber(raw.deductionRate);
  const payParts = splitImportInteger(pay, splitCount);
  const taxParts = splitImportInteger(tax, splitCount);
  const netParts = splitImportInteger(net, splitCount);
  const transportParts = splitImportInteger(transportCost, splitCount);
  const lodgingParts = splitImportInteger(lodgingCost, splitCount);
  const materialParts = splitImportInteger(materialCost, splitCount);
  const unitParts = isDay
    ? Array.from({ length: splitCount }, () => 1)
    : splitImportHalfUnits(unitsRaw || 0, splitCount);
  return dates.map((date, index) => {
    const basePay = payParts[index];
    const units = unitParts[index] || (isDay ? 1 : 0);
    return {
      sourceRow,
      department,
      type: String(raw.type || "").trim(),
      instructorName,
      date,
      originalDateText: dateText,
      clientName: String(raw.clientName || "").trim(),
      courseName,
      timeText,
      unitType: isDay ? "day" : "hour",
      units,
      basePay,
      customRate: isDay ? basePay : (units > 0 ? Math.round(basePay / units) : basePay),
      tax: taxParts[index],
      net: netParts[index],
      transportCost: transportParts[index],
      lodgingCost: lodgingParts[index],
      materialCost: materialParts[index],
      deductionRate,
      managerName,
      note: String(raw.note || "").trim(),
      splitCount
    };
  });
}

function parseInstructorImportPhone(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return String(value || "").trim();
}

function parseInstructorImportBirth(raw = "") {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 8) return { birthDate: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`, birthYYMMDD: digits.slice(2) };
  if (digits.length === 6) {
    const prefix = Number(digits.slice(0, 2)) > 30 ? "19" : "20";
    return { birthDate: `${prefix}${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`, birthYYMMDD: digits };
  }
  return { birthDate: "", birthYYMMDD: "" };
}

function mapInstructorImportGrade(rawGrade = "") {
  const value = String(rawGrade || "").trim().toUpperCase();
  if (!value) return "A";
  if (value.includes("FT")) return "FT";
  if (value.includes("C")) return "C";
  if (value.includes("B")) return "B";
  if (value.includes("A")) return "A";
  if (value.includes("S") || value.includes("특별")) return "A";
  return "A";
}

function parseInstructorIssueRow(raw, sourceRow) {
  const name = String(raw.name || "").trim();
  if (!name) throw new Error("성명을 입력해 주세요.");
  const rawGrade = String(raw.rawGrade || "").trim();
  const baseRate = parseImportNumber(raw.baseRate);
  const phone = parseInstructorImportPhone(raw.phone);
  const email = String(raw.email || "").trim().replace(/\s+/g, "");
  if (!rawGrade && !baseRate && !phone && !email) {
    throw new Error("등급, 강사료, 전화번호, 이메일 중 하나 이상 입력해 주세요.");
  }
  const birth = parseInstructorImportBirth(raw.birthRaw || raw.birthDate || raw.birthYYMMDD || "");
  return {
    sourceRow,
    name,
    rawGrade,
    grade: mapInstructorImportGrade(rawGrade),
    baseRate,
    phone,
    email,
    birthDate: birth.birthDate,
    birthYYMMDD: birth.birthYYMMDD,
    payoutMethod: String(raw.payoutMethod || "").trim(),
    bankName: String(raw.bankName || "").trim(),
    accountNumber: String(raw.accountNumber || "").trim()
  };
}

function openImportIssueEditor(index) {
  const preview = getActiveImportPreview();
  const issue = preview?.issues?.[index];
  if (!issue) return;
  const raw = issue.raw || {};
  if (importModalTab === "dispatch") {
    modal(`<div class="between"><h3 style="margin:0">경고 행 수정</h3><button class="btn" onclick="openImportModal()">닫기</button></div><div class="sub mt-10">${issue.sourceRow}행 / ${esc(issue.message || "")}</div><div class="form-grid mt-10"><div><label>부서</label><input id="imp_department" value="${esc(raw.department || "")}" /></div><div><label>구분</label><input id="imp_type" value="${esc(raw.type || "")}" /></div><div><label>강사명</label><input id="imp_instructor_name" value="${esc(raw.instructorName || "")}" /></div><div><label>일자</label><input id="imp_date_text" value="${esc(raw.dateText || "")}" placeholder="예: 01월 14일 / 1/15-1/16" /></div><div><label>고객사</label><input id="imp_client_name" value="${esc(raw.clientName || "")}" /></div><div><label>과정명</label><input id="imp_course_name" value="${esc(raw.courseName || "")}" /></div><div><label>시간/일수</label><input id="imp_time_text" value="${esc(raw.timeText || "")}" placeholder="예: 4 / 7 Day" /></div><div><label>강사비</label><input id="imp_pay" type="number" value="${Number(raw.pay || 0)}" /></div><div><label>세금</label><input id="imp_tax" type="number" value="${Number(raw.tax || 0)}" /></div><div><label>실지급액</label><input id="imp_net" type="number" value="${Number(raw.net || 0)}" /></div><div><label>교통비</label><input id="imp_transport" type="number" value="${Number(raw.transportCost || 0)}" /></div><div><label>숙박비</label><input id="imp_lodging" type="number" value="${Number(raw.lodgingCost || 0)}" /></div><div><label>교보재비</label><input id="imp_material" type="number" value="${Number(raw.materialCost || 0)}" /></div><div><label>공제율</label><input id="imp_deduction_rate" type="number" step="0.1" value="${Number(raw.deductionRate || 0)}" /></div><div><label>담당자</label><input id="imp_manager_name" value="${esc(raw.managerName || "")}" /></div><div style="grid-column:1/-1"><label>비고</label><textarea id="imp_note">${esc(raw.note || "")}</textarea></div></div><div class="row row-end mt-12"><button class="btn" onclick="openImportModal()">취소</button><button class="btn primary" onclick="saveImportIssueEdit(${index})">수정 반영</button></div>`);
    return;
  }
  modal(`<div class="between"><h3 style="margin:0">경고 행 수정</h3><button class="btn" onclick="openImportModal()">닫기</button></div><div class="sub mt-10">${issue.sourceRow}행 / ${esc(issue.message || "")}</div><div class="form-grid mt-10"><div><label>성명</label><input id="imp_name" value="${esc(raw.name || "")}" /></div><div><label>등급</label><input id="imp_raw_grade" value="${esc(raw.rawGrade || "")}" /></div><div><label>강사료</label><input id="imp_base_rate" type="number" value="${Number(raw.baseRate || 0)}" /></div><div><label>전화번호</label><input id="imp_phone" value="${esc(raw.phone || "")}" /></div><div><label>이메일</label><input id="imp_email" value="${esc(raw.email || "")}" /></div><div><label>생년월일</label><input id="imp_birth_raw" value="${esc(raw.birthRaw || "")}" placeholder="예: 791120 / 19791120" /></div><div><label>지급방식</label><input id="imp_payout_method" value="${esc(raw.payoutMethod || "")}" /></div><div><label>지급은행</label><input id="imp_bank_name" value="${esc(raw.bankName || "")}" /></div><div><label>계좌번호</label><input id="imp_account_number" value="${esc(raw.accountNumber || "")}" /></div></div><div class="row row-end mt-12"><button class="btn" onclick="openImportModal()">취소</button><button class="btn primary" onclick="saveImportIssueEdit(${index})">수정 반영</button></div>`);
}

function saveImportIssueEdit(index) {
  const preview = getActiveImportPreview();
  const issue = preview?.issues?.[index];
  if (!issue) return;
  try {
    if (importModalTab === "dispatch") {
      const raw = {
        department: v("imp_department"),
        type: v("imp_type"),
        instructorName: v("imp_instructor_name"),
        dateText: v("imp_date_text"),
        clientName: v("imp_client_name"),
        courseName: v("imp_course_name"),
        timeText: v("imp_time_text"),
        pay: Number(v("imp_pay") || 0),
        tax: Number(v("imp_tax") || 0),
        net: Number(v("imp_net") || 0),
        transportCost: Number(v("imp_transport") || 0),
        lodgingCost: Number(v("imp_lodging") || 0),
        materialCost: Number(v("imp_material") || 0),
        deductionRate: Number(v("imp_deduction_rate") || 0),
        managerName: v("imp_manager_name"),
        note: v("imp_note")
      };
      const rows = parseDispatchIssueRows(raw, issue.sourceRow);
      preview.rows.push(...rows);
    } else {
      const raw = {
        name: v("imp_name"),
        rawGrade: v("imp_raw_grade"),
        baseRate: Number(v("imp_base_rate") || 0),
        phone: v("imp_phone"),
        email: v("imp_email"),
        birthRaw: v("imp_birth_raw"),
        payoutMethod: v("imp_payout_method"),
        bankName: v("imp_bank_name"),
        accountNumber: v("imp_account_number")
      };
      preview.rows.push(parseInstructorIssueRow(raw, issue.sourceRow));
    }
    preview.issues.splice(index, 1);
    updateImportPreviewWarnings(preview);
    openImportModal();
  } catch (err) {
    alert(err.message || "경고 행 수정에 실패했습니다.");
  }
}

function deleteImportIssue(index) {
  const preview = getActiveImportPreview();
  if (!preview?.issues?.[index]) return;
  preview.issues.splice(index, 1);
  updateImportPreviewWarnings(preview);
  openImportModal();
}

function renderDispatchImportPreviewTable() {
  const rows = dispatchImportPreview?.rows || [];
  return `<table class="mt-10"><thead><tr><th>일자</th><th>부서</th><th>고객사</th><th>강사</th><th>과정명</th><th>시간/일수</th><th>실지급액</th></tr></thead><tbody>${rows.slice(0, 30).map((row) => `<tr><td>${esc(row.date)}</td><td>${esc(row.department)}</td><td>${esc(row.clientName || "-")}</td><td>${esc(row.instructorName)}</td><td>${esc(row.courseName)}</td><td>${esc(row.unitType === "day" ? `${row.units}일` : `${row.units}시간`)}</td><td>${fmtMoney(row.net || 0)}</td></tr>`).join("") || '<tr><td colspan="7" class="sub">미리보기 데이터 없음</td></tr>'}</tbody></table>${rows.length > 30 ? `<div class="sub mt-10">미리보기는 30건만 표시합니다. 전체 반영 건수: ${rows.length}건</div>` : ""}`;
}

function renderInstructorImportPreviewTable() {
  const rows = instructorImportPreview?.rows || [];
  return `<table class="mt-10"><thead><tr><th>성명</th><th>등급</th><th>강사료</th><th>전화번호</th><th>이메일</th><th>생년월일</th></tr></thead><tbody>${rows.slice(0, 30).map((row) => `<tr><td>${esc(row.name)}</td><td>${esc(row.rawGrade || row.grade)}</td><td>${fmtMoney(row.baseRate || 0)}</td><td>${esc(row.phone || "-")}</td><td>${esc(row.email || "-")}</td><td>${esc(row.birthDate || row.birthYYMMDD || "-")}</td></tr>`).join("") || '<tr><td colspan="6" class="sub">미리보기 데이터 없음</td></tr>'}</tbody></table>${rows.length > 30 ? `<div class="sub mt-10">미리보기는 30건만 표시합니다. 전체 반영 건수: ${rows.length}건</div>` : ""}`;
}

function renderImportPreviewSummary() {
  const preview = getActiveImportPreview();
  if (!preview) return '<div class="sub mt-10">엑셀 파일을 선택하면 미리보기를 생성합니다.</div>';
  return `<div class="card mt-10"><div><b>시트</b> ${esc(preview.sheetName || "-")}</div><div class="sub mt-10">헤더 행 ${preview.headerRow} / 반영 예정 ${preview.rowCount}건</div>${importModalTab === "dispatch" ? renderDispatchImportPreviewTable() : renderInstructorImportPreviewTable()}</div>`;
}

function renderImportWarningGuides(issues = []) {
  const messages = issues.map((issue) => String(issue.message || ""));
  const guides = [];
  if (messages.some((message) => message.includes("날짜"))) {
    guides.push("날짜 입력 예시: 01월 14일, 1/14, 1/15-1/16, 1/3, 1/4, 1/10, 2026-03-31");
  }
  if (messages.some((message) => message.includes("필수값"))) {
    if (importModalTab === "dispatch") guides.push("출강내역 필수값: 부서, 강사명, 일자, 과정명, 담당자");
    else guides.push("강사정보 기본값: 성명은 필요하고, 등급/강사료/전화번호/이메일 중 1개 이상이 필요합니다.");
  }
  if (messages.some((message) => message.includes("강사정보가 충분하지 않습니다."))) {
    guides.push("강사정보는 성명과 함께 등급, 강사료, 전화번호, 이메일 중 하나 이상을 입력해 주세요.");
  }
  if (!guides.length) return "";
  return `<div class="card mt-10"><div><b>입력 가이드</b></div><div class="sub mt-10">${guides.map((guide) => esc(guide)).join("<br/>")}</div></div>`;
}

function renderImportWarningCard() {
  const preview = getActiveImportPreview();
  const issues = preview?.issues || [];
  if (!issues.length) return "";
  const rows = importModalTab === "dispatch"
    ? issues.map((issue, index) => `<tr><td>${issue.sourceRow}행</td><td>${esc(issue.message || "-")}</td><td>${esc(issue.raw?.courseName || issue.raw?.name || "-")}</td><td><div class="row"><button class="btn" onclick="openImportIssueEditor(${index})">수정</button><button class="btn danger" onclick="deleteImportIssue(${index})">삭제</button></div></td></tr>`).join("")
    : issues.map((issue, index) => `<tr><td>${issue.sourceRow}행</td><td>${esc(issue.message || "-")}</td><td>${esc(issue.raw?.name || "-")}</td><td><div class="row"><button class="btn" onclick="openImportIssueEditor(${index})">수정</button><button class="btn danger" onclick="deleteImportIssue(${index})">삭제</button></div></td></tr>`).join("");
  return `${renderImportWarningGuides(issues)}<div class="card mt-10"><div><b>경고</b></div><div class="sub mt-10">경고 행은 이 화면에서 직접 수정하거나 제외할 수 있습니다. 모든 경고를 해소해야 반영할 수 있습니다.</div><table class="mt-10"><thead><tr><th>행</th><th>사유</th><th>대상</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function canProceedImportApply() {
  const preview = getActiveImportPreview();
  return !!preview?.rows?.length && !(preview?.issues || []).length;
}

function openImportModal(errorMessage = importModalErrorMessage) {
  if (!canAdmin()) return;
  const preview = getActiveImportPreview();
  const tabs = importModalLockedTab
    ? ""
    : ["dispatch", "instructor"].map((tab) => `<button class="btn ${importModalTab === tab ? "primary" : ""}" onclick="setImportModalTab('${tab}')">${getImportTabLabel(tab)}</button>`).join("");
  const infoHtml = importModalTab === "dispatch"
    ? '<div class="sub mt-10">기간 일정은 균등 분할되고, 중복 건은 업데이트됩니다.</div>'
    : '<div class="sub mt-10">동일 강사명은 기존 데이터를 업데이트합니다.</div>';
  modal(`<div class="between"><h3 style="margin:0">${importModalLockedTab ? `${getImportTabLabel(importModalTab)} 업로드` : "엑셀 업로드"}</h3><button class="btn" onclick="closeModal()">닫기</button></div>${tabs ? `<div class="row mt-10">${tabs}</div>` : ""}${infoHtml}<div class="mt-10"><input type="file" accept=".xlsx,.xls" onchange="handleImportFile(this.files[0])" /></div>${errorMessage ? `<div class="text-danger sub mt-10">${esc(errorMessage)}</div>` : ""}${renderImportWarningCard()}${renderImportPreviewSummary()}<div class="row row-end mt-12"><button class="btn" onclick="closeModal()">취소</button><button class="btn primary" onclick="openImportApplyConfirmModal()" ${canProceedImportApply() ? "" : "disabled"}>반영 설정</button></div>`);
}

function openImportApplyConfirmModal() {
  if (!canProceedImportApply()) return;
  const preview = getActiveImportPreview();
  const summaryText = importModalTab === "dispatch"
    ? `기간 일정은 균등 분할되고, 동일 키는 업데이트됩니다. 반영 대상은 ${preview.rowCount}건입니다.`
    : `동일 강사명은 업데이트되고, 신규 강사는 자동 생성할 수 있습니다. 반영 대상은 ${preview.rowCount}건입니다.`;
  const departmentOption = importModalTab === "dispatch"
    ? `<label><input type="checkbox" ${importApplyOptions.autoCreateDepartments ? "checked" : ""} onchange="toggleImportOption('autoCreateDepartments', this.checked)" /> 부서 자동 생성</label>`
    : "";
  const managerOption = importModalTab === "dispatch"
    ? `<label><input type="checkbox" ${importApplyOptions.autoCreateManagers ? "checked" : ""} onchange="toggleImportOption('autoCreateManagers', this.checked)" /> 담당자 자동 생성</label>`
    : "";
  const scheduleStatusOption = importModalTab === "dispatch"
    ? `<div class="mt-12"><label>업로드 일정 상태</label><select onchange="changeImportScheduleStatus(this.value)"><option value="confirmed" ${importApplyOptions.dispatchScheduleStatus === "confirmed" ? "selected" : ""}>확정</option><option value="draft" ${importApplyOptions.dispatchScheduleStatus === "draft" ? "selected" : ""}>가안</option></select></div>`
    : "";
  modal(`<div class="between"><h3 style="margin:0">${getImportTabLabel(importModalTab)} 업로드 확인</h3><button class="btn" onclick="openImportModal()">돌아가기</button></div><div class="card mt-10"><div>${esc(summaryText)}</div><div class="row mt-12" style="flex-wrap:wrap;gap:12px;"><label><input type="checkbox" ${importApplyOptions.autoCreateInstructors ? "checked" : ""} onchange="toggleImportOption('autoCreateInstructors', this.checked)" /> 강사 자동 생성</label>${managerOption}${departmentOption}</div>${scheduleStatusOption}<div class="sub mt-10">중복 처리: 업데이트 고정</div>${importModalTab === "dispatch" ? '<div class="sub mt-10">기간 분할: 균등 분할 고정</div>' : ""}</div><div class="row row-end mt-12"><button class="btn" onclick="openImportModal()">취소</button><button class="btn primary" onclick="applyActiveImportPreview()">업로드 실행</button></div>`);
}

function ensureImportedDepartment(teamName) {
  const normalized = String(teamName || "-").trim() || "-";
  const exists = getDepartmentNames().includes(normalized);
  if (!exists) {
    if (!importApplyOptions.autoCreateDepartments) throw new Error(`부서가 등록되어 있지 않습니다. (${normalized})`);
    state.settings.departments = [...new Set([...(state.settings.departments || []), normalized])].sort((a, b) => a.localeCompare(b, "ko"));
  }
  return normalized;
}

function ensureImportedManager(managerName, teamName) {
  const exact = state.users.find((user) => user.name === managerName && (user.team || "-") === teamName);
  if (exact) return exact;
  const byName = state.users.find((user) => user.name === managerName);
  if (byName) {
    byName.team = byName.team || teamName;
    return byName;
  }
  if (!importApplyOptions.autoCreateManagers) throw new Error(`담당자가 등록되어 있지 않습니다. (${managerName})`);
  const created = {
    id: uid("u"),
    loginId: `import_mgr_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    password: "",
    name: managerName || "미지정 담당자",
    role: "user",
    team: teamName || "-"
  };
  state.users.push(created);
  return created;
}

function createImportedInstructorPayload(payload) {
  return {
    id: uid("i"),
    name: payload.name,
    category: payload.category || "강사",
    categoryOther: payload.categoryOther || "",
    email: payload.email || "",
    birthDate: payload.birthDate || "",
    birthYYMMDD: payload.birthYYMMDD || "",
    phone: payload.phone || "",
    field: payload.field || "",
    specialization: payload.specialization || "",
    specializations: payload.specializations || [],
    target: payload.target || "",
    photoUrl: payload.photoUrl || "",
    qualifications: payload.qualifications || "",
    grade: payload.grade || "A",
    unitType: payload.unitType || "hour",
    baseRate: Number(payload.baseRate || 0),
    deductionRate: Number(payload.deductionRate || 3.3),
    rating: Number(payload.rating || 0),
    reviews: payload.reviews || [],
    paymentMethod: payload.paymentMethod || "",
    bankName: payload.bankName || "",
    accountNumber: payload.accountNumber || ""
  };
}

function ensureImportedInstructorFromDispatch(row) {
  const exact = state.instructors.find((instructor) => instructor.name === row.instructorName);
  if (exact) return exact;
  if (!importApplyOptions.autoCreateInstructors) throw new Error(`강사가 등록되어 있지 않습니다. (${row.instructorName})`);
  const grade = /FT/i.test(String(row.type || "")) ? "FT" : "A";
  const created = createImportedInstructorPayload({
    name: row.instructorName,
    category: row.type || "강사",
    field: "",
    specialization: "",
    specializations: [],
    grade,
    unitType: row.unitType === "day" ? "day" : "hour",
    baseRate: Number(row.customRate || 0),
    deductionRate: Number(row.deductionRate || 3.3)
  });
  state.instructors.push(created);
  return created;
}

function upsertInstructorFromImport(row) {
  const existing = state.instructors.find((instructor) => createInstructorImportKey(instructor) === createInstructorImportKey(row));
  const fallbackRate = Number(getGradeRule(row.grade)?.rate || 0);
  const next = {
    name: row.name,
    category: row.grade === "FT" ? "FT" : "강사",
    categoryOther: "",
    email: row.email || existing?.email || "",
    birthDate: row.birthDate || existing?.birthDate || "",
    birthYYMMDD: row.birthYYMMDD || existing?.birthYYMMDD || "",
    phone: row.phone || existing?.phone || "",
    field: existing?.field || "",
    specialization: existing?.specialization || "",
    specializations: existing?.specializations || normalizeSpecializations(existing?.specialization || ""),
    target: existing?.target || "",
    photoUrl: existing?.photoUrl || "",
    qualifications: existing?.qualifications || "",
    grade: row.grade || existing?.grade || "A",
    unitType: existing?.unitType || "hour",
    baseRate: Number(row.baseRate || existing?.baseRate || fallbackRate),
    deductionRate: Number(existing?.deductionRate || 3.3),
    rating: Number(existing?.rating || 0),
    reviews: existing?.reviews || [],
    paymentMethod: row.payoutMethod || existing?.paymentMethod || "",
    bankName: row.bankName || existing?.bankName || "",
    accountNumber: row.accountNumber || existing?.accountNumber || ""
  };
  if (existing) {
    Object.assign(existing, next);
    return existing;
  }
  if (!importApplyOptions.autoCreateInstructors) throw new Error(`강사가 등록되어 있지 않습니다. (${row.name})`);
  const created = createImportedInstructorPayload(next);
  state.instructors.push(created);
  return created;
}

function findScheduleForDispatchImport(row, importKey) {
  return state.schedules.find((item) => !item.deleted && item.externalImportKey === importKey)
    || state.schedules.find((item) => !item.deleted
      && item.date === row.date
      && (item.course || "") === (row.courseName || "")
      && (item.clientName || "") === (row.clientName || "")
      && nameOfUser(item.managerId) === row.managerName
      && getScheduleInstructorNames(item).includes(row.instructorName));
}

function findDispatchForImport(row, importKey) {
  return state.dispatches.find((item) => !item.deleted && item.externalImportKey === importKey)
    || state.dispatches.find((item) => {
      if (item.deleted || item.date !== row.date || nameOfInstructor(item.instructorId) !== row.instructorName) return false;
      const schedule = state.schedules.find((scheduleItem) => scheduleItem.id === item.scheduleId);
      return (schedule?.course || "") === (row.courseName || "")
        && (schedule?.clientName || "") === (row.clientName || "")
        && nameOfUser(schedule?.managerId) === row.managerName;
    });
}

function applyDispatchImportPreview() {
  if (!dispatchImportPreview?.rows?.length) return;
  const uploadStatus = importApplyOptions.dispatchScheduleStatus === "draft" ? "draft" : "confirmed";
  dispatchImportPreview.rows.forEach((row) => {
    const teamName = ensureImportedDepartment(row.department || "-");
    const manager = ensureImportedManager(row.managerName, teamName);
    const instructor = ensureImportedInstructorFromDispatch(row);
    const importKey = createDispatchImportKey(row);
    const scheduleHours = row.unitType === "hour" ? Number(row.units || 0) : 8;
    let schedule = findScheduleForDispatchImport(row, importKey);
    if (!schedule) {
      schedule = {
        id: uid("s"),
        date: row.date,
        start: "09:00",
        end: addHoursToTime("09:00", scheduleHours || 8),
        hours: scheduleHours || 8,
        course: row.courseName || "-",
        clientName: row.clientName || "",
        managerId: manager.id,
        instructorId: instructor.id,
        instructorIds: [instructor.id],
        ownerTeam: teamName,
        status: uploadStatus,
        region: defaultRegion(),
        deleted: false
      };
      state.schedules.push(schedule);
    }
    schedule.date = row.date;
    schedule.course = row.courseName || schedule.course;
    schedule.clientName = row.clientName || schedule.clientName || "";
    schedule.managerId = manager.id;
    schedule.instructorId = instructor.id;
    schedule.instructorIds = [instructor.id];
    schedule.ownerTeam = teamName;
    schedule.hours = scheduleHours || schedule.hours || 8;
    schedule.start = "09:00";
    schedule.end = addHoursToTime("09:00", schedule.hours || 8);
    schedule.status = uploadStatus;
    schedule.externalImportKey = importKey;
    schedule.importedFromExcel = true;

    let dispatch = findDispatchForImport(row, importKey);
    if (!dispatch) {
      dispatch = {
        id: uid("d"),
        scheduleId: schedule.id,
        instructorId: instructor.id,
        date: row.date,
        units: Number(row.units || 0),
        customRate: Number(row.customRate || 0),
        deductionRate: Number(row.deductionRate || 0),
        region: defaultRegion(),
        transportCost: Number(row.transportCost || 0),
        lodgingCost: Number(row.lodgingCost || 0),
        materialCost: Number(row.materialCost || 0),
        receiptUrl: "",
        note: row.note || "",
        modifiedAfterEmail: false,
        manualImport: true,
        history: []
      };
      state.dispatches.push(dispatch);
    }
    dispatch.scheduleId = schedule.id;
    dispatch.instructorId = instructor.id;
    dispatch.date = row.date;
    dispatch.units = Number(row.units || 0);
    dispatch.customRate = Number(row.customRate || 0);
    dispatch.deductionRate = Number(row.deductionRate || 0);
    dispatch.transportCost = Number(row.transportCost || 0);
    dispatch.lodgingCost = Number(row.lodgingCost || 0);
    dispatch.materialCost = Number(row.materialCost || 0);
    dispatch.note = row.note || "";
    dispatch.manualImport = true;
    dispatch.externalImportKey = importKey;
    dispatch.basePay = Number(row.basePay || 0);
    dispatch.gross = Number(row.basePay || 0) + Number(row.transportCost || 0) + Number(row.lodgingCost || 0) + Number(row.materialCost || 0);
    dispatch.deduction = Number(row.tax || 0);
    dispatch.net = Number(row.net || 0);
    dispatch.history = Array.isArray(dispatch.history) ? dispatch.history : [];
    dispatch.history.push({ at: nowIso(), by: getCurrentUser()?.name || "system", action: "엑셀 업로드" });
  });

  normalizeSettingsSchema();
  saveState();
}

function applyInstructorImportPreview() {
  if (!instructorImportPreview?.rows?.length) return;
  instructorImportPreview.rows.forEach((row) => {
    upsertInstructorFromImport(row);
  });
  normalizeSettingsSchema();
  saveState();
}

function applyActiveImportPreview() {
  try {
    if (importModalTab === "dispatch") applyDispatchImportPreview();
    else applyInstructorImportPreview();
    if (importModalTab === "dispatch") dispatchImportPreview = null;
    else instructorImportPreview = null;
    importModalErrorMessage = "";
    closeModal();
    renderAll();
  } catch (err) {
    openImportModal(err.message || "업로드 반영에 실패했습니다.");
  }
}


