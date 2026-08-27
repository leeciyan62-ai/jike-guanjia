(() => {
  const STORAGE_KEY = "jike-guanjia-data-v2";
  const LEGACY_KEY = "jike-guanjia-courses-v1";

  const COLORS = [
    { id: "teal", value: "#0f766e" },
    { id: "coral", value: "#d4573c" },
    { id: "sky", value: "#3d7ea6" },
    { id: "leaf", value: "#3f7d4e" },
    { id: "gold", value: "#c9892b" },
    { id: "plum", value: "#6b4f7a" },
  ];

  const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
  const WEEKDAYS_FULL = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

  const STATUS = {
    planned: { label: "待上", color: "#94a3a0" },
    done: { label: "已完成", color: "#0f766e" },
    leave: { label: "请假", color: "#c9892b" },
    missed: { label: "缺席", color: "#d4573c" },
    other: { label: "其他", color: "#6b4f7a" },
  };

  const store = loadStore();
  let courses = store.courses;
  let packages = store.packages;

  let weekStart = startOfWeek(new Date());
  let selectedDay = toDateKey(new Date());
  let activeTab = "calendar";
  let statsDays = 7;
  let selected = new Set();
  let editingId = null;
  let editingPackageId = null;
  let activeColor = COLORS[0].value;
  let packageColor = COLORS[0].value;
  let pickedTargetDates = [];

  const els = {
    weekLabel: document.getElementById("weekLabel"),
    dayStrip: document.getElementById("dayStrip"),
    dayTitle: document.getElementById("dayTitle"),
    agenda: document.getElementById("agenda"),
    headerSub: document.getElementById("headerSub"),
    selectionBar: document.getElementById("selectionBar"),
    selectionCount: document.getElementById("selectionCount"),
    courseDialog: document.getElementById("courseDialog"),
    courseForm: document.getElementById("courseForm"),
    dialogTitle: document.getElementById("dialogTitle"),
    deleteCourse: document.getElementById("deleteCourse"),
    packageSelect: document.getElementById("packageSelect"),
    statusNoteWrap: document.getElementById("statusNoteWrap"),
    copyDialog: document.getElementById("copyDialog"),
    copyForm: document.getElementById("copyForm"),
    copySummary: document.getElementById("copySummary"),
    datesMode: document.getElementById("datesMode"),
    weeksMode: document.getElementById("weeksMode"),
    pickedDates: document.getElementById("pickedDates"),
    pickDate: document.getElementById("pickDate"),
    weekCount: document.getElementById("weekCount"),
    skipConflicts: document.getElementById("skipConflicts"),
    swatches: document.getElementById("swatches"),
    packageSwatches: document.getElementById("packageSwatches"),
    packageDialog: document.getElementById("packageDialog"),
    packageForm: document.getElementById("packageForm"),
    packageDialogTitle: document.getElementById("packageDialogTitle"),
    deletePackage: document.getElementById("deletePackage"),
    childList: document.getElementById("childList"),
    toast: document.getElementById("toast"),
    viewCalendar: document.getElementById("viewCalendar"),
    viewDashboard: document.getElementById("viewDashboard"),
    statGrid: document.getElementById("statGrid"),
    statusBars: document.getElementById("statusBars"),
    statusLegend: document.getElementById("statusLegend"),
    byCourseStats: document.getElementById("byCourseStats"),
    chartPeriodLabel: document.getElementById("chartPeriodLabel"),
    packageGrid: document.getElementById("packageGrid"),
  };

  ensureSelectedDayInWeek();

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return {
          courses: migrateCourses(Array.isArray(data.courses) ? data.courses : []),
          packages: Array.isArray(data.packages) ? data.packages : [],
        };
      }
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const list = JSON.parse(legacy);
        return { courses: migrateCourses(Array.isArray(list) ? list : []), packages: [] };
      }
    } catch {
      /* ignore */
    }
    return { courses: [], packages: [] };
  }

  function migrateCourses(list) {
    return list.map((c) => ({
      ...c,
      status: c.status && STATUS[c.status] ? c.status : "planned",
      statusNote: c.statusNote || "",
      packageId: c.packageId || "",
    }));
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ courses, packages }));
  }

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toDateKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseDateKey(key) {
    const [y, m, day] = key.split("-").map(Number);
    return new Date(y, m - 1, day);
  }

  function startOfWeek(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    return x;
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function ensureSelectedDayInWeek() {
    const keys = Array.from({ length: 7 }, (_, i) => toDateKey(addDays(weekStart, i)));
    if (!keys.includes(selectedDay)) selectedDay = keys[0];
  }

  function formatWeekLabel(start) {
    const end = addDays(start, 6);
    return `${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;
  }

  function formatShortDate(key) {
    const d = parseDateKey(key);
    return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS_FULL[(d.getDay() + 6) % 7]}）`;
  }

  function formatDayTitle(key) {
    const d = parseDateKey(key);
    const today = toDateKey(new Date());
    const wd = WEEKDAYS_FULL[(d.getDay() + 6) % 7];
    const base = `${d.getMonth() + 1}月${d.getDate()}日 · ${wd}`;
    return key === today ? `${base}（今天）` : base;
  }

  function timeToMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function sortCourses(list) {
    return [...list].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return timeToMinutes(a.start) - timeToMinutes(b.start);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function money(n) {
    const v = Number(n) || 0;
    return v % 1 === 0 ? String(v) : v.toFixed(2);
  }

  function showToast(msg) {
    els.toast.hidden = false;
    els.toast.textContent = msg;
    requestAnimationFrame(() => els.toast.classList.add("show"));
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      els.toast.classList.remove("show");
      setTimeout(() => {
        els.toast.hidden = true;
      }, 280);
    }, 2200);
  }

  function updateChildList() {
    const names = [
      ...new Set([
        ...courses.map((c) => c.child).filter(Boolean),
        ...packages.map((p) => p.child).filter(Boolean),
      ]),
    ];
    els.childList.innerHTML = names.map((n) => `<option value="${escapeHtml(n)}"></option>`).join("");
  }

  function fillPackageSelect(selectedId = "") {
    els.packageSelect.innerHTML = [`<option value="">不关联包课</option>`]
      .concat(
        packages.map(
          (p) =>
            `<option value="${p.id}"${p.id === selectedId ? " selected" : ""}>${escapeHtml(p.name)}${
              p.child ? ` · ${escapeHtml(p.child)}` : ""
            }</option>`
        )
      )
      .join("");
  }

  function renderSwatches(container, active) {
    container.innerHTML = COLORS.map(
      (c) =>
        `<button type="button" class="swatch${c.value === active ? " active" : ""}" data-color="${c.value}" style="background:${c.value}" aria-label="${c.id}"></button>`
    ).join("");
  }

  function syncStatusNoteVisibility() {
    const status = els.courseForm.status.value;
    els.statusNoteWrap.hidden = !(status === "leave" || status === "missed" || status === "other");
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll(".tabbar .tab").forEach((btn) => {
      const on = btn.dataset.tab === tab;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    els.viewCalendar.hidden = tab !== "calendar";
    els.viewDashboard.hidden = tab !== "dashboard";
    els.headerSub.textContent = tab === "calendar" ? "周历安排" : "数据大盘";
    document.getElementById("btnToday").hidden = tab !== "calendar";
    if (tab === "dashboard") renderDashboard();
  }

  function renderSelectionBar() {
    const n = selected.size;
    els.selectionBar.hidden = n === 0;
    els.selectionCount.textContent = `已选 ${n} 节`;
    document.getElementById("btnEditSelected").hidden = n !== 1;
  }

  function renderCalendar() {
    ensureSelectedDayInWeek();
    els.weekLabel.textContent = formatWeekLabel(weekStart);
    els.dayTitle.textContent = formatDayTitle(selectedDay);

    const todayKey = toDateKey(new Date());
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    els.dayStrip.innerHTML = days
      .map((d, i) => {
        const key = toDateKey(d);
        const has = courses.some((c) => c.date === key);
        const cls = [
          "day-chip",
          key === todayKey ? "today" : "",
          key === selectedDay ? "active" : "",
          has ? "has-course" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<button type="button" class="${cls}" data-day="${key}">
          <span class="w">${WEEKDAYS[i]}</span>
          <span class="d">${d.getDate()}</span>
        </button>`;
      })
      .join("");

    const dayCourses = sortCourses(courses.filter((c) => c.date === selectedDay));
    els.agenda.innerHTML = dayCourses.length
      ? dayCourses
          .map((c) => {
            const sel = selected.has(c.id) ? " selected" : "";
            const st = STATUS[c.status] || STATUS.planned;
            const meta = [c.child, c.note].filter(Boolean).join(" · ");
            const reason = c.statusNote ? ` · ${c.statusNote}` : "";
            return `<div class="course status-${c.status}${sel}" data-id="${c.id}" style="background:${c.color}">
              <button type="button" class="check" data-toggle="${c.id}" aria-label="选择"></button>
              <button type="button" class="body" data-edit="${c.id}">
                <span class="time">${c.start}–${c.end}</span>
                <span class="title">${escapeHtml(c.title)}</span>
                ${meta ? `<span class="meta">${escapeHtml(meta)}</span>` : ""}
                <span class="status-tag">${st.label}${escapeHtml(reason)}</span>
              </button>
            </div>`;
          })
          .join("")
      : `<div class="empty-day">这天还没有课<br /><span style="font-size:.82rem">点右上角「加课」或底部 ＋</span></div>`;

    renderSelectionBar();
    updateChildList();
  }

  function coursesInLastDays(days) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fromKey = toDateKey(addDays(today, -(days - 1)));
    const toKey = toDateKey(today);
    return courses.filter((c) => c.date >= fromKey && c.date <= toKey);
  }

  function countByStatus(list) {
    const counts = { planned: 0, done: 0, leave: 0, missed: 0, other: 0 };
    for (const c of list) {
      if (counts[c.status] != null) counts[c.status] += 1;
      else counts.other += 1;
    }
    return counts;
  }

  function packageUsage(pkg) {
    const linked = courses.filter((c) => c.packageId === pkg.id);
    const done = linked.filter((c) => c.status === "done").length;
    const remaining = Math.max(0, pkg.totalSessions - done);
    const unit = pkg.totalSessions > 0 ? pkg.totalFee / pkg.totalSessions : 0;
    const autoSpent = done * unit;
    const spent = pkg.spentFee == null || pkg.spentFee === "" ? autoSpent : Number(pkg.spentFee);
    const progress = pkg.totalSessions > 0 ? Math.min(100, (done / pkg.totalSessions) * 100) : 0;
    return { done, remaining, unit, spent, progress };
  }

  function renderDashboard() {
    const list = coursesInLastDays(statsDays);
    const counts = countByStatus(list);
    const total = list.length;
    const rate = total ? Math.round((counts.done / total) * 100) : 0;
    els.chartPeriodLabel.textContent = `近 ${statsDays} 天`;

    els.statGrid.innerHTML = [
      { label: "排课总数", value: total, sub: `近 ${statsDays} 天`, accent: "rgba(15,118,110,.18)" },
      { label: "已完成", value: counts.done, sub: `出勤率 ${rate}%`, accent: "rgba(15,118,110,.22)" },
      { label: "请假", value: counts.leave, sub: "已提前请假", accent: "rgba(201,137,43,.22)" },
      {
        label: "未上 / 其他",
        value: counts.missed + counts.other,
        sub: `待上 ${counts.planned}`,
        accent: "rgba(212,87,60,.18)",
      },
    ]
      .map(
        (s) => `<article class="stat-card" style="--accent:${s.accent}">
          <span class="label">${s.label}</span>
          <span class="value">${s.value}</span>
          <span class="sub">${s.sub}</span>
        </article>`
      )
      .join("");

    const parts = [
      ["done", counts.done],
      ["leave", counts.leave],
      ["missed", counts.missed],
      ["other", counts.other],
      ["planned", counts.planned],
    ];
    const denom = Math.max(1, total);
    els.statusBars.innerHTML = parts
      .map(
        ([k, n]) =>
          `<div class="bar-seg" style="width:${(n / denom) * 100}%;background:${STATUS[k].color}"></div>`
      )
      .join("");
    els.statusLegend.innerHTML = parts
      .map(([k, n]) => `<span><i class="dot" style="background:${STATUS[k].color}"></i>${STATUS[k].label} ${n}</span>`)
      .join("");

    const byTitle = new Map();
    for (const c of list) {
      const key = c.title || "未命名";
      if (!byTitle.has(key)) byTitle.set(key, { total: 0, done: 0 });
      const row = byTitle.get(key);
      row.total += 1;
      if (c.status === "done") row.done += 1;
    }
    const rows = [...byTitle.entries()].sort((a, b) => b[1].total - a[1].total);
    els.byCourseStats.innerHTML = rows.length
      ? rows
          .map(([name, row]) => {
            const pct = row.total ? (row.done / row.total) * 100 : 0;
            return `<div class="by-row">
              <span class="name">${escapeHtml(name)}</span>
              <div class="mini-bar"><i style="width:${pct}%"></i></div>
              <span class="nums">${row.done}/${row.total} 已上</span>
            </div>`;
          })
          .join("")
      : `<p class="subtle">这个周期还没有课程记录。</p>`;

    if (!packages.length) {
      els.packageGrid.innerHTML = `<div class="pkg-empty">还没有兴趣课。<br />点右上角「＋ 新增」登记总课时与费用。</div>`;
    } else {
      els.packageGrid.innerHTML = packages
        .map((pkg) => {
          const u = packageUsage(pkg);
          const deadline = pkg.deadline ? `目标 ${pkg.deadline.slice(5).replace("-", "/")} 前` : "未设截止日期";
          return `<button type="button" class="pkg-card" data-package-id="${pkg.id}" style="--pkg-color:${pkg.color}">
            <span class="stripe"></span>
            <h3>${escapeHtml(pkg.name)}</h3>
            <div class="child">${pkg.child ? escapeHtml(pkg.child) : "未指定孩子"}</div>
            <div class="pkg-metrics">
              <div><span class="k">已上 / 总课时</span><span class="v">${u.done}/${pkg.totalSessions}</span></div>
              <div><span class="k">剩余课时</span><span class="v">${u.remaining}</span></div>
              <div><span class="k">消耗费用</span><span class="v">¥${money(u.spent)}</span></div>
              <div><span class="k">单节约</span><span class="v">¥${money(u.unit)}</span></div>
            </div>
            <div class="progress"><i style="width:${u.progress}%"></i></div>
            <div class="pkg-foot"><span>${deadline}</span><span>总费用 ¥${money(pkg.totalFee)}</span></div>
            ${pkg.note ? `<p class="pkg-note">${escapeHtml(pkg.note)}</p>` : ""}
          </button>`;
        })
        .join("");
    }
  }

  function render() {
    renderCalendar();
    if (activeTab === "dashboard") renderDashboard();
  }

  function openCreate(dateKey) {
    editingId = null;
    activeColor = COLORS[0].value;
    els.dialogTitle.textContent = "记一节课";
    els.deleteCourse.hidden = true;
    els.courseForm.reset();
    fillPackageSelect("");
    els.courseForm.date.value = dateKey || selectedDay || toDateKey(new Date());
    els.courseForm.start.value = "10:00";
    els.courseForm.end.value = "11:00";
    els.courseForm.status.value = "planned";
    syncStatusNoteVisibility();
    renderSwatches(els.swatches, activeColor);
    els.courseDialog.showModal();
  }

  function openEdit(id) {
    const c = courses.find((x) => x.id === id);
    if (!c) return;
    editingId = id;
    activeColor = c.color;
    els.dialogTitle.textContent = "编辑课程";
    els.deleteCourse.hidden = false;
    fillPackageSelect(c.packageId || "");
    els.courseForm.title.value = c.title;
    els.courseForm.child.value = c.child || "";
    els.courseForm.date.value = c.date;
    els.courseForm.start.value = c.start;
    els.courseForm.end.value = c.end;
    els.courseForm.note.value = c.note || "";
    els.courseForm.status.value = c.status || "planned";
    els.courseForm.statusNote.value = c.statusNote || "";
    syncStatusNoteVisibility();
    renderSwatches(els.swatches, activeColor);
    els.courseDialog.showModal();
  }

  function openPackageCreate() {
    editingPackageId = null;
    packageColor = COLORS[0].value;
    els.packageDialogTitle.textContent = "新增兴趣课";
    els.deletePackage.hidden = true;
    els.packageForm.reset();
    els.packageForm.totalSessions.value = "24";
    els.packageForm.totalFee.value = "0";
    els.packageForm.spentFee.value = "";
    renderSwatches(els.packageSwatches, packageColor);
    els.packageDialog.showModal();
  }

  function openPackageEdit(id) {
    const pkg = packages.find((p) => p.id === id);
    if (!pkg) return;
    editingPackageId = id;
    packageColor = pkg.color;
    els.packageDialogTitle.textContent = "编辑兴趣课";
    els.deletePackage.hidden = false;
    els.packageForm.name.value = pkg.name;
    els.packageForm.child.value = pkg.child || "";
    els.packageForm.totalSessions.value = String(pkg.totalSessions);
    els.packageForm.totalFee.value = String(pkg.totalFee);
    els.packageForm.spentFee.value = pkg.spentFee == null ? "" : String(pkg.spentFee);
    els.packageForm.deadline.value = pkg.deadline || "";
    els.packageForm.note.value = pkg.note || "";
    renderSwatches(els.packageSwatches, packageColor);
    els.packageDialog.showModal();
  }

  function toggleSelect(id) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    renderCalendar();
  }

  function markSelected(status) {
    if (!selected.size) return;
    courses = courses.map((c) =>
      selected.has(c.id)
        ? { ...c, status, statusNote: status === "done" || status === "planned" ? "" : c.statusNote }
        : c
    );
    save();
    render();
    showToast(`已标记为「${STATUS[status].label}」`);
  }

  function renderPickedDates() {
    if (!pickedTargetDates.length) {
      els.pickedDates.innerHTML = `<li style="background:transparent;color:var(--ink-soft)">还没加入日期</li>`;
      return;
    }
    els.pickedDates.innerHTML = pickedTargetDates
      .map(
        (d) =>
          `<li>${formatShortDate(d)} <button type="button" data-remove-date="${d}" aria-label="移除">×</button></li>`
      )
      .join("");
  }

  function openCopyDialog() {
    if (!selected.size) return;
    const list = courses.filter((c) => selected.has(c.id));
    const preview = list
      .slice(0, 3)
      .map((c) => `${c.title}（${formatShortDate(c.date)} ${c.start}）`)
      .join("、");
    const more = list.length > 3 ? ` 等 ${list.length} 节` : `，共 ${list.length} 节`;
    els.copySummary.textContent = `将复制：${preview}${more}`;
    pickedTargetDates = [];
    els.pickDate.value = toDateKey(addDays(weekStart, 7));
    els.weekCount.value = "4";
    document.querySelector('input[name="copyMode"][value="dates"]').checked = true;
    els.datesMode.hidden = false;
    els.weeksMode.hidden = true;
    renderPickedDates();
    els.copyDialog.showModal();
  }

  function isConflict(candidate, existing) {
    return existing.some(
      (c) =>
        c.date === candidate.date &&
        c.title === candidate.title &&
        c.start === candidate.start &&
        c.end === candidate.end
    );
  }

  function doBatchCopy() {
    const source = courses.filter((c) => selected.has(c.id));
    if (!source.length) return false;
    const mode = document.querySelector('input[name="copyMode"]:checked').value;
    const skip = els.skipConflicts.checked;
    const created = [];
    const clone = (s, date) => ({ ...s, id: uid(), date, status: "planned", statusNote: "" });

    if (mode === "dates") {
      if (!pickedTargetDates.length) {
        showToast("请先加入至少一个目标日期");
        return false;
      }
      for (const targetDate of pickedTargetDates) {
        for (const s of source) {
          const next = clone(s, targetDate);
          if (skip && isConflict(next, [...courses, ...created])) continue;
          created.push(next);
        }
      }
    } else {
      const weeks = Math.min(12, Math.max(1, Number(els.weekCount.value) || 1));
      for (let w = 1; w <= weeks; w++) {
        for (const s of source) {
          const next = clone(s, toDateKey(addDays(parseDateKey(s.date), 7 * w)));
          if (skip && isConflict(next, [...courses, ...created])) continue;
          created.push(next);
        }
      }
    }

    courses = [...courses, ...created];
    save();
    selected.clear();
    render();
    showToast(created.length ? `已复制 ${created.length} 节课` : "没有可复制的新课程");
    return true;
  }

  // Events
  document.querySelectorAll(".tabbar .tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll(".period-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      statsDays = Number(btn.dataset.days);
      document.querySelectorAll(".period-btn").forEach((b) => b.classList.toggle("active", b === btn));
      renderDashboard();
    });
  });

  document.getElementById("prevWeek").addEventListener("click", () => {
    weekStart = addDays(weekStart, -7);
    selectedDay = toDateKey(weekStart);
    selected.clear();
    renderCalendar();
  });
  document.getElementById("nextWeek").addEventListener("click", () => {
    weekStart = addDays(weekStart, 7);
    selectedDay = toDateKey(weekStart);
    selected.clear();
    renderCalendar();
  });
  document.getElementById("btnToday").addEventListener("click", () => {
    weekStart = startOfWeek(new Date());
    selectedDay = toDateKey(new Date());
    selected.clear();
    switchTab("calendar");
    renderCalendar();
  });

  document.getElementById("btnAdd").addEventListener("click", () => {
    if (activeTab === "dashboard") openPackageCreate();
    else openCreate(selectedDay);
  });
  document.getElementById("btnAddDay").addEventListener("click", () => openCreate(selectedDay));
  document.getElementById("btnAddPackage").addEventListener("click", openPackageCreate);

  els.dayStrip.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-day]");
    if (!chip) return;
    selectedDay = chip.dataset.day;
    selected.clear();
    renderCalendar();
  });

  els.agenda.addEventListener("click", (e) => {
    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      e.preventDefault();
      toggleSelect(toggle.dataset.toggle);
      return;
    }
    const edit = e.target.closest("[data-edit]");
    if (edit) openEdit(edit.dataset.edit);
  });

  els.packageGrid.addEventListener("click", (e) => {
    const card = e.target.closest("[data-package-id]");
    if (card) openPackageEdit(card.dataset.packageId);
  });

  document.getElementById("btnEditSelected").addEventListener("click", () => {
    if (selected.size !== 1) return;
    openEdit([...selected][0]);
  });
  document.getElementById("btnMarkDone").addEventListener("click", () => markSelected("done"));
  document.getElementById("btnMarkLeave").addEventListener("click", () => markSelected("leave"));
  document.getElementById("btnSelectAllWeek").addEventListener("click", () => {
    courses.filter((c) => c.date === selectedDay).forEach((c) => selected.add(c.id));
    renderCalendar();
  });
  document.getElementById("btnClearSelect").addEventListener("click", () => {
    selected.clear();
    renderCalendar();
  });
  document.getElementById("btnBatchDelete").addEventListener("click", () => {
    if (!selected.size) return;
    if (!confirm(`确定删除选中的 ${selected.size} 节课？`)) return;
    courses = courses.filter((c) => !selected.has(c.id));
    selected.clear();
    save();
    render();
    showToast("已删除所选课程");
  });
  document.getElementById("btnBatchCopy").addEventListener("click", openCopyDialog);

  els.swatches.addEventListener("click", (e) => {
    const btn = e.target.closest(".swatch");
    if (!btn) return;
    activeColor = btn.dataset.color;
    renderSwatches(els.swatches, activeColor);
  });
  els.packageSwatches.addEventListener("click", (e) => {
    const btn = e.target.closest(".swatch");
    if (!btn) return;
    packageColor = btn.dataset.color;
    renderSwatches(els.packageSwatches, packageColor);
  });

  els.courseForm.status.addEventListener("change", syncStatusNoteVisibility);
  els.packageSelect.addEventListener("change", () => {
    const pkg = packages.find((p) => p.id === els.packageSelect.value);
    if (pkg && !els.courseForm.title.value.trim()) {
      els.courseForm.title.value = pkg.name;
      activeColor = pkg.color;
      renderSwatches(els.swatches, activeColor);
      if (pkg.child) els.courseForm.child.value = pkg.child;
    }
  });

  document.getElementById("closeDialog").addEventListener("click", () => els.courseDialog.close());
  document.getElementById("cancelDialog").addEventListener("click", () => els.courseDialog.close());
  document.getElementById("closePackage").addEventListener("click", () => els.packageDialog.close());
  document.getElementById("cancelPackage").addEventListener("click", () => els.packageDialog.close());

  els.deleteCourse.addEventListener("click", () => {
    if (!editingId) return;
    if (!confirm("删除这节课？")) return;
    courses = courses.filter((c) => c.id !== editingId);
    selected.delete(editingId);
    save();
    els.courseDialog.close();
    render();
    showToast("已删除");
  });

  els.deletePackage.addEventListener("click", () => {
    if (!editingPackageId) return;
    if (!confirm("删除此兴趣课？关联的单节课不会删除，只是取消关联。")) return;
    const id = editingPackageId;
    packages = packages.filter((p) => p.id !== id);
    courses = courses.map((c) => (c.packageId === id ? { ...c, packageId: "" } : c));
    save();
    els.packageDialog.close();
    render();
    showToast("已删除兴趣课");
  });

  els.courseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(els.courseForm);
    const title = String(fd.get("title") || "").trim();
    const child = String(fd.get("child") || "").trim();
    const date = String(fd.get("date") || "");
    const start = String(fd.get("start") || "");
    const end = String(fd.get("end") || "");
    const note = String(fd.get("note") || "").trim();
    const status = String(fd.get("status") || "planned");
    const statusNote = String(fd.get("statusNote") || "").trim();
    const packageId = String(fd.get("packageId") || "");

    if (!title || !date || !start || !end) return;
    if (timeToMinutes(end) <= timeToMinutes(start)) {
      showToast("结束时间需晚于开始时间");
      return;
    }

    const payload = {
      title,
      child,
      date,
      start,
      end,
      note,
      color: activeColor,
      status: STATUS[status] ? status : "planned",
      statusNote,
      packageId,
    };

    if (editingId) {
      courses = courses.map((c) => (c.id === editingId ? { ...c, ...payload } : c));
      showToast("已更新");
    } else {
      courses.push({ id: uid(), ...payload });
      showToast("已记下这节课");
    }
    weekStart = startOfWeek(parseDateKey(date));
    selectedDay = date;
    save();
    els.courseDialog.close();
    render();
  });

  els.packageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(els.packageForm);
    const name = String(fd.get("name") || "").trim();
    if (!name) return;
    const spentRaw = String(fd.get("spentFee") || "").trim();
    const payload = {
      name,
      child: String(fd.get("child") || "").trim(),
      totalSessions: Math.max(1, Number(fd.get("totalSessions")) || 1),
      totalFee: Math.max(0, Number(fd.get("totalFee")) || 0),
      spentFee: spentRaw === "" ? null : Math.max(0, Number(spentRaw) || 0),
      deadline: String(fd.get("deadline") || ""),
      note: String(fd.get("note") || "").trim(),
      color: packageColor,
    };

    if (editingPackageId) {
      packages = packages.map((p) => (p.id === editingPackageId ? { ...p, ...payload } : p));
      showToast("兴趣课已更新");
    } else {
      packages.push({ id: uid(), ...payload });
      showToast("已新增兴趣课");
    }
    save();
    els.packageDialog.close();
    render();
  });

  document.querySelectorAll('input[name="copyMode"]').forEach((r) => {
    r.addEventListener("change", () => {
      const mode = document.querySelector('input[name="copyMode"]:checked').value;
      els.datesMode.hidden = mode !== "dates";
      els.weeksMode.hidden = mode !== "weeks";
    });
  });

  document.getElementById("addPickDate").addEventListener("click", () => {
    const v = els.pickDate.value;
    if (!v) return;
    if (!pickedTargetDates.includes(v)) {
      pickedTargetDates.push(v);
      pickedTargetDates.sort();
      renderPickedDates();
    }
  });

  els.pickedDates.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-date]");
    if (!btn) return;
    pickedTargetDates = pickedTargetDates.filter((d) => d !== btn.dataset.removeDate);
    renderPickedDates();
  });

  document.getElementById("closeCopy").addEventListener("click", () => els.copyDialog.close());
  document.getElementById("cancelCopy").addEventListener("click", () => els.copyDialog.close());
  els.copyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (doBatchCopy()) els.copyDialog.close();
  });

  if (!courses.length && !packages.length && !localStorage.getItem(STORAGE_KEY + ":seen")) {
    localStorage.setItem(STORAGE_KEY + ":seen", "1");
    const pkgId = uid();
    packages = [
      {
        id: pkgId,
        name: "游泳课",
        child: "",
        totalSessions: 24,
        totalFee: 4800,
        spentFee: null,
        deadline: `${new Date().getFullYear()}-10-31`,
        note: "10月前完成",
        color: COLORS[0].value,
      },
    ];
    courses = [
      {
        id: uid(),
        title: "游泳课",
        child: "",
        date: selectedDay,
        start: "10:00",
        end: "11:00",
        note: "示例 · 可删可改",
        color: COLORS[0].value,
        status: "planned",
        statusNote: "",
        packageId: pkgId,
      },
    ];
    save();
  }

  render();
})();
