function onInstructorSearchInput(key, value) {
  instructorFilter[key] = value;
  if (!instructorSearchComposing) refreshInstructorListOnly();
}
function onInstructorSearchCompositionStart() { instructorSearchComposing = true; }
function onInstructorSearchCompositionEnd(key, value) {
  instructorSearchComposing = false;
  instructorFilter[key] = value;
  refreshInstructorListOnly();
}
function addInstructorFilterSpecialization(raw = "") {
  const input = document.getElementById("ins_filter_spec_input");
  const value = raw || input?.value || "";
  const items = normalizeSpecializations(value);
  items.forEach((s) => {
    if (!instructorFilter.specializationList.includes(s)) instructorFilter.specializationList.push(s);
  });
  if (input) input.value = "";
  renderInstructorFilterSpecializationTags();
  refreshInstructorListOnly();
}
function removeInstructorFilterSpecialization(encodedName) {
  const name = decodeURIComponent(encodedName);
  instructorFilter.specializationList = instructorFilter.specializationList.filter((x) => x !== name);
  renderInstructorFilterSpecializationTags();
  refreshInstructorListOnly();
}
function renderInstructorFilterSpecializationTags() {
  const box = document.getElementById("ins_filter_spec_tags");
  if (!box) return;
  box.innerHTML = (instructorFilter.specializationList || []).map((s) => `<span class="status-pill st-neutral">${esc(s)} <span style="margin-left:6px;cursor:pointer;" onclick="removeInstructorFilterSpecialization('${encodeURIComponent(s)}')">x</span></span>`).join("");
}
function onInstructorFilterSpecInput() {
  const input = document.getElementById("ins_filter_spec_input");
  const typed = input?.value?.trim() || "";
  if (!typed) return;
  const options = getAllSpecializationOptions();
  if (options.includes(typed)) addInstructorFilterSpecialization(typed);
}
function setInstructorSpecializationsFilter(selectEl) {
  instructorFilter.specializationList = Array.from(selectEl?.selectedOptions || []).map((o) => o.value);
  renderInstructorFilterSpecializationTags();
  refreshInstructorListOnly();
}
function selectInstructor(id) { selectedInstructorId = id; renderInstructors(); }
function formatBirthToYYMMDD(yyyyMmDd) {
  const raw = String(yyyyMmDd || "").replaceAll("-", "");
  if (raw.length !== 8) return "";
  return raw.slice(2);
}
function openInstructorProfile(id) {
  selectInstructor(id);
}
function exploreRecommendedInstructors() {
  const top = state.instructors.slice().sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0, 5);
  modal(`<div class="between"><h3 style="margin:0">추천 강사 탐색</h3><button class="btn" onclick="closeModal()">닫기</button></div><div class="card mt-10"><table><thead><tr><th>강사명</th><th>평점</th><th>전문분야</th><th>등급</th></tr></thead><tbody>${top.map((i) => `<tr><td>${esc(i.name)}</td><td>${Number(i.rating || 0).toFixed(1)}</td><td>${esc(i.specialization || i.field || "-")}</td><td>${esc(i.grade || "-")}</td></tr>`).join("") || '<tr><td colspan="4" class="sub">추천 데이터 없음</td></tr>'}</tbody></table></div>`);
}
function openInstructorModal(id = "") {
  const t = state.instructors.find((i) => i.id === id);
  const gradeKeys = Object.keys(getGradeRulesMap() || {});
  const defaultGrade = gradeKeys[0] || "A";
  const gradeOptions = gradeKeys.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
  const selectedGrade = t?.grade || defaultGrade;
  const specializationOptions = getAllSpecializationOptions();
  modal(`<div class="between"><h3 style="margin:0">${t ? "강사 수정" : "신규 강사 등록"}</h3><button class="btn" onclick="closeModal()">닫기</button></div><div class="mt-10" style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;"><div style="grid-column:span 2;"><label>이름</label><input id="ins_name" value="${esc(t?.name || "")}" /></div><div style="grid-column:span 2;"><label>구분</label><select id="ins_category"><option value="강사">강사</option><option value="FT">FT</option><option value="기타">기타(입력)</option></select></div><div style="grid-column:span 2;"><label>생년월일</label><input id="ins_birth_date" type="date" value="${esc(t?.birthDate || "")}" /></div><div id="ins_category_other_wrap" style="grid-column:1/-1;"><label>구분(기타 입력)</label><input id="ins_category_other" value="${esc(t?.categoryOther || "")}" /></div><div style="grid-column:span 3;"><label>연락처</label><input id="ins_phone" placeholder="000-0000-0000" value="${esc(t?.phone || "")}" /></div><div style="grid-column:span 3;"><label>이메일</label><input id="ins_email" placeholder="xxx@xxx.xxx" value="${esc(t?.email || "")}" /></div><div style="grid-column:span 3;"><label>등급</label><select id="ins_grade">${gradeOptions}</select></div><div style="grid-column:span 3;"><label>공제율</label><select id="ins_ded"><option value="3.3">3.3%</option><option value="8.8">8.8%</option><option value="10">10%</option></select></div><div style="grid-column:span 3;"><label>전문분야(선택)</label><div id="ins_spec_tags" class="row"></div><div class="row mt-10"><input id="ins_spec_input" placeholder="예: SQL" list="insSpecMasterList" /><button class="btn" onclick="addEditingSpecialization()">추가</button></div><datalist id="insSpecMasterList">${specializationOptions.map((s) => `<option value="${esc(s)}"></option>`).join("")}</datalist></div><div style="grid-column:span 3;"><label>자격사항(선택)</label><input id="ins_qual" value="${esc(t?.qualifications || "")}" /></div><div style="grid-column:1/-1"><label>대표 사진 URL</label><input id="ins_photo" value="${esc(t?.photoUrl || "")}" /></div></div><div class="row row-end mt-12">${t && canAdmin() ? `<button class="btn danger" onclick="removeInstructor('${t.id}')">삭제</button>` : ""}<button class="btn primary" onclick="saveInstructor('${t?.id || ""}')">저장</button></div>`);
  document.getElementById("ins_grade").value = selectedGrade;
  document.getElementById("ins_ded").value = String(t?.deductionRate || 3.3);
  document.getElementById("ins_category").value = t?.category || "강사";
  const phoneInput = document.getElementById("ins_phone");
  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      phoneInput.value = fmtPhone(phoneInput.value);
    });
  }
  editingInstructorSpecializations = getInstructorSpecializations(t);
  renderEditingSpecializations();
  const specInput = document.getElementById("ins_spec_input");
  if (specInput) {
    specInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addEditingSpecialization();
      }
    });
    specInput.addEventListener("input", () => {
      const typed = specInput.value.trim();
      if (!typed) return;
      const options = getAllSpecializationOptions();
      if (options.includes(typed)) addEditingSpecialization();
    });
  }
  const syncCategoryOther = () => {
    const isOther = v("ins_category") === "기타";
    const wrap = document.getElementById("ins_category_other_wrap");
    if (wrap) wrap.style.display = isOther ? "" : "none";
  };
  document.getElementById("ins_category").addEventListener("change", syncCategoryOther);
  syncCategoryOther();
}
function renderEditingSpecializations() {
  const box = document.getElementById("ins_spec_tags");
  if (!box) return;
  box.innerHTML = editingInstructorSpecializations.map((s) => `<span class="status-pill st-neutral">${esc(s)} <span style="margin-left:6px;cursor:pointer;" onclick="removeEditingSpecialization('${encodeURIComponent(s)}')">x</span></span>`).join("") || '<span class="sub">등록된 전문분야 없음</span>';
}
function addEditingSpecialization() {
  const input = document.getElementById("ins_spec_input");
  const value = input?.value || "";
  const items = normalizeSpecializations(value);
  items.forEach((s) => {
    if (!editingInstructorSpecializations.includes(s)) editingInstructorSpecializations.push(s);
  });
  if (input) input.value = "";
  renderEditingSpecializations();
}
function removeEditingSpecialization(encodedName) {
  const name = decodeURIComponent(encodedName);
  editingInstructorSpecializations = editingInstructorSpecializations.filter((x) => x !== name);
  renderEditingSpecializations();
}
function saveInstructor(id) {
  const birthDate = v("ins_birth_date");
  const selectedGrade = v("ins_grade");
  const existing = id ? state.instructors.find((i) => i.id === id) : null;
  const pendingSpecs = normalizeSpecializations(v("ins_spec_input"));
  pendingSpecs.forEach((s) => {
    if (!editingInstructorSpecializations.includes(s)) editingInstructorSpecializations.push(s);
  });
  const specializationText = editingInstructorSpecializations.join(", ");
  const phone = fmtPhone(v("ins_phone"));
  const gradeRule = getGradeRule(selectedGrade);
  const item = {
    name: v("ins_name"),
    category: v("ins_category") || "강사",
    categoryOther: v("ins_category_other"),
    birthDate,
    birthYYMMDD: formatBirthToYYMMDD(birthDate),
    phone,
    email: v("ins_email"),
    grade: v("ins_grade"),
    deductionRate: Number(v("ins_ded")),
    specialization: specializationText,
    field: specializationText,
    specializations: [...editingInstructorSpecializations],
    photoUrl: v("ins_photo"),
    qualifications: v("ins_qual"),
    unitType: gradeRule.unitType || "hour",
    baseRate: Number(gradeRule.rate || 0),
    rating: Number(existing?.rating || 0),
    target: id ? state.instructors.find((i) => i.id === id)?.target || "" : "",
    reviews: id ? state.instructors.find((i) => i.id === id)?.reviews || [] : []
  };
  if (!item.name) return alert("이름은 필수입니다.");
  if (!birthDate) return alert("생년월일을 입력해주세요.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return alert("생년월일 형식은 yyyy-mm-dd 입니다.");
  if (item.phone && !/^\d{2,3}-\d{3,4}-\d{4}$/.test(item.phone)) return alert("연락처 형식은 000-0000-0000 입니다.");
  if (item.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) return alert("이메일 형식이 올바르지 않습니다.");
  if (item.category === "기타" && !item.categoryOther) return alert("구분이 기타인 경우 값을 입력해주세요.");
  if (id) Object.assign(state.instructors.find((i) => i.id === id), item);
  else state.instructors.push({ id: uid("i"), ...item });
  saveState();
  closeModal();
  renderInstructors();
}
function removeInstructor(id) {
  if (!canAdmin()) return alert("관리자만 삭제할 수 있습니다.");
  const target = state.instructors.find((i) => i.id === id);
  if (!target) return;
  if (!confirm("삭제하시겠습니까?")) return;
  state.instructors = state.instructors.filter((i) => i.id !== id);
  saveState();
  closeModal();
  renderInstructors();
  alert(`${target.name} 강사 삭제 처리되었습니다.`);
}
function openInstructorReviewsModal(instructorId) {
  const ins = state.instructors.find((x) => x.id === instructorId);
  if (!ins) return;
  const reviews = Array.isArray(ins.reviews) ? ins.reviews : [];
  modal(`<div class="between"><h3 style="margin:0">강의 평가 요약 - ${esc(ins.name)}</h3><button class="btn" onclick="closeModal()">닫기</button></div><div class="card mt-10"><table><thead><tr><th>평점</th><th>내용</th><th>작성일</th><th></th></tr></thead><tbody>${reviews.map((r) => `<tr><td>${Number(r.score || 0).toFixed(1)}</td><td>${esc(r.text || "-")}</td><td>${toLocal(r.at)}</td><td><button class="btn" onclick="openReviewEditor('${ins.id}','${r.id}')">수정</button> <button class="btn" onclick="deleteReview('${ins.id}','${r.id}')">삭제</button></td></tr>`).join("") || '<tr><td colspan="4" class="sub">평가 데이터가 없습니다.</td></tr>'}</tbody></table><div class="row row-end mt-12"><button class="btn primary" onclick="openReviewEditor('${ins.id}','')">평가 입력</button></div></div>`);
}
function openReviewEditor(instructorId, reviewId) {
  const ins = state.instructors.find((x) => x.id === instructorId);
  if (!ins) return;
  const r = (ins.reviews || []).find((x) => x.id === reviewId) || null;
  modal(`<div class="between"><h3 style="margin:0">${r ? "평가 수정" : "평가 입력"} - ${esc(ins.name)}</h3><button class="btn" onclick="openInstructorReviewsModal('${ins.id}')">닫기</button></div><div class="form-grid mt-10"><div><label>평점(0~5)</label><input id="rv_score" type="number" min="0" max="5" step="0.1" value="${r ? Number(r.score || 0) : 0}" /></div><div><label>작성자</label><input id="rv_author" value="${esc(r?.author || getCurrentUser()?.name || "관리자")}" /></div><div style="grid-column:1/-1"><label>내용</label><textarea id="rv_text">${esc(r?.text || "")}</textarea></div></div><div class="row row-end mt-12"><button class="btn primary" onclick="saveReviewEdit('${ins.id}','${r?.id || ""}')">저장</button></div>`);
}
function saveReviewEdit(instructorId, reviewId) {
  const ins = state.instructors.find((x) => x.id === instructorId);
  if (!ins) return;
  const payload = { id: reviewId || uid("rv"), score: Number(v("rv_score")), author: v("rv_author") || "관리자", text: v("rv_text"), at: new Date().toISOString() };
  if (!payload.text) return alert("평가 내용을 입력해주세요.");
  if (!Array.isArray(ins.reviews)) ins.reviews = [];
  const idx = ins.reviews.findIndex((r) => r.id === reviewId);
  if (idx >= 0) ins.reviews[idx] = { ...ins.reviews[idx], ...payload };
  else ins.reviews.push(payload);
  const avg = ins.reviews.length ? ins.reviews.reduce((s, r) => s + Number(r.score || 0), 0) / ins.reviews.length : 0;
  ins.rating = Number(avg.toFixed(1));
  saveState();
  openInstructorReviewsModal(instructorId);
  renderInstructors();
}
function deleteReview(instructorId, reviewId) {
  const ins = state.instructors.find((x) => x.id === instructorId);
  if (!ins) return;
  ins.reviews = (ins.reviews || []).filter((r) => r.id !== reviewId);
  const avg = ins.reviews.length ? ins.reviews.reduce((s, r) => s + Number(r.score || 0), 0) / ins.reviews.length : 0;
  ins.rating = Number(avg.toFixed(1));
  saveState();
  openInstructorReviewsModal(instructorId);
  renderInstructors();
}
function getFilteredInstructors() {
  const q = (instructorFilter.q || "").toLowerCase();
  const selectedSpecs = (instructorFilter.specializationList || []).map((x) => String(x).toLowerCase());
  return state.instructors.filter((i) => {
    const specList = getInstructorSpecializations(i);
    const specLower = specList.map((s) => s.toLowerCase());
    const courseText = state.schedules.filter((s) => s.instructorId === i.id && !s.deleted).map((s) => s.course).join(" ");
    const text = [i.name, i.email, i.phone, i.specialization, i.field, specList.join(" "), i.category, i.categoryOther, courseText].join(" ").toLowerCase();
    if (q && !text.includes(q)) return false;
    if (instructorFilter.grade && i.grade !== instructorFilter.grade) return false;
    if (selectedSpecs.length && !selectedSpecs.some((s) => specLower.includes(s))) return false;
    if (Number(i.rating || 0) < Number(instructorFilter.ratingMin || 0)) return false;
    return true;
  }).slice().sort((a, b) => `${a.name || ""}`.localeCompare(`${b.name || ""}`, "ko"));
}
function renderInstructorDetailPanel(i) {
  if (!i) return '<div class="card"><div class="sub">강사를 선택하면 상세 프로필이 표시됩니다.</div></div>';
  const categoryLabel = i.category === "기타" ? `기타(${i.categoryOther || "-"})` : (i.category || "-");
  const relatedSchedules = state.schedules.filter((s) => !s.deleted && s.instructorId === i.id).slice(0, 8);
  const recentDispatches = state.dispatches.filter((d) => d.instructorId === i.id).slice().sort((a, b) => `${b.date}`.localeCompare(`${a.date}`)).slice(0, 6);
  const tags = getInstructorSpecializations(i);
  const reviews = Array.isArray(i.reviews) ? i.reviews : [];
  const avgRating = reviews.length ? Number((reviews.reduce((sum, r) => sum + Number(r.score || 0), 0) / reviews.length).toFixed(1)) : 0;
  return `
    <div class="ins-detail-panel">
      <div class="card ins-detail-hero">
        <span class="ins-close-x" onclick="closeInstructorDetail()" title="닫기">×</span>
        <div class="ins-detail-hero-left">
          <img src="${esc(i.photoUrl || "https://placehold.co/160x160?text=PHOTO")}" alt="profile" />
          <button class="btn ins-photo-btn" onclick="openInstructorModal('${i.id}')">수정</button>
        </div>
        <div class="ins-detail-hero-main">
          <div class="between">
            <div>
              <h2 style="margin:0;">${esc(i.name)} <span class="status-pill st-neutral">${esc(categoryLabel)}</span></h2>
            </div>
            <div class="row">
              <button class="btn" onclick="closeInstructorDetail()">목록으로 돌아가기</button>
              ${canAdmin() ? `<button class="btn" onclick="openInstructorAccountModal('${i.id}')">${getRequestInstructorUser(i.id) ? "계정 관리" : "계정 생성"}</button>` : ""}
              <button class="btn" onclick="openInstructorModal('${i.id}')">정보 수정</button>
              <button class="btn">프로필 다운로드</button>
            </div>
          </div>
          <div class="row mt-12">
            <span class="ins-contact-big">${esc(i.phone || "-")}</span>
            <span class="ins-contact-big">${esc(i.email || "-")}</span>
          </div>
        </div>
      </div>
      <div class="ins-detail-grid mt-12">
        <div class="ins-detail-main">
          <div class="card">
            <div class="between"><h3 style="margin:0;">강사료 및 정산 기준 설정</h3></div>
            <div class="ins-kpi-row mt-12">
              <div class="ins-kpi-box"><div class="kpi-title">강사 등급</div><div class="kpi-value">${esc(i.grade || "-")}</div></div>
              <div class="ins-kpi-box"><div class="kpi-title">${i.unitType === "day" ? "1일 강사료" : "시간당 강사료"}</div><div class="kpi-value">${fmtMoney(i.baseRate || 0)}</div></div>
              <div class="ins-kpi-box"><div class="kpi-title">공제 세율</div><div class="kpi-value">${Number(i.deductionRate || 0)}%</div></div>
            </div>
          </div>
          <div class="card mt-12">
            <div class="between"><h3 style="margin:0;">최근 출강 및 정산 이력</h3><button class="btn" onclick="openSettlementRecentForInstructor('${i.id}')">상세보기</button></div>
            <table class="mt-10">
              <thead><tr><th>일자</th><th>과정명</th><th>시간</th><th>정산금액</th></tr></thead>
              <tbody>${recentDispatches.map((d) => {
                const sch = state.schedules.find((s) => s.id === d.scheduleId);
                const hours = sch ? durationHours(sch.start || "00:00", sch.end || "00:00") : 0;
                return `<tr><td>${d.date}</td><td>${esc(sch?.course || "-")}</td><td>${hours}h</td><td>${fmtMoney(d.net || 0)}</td></tr>`;
              }).join("") || '<tr><td colspan="4" class="sub">이력 없음</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div class="ins-detail-side">
          <div class="card">
            <h3 style="margin-top:0;">주요 전문 분야</h3>
            <div class="row">${tags.map((t) => `<span class="status-pill st-neutral">${esc(t)}</span>`).join("") || '<span class="sub">등록 없음</span>'}</div>
          </div>
          <div class="card mt-12">
            <div class="between"><h3 style="margin-top:0;">강의 평가 요약</h3><button class="btn" onclick="openInstructorReviewsModal('${i.id}')">상세보기</button></div>
            <div class="ins-rating-big">${avgRating.toFixed(1)} <span>/ 5.0</span></div>
            <div class="sub mt-10">관련 일정: ${relatedSchedules.length}건</div>
            <div class="sub mt-10">평가 수: ${reviews.length}건</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
function refreshInstructorListOnly() {
  const body = document.getElementById("instructorListBody");
  const summary = document.getElementById("instructorListSummary");
  const sizeSelect = document.getElementById("instructorLimitSelect");
  if (!body || !summary || !sizeSelect) return;
  const filtered = getFilteredInstructors();
  selectedInstructorIds = selectedInstructorIds.filter((id) => filtered.some((instructor) => instructor.id === id));
  if (selectedInstructorId && !filtered.some((i) => i.id === selectedInstructorId)) selectedInstructorId = filtered[0]?.id || "";
  const pageSize = instructorFilter.limit === "50" ? 50 : instructorFilter.limit === "100" ? 100 : 12;
  const rows = filtered.slice(0, pageSize);
  const encodedIds = encodeURIComponent(JSON.stringify(rows.map((instructor) => instructor.id)));
  const allChecked = !!rows.length && rows.every((instructor) => selectedInstructorIds.includes(instructor.id));
  const selectAllBox = document.getElementById("instructorSelectAll");
  if (selectAllBox) {
    selectAllBox.checked = allChecked;
    selectAllBox.setAttribute("onchange", `toggleInstructorSelectAll(this.checked,'${encodedIds}')`);
  }
  const deleteButton = document.getElementById("deleteSelectedInstructorsButton");
  if (deleteButton) deleteButton.disabled = !selectedInstructorIds.length;
  const q = String(instructorFilter.q || "");
  body.innerHTML = rows.map((i) => {
    const categoryLabel = i.category === "기타" ? `기타(${i.categoryOther || "-"})` : (i.category || "-");
    const specText = getInstructorSpecializations(i).join(", ") || "-";
    const checkCell = canAdmin() ? `<td class="cell-center select-cell"><label class="select-hitbox" onclick="event.stopPropagation()"><input type="checkbox" ${selectedInstructorIds.includes(i.id) ? "checked" : ""} onclick="event.stopPropagation()" onchange="toggleInstructorSelection('${i.id}',this.checked)" /></label></td>` : "";
    return `<tr onclick="selectInstructor('${i.id}')" style="cursor:pointer;">${checkCell}<td class="cell-mid-left"><b>${highlightText(i.name, q)}</b> <span class="status-pill st-neutral">${esc(categoryLabel)}</span><div class="sub mt-10">${highlightText(i.phone || "-", q)} / ${highlightText(i.email || "-", q)}</div></td><td class="cell-center"><span class="status-pill st-neutral">${esc(i.grade || "-")}</span></td><td class="cell-center"><span class="status-pill st-warn">★ ${Number(i.rating || 0).toFixed(1)}</span></td><td class="cell-center">${highlightText(specText, q)}</td><td class="cell-center"><button class="btn" onclick="event.stopPropagation(); selectInstructor('${i.id}')">상세</button></td></tr>`;
  }).join("") || `<tr><td colspan="${canAdmin() ? 6 : 5}" class="sub">검색 결과가 없습니다.</td></tr>`;
  summary.textContent = `총 ${filtered.length}명 중 ${Math.min(rows.length, filtered.length)}명 표시`;
  sizeSelect.value = instructorFilter.limit || "default";
  const compactList = document.getElementById("instructorCompactList");
  if (compactList) {
    compactList.innerHTML = selectedInstructorId
      ? ""
      : rows.map((i) => `<button class="ins-compact-item ${selectedInstructorId === i.id ? "active" : ""}" onclick="selectInstructor('${i.id}')"><span class="ins-compact-name">${esc(i.name)}</span><span class="ins-compact-meta">${esc(i.grade || "-")} · ${esc((getInstructorSpecializations(i)[0] || i.category || "-"))}</span></button>`).join("");
  }
  const detailRoot = document.getElementById("instructorDetailRoot");
  if (detailRoot) {
    const selected = state.instructors.find((x) => x.id === selectedInstructorId) || filtered[0] || null;
    detailRoot.innerHTML = renderInstructorDetailPanel(selected);
  }
  enhanceSortableTables(document.getElementById("view-instructors"));
}
function renderInstructors() {
  const root = document.getElementById("view-instructors");
  const grades = Object.keys(getGradeRulesMap() || {});
  const specs = getAllSpecializationOptions();
  root.innerHTML = `<div class="card"><div class="between"><div><h3 style="margin:0">강사 리스트</h3></div><div class="row">${selectedInstructorId ? `<button class="btn" onclick="closeInstructorDetail()">목록으로 돌아가기</button>` : `${canAdmin() ? `<button id="deleteSelectedInstructorsButton" class="btn danger" onclick="deleteSelectedInstructors()" ${selectedInstructorIds.length ? "" : "disabled"}>선택 삭제</button>` : ""}<button class="btn primary" onclick="openInstructorModal()">신규 강사 등록</button>`}</div></div>${selectedInstructorId ? "" : `<div class="ins-filter-grid mt-12"><div class="ins-filter-cell is-search"><label>검색</label><input placeholder="이름, 진행한 과정, 이메일, 연락처, 전문분야..." value="${esc(instructorFilter.q)}" oninput="onInstructorSearchInput('q',this.value)" oncompositionstart="onInstructorSearchCompositionStart()" oncompositionend="onInstructorSearchCompositionEnd('q',this.value)" /></div><div class="ins-filter-cell"><label>등급</label><select onchange="setInstructorFilter('grade',this.value)"><option value="">전체 등급</option>${grades.map((g) => `<option value="${esc(g)}" ${instructorFilter.grade === g ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></div><div class="ins-filter-cell"><label>전문분야(다중 선택)</label><div class="ins-filter-spec-input"><input id="ins_filter_spec_input" placeholder="전문분야 입력" list="insFilterSpecList" oninput="onInstructorFilterSpecInput()" /></div><div id="ins_filter_spec_tags" class="row ins-filter-spec-tags"></div><datalist id="insFilterSpecList">${specs.map((s) => `<option value="${esc(s)}"></option>`).join("")}</datalist></div></div>`}</div><div class="ins-view ${selectedInstructorId ? "is-open" : ""} mt-12"><div class="ins-view-left"><div class="card"><table class="dash-table ins-table"><colgroup>${canAdmin() ? '<col style="width:56px"/>' : ''}<col style="width:380px"/><col style="width:90px"/><col style="width:90px"/><col style="width:220px"/><col style="width:110px"/></colgroup><thead><tr>${canAdmin() ? `<th class="select-cell"><label class="select-hitbox"><input id="instructorSelectAll" type="checkbox" onchange="toggleInstructorSelectAll(this.checked,'%5B%5D')" /></label></th>` : ""}<th>강사 정보</th><th>등급</th><th>평점</th><th>전문 분야</th><th>관리</th></tr></thead><tbody id="instructorListBody"></tbody></table><div class="between mt-10"><div class="sub" id="instructorListSummary"></div><div class="row row-end"><label style="margin:0;">표시 개수</label><select id="instructorLimitSelect" style="width:110px;" onchange="setInstructorFilter('limit',this.value)"><option value="default">기본</option><option value="50">50</option><option value="100">100</option></select></div></div></div><div class="card" id="instructorCompactList"></div></div><div class="ins-view-right" id="instructorDetailRoot"></div></div>`;
  if (!selectedInstructorId) {
    renderInstructorFilterSpecializationTags();
    const filterSpecInput = document.getElementById("ins_filter_spec_input");
    if (filterSpecInput) {
      filterSpecInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addInstructorFilterSpecialization();
        }
      });
    }
  }
  refreshInstructorListOnly();
}

let selectedInstructorIds = [];

function toggleInstructorSelection(instructorId, checked) {
  const set = new Set(selectedInstructorIds);
  if (checked) set.add(instructorId);
  else set.delete(instructorId);
  selectedInstructorIds = [...set];
}

function toggleInstructorSelectAll(checked, encodedIds) {
  const ids = JSON.parse(decodeURIComponent(encodedIds || "%5B%5D"));
  selectedInstructorIds = checked ? ids : [];
  refreshInstructorListOnly();
}

function deleteSelectedInstructors() {
  if (!selectedInstructorIds.length) return alert("삭제할 강사를 선택해주세요.");
  state.instructors = state.instructors.filter((instructor) => !selectedInstructorIds.includes(instructor.id));
  selectedInstructorIds = [];
  if (selectedInstructorId && !state.instructors.some((instructor) => instructor.id === selectedInstructorId)) selectedInstructorId = "";
  saveState();
  renderInstructors();
}
