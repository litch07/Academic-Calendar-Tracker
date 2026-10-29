      // App State
      let completedClasses = new Set();
      let completedEvents = new Set();
      let completedExams = new Set();
      let userEvaluations = [];
      let makeupMeetingLinks = {};
      let currentFilter = "ALL";
      let currentEventFilter = "ALL";
      let currentEvalFilter = "ALL";
      let currentPage = "calendar";

      const STORAGE_KEY = "calendar_263_completed_classes_v1";
      const EVENTS_STORAGE_KEY = "calendar_263_completed_events_v1";
      const EVALS_STORAGE_KEY = "calendar_263_user_evaluations_v1";
      const EXAMS_STORAGE_KEY = "calendar_263_completed_exams_v1";
      const LINKS_STORAGE_KEY = "calendar_263_makeup_links_v1";

      function loadState() {
        try {
          const savedClasses = localStorage.getItem(STORAGE_KEY);
          if (savedClasses)
            completedClasses = new Set(JSON.parse(savedClasses));

          const savedEvents = localStorage.getItem(EVENTS_STORAGE_KEY);
          if (savedEvents) completedEvents = new Set(JSON.parse(savedEvents));

          const savedEvals = localStorage.getItem(EVALS_STORAGE_KEY);
          if (savedEvals) userEvaluations = JSON.parse(savedEvals);

          const savedExams = localStorage.getItem(EXAMS_STORAGE_KEY);
          if (savedExams) completedExams = new Set(JSON.parse(savedExams));

          const savedLinks = localStorage.getItem(LINKS_STORAGE_KEY);
          if (savedLinks) makeupMeetingLinks = JSON.parse(savedLinks);
        } catch (e) {
          console.error("Failed loading saved state:", e);
        }
      }

      function saveState() {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([...completedClasses]),
          );
          localStorage.setItem(
            EVENTS_STORAGE_KEY,
            JSON.stringify([...completedEvents]),
          );
          localStorage.setItem(
            EVALS_STORAGE_KEY,
            JSON.stringify(userEvaluations),
          );
          localStorage.setItem(
            EXAMS_STORAGE_KEY,
            JSON.stringify([...completedExams]),
          );
          localStorage.setItem(
            LINKS_STORAGE_KEY,
            JSON.stringify(makeupMeetingLinks),
          );
        } catch (e) {
          console.error("Failed saving state:", e);
        }
      }

      // Navigation Controller
      function switchPage(page) {
        currentPage = page;
        const pages = ["calendar", "dashboard", "events", "assessments"];
        pages.forEach((p) => {
          const el = document.getElementById(`page-${p}`);
          if (el) el.classList.add("hidden");
        });

        const activeEl = document.getElementById(`page-${page}`);
        if (activeEl) activeEl.classList.remove("hidden");

        if (page === "calendar") renderCalendar();
        else if (page === "dashboard") renderDashboard();
        else if (page === "assessments") renderEvaluations();
        else if (page === "events") renderEvents();

        updateNavigation();
      }

      function updateNavigation() {
        const navCal = document.getElementById("nav-calendar");
        const navDash = document.getElementById("nav-dashboard");
        const navEvt = document.getElementById("nav-events");
        const navEval = document.getElementById("nav-assessments");

        const inactiveStyle =
          "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 text-slate-600 hover:text-slate-900 hover:bg-white/50 whitespace-nowrap relative";
        const activeStyle =
          "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 bg-white text-brand-700 shadow-sm whitespace-nowrap relative";

        if (navCal)
          navCal.className =
            currentPage === "calendar" ? activeStyle : inactiveStyle;
        if (navDash)
          navDash.className =
            currentPage === "dashboard" ? activeStyle : inactiveStyle;
        if (navEval)
          navEval.className =
            currentPage === "assessments" ? activeStyle : inactiveStyle;
        if (navEvt)
          navEvt.className =
            currentPage === "events" ? activeStyle : inactiveStyle;
      }

      function toggleClass(id, event) {
        if (event) event.stopPropagation();
        if (completedClasses.has(id)) {
          completedClasses.delete(id);
        } else {
          completedClasses.add(id);
        }
        saveState();
        renderCalendar();
        renderDashboard();
      }

      function setFilter(filter) {
        currentFilter = filter;
        document.querySelectorAll(".filter-btn").forEach((btn) => {
          btn.className =
            "filter-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
        });
        const activeBtn = document.getElementById(`filter-${filter}`);
        if (activeBtn) {
          if (filter === "MAKEUP") {
            activeBtn.className =
              "filter-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-500 shadow-md shadow-amber-500/20";
          } else {
            activeBtn.className =
              "filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all bg-gradient-to-r from-brand-600 to-indigo-600 text-white border-brand-600 shadow-md shadow-brand-500/20";
          }
        }
        renderCalendar();
      }

      function renderCalendar() {
        const container = document.getElementById("calendar-container");
        if (!container) return;

        container.innerHTML = "";

        const months = ["OCT", "NOV", "DEC", "JAN"];
        const monthTitles = {
          OCT: "October 2026",
          NOV: "November 2026",
          DEC: "December 2026",
          JAN: "January 2027",
        };

        const monthThemeMap = {
          OCT: {
            cardBg:
              "bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-indigo-50/90 border-indigo-200/80",
            headerGrad:
              "from-indigo-600 via-indigo-700 to-purple-700 text-white",
          },
          NOV: {
            cardBg:
              "bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-amber-50/90 border-amber-200/80",
            headerGrad: "from-amber-600 via-orange-600 to-red-600 text-white",
          },
          DEC: {
            cardBg:
              "bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-emerald-50/90 border-emerald-200/80",
            headerGrad: "from-emerald-600 via-teal-700 to-cyan-700 text-white",
          },
          JAN: {
            cardBg:
              "bg-gradient-to-br from-blue-50/90 via-sky-50/50 to-blue-50/90 border-blue-200/80",
            headerGrad: "from-blue-600 via-sky-600 to-indigo-700 text-white",
          },
        };

        months.forEach((m) => {
          const monthClasses = ALL_CLASSES.filter((c) => c.month === m);
          const filteredClasses = monthClasses.filter((c) => {
            if (currentFilter === "ALL") return true;
            if (currentFilter === "MAKEUP") return c.isMakeup;
            return c.track === currentFilter;
          });

          if (filteredClasses.length === 0 && currentFilter !== "ALL") return;

          const theme = monthThemeMap[m];

          const monthSection = document.createElement("div");
          monthSection.className = `rounded-3xl border-2 shadow-sm p-5 space-y-4 ${theme.cardBg}`;

          const completedInMonth = monthClasses.filter((c) =>
            completedClasses.has(c.id),
          ).length;
          monthSection.innerHTML = `
                    <button onclick="toggleSection('month-sec-${m}')" class="w-full flex items-center justify-between bg-gradient-to-r ${theme.headerGrad} p-3.5 rounded-2xl shadow-sm cursor-pointer hover:opacity-95 transition-opacity">
                        <div class="flex items-center gap-2.5">
                            <i data-lucide="calendar" class="w-5 h-5 opacity-90"></i>
                            <h2 class="text-base font-extrabold tracking-wide">${monthTitles[m]}</h2>
                            <span class="text-[11px] font-bold bg-white/20 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full border border-white/30">${monthClasses.length} Scheduled</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-bold bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-xl border border-white/30">${completedInMonth} / ${monthClasses.length} Done</span>
                            <i id="month-sec-${m}-arrow" data-lucide="chevron-down" class="w-5 h-5 transform transition-transform"></i>
                        </div>
                    </button>
                    <div id="month-sec-${m}" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 transition-all">
                    </div>
                `;

          container.appendChild(monthSection);
          const grid = document.getElementById(`month-sec-${m}`);

          monthClasses.forEach((item) => {
            const isVisible = filteredClasses.some((fc) => fc.id === item.id);
            if (!isVisible) return;

            const isDone = completedClasses.has(item.id);
            const dayEvals = userEvaluations.filter(
              (e) => e.dateId === item.id,
            );
            const linkData = makeupMeetingLinks[item.id];

            const card = document.createElement("div");

            let borderStyle = isDone
              ? "border-emerald-500 bg-emerald-50/80 hover:bg-emerald-100 shadow-sm"
              : item.isMakeup
                ? "border-amber-300 bg-amber-50/60 hover:bg-amber-100/70"
                : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm";

            card.className = `relative flex flex-col justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none ${borderStyle}`;
            card.onclick = (e) => toggleClass(item.id, e);

            let trackBadgeClass = "bg-slate-100 text-slate-700";
            if (item.track === "SAT")
              trackBadgeClass = "bg-indigo-100 text-indigo-800";
            if (item.track === "SUN")
              trackBadgeClass = "bg-blue-100 text-blue-800";
            if (item.track === "TUE")
              trackBadgeClass = "bg-emerald-100 text-emerald-800";
            if (item.track === "WED")
              trackBadgeClass = "bg-purple-100 text-purple-800";

            let evalsHtml = "";
            if (dayEvals.length > 0) {
              evalsHtml = `<div class="mt-2 space-y-1" onclick="event.stopPropagation()">`;
              dayEvals.forEach((ev) => {
                let evBadge = "bg-rose-100 text-rose-800 border-rose-200";
                if (ev.type === "Presentation")
                  evBadge = "bg-indigo-100 text-indigo-800 border-indigo-200";
                if (ev.type === "Assignment Deadline")
                  evBadge = "bg-cyan-100 text-cyan-800 border-cyan-200";
                if (ev.type === "Update")
                  evBadge = "bg-amber-100 text-amber-800 border-amber-200";

                evalsHtml += `
                                <div class="p-1.5 rounded-lg border text-[10px] ${evBadge} ${ev.done ? "line-through opacity-60" : "font-semibold"} flex items-center justify-between gap-1">
                                    <div class="truncate">
                                        <span class="font-extrabold uppercase mr-0.5">${ev.code}:</span>
                                        <span>${ev.desc}</span>
                                    </div>
                                    <button onclick="deleteEvaluation('${ev.id}', event)" class="text-slate-400 hover:text-rose-600 shrink-0">
                                        &times;
                                    </button>
                                </div>
                            `;
              });
              evalsHtml += `</div>`;
            }

            let meetingLinkHtml = "";
            if (item.isMakeup) {
              if (linkData && linkData.url) {
                const aliasText = linkData.alias || "Join Meeting";
                meetingLinkHtml = `
                                <div class="mt-2" onclick="event.stopPropagation()">
                                    <a href="${linkData.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 w-full justify-center text-[10px] font-bold text-amber-800 bg-amber-200 hover:bg-amber-300 px-2 py-0.5 rounded border border-amber-300 transition-colors truncate" title="${linkData.url}">
                                        <i data-lucide="video" class="w-3 h-3 text-amber-700 shrink-0"></i>
                                        <span class="truncate">${aliasText}</span>
                                        <i data-lucide="external-link" class="w-2.5 h-2.5 text-amber-700 shrink-0"></i>
                                    </a>
                                </div>
                            `;
              } else {
                meetingLinkHtml = `
                                <div class="mt-2" onclick="event.stopPropagation()">
                                    <button onclick="openMeetingModal('${item.id}', '${item.month} ${item.dayNum}', event)" class="inline-flex items-center gap-1 w-full justify-center text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded border border-amber-300 transition-colors">
                                        <i data-lucide="link" class="w-3 h-3"></i> + Add Link
                                    </button>
                                </div>
                            `;
              }
            }

            card.innerHTML = `
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-extrabold ${isDone ? "text-emerald-900" : "text-slate-900"}">${item.month} ${item.dayNum}</span>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${trackBadgeClass}">${item.dayName}</span>
                            </div>

                            <div class="space-y-1">
                                <span class="text-xs ${isDone ? "text-emerald-700" : "text-slate-500"} font-medium block">Track: <strong class="${isDone ? "text-emerald-900" : "text-slate-800"}">${item.track}</strong> (#${item.classNo})</span>
                                ${
                                  item.isMakeup
                                    ? `<div class="flex items-center justify-between">
                                        <span class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                                            <i data-lucide="video" class="w-3 h-3"></i> Online Makeup
                                        </span>
                                        ${linkData && linkData.url ? `<button onclick="openMeetingModal('${item.id}', '${item.month} ${item.dayNum}', event)" class="text-[10px] font-bold text-amber-700 hover:text-amber-900" title="Edit Link"><i data-lucide="edit-3" class="w-3 h-3"></i></button>` : ""}
                                       </div>`
                                    : `<span class="text-[10px] ${isDone ? "text-emerald-600" : "text-slate-400"}">Regular Class</span>`
                                }
                            </div>

                            ${meetingLinkHtml}
                            ${evalsHtml}
                        </div>

                        <div class="mt-3 pt-2 border-t ${isDone ? "border-emerald-200" : "border-slate-100"} flex items-center justify-between">
                            <button onclick="openEvalModal('${item.id}', '${item.month} ${item.dayNum}, 2026', event)" class="text-[10px] font-bold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded transition-colors flex items-center gap-0.5">
                                <i data-lucide="plus" class="w-3 h-3"></i> Eval
                            </button>
                            <div onclick="toggleClass('${item.id}', event)" class="w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${isDone ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 bg-white"}">
                                ${isDone ? '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>' : ""}
                            </div>
                        </div>
                    `;

            grid.appendChild(card);
          });
        });

        const completedCount = completedClasses.size;
        const qComp = document.getElementById("quick-completed-count");
        const qRem = document.getElementById("quick-remaining-count");
        if (qComp) qComp.innerText = completedCount;
        if (qRem) qRem.innerText = 48 - completedCount;

        lucide.createIcons();
      }

      function renderDashboard() {
        const total = 48;
        const done = completedClasses.size;
        const remaining = total - done;
        const percentage = Math.round((done / total) * 100);

        const ring = document.getElementById("overall-ring");
        if (ring) ring.setAttribute("stroke-dasharray", `${percentage}, 100`);

        const oPct = document.getElementById("overall-percentage");
        const dComp = document.getElementById("dash-completed-total");
        const dRem = document.getElementById("dash-remaining-desc");
        if (oPct) oPct.innerText = `${percentage}%`;
        if (dComp) dComp.innerText = done;
        if (dRem)
          dRem.innerText = `${remaining} classes remaining for full credit.`;

        const regularClasses = ALL_CLASSES.filter((c) => !c.isMakeup);
        const makeupClasses = ALL_CLASSES.filter((c) => c.isMakeup);

        const regDone = regularClasses.filter((c) =>
          completedClasses.has(c.id),
        ).length;
        const makeupDone = makeupClasses.filter((c) =>
          completedClasses.has(c.id),
        ).length;

        const rLbl = document.getElementById("reg-count-label");
        const rBar = document.getElementById("reg-progress-bar");
        const mLbl = document.getElementById("makeup-count-label");
        const mBar = document.getElementById("makeup-progress-bar");

        if (rLbl) rLbl.innerText = `${regDone}/43`;
        if (rBar) rBar.style.width = `${(regDone / 43) * 100}%`;
        if (mLbl) mLbl.innerText = `${makeupDone}/5`;
        if (mBar) mBar.style.width = `${(makeupDone / 5) * 100}%`;

        let testCnt = 0,
          presCnt = 0,
          assignCnt = 0,
          updCnt = 0;
        userEvaluations.forEach((ev) => {
          if (ev.type === "Class Test") testCnt++;
          if (ev.type === "Presentation") presCnt++;
          if (ev.type === "Assignment Deadline") assignCnt++;
          if (ev.type === "Update") updCnt++;
        });

        const sTest = document.getElementById("sum-tests-count");
        const sPres = document.getElementById("sum-pres-count");
        const sAssign = document.getElementById("sum-assign-count");
        const sUpd = document.getElementById("sum-upd-count");

        if (sTest) sTest.innerText = testCnt;
        if (sPres) sPres.innerText = presCnt;
        if (sAssign) sAssign.innerText = assignCnt;
        if (sUpd) sUpd.innerText = updCnt;

        const tracks = ["SAT", "SUN", "TUE", "WED"];
        const trackGrid = document.getElementById("track-cards-grid");
        if (trackGrid) {
          trackGrid.innerHTML = "";
          tracks.forEach((t) => {
            const trackClasses = ALL_CLASSES.filter((c) => c.track === t);
            const trackDone = trackClasses.filter((c) =>
              completedClasses.has(c.id),
            ).length;
            const trackPct = Math.round((trackDone / 12) * 100);

            const card = document.createElement("div");
            card.className =
              "bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4";
            card.innerHTML = `
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-xs font-bold uppercase tracking-wider text-slate-400">${t} Track</span>
                                <span class="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">${trackDone} / 12</span>
                            </div>
                            <h3 class="text-xl font-extrabold text-slate-900">${t} Track</h3>
                            <p class="text-xs text-slate-500 mt-0.5">${12 - trackDone} classes remaining</p>
                        </div>

                        <div class="space-y-2">
                            <div class="flex justify-between text-xs font-semibold">
                                <span class="text-slate-500">Progress</span>
                                <span class="text-slate-900 font-bold">${trackPct}%</span>
                            </div>
                            <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <div class="h-full bg-brand-600 rounded-full transition-all duration-500" style="width: ${trackPct}%"></div>
                            </div>
                        </div>

                        <div class="grid grid-cols-6 gap-1.5 pt-2 border-t border-slate-100">
                            ${trackClasses
                              .map((c) => {
                                const isC = completedClasses.has(c.id);
                                return `
                                    <div title="${c.month} ${c.dayNum} (${c.dayName}) - ${isC ? "Completed" : "Pending"}" 
                                         class="h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${isC ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400 border border-slate-200"}">
                                        ${c.classNo}
                                    </div>
                                `;
                              })
                              .join("")}
                        </div>
                    `;
            trackGrid.appendChild(card);
          });
        }

        const timeline = document.getElementById("schedule-timeline");
        if (timeline) {
          timeline.innerHTML = "";
          ALL_CLASSES.forEach((c) => {
            const isDone = completedClasses.has(c.id);
            const item = document.createElement("div");
            item.className = `flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${isDone ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`;
            item.innerHTML = `
                        <div class="flex items-center gap-3">
                            <span class="font-bold text-slate-900 w-16">${c.month} ${c.dayNum}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-slate-200 text-slate-700">${c.dayName}</span>
                            <span class="text-slate-600 font-medium">Track: <strong class="text-slate-800">${c.track}</strong> (#${c.classNo})</span>
                        </div>
                        <div class="flex items-center gap-2">
                            ${c.isMakeup ? '<span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">Makeup</span>' : ""}
                            <span class="font-semibold ${isDone ? "text-emerald-600" : "text-slate-400"}">
                                ${isDone ? "Done" : "Pending"}
                            </span>
                        </div>
                    `;
            timeline.appendChild(item);
          });
        }

        const makeupList = document.getElementById("makeup-schedule-list");
        if (makeupList) {
          makeupList.innerHTML = "";
          makeupClasses.forEach((c) => {
            const isDone = completedClasses.has(c.id);
            const item = document.createElement("div");
            item.className = `p-3 rounded-xl border flex items-center justify-between ${isDone ? "bg-emerald-50 border-emerald-200" : "bg-amber-50/50 border-amber-200"}`;
            item.innerHTML = `
                        <div class="flex items-center gap-3">
                            <div class="p-2 rounded-lg bg-amber-100 text-amber-700">
                                <i data-lucide="video" class="w-4 h-4"></i>
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h4 class="font-bold text-xs text-slate-900">${c.month} ${c.dayNum} (${c.dayName})</h4>
                                    <span class="text-[10px] font-bold px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded">For ${c.makeupFor} Track</span>
                                </div>
                                <p class="text-[11px] text-slate-500 mt-0.5">Counts as ${c.makeupFor} Class #${c.classNo}</p>
                            </div>
                        </div>
                        <button onclick="toggleClass('${c.id}', event)" class="px-3 py-1.5 rounded-lg text-xs font-semibold ${isDone ? "bg-emerald-600 text-white" : "bg-white border border-amber-300 text-amber-800 hover:bg-amber-100"} transition-colors">
                            ${isDone ? "Completed" : "Mark Done"}
                        </button>
                    `;
            makeupList.appendChild(item);
          });
        }

        lucide.createIcons();
      }

      function openEvalModal(dateId, dateDisplay, event) {
        if (event) event.stopPropagation();
        const classObj = ALL_CLASSES.find((c) => c.id === dateId);

        const dId = document.getElementById("eval-date-id");
        const dStr = document.getElementById("eval-date-str");
        const dDisp = document.getElementById("eval-date-display");
        const modal = document.getElementById("eval-modal");

        if (dId) dId.value = dateId;
        if (dStr) dStr.value = classObj ? classObj.dateStr : "2026-10-27";
        if (dDisp) dDisp.value = dateDisplay;
        if (modal) modal.classList.remove("hidden");
      }

      function closeEvalModal() {
        const modal = document.getElementById("eval-modal");
        const form = document.getElementById("eval-form");
        if (modal) modal.classList.add("hidden");
        if (form) form.reset();
      }

      function saveEvaluation(e) {
        e.preventDefault();
        const dateId = document.getElementById("eval-date-id").value;
        const dateStr = document.getElementById("eval-date-str").value;
        const code = document
          .getElementById("eval-code")
          .value.trim()
          .toUpperCase();
        const title = document.getElementById("eval-course-title").value.trim();
        const type = document.getElementById("eval-type").value;
        const desc = document.getElementById("eval-desc").value.trim();

        const newEval = {
          id: "eval-" + Date.now(),
          dateId,
          dateStr,
          code,
          title,
          type,
          desc,
          done: false,
        };

        userEvaluations.push(newEval);
        saveState();
        closeEvalModal();
        renderCalendar();
        renderEvaluations();
        renderDashboard();
      }

      function openMeetingModal(tileId, dateDisplay, event) {
        if (event) event.stopPropagation();
        const mId = document.getElementById("meeting-tile-id");
        const mDisp = document.getElementById("meeting-tile-display");
        const mUrl = document.getElementById("meeting-url");
        const mAlias = document.getElementById("meeting-alias");
        const btnRemove = document.getElementById("btn-remove-link");
        const modal = document.getElementById("meeting-modal");

        if (mId) mId.value = tileId;
        if (mDisp) mDisp.value = dateDisplay;

        const existing = makeupMeetingLinks[tileId];
        if (existing) {
          if (mUrl) mUrl.value = existing.url || "";
          if (mAlias) mAlias.value = existing.alias || "";
          if (btnRemove) btnRemove.classList.remove("hidden");
        } else {
          if (mUrl) mUrl.value = "";
          if (mAlias) mAlias.value = "";
          if (btnRemove) btnRemove.classList.add("hidden");
        }

        if (modal) modal.classList.remove("hidden");
      }

      function closeMeetingModal() {
        const modal = document.getElementById("meeting-modal");
        const form = document.getElementById("meeting-form");
        if (modal) modal.classList.add("hidden");
        if (form) form.reset();
      }

      function saveMeetingLink(e) {
        e.preventDefault();
        const tileId = document.getElementById("meeting-tile-id").value;
        const url = document.getElementById("meeting-url").value.trim();
        const alias = document.getElementById("meeting-alias").value.trim();

        if (url) {
          makeupMeetingLinks[tileId] = { url, alias };
          saveState();
          renderCalendar();
        }
        closeMeetingModal();
      }

      function removeMeetingLink() {
        const tileId = document.getElementById("meeting-tile-id").value;
        if (makeupMeetingLinks[tileId]) {
          delete makeupMeetingLinks[tileId];
          saveState();
          renderCalendar();
        }
        closeMeetingModal();
      }

      function toggleEvalDone(id) {
        const ev = userEvaluations.find((e) => e.id === id);
        if (ev) {
          ev.done = !ev.done;
          saveState();
          renderEvaluations();
          renderCalendar();
        }
      }

      function toggleExamDone(id) {
        if (completedExams.has(id)) {
          completedExams.delete(id);
        } else {
          completedExams.add(id);
        }
        saveState();
        renderEvaluations();
      }

      function deleteEvaluation(id, event) {
        if (event) event.stopPropagation();
        userEvaluations = userEvaluations.filter((e) => e.id !== id);
        saveState();
        renderCalendar();
        renderEvaluations();
        renderDashboard();
      }

      function filterEvaluations(type) {
        currentEvalFilter = type;
        document.querySelectorAll(".eval-f-btn").forEach((btn) => {
          btn.className =
            "eval-f-btn px-3 py-1.5 rounded-lg text-xs font-medium border transition-all bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
        });

        let btnId = "eval-filter-ALL";
        if (type === "Class Test") btnId = "eval-filter-Test";
        if (type === "Presentation") btnId = "eval-filter-Pres";
        if (type === "Assignment Deadline") btnId = "eval-filter-Assign";
        if (type === "Update") btnId = "eval-filter-Upd";

        const activeBtn = document.getElementById(btnId);
        if (activeBtn) {
          activeBtn.className =
            "eval-f-btn px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all bg-slate-800 text-white border-slate-800 shadow-sm";
        }
        renderEvaluations();
      }

      function toggleSection(secId) {
        const sec = document.getElementById(secId);
        const arrow = document.getElementById(secId + "-arrow");
        if (sec) {
          sec.classList.toggle("hidden");
          if (arrow) arrow.classList.toggle("rotate-180");
        }
      }

      function renderEvaluations() {
        const container = document.getElementById("evaluations-list");
        const midContainer = document.getElementById("midterm-exam-list");
        const finalContainer = document.getElementById("final-exam-list");

        const today = new Date("2026-10-27");

        if (midContainer) {
          midContainer.innerHTML = "";
          MIDTERM_DAYS.forEach((d) => {
            const isDone = completedExams.has(d.id);
            const targetDate = new Date(d.dateStr);
            const diffDays = Math.ceil(
              (targetDate - today) / (1000 * 60 * 60 * 24),
            );

            let urgencyClass =
              diffDays < 7
                ? "bg-rose-100 text-rose-800 border-rose-300"
                : diffDays <= 14
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-emerald-100 text-emerald-800 border-emerald-300";
            let urgencyBadge =
              diffDays < 7
                ? `${diffDays <= 0 ? "Passed" : diffDays + " Days"} (Very Important)`
                : diffDays <= 14
                  ? `${diffDays} Days (Prepare)`
                  : `${diffDays} Days (Plan)`;

            const item = document.createElement("div");
            item.className = `p-3 rounded-xl border flex items-center justify-between text-xs ${isDone ? "bg-emerald-50 border-emerald-300 opacity-60" : "bg-white border-slate-200"}`;
            item.innerHTML = `
                        <div class="flex items-center gap-3">
                            <span class="font-bold text-slate-800">Day ${d.dayNo}: ${d.display}</span>
                            <span class="px-2 py-0.5 rounded border text-[10px] font-bold ${urgencyClass}">${urgencyBadge}</span>
                        </div>
                        <button onclick="toggleExamDone('${d.id}')" class="px-3 py-1 rounded-lg text-[11px] font-semibold ${isDone ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}">
                            ${isDone ? "Completed" : "Mark Done"}
                        </button>
                    `;
            midContainer.appendChild(item);
          });
        }

        if (finalContainer) {
          finalContainer.innerHTML = "";
          FINAL_DAYS.forEach((d) => {
            const isDone = completedExams.has(d.id);
            const targetDate = new Date(d.dateStr);
            const diffDays = Math.ceil(
              (targetDate - today) / (1000 * 60 * 60 * 24),
            );

            let urgencyClass =
              diffDays < 7
                ? "bg-rose-100 text-rose-800 border-rose-300"
                : diffDays <= 14
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-emerald-100 text-emerald-800 border-emerald-300";
            let urgencyBadge =
              diffDays < 7
                ? `${diffDays <= 0 ? "Passed" : diffDays + " Days"} (Very Important)`
                : diffDays <= 14
                  ? `${diffDays} Days (Prepare)`
                  : `${diffDays} Days (Plan)`;

            const item = document.createElement("div");
            item.className = `p-3 rounded-xl border flex items-center justify-between text-xs ${isDone ? "bg-emerald-50 border-emerald-300 opacity-60" : "bg-white border-slate-200"}`;
            item.innerHTML = `
                        <div class="flex items-center gap-3">
                            <span class="font-bold text-slate-800">Day ${d.dayNo}: ${d.display}</span>
                            <span class="px-2 py-0.5 rounded border text-[10px] font-bold ${urgencyClass}">${urgencyBadge}</span>
                        </div>
                        <button onclick="toggleExamDone('${d.id}')" class="px-3 py-1 rounded-lg text-[11px] font-semibold ${isDone ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}">
                            ${isDone ? "Completed" : "Mark Done"}
                        </button>
                    `;
            finalContainer.appendChild(item);
          });
        }

        if (!container) return;
        container.innerHTML = "";

        let filtered = userEvaluations;
        if (currentEvalFilter !== "ALL") {
          filtered = userEvaluations.filter(
            (e) => e.type === currentEvalFilter,
          );
        }

        const pendingCount = userEvaluations.filter((e) => !e.done).length;
        const navBadge = document.getElementById("nav-eval-badge");
        if (navBadge) {
          if (pendingCount > 0) {
            navBadge.innerText = pendingCount;
            navBadge.classList.remove("hidden");
          } else {
            navBadge.classList.add("hidden");
          }
        }

        if (filtered.length === 0) {
          container.innerHTML = `
                    <div class="bg-white p-8 text-center rounded-2xl border border-slate-200 shadow-sm">
                        <div class="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-2">
                            <i data-lucide="pen-tool" class="w-5 h-5"></i>
                        </div>
                        <h3 class="text-xs font-bold text-slate-800">No Custom Assessments Added</h3>
                        <p class="text-[11px] text-slate-500 max-w-sm mx-auto mt-0.5">
                            Click <strong>+ Eval</strong> on any calendar tile to schedule custom class tests, presentations, or lab tasks.
                        </p>
                    </div>
                `;
          lucide.createIcons();
          return;
        }

        filtered
          .sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr))
          .forEach((ev) => {
            const isDone = ev.done;
            const targetDate = new Date(ev.dateStr);
            const diffTime = targetDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let urgencyBadge = "";
            let urgencyClass = "";

            if (diffDays < 7) {
              urgencyClass = "bg-rose-100 text-rose-800 border-rose-300";
              urgencyBadge = `${diffDays <= 0 ? "Today / Passed" : diffDays + " Days Left"} (Very Important)`;
            } else if (diffDays <= 14) {
              urgencyClass = "bg-amber-100 text-amber-800 border-amber-300";
              urgencyBadge = `${diffDays} Days Left (Prepare)`;
            } else {
              urgencyClass =
                "bg-emerald-100 text-emerald-800 border-emerald-300";
              urgencyBadge = `${diffDays} Days Left (Plan)`;
            }

            let typeBadge = "bg-rose-50 text-rose-700 border-rose-200";
            let iconName = "file-text";
            let iconBg =
              "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-sm shadow-rose-500/30";

            if (ev.type === "Presentation") {
              typeBadge = "bg-indigo-50 text-indigo-700 border-indigo-200";
              iconName = "presentation";
              iconBg =
                "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm shadow-indigo-500/30";
            } else if (ev.type === "Assignment Deadline") {
              typeBadge = "bg-cyan-50 text-cyan-700 border-cyan-200";
              iconName = "clipboard";
              iconBg =
                "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/30";
            } else if (ev.type === "Update") {
              typeBadge = "bg-amber-50 text-amber-700 border-amber-200";
              iconName = "alert-circle";
              iconBg =
                "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm shadow-amber-500/30";
            }

            const item = document.createElement("div");
            item.className = `p-4 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none ${
              isDone
                ? "bg-emerald-50/60 border-emerald-400 opacity-70"
                : "bg-white border-slate-200 hover:border-brand-300 shadow-sm"
            }`;

            item.onclick = () => toggleEvalDone(ev.id);

            item.innerHTML = `
                    <div class="flex items-start gap-3.5">
                        <div class="p-2.5 rounded-xl ${isDone ? "bg-emerald-600 text-white" : iconBg} shrink-0 mt-0.5 sm:mt-0">
                            <i data-lucide="${iconName}" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <div class="flex flex-wrap items-center gap-2 mb-1">
                                <span class="text-xs font-extrabold ${isDone ? "text-emerald-950" : "text-slate-900"}">${ev.code}</span>
                                ${ev.title ? `<span class="text-xs text-slate-500 font-medium">— ${ev.title}</span>` : ""}
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-md border ${typeBadge}">${ev.type}</span>
                            </div>
                            <h3 class="text-sm font-bold ${isDone ? "text-emerald-900 line-through" : "text-slate-900"}">${ev.desc}</h3>
                            <p class="text-xs text-slate-500 mt-0.5">Scheduled Date: <strong>${ev.dateStr}</strong></p>
                        </div>
                    </div>

                    <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0" onclick="event.stopPropagation()">
                        <span class="px-2.5 py-1 rounded-xl border text-xs font-bold ${urgencyClass}">
                            ${urgencyBadge}
                        </span>

                        <div class="flex items-center gap-2">
                            <button onclick="toggleEvalDone('${ev.id}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold ${isDone ? "bg-emerald-600 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"} transition-colors">
                                ${isDone ? "Done" : "Mark Done"}
                            </button>
                            <button onclick="deleteEvaluation('${ev.id}', event)" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                `;

            container.appendChild(item);
          });

        lucide.createIcons();
      }

      function toggleEvent(id) {
        if (completedEvents.has(id)) {
          completedEvents.delete(id);
        } else {
          completedEvents.add(id);
        }
        saveState();
        renderEvents();
      }

      function setEventFilter(filter) {
        currentEventFilter = filter;
        document.querySelectorAll(".event-filter-btn").forEach((btn) => {
          btn.className =
            "event-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
        });
        const activeBtn = document.getElementById(`event-filter-${filter}`);
        if (activeBtn) {
          activeBtn.className =
            "event-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all bg-brand-600 text-white border-brand-600 shadow-sm";
        }
        renderEvents();
      }

      function renderEvents() {
        const container = document.getElementById("events-container");
        if (!container) return;

        container.innerHTML = "";

        const filtered = ACADEMIC_EVENTS.filter((evt) => {
          if (currentEventFilter === "ALL") return true;
          return evt.category === currentEventFilter;
        });

        filtered.forEach((evt) => {
          const isDone = completedEvents.has(evt.id);
          const item = document.createElement("div");

          let catBadge = "bg-slate-100 text-slate-700 border-slate-200";
          let iconName = "calendar";
          let iconBg =
            "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm shadow-indigo-500/30";

          if (evt.category === "EXAM") {
            catBadge = "bg-rose-100 text-rose-800 border-rose-200";
            iconName = "file-text";
            iconBg =
              "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-sm shadow-rose-500/30";
          } else if (evt.category === "PAYMENT") {
            catBadge = "bg-emerald-100 text-emerald-800 border-emerald-200";
            iconName = "credit-card";
            iconBg =
              "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/30";
          } else if (evt.category === "HOLIDAY") {
            catBadge = "bg-amber-100 text-amber-800 border-amber-200";
            iconName = "sun";
            iconBg =
              "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm shadow-amber-500/30";
          } else if (evt.category === "ACADEMIC") {
            catBadge = "bg-indigo-100 text-indigo-800 border-indigo-200";
            iconName = "clock";
            iconBg =
              "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-500/30";
          }

          item.className = `p-4 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none ${
            isDone
              ? "bg-emerald-50/80 border-emerald-500 shadow-sm"
              : "bg-white border-slate-200 hover:border-brand-300"
          }`;

          item.onclick = () => toggleEvent(evt.id);

          item.innerHTML = `
                    <div class="flex items-start gap-3.5">
                        <div class="p-2.5 rounded-xl ${isDone ? "bg-emerald-600 text-white" : iconBg} shrink-0 mt-0.5 sm:mt-0">
                            <i data-lucide="${iconName}" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <div class="flex flex-wrap items-center gap-2 mb-1">
                                <span class="text-xs font-extrabold ${isDone ? "text-emerald-950" : "text-slate-900"}">${evt.dateDisplay} (${evt.dayName})</span>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-md border ${catBadge}">${evt.category}</span>
                            </div>
                            <h3 class="text-sm font-bold ${isDone ? "text-emerald-900 line-through" : "text-slate-900"}">${evt.title}</h3>
                            <p class="text-xs ${isDone ? "text-emerald-700" : "text-slate-500"} mt-0.5">${evt.note}</p>
                        </div>
                    </div>

                    <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                        <span class="text-xs font-bold ${isDone ? "text-emerald-700" : "text-slate-400"}">
                            ${isDone ? "Completed" : "Mark Done"}
                        </span>
                        <div class="w-6 h-6 rounded-lg border flex items-center justify-center transition-colors ${isDone ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 bg-white"}">
                            ${isDone ? '<i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>' : ""}
                        </div>
                    </div>
                `;

          container.appendChild(item);
        });

        const totalEvents = ACADEMIC_EVENTS.length;
        const completedCount = completedEvents.size;

        const eComp = document.getElementById("events-completed-count");
        const eRem = document.getElementById("events-remaining-count");

        if (eComp) eComp.innerText = completedCount;
        if (eRem) eRem.innerText = totalEvents - completedCount;

        lucide.createIcons();
      }

      function openResetModal() {
        const modal = document.getElementById("reset-modal");
        if (modal) modal.classList.remove("hidden");
      }

      function closeResetModal() {
        const modal = document.getElementById("reset-modal");
        if (modal) modal.classList.add("hidden");
      }

      function confirmReset() {
        completedClasses.clear();
        completedEvents.clear();
        completedExams.clear();
        userEvaluations = [];
        makeupMeetingLinks = {};
        saveState();
        renderCalendar();
        renderDashboard();
        renderEvaluations();
        renderEvents();
        closeResetModal();
      }

      // Initialize App on DOM Ready
      window.addEventListener("DOMContentLoaded", () => {
        loadState();
        renderCalendar();
        renderDashboard();
        renderEvaluations();
        renderEvents();
        updateNavigation();
        lucide.createIcons();
      });