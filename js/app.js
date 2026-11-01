// ─── Date Engine ─────────────────────────────────────────────────────────
function formatLocalDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Returns today as YYYY-MM-DD string using local time (no timezone shift)
function getTodayStr() {
  return formatLocalDate(new Date());
}

function formatHumanDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function parseEventDate(dateDisplay) {
  if (!dateDisplay) return null;
  if (dateDisplay.includes("–")) {
    const parts = dateDisplay.split("–");
    const startStr = parts[0].trim();
    const endStr = parts[1].trim();
    const year = endStr.split(",")[1]?.trim() || "2026";
    const d = new Date(`${startStr}, ${year}`);
    if (!isNaN(d.getTime())) return formatLocalDate(d);
  } else {
    const d = new Date(dateDisplay);
    if (!isNaN(d.getTime())) return formatLocalDate(d);
  }
  return null;
}

// Returns "PAST", "TODAY", or "FUTURE" for a given dateStr
function getTemporalState(dateStr) {
  const today = getTodayStr();
  if (dateStr < today) return "PAST";
  if (dateStr === today) return "TODAY";
  return "FUTURE";
}
// ─────────────────────────────────────────────────────────────────────────

      // App State
      let completedClasses = new Set();
      let unmarkedClasses = new Set();
      let completedEvents = new Set();
      let completedExams = new Set();
      let userEvaluations = [];
      let makeupMeetingLinks = {};
      let currentFilter = "ALL";
      let currentEventFilter = "ALL";
      let currentEvalFilter = "ALL";
      let currentPage = "home";
      let userMonthToggles = {}; // Tracks manual user expand/collapse per month

      const STORAGE_KEY = "calendar_263_completed_classes_v1";
      const UNMARKED_STORAGE_KEY = "calendar_263_unmarked_classes_v1";
      const EVENTS_STORAGE_KEY = "calendar_263_completed_events_v1";
      const EVALS_STORAGE_KEY = "calendar_263_user_evaluations_v1";
      const EXAMS_STORAGE_KEY = "calendar_263_completed_exams_v1";
      const LINKS_STORAGE_KEY = "calendar_263_makeup_links_v1";
      const SYNC_CODE_KEY = "calendar_263_sync_code_v1";

      const firebaseConfig = {
        databaseURL:
          "https://academic-calendar-tracker-default-rtdb.asia-southeast1.firebasedatabase.app/",
      };

      let db = null;
      try {
        if (typeof firebase !== "undefined") {
          firebase.initializeApp(firebaseConfig);
          db = firebase.database();
        }
      } catch (e) {
        console.warn("Firebase initialization skipped or failed:", e);
      }

      let syncRef = null;
      let syncCode = "";
      let isRemoteUpdating = false;

      function loadState() {
        try {
          const savedClasses = localStorage.getItem(STORAGE_KEY);
          if (savedClasses)
            completedClasses = new Set(JSON.parse(savedClasses));

          const savedUnmarked = localStorage.getItem(UNMARKED_STORAGE_KEY);
          if (savedUnmarked)
            unmarkedClasses = new Set(JSON.parse(savedUnmarked));

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
          // 1. Local Storage fallback
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([...completedClasses]),
          );
          localStorage.setItem(
            UNMARKED_STORAGE_KEY,
            JSON.stringify([...unmarkedClasses]),
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

          // 2. Firebase Database Sync
          if (db && syncCode && !isRemoteUpdating) {
            const syncPayload = {
              completedClasses: [...completedClasses],
              completedEvents: [...completedEvents],
              completedExams: [...completedExams],
              userEvaluations: userEvaluations,
              makeupMeetingLinks: makeupMeetingLinks,
              lastUpdated: Date.now(),
            };

            db.ref("UIU_Calendar_263/sync_sessions/" + syncCode).set(
              syncPayload,
              (error) => {
                if (error) {
                  console.error("Failed saving to cloud sync database:", error);
                }
              },
            );
          }
        } catch (e) {
          console.error("Failed saving state:", e);
        }
      }

      // Responsive Brand Header Home Controller
      function navigateToHome(event) {
        if (event) {
          if (typeof event.preventDefault === "function") event.preventDefault();
          if (typeof event.stopPropagation === "function") event.stopPropagation();
        }
        const evalModal = document.getElementById("eval-modal");
        if (evalModal && !evalModal.classList.contains("hidden")) closeEvalModal();
        const syncModal = document.getElementById("sync-modal");
        if (syncModal && !syncModal.classList.contains("hidden")) closeSyncModal();
        const meetModal = document.getElementById("meeting-modal");
        if (meetModal && !meetModal.classList.contains("hidden")) closeMeetingModal();
        const resetModal = document.getElementById("reset-modal");
        if (resetModal && !resetModal.classList.contains("hidden")) closeResetModal();

        if (currentPage === "home") {
          if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        } else {
          switchPage("home", true);
        }
      }

      // Mobile & Responsive Drawer Controller
      function toggleMobileMenu(forceState, event) {
        // If passed an Event as first argument (from onclick="toggleMobileMenu(event)")
        const e = (forceState && typeof forceState.stopPropagation === "function")
          ? forceState
          : ((event && typeof event.stopPropagation === "function") ? event : null);
        if (e) {
          e.stopPropagation();
        }

        const isForced = typeof forceState === "boolean";
        const panel = document.getElementById("mobile-nav-panel");
        const backdrop = document.getElementById("mobile-nav-backdrop");
        const iconBars = document.getElementById("menu-icon-bars");
        const iconClose = document.getElementById("menu-icon-close");
        const btn = document.getElementById("mobile-menu-btn");

        if (!panel) return;

        const isCurrentlyOpen = !panel.classList.contains("hidden");
        const shouldOpen = isForced ? forceState : !isCurrentlyOpen;

        if (shouldOpen) {
          panel.classList.remove("hidden");
          if (backdrop) backdrop.classList.remove("hidden");
          if (iconBars) iconBars.classList.add("hidden");
          if (iconClose) iconClose.classList.remove("hidden");
          if (btn && typeof btn.setAttribute === "function") btn.setAttribute("aria-expanded", "true");
        } else {
          panel.classList.add("hidden");
          if (backdrop) backdrop.classList.add("hidden");
          if (iconBars) iconBars.classList.remove("hidden");
          if (iconClose) iconClose.classList.add("hidden");
          if (btn && typeof btn.setAttribute === "function") btn.setAttribute("aria-expanded", "false");
        }
      }

      // Navigation Controller with Scroll Reset Control
      function switchPage(page, scrollToTop = true) {
        toggleMobileMenu(false);
        currentPage = page;
        const pages = ["home", "calendar", "dashboard", "events", "assessments"];
        pages.forEach((p) => {
          const el = document.getElementById(`page-${p}`);
          if (el) el.classList.add("hidden");
        });

        const activeEl = document.getElementById(`page-${page}`);
        if (activeEl) activeEl.classList.remove("hidden");

        if (page === "home") renderHome();
        else if (page === "calendar") renderCalendar(false);
        else if (page === "dashboard") renderDashboard();
        else if (page === "assessments") renderEvaluations();
        else if (page === "events") renderEvents();

        updateNavigation();

        if (scrollToTop && typeof window !== "undefined" && typeof window.scrollTo === "function") {
          window.scrollTo({ top: 0, behavior: "instant" });
        }
      }

      function scrollToTodayTile() {
        const todayStr = getTodayStr();
        const todayClass = ALL_CLASSES.find((c) => c.dateStr === todayStr);
        if (todayClass) {
          const monthSecId = `month-sec-${todayClass.month}`;
          const monthSec = document.getElementById(monthSecId);
          if (monthSec && monthSec.classList.contains("hidden")) {
            toggleSection(monthSecId);
          }
        }
        setTimeout(() => {
          const todayTile = document.getElementById("today-calendar-tile");
          if (todayTile && typeof todayTile.scrollIntoView === "function") {
            todayTile.scrollIntoView({ behavior: "smooth", block: "center" });
            todayTile.classList.add("ring-4", "ring-indigo-400");
            setTimeout(() => {
              todayTile.classList.remove("ring-4", "ring-indigo-400");
            }, 1200);
          }
        }, 100);
      }

      // Direct Navigation & Attention Highlight Helpers
      function openClassInGrid(classId, event) {
        if (event) event.stopPropagation();

        const targetClass = ALL_CLASSES.find((c) => c.id === classId);
        if (!targetClass) {
          switchPage("calendar", false);
          return;
        }

        // 1. Ensure the filter does not hide this class
        if (typeof currentFilter !== "undefined" && currentFilter !== "ALL") {
          const matchTrack = currentFilter === targetClass.track;
          const matchMakeup = currentFilter === "MAKEUP" && targetClass.isMakeup;
          if (!matchTrack && !matchMakeup && typeof setFilter === "function") {
            setFilter("ALL");
          }
        }

        // 2. Ensure month section is expanded if collapsed
        const monthSecId = `month-sec-${targetClass.month}`;
        if (typeof document !== "undefined") {
          const monthSec = document.getElementById(monthSecId);
          if (monthSec && monthSec.classList.contains("hidden") && typeof toggleSection === "function") {
            toggleSection(monthSecId);
          }
        }

        // 3. Switch to calendar page without reset
        switchPage("calendar", false);

        // 4. Locate target tile, center smoothly in viewport, and apply executive spotlight
        setTimeout(() => {
          const todayTile = document.getElementById("today-calendar-tile");
          const el = document.querySelector(`[data-class-id="${classId}"]`) ||
                     document.getElementById(`class-tile-${classId}`) ||
                     (todayTile && todayTile.dataset && todayTile.dataset.classId === classId ? todayTile : null) ||
                     (targetClass.dateStr === getTodayStr() ? todayTile : null);
          if (el) {
            if (typeof el.scrollIntoView === "function") {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            setTimeout(() => {
              el.classList.add("executive-spotlight-indigo");
              setTimeout(() => {
                el.classList.remove("executive-spotlight-indigo");
              }, 2500);
            }, 180);
          }
        }, 100);
      }

      function openEventDetail(eventId, event) {
        if (event) event.stopPropagation();

        // 1. Ensure event is visible if an event category filter was active
        if (typeof currentEventFilter !== "undefined" && currentEventFilter !== "ALL") {
          currentEventFilter = "ALL";
          if (typeof document !== "undefined") {
            document.querySelectorAll(".event-filter-btn").forEach((btn) => {
              btn.className =
                "event-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 cursor-pointer";
            });
            const allBtn = document.getElementById("event-filter-ALL");
            if (allBtn) {
              allBtn.className =
                "event-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all bg-brand-600 text-white border-brand-600 shadow-sm whitespace-nowrap shrink-0 cursor-pointer touch-manipulation";
            }
          }
        }

        // 2. Switch to events view without jumping to top
        switchPage("events", false);

        // 3. Smoothly center target notice card and trigger executive spotlight animation
        setTimeout(() => {
          const el = document.getElementById(`event-card-${eventId}`);
          if (el) {
            if (typeof el.scrollIntoView === "function") {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            setTimeout(() => {
              el.classList.add("executive-spotlight-sky");
              setTimeout(() => {
                el.classList.remove("executive-spotlight-sky");
              }, 2500);
            }, 180);
          }
        }, 100);
      }

      function openAssessmentDetail(evalId, event) {
        if (event) event.stopPropagation();
        switchPage("assessments", false);
        setTimeout(() => {
          const el = document.getElementById(`eval-card-${evalId}`);
          if (el) {
            if (typeof el.scrollIntoView === "function") {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            setTimeout(() => {
              el.classList.add("executive-spotlight-amber");
              setTimeout(() => {
                el.classList.remove("executive-spotlight-amber");
              }, 2500);
            }, 180);
          }
        }, 100);
      }

      function openExamSchedule(event) {
        if (event) event.stopPropagation();
        switchPage("assessments", false);
        setTimeout(() => {
          const todayStr = getTodayStr();
          const lastMidterm = MIDTERM_DAYS[MIDTERM_DAYS.length - 1];
          const allMidtermsDone = MIDTERM_DAYS.every((d) => completedExams.has(d.id));
          const isMidtermFinished = allMidtermsDone || (todayStr > lastMidterm.dateStr);

          // If midterm is finished, target final-section; otherwise target midterm-section
          const targetSecId = isMidtermFinished ? "final-section" : "midterm-section";
          const targetListId = isMidtermFinished ? "final-exam-list" : "midterm-exam-list";

          const sec = document.getElementById(targetSecId);
          if (sec && sec.classList.contains("hidden")) {
            sec.classList.remove("hidden");
            const arrow = document.getElementById(targetSecId + "-arrow");
            if (arrow) arrow.classList.add("rotate-180");
          }

          const el = document.getElementById(targetListId);
          if (el) {
            const card = el.closest(".card-hover-pop") || el.parentElement;
            if (card) {
              if (typeof card.scrollIntoView === "function") {
                card.scrollIntoView({ behavior: "smooth", block: "center" });
              }
              setTimeout(() => {
                card.classList.add("executive-spotlight-sky");
                setTimeout(() => {
                  card.classList.remove("executive-spotlight-sky");
                }, 2500);
              }, 180);
            }
          }
        }, 100);
      }

      function updateNavigation() {
        const navHome = document.getElementById("nav-home");
        const navCal = document.getElementById("nav-calendar");
        const navDash = document.getElementById("nav-dashboard");
        const navEval = document.getElementById("nav-assessments");
        const navEvt = document.getElementById("nav-events");

        const inactiveStyle =
          "flex-1 md:flex-none flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 text-slate-600 hover:text-slate-900 hover:bg-white/50 whitespace-nowrap shrink-0 relative";
        const activeStyle =
          "flex-1 md:flex-none flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 bg-white text-brand-700 shadow-sm whitespace-nowrap shrink-0 relative";

        if (navHome)
          navHome.className =
            currentPage === "home" ? activeStyle : inactiveStyle;
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

        // Keep assessment pending badge updated across all page views
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
        const bottomBadge = document.getElementById("bottom-eval-badge");
        if (bottomBadge) {
          if (pendingCount > 0) {
            bottomBadge.innerText = pendingCount;
            bottomBadge.classList.remove("hidden");
          } else {
            bottomBadge.classList.add("hidden");
          }
        }
        const menuBadge = document.getElementById("menu-eval-badge");
        if (menuBadge) {
          if (pendingCount > 0) {
            menuBadge.innerText = pendingCount;
            menuBadge.classList.remove("hidden");
          } else {
            menuBadge.classList.add("hidden");
          }
        }
        const evalCountBadge = document.getElementById("eval-count-badge");
        if (evalCountBadge) {
          evalCountBadge.innerText = `${pendingCount} Active ${pendingCount === 1 ? "Task" : "Tasks"}`;
        }

        // Update Mobile Bottom Bar active items
        const bottomPages = ["home", "calendar", "dashboard", "assessments", "events"];
        const bottomIcons = {
          home: "text-brand-600",
          calendar: "text-indigo-600",
          dashboard: "text-sky-600",
          assessments: "text-rose-600",
          events: "text-purple-600",
        };
        bottomPages.forEach((p) => {
          const btn = document.getElementById(`bottom-nav-${p}`);
          if (btn) {
            const icon = btn.querySelector("svg, i");
            if (currentPage === p) {
              btn.className = "flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl text-[10px] font-bold text-brand-700 bg-brand-50/80 transition-all touch-manipulation cursor-pointer";
              if (icon) {
                icon.className = `w-4 h-4 pointer-events-none mb-0.5 ${bottomIcons[p] || "text-brand-600"}`;
              }
            } else {
              btn.className = "flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition-all touch-manipulation cursor-pointer";
              if (icon) {
                icon.className = "w-4 h-4 pointer-events-none mb-0.5 text-slate-400";
              }
            }
          }
        });
      }

      function toggleClass(id, event) {
        if (event) event.stopPropagation();
        if (completedClasses.has(id)) {
          completedClasses.delete(id);
          unmarkedClasses.add(id);
        } else {
          completedClasses.add(id);
          unmarkedClasses.delete(id);
        }
        saveState();
        renderHome();
        renderCalendar();
        renderDashboard();
      }

      function setFilter(filter) {
        currentFilter = filter;
        document.querySelectorAll(".filter-btn").forEach((btn) => {
          btn.className =
            "filter-btn px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all bg-white text-slate-600 border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 shadow-2xs cursor-pointer flex items-center justify-center touch-manipulation";
        });
        const activeBtn = document.getElementById(`filter-${filter}`);
        if (activeBtn) {
          let activeClass = "bg-brand-600 text-white border-brand-600 font-bold";
          if (filter === "MAKEUP") {
            activeClass = "bg-amber-500 text-slate-950 border-amber-500 font-extrabold";
          } else if (filter === "SAT") {
            activeClass = "bg-indigo-600 text-white border-indigo-600 font-bold";
          } else if (filter === "SUN") {
            activeClass = "bg-sky-600 text-white border-sky-600 font-bold";
          } else if (filter === "TUE") {
            activeClass = "bg-emerald-600 text-white border-emerald-600 font-bold";
          } else if (filter === "WED") {
            activeClass = "bg-purple-600 text-white border-purple-600 font-bold";
          }
          activeBtn.className = `filter-btn px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs border transition-all ${activeClass} shadow-xs cursor-pointer flex items-center justify-center touch-manipulation`;
        }
        renderCalendar();
      }

      function onEvalDateChange(val) {
  if (!val) return;
  const dStr = document.getElementById("eval-date-str");
  const dId = document.getElementById("eval-date-id");
  const hintEl = document.getElementById("eval-date-hint");

  if (dStr) dStr.value = val;

  const matchClass = ALL_CLASSES.find((c) => c.dateStr === val);
  if (dId) dId.value = matchClass ? matchClass.id : "manual-" + val;

  if (hintEl) {
    const d = new Date(val + "T00:00:00");
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatted = `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

    if (matchClass) {
      hintEl.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600"></i> <span>${formatted} &bull; ${matchClass.track} Track (Class #${matchClass.classNo})</span>`;
    } else {
      hintEl.innerHTML = `<i data-lucide="info" class="w-3.5 h-3.5 text-slate-400"></i> <span>${formatted} &bull; Independent Study / Off-Day</span>`;
    }
    lucide.createIcons();
  }
}

function openHomeEvalModal(event) {
  if (event) event.stopPropagation();
  const todayStr = getTodayStr();
  const nextClass = ALL_CLASSES.find((c) => c.dateStr >= todayStr) || ALL_CLASSES[0];
  openEvalModal(nextClass ? nextClass.id : "manual", nextClass ? nextClass.dateStr : todayStr, event);
}

function handleDeliverablesClick(event) {
  if (event) event.stopPropagation();
  switchPage('assessments');
  if (!userEvaluations || userEvaluations.length === 0) {
    openHomeEvalModal();
  }
}


      function getTrackStyle(track) {
        switch (track) {
          case "SAT":
            return {
              badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
              iconBg: "bg-indigo-100 text-indigo-700 border border-indigo-200/80",
              pill: "bg-indigo-600 text-white",
              bar: "bg-gradient-to-r from-indigo-500 to-brand-600",
              dot: "bg-indigo-600",
              border: "border-indigo-200/90",
              cardBg: "border-indigo-200/90 bg-gradient-to-br from-indigo-50/40 via-white to-white hover:border-indigo-400",
              name: "Saturday Track",
              accentText: "text-indigo-950"
            };
          case "SUN":
            return {
              badge: "bg-sky-50 text-sky-700 border-sky-200",
              iconBg: "bg-sky-100 text-sky-700 border border-sky-200/80",
              pill: "bg-sky-600 text-white",
              bar: "bg-gradient-to-r from-sky-500 to-blue-600",
              dot: "bg-sky-600",
              border: "border-sky-200/90",
              cardBg: "border-sky-200/90 bg-gradient-to-br from-sky-50/40 via-white to-white hover:border-sky-400",
              name: "Sunday Track",
              accentText: "text-sky-950"
            };
          case "TUE":
            return {
              badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
              iconBg: "bg-emerald-100 text-emerald-700 border border-emerald-200/80",
              pill: "bg-emerald-600 text-white",
              bar: "bg-gradient-to-r from-emerald-500 to-teal-600",
              dot: "bg-emerald-600",
              border: "border-emerald-200/90",
              cardBg: "border-emerald-200/90 bg-gradient-to-br from-emerald-50/40 via-white to-white hover:border-emerald-400",
              name: "Tuesday Track",
              accentText: "text-emerald-950"
            };
          case "WED":
            return {
              badge: "bg-purple-50 text-purple-700 border-purple-200",
              iconBg: "bg-purple-100 text-purple-700 border border-purple-200/80",
              pill: "bg-purple-600 text-white",
              bar: "bg-gradient-to-r from-purple-500 to-indigo-600",
              dot: "bg-purple-600",
              border: "border-purple-200/90",
              cardBg: "border-purple-200/90 bg-gradient-to-br from-purple-50/40 via-white to-white hover:border-purple-400",
              name: "Wednesday Track",
              accentText: "text-purple-950"
            };
          default:
            return {
              badge: "bg-slate-100 text-slate-700 border-slate-200",
              iconBg: "bg-slate-100 text-slate-700 border border-slate-200",
              pill: "bg-slate-700 text-white",
              bar: "bg-slate-900",
              dot: "bg-slate-600",
              border: "border-slate-200",
              cardBg: "border-slate-200 bg-white hover:border-slate-300",
              name: "Track",
              accentText: "text-slate-900"
            };
        }
      }

function renderHome() {
  const container = document.getElementById("home-container");
  if (!container) return;

  const todayStr = getTodayStr();
  const todayClass = ALL_CLASSES.find((c) => c.dateStr === todayStr);
  const now = new Date();
  const fullDateDisplay = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hour = now.getHours();
  const greeting =
    hour < 12
      ? "Good Morning"
      : hour < 17
        ? "Good Afternoon"
        : "Good Evening";

  // Academic Week & Phase Calculation (Term starts Oct 27, 2026)
  const termStartDate = new Date("2026-10-27T00:00:00");
  const nowDate = new Date(todayStr + "T00:00:00");
  const diffDaysFromStart = Math.floor((nowDate - termStartDate) / (1000 * 60 * 60 * 24));
  const currentWeek = diffDaysFromStart < 0 ? 1 : Math.min(14, Math.floor(diffDaysFromStart / 7) + 1);

  let termPhase = "Pre-Midterm Curriculum";
  if (todayStr >= "2026-12-05" && todayStr <= "2026-12-12") {
    termPhase = "Midterm Exam Week";
  } else if (todayStr > "2026-12-12" && todayStr < "2027-01-21") {
    termPhase = "Post-Midterm Curriculum";
  } else if (todayStr >= "2027-01-21" && todayStr <= "2027-01-24") {
    termPhase = "Finals Prep Recess";
  } else if (todayStr >= "2027-01-25") {
    termPhase = "Final Examinations";
  }

  // ── Core Metrics ────────────────────────────────────────────────────────────
  const total = 48;
  const done = completedClasses.size;
  const remaining = total - done;
  const pct = Math.round((done / total) * 100);

  const totalEvals = userEvaluations.length;
  const completedEvals = userEvaluations.filter((e) => e.done).length;
  const activeEvals = userEvaluations
    .filter((e) => !e.done)
    .sort((a, b) => (a.dateStr > b.dateStr ? 1 : a.dateStr < b.dateStr ? -1 : 0));
  const pendingEvals = activeEvals.length;

  const nextClass = ALL_CLASSES.find((c) => c.dateStr > todayStr);
  const nextMidtermDay = MIDTERM_DAYS.find((d) => !completedExams.has(d.id));
  const nextFinalDay = FINAL_DAYS.find((d) => !completedExams.has(d.id));
  const nextExamDay = nextMidtermDay || nextFinalDay;
  const isFinalExam = !nextMidtermDay && !!nextFinalDay;

  // ── KPI 3 Timeline Calculation (From Term Start: Oct 27, 2026) ─────────────
  let diffExamDays = 0;
  let examTimelineProgress = 0;
  let examTimelineSubtext = "";
  if (nextExamDay) {
    const examTargetDate = new Date(nextExamDay.dateStr + "T00:00:00");
    diffExamDays = Math.ceil((examTargetDate - nowDate) / (1000 * 60 * 60 * 24));

    // Calculate progress in terms of the start of the trimester
    const totalExamTimelineDays = Math.max(1, Math.floor((examTargetDate - termStartDate) / (1000 * 60 * 60 * 24)));
    const elapsedDaysToExam = Math.min(totalExamTimelineDays, Math.max(0, Math.floor((nowDate - termStartDate) / (1000 * 60 * 60 * 24))));
    examTimelineProgress = Math.min(100, Math.max(0, Math.round((elapsedDaysToExam / totalExamTimelineDays) * 100)));

    const examPhaseName = isFinalExam ? "Finals" : "Midterms";
    if (diffExamDays <= 0) {
      examTimelineSubtext = `${nextExamDay.display} &bull; Exams in session!`;
    } else {
      examTimelineSubtext = `Day ${elapsedDaysToExam + 1} of ${totalExamTimelineDays} to ${examPhaseName} (${examTimelineProgress}% elapsed)`;
    }
  } else {
    examTimelineProgress = 100;
    examTimelineSubtext = "All trimester examinations concluded";
  }

  // ── KPI 2 Deliverables Metrics (Coursework Progress & Deadline Tracking) ─────
  const overdueEvals = activeEvals.filter((e) => e.dateStr < todayStr);
  const upcomingEvals = activeEvals.filter((e) => e.dateStr >= todayStr);
  const nextUpcomingEval = upcomingEvals[0] || null;

  let deliverableTimelineProgress = 0;
  let deliverableTimelineSubtext = "";
  let deliverableMetricLabel = pendingEvals === 1 ? "Active Task" : "Active Tasks";

  if (totalEvals === 0) {
    // No custom evaluations added yet
    deliverableTimelineProgress = 0;
    deliverableTimelineSubtext = "No deliverables scheduled &bull; Click to add";
  } else if (pendingEvals === 0) {
    // All scheduled deliverables completed
    deliverableTimelineProgress = 100;
    deliverableMetricLabel = "All Completed";
    deliverableTimelineSubtext = `All ${totalEvals} scheduled deliverables completed!`;
  } else {
    // Active deliverables exist: Progress represents completion rate of coursework
    deliverableTimelineProgress = Math.round((completedEvals / totalEvals) * 100);
    deliverableMetricLabel = `${pendingEvals} ${pendingEvals === 1 ? "Task" : "Tasks"} (${completedEvals}/${totalEvals} Done)`;

    if (nextUpcomingEval) {
      const evalTargetDate = new Date(nextUpcomingEval.dateStr + "T00:00:00");
      const daysUntilTask = Math.ceil((evalTargetDate - nowDate) / (1000 * 60 * 60 * 24));

      if (daysUntilTask === 0) {
        deliverableTimelineSubtext = `<span class="text-rose-600 font-bold animate-pulse">Due Today: ${nextUpcomingEval.code} ${nextUpcomingEval.type}</span>`;
      } else if (daysUntilTask === 1) {
        deliverableTimelineSubtext = `<span class="text-amber-800 font-bold">Due Tomorrow: ${nextUpcomingEval.code} ${nextUpcomingEval.type}</span>`;
      } else {
        deliverableTimelineSubtext = `Next: ${nextUpcomingEval.code} ${nextUpcomingEval.type} (${daysUntilTask} days left)`;
      }

      if (overdueEvals.length > 0) {
        deliverableTimelineSubtext += ` &bull; <span class="text-rose-600 font-bold">${overdueEvals.length} overdue</span>`;
      }
    } else if (overdueEvals.length > 0) {
      // Only overdue evaluations remain
      const mostRecentOverdue = overdueEvals[overdueEvals.length - 1];
      const overdueDays = Math.max(1, Math.ceil((nowDate - new Date(mostRecentOverdue.dateStr + "T00:00:00")) / (1000 * 60 * 60 * 24)));
      deliverableTimelineSubtext = `<span class="text-rose-600 font-bold">${mostRecentOverdue.code} &bull; Overdue by ${overdueDays === 1 ? "1 day" : overdueDays + " days"}!</span>`;
    }
  }

    // Next class countdown label
  let nextClassLabel = "";
  if (nextClass) {
    const nextDate = new Date(nextClass.dateStr + "T00:00:00");
    const diffNext = Math.ceil((nextDate - nowDate) / (1000 * 60 * 60 * 24));
    nextClassLabel = diffNext === 1 ? "Tomorrow" : diffNext === 0 ? "Today" : `in ${diffNext} days`;
  }

  // Track Progress Data
  const tracks = ["SAT", "SUN", "TUE", "WED"];
  const trackStats = tracks.map((t) => {
    const trackClasses = ALL_CLASSES.filter((c) => c.track === t);
    const trackDone = trackClasses.filter((c) => completedClasses.has(c.id)).length;
    const trackNext = trackClasses.find((c) => c.dateStr >= todayStr);
    return {
      track: t,
      total: trackClasses.length,
      done: trackDone,
      remaining: trackClasses.length - trackDone,
      pct: Math.round((trackDone / trackClasses.length) * 100),
      nextClass: trackNext,
    };
  });

  // Upcoming Official Notices (Next 3 events)
  const upcomingNotices = ACADEMIC_EVENTS
    .filter((evt) => evt.dateStr && evt.dateStr >= todayStr)
    .slice(0, 3);

  // ── 1. Executive Academic Briefing Banner (Refined Light Theme) ───────────
  const isTodayClassDone = todayClass ? completedClasses.has(todayClass.id) : false;
  const todayLink = todayClass ? makeupMeetingLinks[todayClass.id] : null;

  const briefingBannerHtml = `
    <div class="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200/90 relative overflow-hidden transition-all hover:border-slate-300 card-hover-pop">
      <!-- Ambient subtle decorative backdrop glows -->
      <div class="absolute -top-16 -right-16 w-72 h-72 bg-gradient-to-br from-brand-100/40 via-indigo-50/30 to-transparent rounded-full blur-2xl pointer-events-none"></div>
      <div class="absolute -bottom-16 -left-16 w-56 h-56 bg-gradient-to-tr from-slate-100/60 to-transparent rounded-full blur-2xl pointer-events-none"></div>

      <!-- Top status bar with official branding and calendar date -->
      <div class="relative flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-100">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-brand-50 text-brand-800 border border-brand-200/80 shadow-2xs">
            <img src="img/uiu-logo.webp" alt="UIU" class="w-3.5 h-3.5 object-contain rounded-xs" />
            <span>UIU Term 263</span>
          </span>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/70">
            Week ${currentWeek} of 14 &bull; ${termPhase}
          </span>
        </div>
        <div class="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200/70">
          <i data-lucide="calendar" class="w-3.5 h-3.5 text-brand-600"></i>
          <span>${fullDateDisplay}</span>
        </div>
      </div>

      <!-- Main Focus Briefing -->
      <div class="relative py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <span class="text-xs font-extrabold tracking-wider uppercase text-brand-600 flex items-center gap-1.5 mb-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            ${greeting} &bull; Daily Academic Briefing
          </span>
          <h2 class="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            ${todayClass
              ? `${todayClass.track} Track &bull; Class #${todayClass.classNo} Scheduled Today`
              : "No Classes Scheduled Today"}
          </h2>
          <p class="text-sm text-slate-600 font-medium mt-1.5 max-w-2xl leading-relaxed">
            ${todayClass
              ? `${todayClass.isMakeup ? "Online makeup lecture compensating for " + todayClass.makeupFor + " Track." : "Regular on-campus lecture session."} ${remaining} classes remaining in curriculum.`
              : "Timetable is open today for independent study, coursework, and review."}
          </p>

          ${!todayClass && nextClass ? `
            <div class="mt-3.5 inline-flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs max-w-xl">
              <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex flex-col items-center justify-center font-black text-xs shrink-0 shadow-xs">
                <span>${nextClass.track}</span>
                <span class="text-[9px] font-bold text-indigo-200">#${nextClass.classNo}</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-xs font-black text-slate-900 truncate">Next Lecture: ${nextClass.track} Track &bull; Class #${nextClass.classNo}</div>
                <div class="text-[11px] font-semibold text-indigo-700 mt-0.5">${nextClass.month} ${nextClass.dayNum} (${nextClass.dayName}) &bull; ${nextClassLabel}</div>
              </div>
            </div>
          ` : ""}
        </div>

        <!-- Primary Context Actions -->
        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
          ${todayClass
            ? `
              <button onclick="toggleClass('${todayClass.id}', event)" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                isTodayClassDone
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                  : "bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/25"
              }">
                <i data-lucide="${isTodayClassDone ? "check" : "circle"}" class="w-4 h-4 stroke-[2.5]"></i>
                <span>${isTodayClassDone ? "Attended Today" : "Mark Attended"}</span>
              </button>
              <button onclick="openClassInGrid('${todayClass.id}', event)" class="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200/90 hover:border-slate-300 transition-all shadow-2xs cursor-pointer" title="Locate Today's Lecture in Calendar Grid">
                <i data-lucide="calendar" class="w-4 h-4 text-brand-600"></i>
                <span>View in Grid</span>
              </button>
              ${todayClass.isMakeup
                ? todayLink && todayLink.url
                  ? `<a href="${todayLink.url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 transition-colors shadow-xs cursor-pointer">
                      <i data-lucide="video" class="w-4 h-4"></i>
                      <span>${todayLink.alias || "Join Class"}</span>
                      <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                     </a>`
                  : `<button onclick="openMeetingModal('${todayClass.id}', '${todayClass.month} ${todayClass.dayNum}', event)" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer">
                      <i data-lucide="link" class="w-4 h-4 text-slate-500"></i>
                      <span>Add Meeting Link</span>
                     </button>`
                : ""
              }
            `
            : `
              ${nextClass
                ? `<button onclick="openClassInGrid('${nextClass.id}', event)" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-600/25 transition-all cursor-pointer" title="Locate Next Upcoming Lecture in Calendar Grid">
                    <i data-lucide="calendar" class="w-4 h-4"></i>
                    <span>View Next Lecture (${nextClass.track} #${nextClass.classNo})</span>
                   </button>`
                : `<button onclick="switchPage('calendar')" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-600/25 transition-all cursor-pointer">
                    <i data-lucide="calendar" class="w-4 h-4"></i>
                    <span>Open Calendar Grid</span>
                   </button>`
              }
            `
          }
          <button onclick="openHomeEvalModal(event)" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 border border-slate-200/80 transition-colors shadow-2xs cursor-pointer">
            <i data-lucide="plus" class="w-4 h-4 text-slate-600"></i>
            <span>Add Assessment</span>
          </button>
        </div>
      </div>

      <!-- Trimester Timeline Progress Gauge -->
      <div class="relative pt-4 border-t border-slate-100 mt-1">
        <div class="flex items-center justify-between text-xs font-medium text-slate-600 mb-2">
          <span class="flex items-center gap-1.5 font-semibold">
            <i data-lucide="calendar-range" class="w-3.5 h-3.5 text-brand-600"></i>
            Trimester Timeline (Week ${currentWeek} of 14)
          </span>
          <span class="text-xs font-extrabold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200/60">${Math.round((currentWeek / 14) * 100)}% Elapsed</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2.5 p-0.5 border border-slate-200/50 overflow-hidden">
          <div class="bg-gradient-to-r from-brand-600 via-indigo-500 to-emerald-500 h-1.5 rounded-full transition-all duration-500" style="width: ${Math.round((currentWeek / 14) * 100)}%"></div>
        </div>
      </div>
    </div>
  `;

  // ── 2. Three Balanced Vital KPI Stat Cards ──────────────────────────────────
  const kpiSectionHtml = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- KPI 1: Curriculum Attendance -->
      <div onclick="switchPage('calendar')" class="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-300 hover:shadow-md cursor-pointer group card-hover-pop">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Lectures Attended</span>
          <div class="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <i data-lucide="graduation-cap" class="w-4 h-4"></i>
          </div>
        </div>
        <div class="flex items-baseline gap-2 mt-3">
          <h3 class="text-3xl font-black text-slate-900 tracking-tight">${done}</h3>
          <span class="text-xs font-bold text-indigo-600">/ ${total} Lectures (${pct}%)</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
          <div class="bg-gradient-to-r from-indigo-500 to-brand-600 h-2 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
        </div>
        <div class="flex items-center justify-between mt-2.5 text-xs text-slate-500 font-medium">
          <span>${remaining} lectures remaining</span>
          <span class="text-indigo-600 font-bold group-hover:text-indigo-700 transition-colors">View Grid &rarr;</span>
        </div>
      </div>

      <!-- KPI 2: Active Deliverables & Reviews -->
      <div onclick="handleDeliverablesClick(event)" class="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-amber-300 hover:shadow-md cursor-pointer group card-hover-pop">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Deliverables</span>
          <div class="p-2.5 rounded-xl ${pendingEvals > 0 ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-amber-50 text-amber-700 border border-amber-100"} group-hover:bg-amber-500 group-hover:text-white transition-all">
            <i data-lucide="check-square" class="w-4 h-4"></i>
          </div>
        </div>
        <div class="flex items-baseline gap-2 mt-3">
          <h3 class="text-3xl font-black text-slate-900 tracking-tight">${pendingEvals}</h3>
          <span class="text-xs font-bold text-amber-700">${deliverableMetricLabel}</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
          <div class="${pendingEvals === 0 && userEvaluations.length > 0 ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-gradient-to-r from-amber-400 to-orange-500"} h-2 rounded-full transition-all duration-300" style="width: ${deliverableTimelineProgress}%"></div>
        </div>
        <div class="flex items-center justify-between mt-2.5 text-xs text-slate-500 font-medium">
          <span class="truncate">${deliverableTimelineSubtext}</span>
          <span class="text-amber-700 font-bold group-hover:text-amber-800 transition-colors shrink-0 ml-2">${totalEvals === 0 ? "+ Add &rarr;" : "Manage &rarr;"}</span>
        </div>
      </div>

      <!-- KPI 3: Next Examination Horizon -->
      <div onclick="openExamSchedule(event)" class="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-sky-300 hover:shadow-md cursor-pointer group card-hover-pop" title="View Examination Schedules">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">${isFinalExam ? "Final Examination" : "Midterm Examination"}</span>
          <div class="p-2.5 rounded-xl bg-sky-50 text-sky-700 border border-sky-100 group-hover:bg-sky-600 group-hover:text-white transition-all">
            <i data-lucide="award" class="w-4 h-4"></i>
          </div>
        </div>
        <div class="flex items-baseline gap-2 mt-3">
          <h3 class="text-3xl font-black text-slate-900 tracking-tight">
            ${diffExamDays <= 0 ? "In Session" : diffExamDays}
          </h3>
          <span class="text-xs font-bold text-sky-700">${diffExamDays === 1 ? "Day Left" : "Days Left"} (${examTimelineProgress}%)</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
          <div class="bg-gradient-to-r from-sky-500 to-indigo-600 h-2 rounded-full transition-all duration-300" style="width: ${examTimelineProgress}%"></div>
        </div>
        <div class="flex items-center justify-between mt-2.5 text-xs text-slate-500 font-medium">
          <span class="truncate">${examTimelineSubtext}</span>
          <span class="text-sky-700 font-bold group-hover:text-sky-800 transition-colors shrink-0 ml-2">Exams &rarr;</span>
        </div>
      </div>
    </div>
  `;

  // ── 3. Left Column: 7-Day Institutional Horizon (Grouped By Date) ────────────
  const dayGroups = [];
  let totalActivitiesCount = 0;

  for (let i = 0; i < 7; i++) {
    const loopDate = new Date(nowDate);
    loopDate.setDate(loopDate.getDate() + i);
    const dateStr = formatLocalDate(loopDate);
    const loopMonth = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][loopDate.getMonth()];
    const loopDayNum = loopDate.getDate();
    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][loopDate.getDay()];
    const fullDayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][loopDate.getDay()];

    const classMatch = ALL_CLASSES.find((c) => c.dateStr === dateStr);
    const eventMatch = ACADEMIC_EVENTS.find((e) => e.dateStr === dateStr);
    const evalsMatch = userEvaluations.filter((e) => e.dateStr === dateStr);

    const dayItems = [];

    if (classMatch) {
      dayItems.push({
        type: "CLASS",
        title: `Lecture #${classMatch.classNo}`, 
        subtitle: classMatch.isMakeup
          ? `Online Makeup Class compensating for ${classMatch.makeupFor} Track`
          : "Regular On-Campus Lecture Session",
        isDone: completedClasses.has(classMatch.id),
        id: classMatch.id,
        isMakeup: classMatch.isMakeup,
        makeupFor: classMatch.makeupFor,
        track: classMatch.track,
        linkData: makeupMeetingLinks[classMatch.id],
      });
    }

    if (eventMatch) {
      dayItems.push({
        type: "EVENT",
        title: eventMatch.title,
        subtitle: eventMatch.note,
        category: eventMatch.category || "ACADEMIC",
        isDone: completedEvents.has(eventMatch.id),
        id: eventMatch.id,
      });
    }

    evalsMatch.forEach((ev) => {
      dayItems.push({
        type: "EVAL",
        title: `${ev.code} — ${ev.type}`,
        subtitle: ev.desc,
        isDone: ev.done,
        id: ev.id,
      });
    });

    if (dayItems.length > 0) {
      totalActivitiesCount += dayItems.length;
      dayGroups.push({
        dateStr,
        isToday: i === 0,
        isTomorrow: i === 1,
        dayLabel: i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayName,
        fullDayName,
        monthShort: loopMonth.toUpperCase(),
        dayNum: loopDayNum,
        relativeText: i === 0 ? "Today's Schedule" : i === 1 ? "Tomorrow's Schedule" : (i === 2 ? "In 2 Days" : `In ${i} Days`),
        dateFormatted: `${loopMonth} ${loopDayNum}`,
        fullDateFormatted: `${fullDayName}, ${loopMonth} ${loopDayNum}`,
        items: dayItems,
      });
    }
  }

  let agendaContentHtml = "";
  if (dayGroups.length === 0) {
    agendaContentHtml = `
      <div class="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
        <i data-lucide="calendar" class="w-8 h-8 mx-auto text-slate-400 mb-2"></i>
        <p class="text-xs font-bold text-slate-700">No scheduled activities for the next 7 days</p>
        <p class="text-[11px] text-slate-500 mt-0.5">Academic timetable is open for independent review and study.</p>
      </div>
    `;
  } else {
    agendaContentHtml = '<div class="space-y-4">';
    dayGroups.forEach((group) => {
      let containerStyle = "";
      let headerBorder = "";
      let dateBadgeStyle = "";
      let dateMonthColor = "";
      let dateNumColor = "";
      let titleColor = "";
      let statusPill = "";
      let countBadgeStyle = "";

      if (group.isToday) {
        containerStyle = "rounded-2xl border-2 border-indigo-200/90 bg-gradient-to-b from-indigo-50/40 via-white to-white shadow-xs p-4 sm:p-5 space-y-3.5";
        headerBorder = "border-indigo-100/90 pb-3";
        dateBadgeStyle = "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30";
        dateMonthColor = "text-indigo-200 font-bold";
        dateNumColor = "text-white font-black";
        titleColor = "text-indigo-950 font-black";
        statusPill = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-600 text-white shadow-xs"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>TODAY</span>`;
        countBadgeStyle = "bg-indigo-100 text-indigo-800 font-extrabold border border-indigo-200";
      } else if (group.isTomorrow) {
        containerStyle = "rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/25 via-white to-white shadow-xs p-4 sm:p-5 space-y-3.5";
        headerBorder = "border-amber-100/90 pb-3";
        dateBadgeStyle = "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20";
        dateMonthColor = "text-amber-950 font-bold";
        dateNumColor = "text-slate-950 font-black";
        titleColor = "text-slate-900 font-extrabold";
        statusPill = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">TOMORROW</span>`;
        countBadgeStyle = "bg-amber-100 text-amber-900 font-bold border border-amber-200";
      } else {
        containerStyle = "rounded-2xl border border-slate-200/90 bg-slate-50/35 hover:border-slate-300 hover:bg-slate-50/50 transition-all p-4 sm:p-5 space-y-3.5";
        headerBorder = "border-slate-200/70 pb-3";
        dateBadgeStyle = "bg-white text-slate-700 border border-slate-200 shadow-2xs";
        dateMonthColor = "text-slate-500 font-bold";
        dateNumColor = "text-slate-900 font-black";
        titleColor = "text-slate-900 font-extrabold";
        statusPill = `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">${group.dayLabel.toUpperCase()}</span>`;
        countBadgeStyle = "bg-white text-slate-600 font-semibold border border-slate-200";
      }

      agendaContentHtml += `
        <div class="${containerStyle}">
          <!-- Distinct Day Header Bar with Date Stamp -->
          <div class="flex items-center justify-between border-b ${headerBorder}">
            <div class="flex items-center gap-3">
              <!-- Calendar Date Stamp Block -->
              <div class="flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${dateBadgeStyle} shrink-0">
                <span class="text-[10px] uppercase tracking-wider ${dateMonthColor}">${group.monthShort}</span>
                <span class="text-base sm:text-lg leading-none ${dateNumColor}">${group.dayNum}</span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="text-sm sm:text-base ${titleColor}">${group.fullDayName}</h4>
                  ${statusPill}
                </div>
                <p class="text-xs font-medium text-slate-500 mt-0.5">${group.relativeText}</p>
              </div>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-lg ${countBadgeStyle}">
              ${group.items.length === 1 ? "1 Activity" : group.items.length + " Activities"}
            </span>
          </div>

          <!-- Items inside this day -->
          <div class="space-y-2">
            ${group.items
              .map((item) => {
                if (item.type === "CLASS") {
                  const trackStyle = getTrackStyle(item.track);
                  const isMakeup = item.isMakeup;
                  const iconBg = isMakeup ? "bg-amber-100 text-amber-800 border border-amber-300" : trackStyle.iconBg;
                  const badgeClass = isMakeup ? "bg-amber-100 text-amber-900 border border-amber-300 font-extrabold" : trackStyle.badge + " font-extrabold";

                  return `
                    <div onclick="openClassInGrid('${item.id}', event)" class="p-3 sm:p-3.5 rounded-xl border ${item.isDone ? "bg-emerald-50/70 border-emerald-200" : "bg-white border-slate-200/90 hover:border-indigo-300"} transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 card-hover-pop-subtle cursor-pointer group" title="Click to view lecture in Calendar Grid">
                      <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <div class="p-2 rounded-xl ${item.isDone ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : iconBg} shrink-0 mt-0.5 sm:mt-0">
                          <i data-lucide="${isMakeup ? "video" : "graduation-cap"}" class="w-4 h-4"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <h4 class="text-xs sm:text-sm font-bold ${item.isDone ? "text-slate-400 line-through" : "text-slate-900"} truncate group-hover:text-indigo-600 transition-colors">
                              ${item.title}
                            </h4>
                            <span class="text-[10px] px-2 py-0.5 rounded-md ${badgeClass}">
                              ${isMakeup ? "ONLINE MAKEUP" : item.track + " TRACK"}
                            </span>
                          </div>
                          <p class="text-xs text-slate-500 font-medium truncate mt-0.5 flex items-center gap-1.5">
                            <span>${item.subtitle}</span>
                            <span class="text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">&bull; View in Grid &rarr;</span>
                          </p>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        ${isMakeup
                          ? item.linkData && item.linkData.url
                            ? `<a href="${item.linkData.url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-xs">
                                <i data-lucide="video" class="w-3.5 h-3.5"></i>
                                <span>${item.linkData.alias || "Join"}</span>
                                <i data-lucide="external-link" class="w-3 h-3"></i>
                               </a>`
                            : `<button onclick="openMeetingModal('${item.id}', '${group.dateFormatted}', event)" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer">
                                <i data-lucide="link" class="w-3 h-3"></i>
                                <span>Add Link</span>
                               </button>`
                          : ""
                        }
                        <button onclick="toggleClass('${item.id}', event)" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          item.isDone
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            : "bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
                        }">
                          <i data-lucide="${item.isDone ? "check" : "circle"}" class="w-3.5 h-3.5"></i>
                          <span>${item.isDone ? "Attended" : "Mark Attended"}</span>
                        </button>
                      </div>
                    </div>
                  `;
                } else if (item.type === "EVENT") {
                  return `
                    <div onclick="openEventDetail('${item.id}', event)" class="p-3 sm:p-3.5 rounded-xl border bg-gradient-to-r from-sky-50/70 via-indigo-50/30 to-white border-sky-200/90 hover:border-sky-300 transition-all flex items-start sm:items-center justify-between gap-3 card-hover-pop-subtle cursor-pointer group" title="Click to view notice details">
                      <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <div class="p-2 rounded-xl bg-sky-100 text-sky-800 border border-sky-200/80 shrink-0 mt-0.5 sm:mt-0">
                          <i data-lucide="bell" class="w-4 h-4"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <h4 class="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                              ${item.title}
                            </h4>
                            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-200">
                              ${item.category}
                            </span>
                          </div>
                          <p class="text-xs text-slate-500 font-medium mt-0.5">
                            ${item.subtitle}
                          </p>
                        </div>
                      </div>
                      <button onclick="openEventDetail('${item.id}', event)" class="text-xs font-bold text-sky-700 hover:text-sky-900 whitespace-nowrap shrink-0 self-end sm:self-center cursor-pointer">
                        View Notice &rarr;
                      </button>
                    </div>
                  `;
                } else {
                  return `
                    <div onclick="openAssessmentDetail('${item.id}', event)" class="p-3 sm:p-3.5 rounded-xl border bg-gradient-to-r from-rose-50/40 via-pink-50/20 to-white border-rose-200/90 hover:border-rose-300 transition-all flex items-start sm:items-center justify-between gap-3 card-hover-pop-subtle cursor-pointer group" title="Click to view assessment details">
                      <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <div class="p-2 rounded-xl bg-rose-100 text-rose-800 border border-rose-200/80 shrink-0 mt-0.5 sm:mt-0">
                          <i data-lucide="check-square" class="w-4 h-4"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <h4 class="text-xs sm:text-sm font-bold ${item.isDone ? "text-slate-400 line-through" : "text-slate-900"} group-hover:text-rose-700 transition-colors">
                              ${item.title}
                            </h4>
                            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                              ASSESSMENT
                            </span>
                          </div>
                          <p class="text-xs text-slate-500 font-medium truncate mt-0.5">
                            ${item.subtitle}
                          </p>
                        </div>
                      </div>
                      <button onclick="toggleEvalDone('${item.id}', event)" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 self-end sm:self-center ${
                        item.isDone
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                          : "bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-200 font-bold"
                      }">
                        <i data-lucide="${item.isDone ? "check" : "circle"}" class="w-3.5 h-3.5"></i>
                        <span>${item.isDone ? "Done" : "Check Done"}</span>
                      </button>
                    </div>
                  `;
                }
              })
              .join("")}
          </div>
        </div>
      `;
    });
    agendaContentHtml += "</div>";
  }

  const agendaCardHtml = `
    <div class="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
      <div class="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div>
          <h3 class="text-sm font-black text-slate-900 uppercase tracking-wide">Weekly Schedule Horizon</h3>
          <p class="text-xs text-slate-500 font-medium">Chronological itinerary for the next 7 days</p>
        </div>
        <span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
          ${totalActivitiesCount} Activities
        </span>
      </div>
      ${agendaContentHtml}
    </div>
  `;

  // ── 6. Right Column: Upcoming Assessments ───────────────────────────────────
  let assessmentContentHtml = "";
  if (activeEvals.length === 0) {
    assessmentContentHtml = `
      <div class="p-6 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
        <i data-lucide="check-circle" class="w-6 h-6 mx-auto text-emerald-600 mb-2"></i>
        <p class="text-xs font-bold text-slate-800">No Pending Assessments</p>
        <p class="text-[11px] text-slate-500 mt-0.5">Schedule quizzes, lab assignments, or midterm deliverables.</p>
        <button onclick="openHomeEvalModal(event)" class="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>Schedule Assessment</span>
        </button>
      </div>
    `;
  } else {
    assessmentContentHtml = '<div class="space-y-2.5">';
    activeEvals.slice(0, 4).forEach((ev) => {
      const targetDate = new Date(ev.dateStr + "T00:00:00");
      const diffTime = targetDate - nowDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let urgencyBadge = "";
      let urgencyClass = "bg-slate-100 text-slate-700 border-slate-200";

      if (diffDays < 0) {
        const overdueDays = Math.abs(diffDays);
        urgencyBadge = `Overdue (${overdueDays === 1 ? "1 day ago" : overdueDays + " days ago"})`;
        urgencyClass = "bg-rose-100 text-rose-800 border-rose-300 font-bold";
      } else if (diffDays === 0) {
        urgencyBadge = "Due Today!";
        urgencyClass = "bg-rose-100 text-rose-800 border-rose-300 font-black animate-pulse";
      } else if (diffDays < 7) {
        urgencyBadge = `${diffDays === 1 ? "1 Day Left" : diffDays + " Days Left"} (High Priority)`;
        urgencyClass = "bg-rose-50 text-rose-700 border-rose-200 font-bold";
      } else if (diffDays <= 14) {
        urgencyBadge = `${diffDays} Days Left (Prepare)`;
        urgencyClass = "bg-amber-50 text-amber-800 border-amber-200 font-bold";
      } else {
        urgencyBadge = `${diffDays} Days Left (Plan)`;
        urgencyClass = "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold";
      }

      let evalTypeBadge = "bg-slate-100 text-slate-700 border-slate-200";
      if (ev.type === "Presentation") evalTypeBadge = "bg-indigo-50 text-indigo-700 border-indigo-200";
      if (ev.type === "Assignment Deadline") evalTypeBadge = "bg-cyan-50 text-cyan-700 border-cyan-200";
      if (ev.type === "Quiz 1" || ev.type === "Quiz 2") evalTypeBadge = "bg-rose-50 text-rose-700 border-rose-200";
      if (ev.type === "Update") evalTypeBadge = "bg-amber-50 text-amber-800 border-amber-200";

      assessmentContentHtml += `
        <div onclick="openAssessmentDetail('${ev.id}', event)" class="p-3.5 rounded-xl border border-slate-200/90 hover:border-amber-300 bg-white transition-all flex items-center justify-between gap-3 card-hover-pop-subtle cursor-pointer" title="View Assessment Details">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-black text-slate-900 truncate">${ev.code}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded ${evalTypeBadge}">${ev.type}</span>
            </div>
            <p class="text-xs font-semibold text-slate-700 truncate">${ev.desc}</p>
            <div class="flex items-center gap-2 mt-1.5">
              <span class="text-[11px] text-slate-500 font-medium">${ev.dateStr}</span>
              <span class="text-[10px] px-2 py-0.5 rounded border ${urgencyClass}">${urgencyBadge}</span>
            </div>
          </div>
          <button onclick="toggleEvalDone('${ev.id}')" class="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors shrink-0 cursor-pointer" title="Mark Completed">
            Done
          </button>
        </div>
      `;
    });
    assessmentContentHtml += "</div>";
  }

  const assessmentCardHtml = `
    <div class="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
      <div class="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div>
          <h3 class="text-sm font-black text-slate-900 uppercase tracking-wide">Upcoming Assessments</h3>
          <p class="text-xs text-slate-500 font-medium">Quizzes, deadlines, and milestone deliverables</p>
        </div>
        <button onclick="switchPage('assessments')" class="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer">
          <span>All (${activeEvals.length})</span>
          <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      ${assessmentContentHtml}
    </div>
  `;

  // ── 7. Right Column: Institutional Notice Board ─────────────────────────────
  let noticesHtml = "";
  if (upcomingNotices.length === 0) {
    noticesHtml = `
      <p class="text-xs text-slate-500 font-medium">No impending university deadlines this week.</p>
    `;
  } else {
    noticesHtml = '<div class="space-y-2.5">';
    upcomingNotices.forEach((evt) => {
      let catBadge = "bg-sky-100 text-sky-800 border-sky-200";
      if (evt.category === "PAYMENT") catBadge = "bg-emerald-100 text-emerald-800 border-emerald-200";
      if (evt.category === "EXAM") catBadge = "bg-rose-100 text-rose-800 border-rose-200";
      if (evt.category === "HOLIDAY") catBadge = "bg-amber-100 text-amber-800 border-amber-200";

      noticesHtml += `
        <div onclick="openEventDetail('${evt.id}', event)" class="p-3 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:border-indigo-300 flex items-start gap-3 card-hover-pop-subtle transition-all cursor-pointer" title="View Notice Details">
          <div class="p-2 rounded-lg bg-white border border-slate-200 shrink-0 text-slate-700 mt-0.5">
            <i data-lucide="bell" class="w-3.5 h-3.5 text-indigo-600"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-xs font-bold text-slate-900 truncate">${evt.title}</span>
              <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${catBadge}">${evt.category}</span>
            </div>
            <p class="text-xs text-slate-500 truncate">${evt.dateDisplay} &bull; ${evt.note}</p>
          </div>
        </div>
      `;
    });
    noticesHtml += "</div>";
  }

  const noticeBoardCardHtml = `
    <div class="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-3.5">
      <div class="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div>
          <h3 class="text-sm font-black text-slate-900 uppercase tracking-wide">University Notice Board</h3>
          <p class="text-xs text-slate-500 font-medium">Official UIU academic calendar notices</p>
        </div>
        <button onclick="switchPage('events')" class="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer">
          <span>All Events</span>
          <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      ${noticesHtml}
    </div>
  `;

  // ── Master Assemble ─────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="space-y-6">
      ${briefingBannerHtml}

      ${kpiSectionHtml}

      <!-- Command Center Split Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left Column: Timetable & Itinerary (7 Cols on desktop) -->
        <div class="lg:col-span-7 space-y-6">
          ${agendaCardHtml}
        </div>

        <!-- Right Column: Deliverables & Notices (5 Cols on desktop) -->
        <div class="lg:col-span-5 space-y-6">
          ${assessmentCardHtml}
          ${noticeBoardCardHtml}
        </div>
      </div>
    </div>
  `;

  lucide.createIcons();
}

      function renderCalendar(autoScroll = false) {
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

  const monthThemeStyles = {
    OCT: {
      headerBg: "bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90",
      iconBox: "bg-indigo-100 text-indigo-700 border border-indigo-200/80",
      title: "text-slate-900",
      badge: "bg-white text-indigo-800 border border-indigo-200/80 shadow-2xs",
      progress: "bg-white text-brand-700 border border-slate-200/80 shadow-2xs",
      progressFull: "bg-emerald-50 text-emerald-800 border border-emerald-200",
      arrow: "text-slate-400 group-hover:text-slate-600"
    },
    NOV: {
      headerBg: "bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90",
      iconBox: "bg-amber-100 text-amber-800 border border-amber-200/80",
      title: "text-slate-900",
      badge: "bg-white text-amber-900 border border-amber-200/80 shadow-2xs",
      progress: "bg-white text-brand-700 border border-slate-200/80 shadow-2xs",
      progressFull: "bg-emerald-50 text-emerald-800 border border-emerald-200",
      arrow: "text-slate-400 group-hover:text-slate-600"
    },
    DEC: {
      headerBg: "bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90",
      iconBox: "bg-emerald-100 text-emerald-800 border border-emerald-200/80",
      title: "text-slate-900",
      badge: "bg-white text-emerald-900 border border-emerald-200/80 shadow-2xs",
      progress: "bg-white text-brand-700 border border-slate-200/80 shadow-2xs",
      progressFull: "bg-emerald-50 text-emerald-800 border border-emerald-200",
      arrow: "text-slate-400 group-hover:text-slate-600"
    },
    JAN: {
      headerBg: "bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90",
      iconBox: "bg-sky-100 text-sky-800 border border-sky-200/80",
      title: "text-slate-900",
      badge: "bg-white text-sky-900 border border-sky-200/80 shadow-2xs",
      progress: "bg-white text-brand-700 border border-slate-200/80 shadow-2xs",
      progressFull: "bg-emerald-50 text-emerald-800 border border-emerald-200",
      arrow: "text-slate-400 group-hover:text-slate-600"
    },
  };

  const todayStr = getTodayStr();

  // Determine current active month (only this month will be open by default; others collapsed)
  const todayDateObj = new Date(todayStr + "T00:00:00");
  const monthShortNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const wallMonth = monthShortNames[todayDateObj.getMonth()];
  let activeMonth = months.includes(wallMonth) ? wallMonth : null;
  if (!activeMonth) {
    const todayClassObj = ALL_CLASSES.find((c) => c.dateStr === todayStr);
    if (todayClassObj) activeMonth = todayClassObj.month;
  }
  if (!activeMonth) {
    const nextUpcoming = ALL_CLASSES.find((c) => c.dateStr >= todayStr);
    activeMonth = nextUpcoming ? nextUpcoming.month : "OCT";
  }

  months.forEach((m) => {
    const monthClasses = ALL_CLASSES.filter((c) => c.month === m);
    const filteredClasses = monthClasses.filter((c) => {
      if (currentFilter === "ALL") return true;
      if (currentFilter === "MAKEUP") return c.isMakeup;
      return c.track === currentFilter;
    });

    if (filteredClasses.length === 0 && currentFilter !== "ALL") return;

    const monthSection = document.createElement("div");
    monthSection.className = "bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4 card-hover-pop-subtle";

    const completedInMonth = monthClasses.filter((c) =>
      completedClasses.has(c.id),
    ).length;
    const mStyle = monthThemeStyles[m] || monthThemeStyles.OCT;
    const isAllDone = completedInMonth === monthClasses.length;

    // Check month status
    const isCurrentMonth = (m === activeMonth);
    const lastClassInMonth = monthClasses[monthClasses.length - 1];
    const isMonthPast = lastClassInMonth ? todayStr > lastClassInMonth.dateStr : false;

    // ONLY show the current month grid; keep all other months collapsed by default!
    const isUserToggled = Object.prototype.hasOwnProperty.call(userMonthToggles, m);
    const isCollapsed = isUserToggled ? userMonthToggles[m] : !isCurrentMonth;

    let monthStatusBadge = "";
    if (isCurrentMonth) {
      monthStatusBadge = `<span class="text-[10px] sm:text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 sm:px-2.5 py-0.5 rounded-lg flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Current Month</span>`;
    } else if (isMonthPast) {
      monthStatusBadge = isAllDone
        ? `<span class="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 sm:px-2.5 py-0.5 rounded-lg flex items-center gap-1"><i data-lucide="check-check" class="w-3.5 h-3.5 text-emerald-600"></i>Concluded</span>`
        : `<span class="text-[10px] sm:text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200/80 px-2 sm:px-2.5 py-0.5 rounded-lg">Past Month</span>`;
    }

    monthSection.innerHTML = `
      <button onclick="toggleSection('month-sec-${m}')" class="w-full flex items-center justify-between ${mStyle.headerBg} p-3.5 sm:p-4 rounded-2xl shadow-2xs cursor-pointer transition-all group" title="${isCollapsed ? 'Click to expand month schedule' : 'Click to collapse month schedule'}">
        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          <div class="p-2 rounded-xl ${mStyle.iconBox} shadow-2xs">
            <i data-lucide="calendar" class="w-4 h-4 sm:w-5 sm:h-5"></i>
          </div>
          <h2 class="text-sm sm:text-base font-extrabold tracking-tight ${mStyle.title}">${monthTitles[m]}</h2>
          <span class="text-[10px] sm:text-xs font-bold ${mStyle.badge} px-2.5 py-0.5 rounded-lg">${monthClasses.length} Scheduled</span>
          ${monthStatusBadge}
        </div>
        <div class="flex items-center gap-2 sm:gap-3">
          <span class="text-[10px] sm:text-xs font-bold ${isAllDone ? mStyle.progressFull : mStyle.progress} px-2.5 sm:px-3 py-1 rounded-xl">
            ${completedInMonth} / ${monthClasses.length} Done
          </span>
          <i id="month-sec-${m}-arrow" data-lucide="chevron-down" class="w-5 h-5 ${mStyle.arrow} transform transition-transform ${isCollapsed ? "" : "rotate-180"}"></i>
        </div>
      </button>
      <div id="month-sec-${m}" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-3.5 transition-all ${isCollapsed ? "hidden" : ""}">
      </div>
    `;

    container.appendChild(monthSection);
    const grid = document.getElementById(`month-sec-${m}`);

    monthClasses.forEach((item) => {
      const isVisible = filteredClasses.some((fc) => fc.id === item.id);
      if (!isVisible) return;

      const isDone = completedClasses.has(item.id);
      const temporal = getTemporalState(item.dateStr);
      const dayEvals = userEvaluations.filter((e) => e.dateId === item.id);
      const linkData = makeupMeetingLinks[item.id];

      const card = document.createElement("div");
      card.dataset.classId = item.id;
      card.id = `class-tile-${item.id}`;

      // Track Theme Symmetrical Borders & Badges (Smooth rounded corners, no lopsided borders)
      let borderStyle = "";
      let trackBadgeClass = "bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold";

      if (temporal === "TODAY") {
        card.id = "today-calendar-tile";
        if (isDone) {
          borderStyle = "border-2 border-emerald-500 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20";
        } else {
          borderStyle = "border-2 border-indigo-600 bg-gradient-to-b from-indigo-50/50 via-white to-white shadow-md ring-2 ring-indigo-500/25";
        }
      } else if (isDone) {
        borderStyle = "border-2 border-emerald-300 bg-emerald-50/50 hover:border-emerald-400 shadow-2xs";
      } else if (temporal === "PAST") {
        borderStyle = "border border-slate-200 bg-slate-50/90 text-slate-500 opacity-75 hover:opacity-100 shadow-none";
      } else if (item.isMakeup) {
        borderStyle = "border-2 border-amber-300 bg-amber-50/35 hover:border-amber-400 shadow-2xs";
        trackBadgeClass = "bg-amber-100 text-amber-900 border border-amber-300 font-extrabold";
      } else if (item.track === "SAT") {
        borderStyle = "border-2 border-indigo-200/90 bg-white hover:border-indigo-400 hover:shadow-xs";
        trackBadgeClass = "bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold";
      } else if (item.track === "SUN") {
        borderStyle = "border-2 border-sky-200/90 bg-white hover:border-sky-400 hover:shadow-xs";
        trackBadgeClass = "bg-sky-50 text-sky-700 border border-sky-200 font-bold";
      } else if (item.track === "TUE") {
        borderStyle = "border-2 border-emerald-200/90 bg-white hover:border-emerald-400 hover:shadow-xs";
        trackBadgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold";
      } else if (item.track === "WED") {
        borderStyle = "border-2 border-purple-200/90 bg-white hover:border-purple-400 hover:shadow-xs";
        trackBadgeClass = "bg-purple-50 text-purple-700 border border-purple-200 font-bold";
      }

      // Single-line compact status pills (Never wrap or break card height)
      let statusPillHtml = "";
      if (temporal === "TODAY") {
        if (isDone) {
          statusPillHtml = '<span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-md truncate"><i data-lucide="check" class="w-3 h-3 text-emerald-600 stroke-[3] shrink-0"></i><span class="truncate">Attended Today</span></span>';
        } else {
          statusPillHtml = '<span class="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-950 bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded-md truncate"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span><span class="truncate">Scheduled Today</span></span>';
        }
      } else if (isDone) {
        statusPillHtml = '<span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-md truncate"><i data-lucide="check" class="w-3 h-3 text-emerald-600 stroke-[3] shrink-0"></i><span class="truncate">Attended</span></span>';
      } else if (temporal === "PAST") {
        statusPillHtml = '<span class="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md truncate"><span class="truncate">Concluded</span></span>';
      } else if (item.isMakeup) {
        statusPillHtml = `<div class="flex items-center justify-between gap-1">
          <span class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded-md truncate">
            <i data-lucide="video" class="w-3 h-3 text-amber-700 shrink-0"></i>
            <span class="truncate">Makeup (${item.makeupFor})</span>
          </span>
          ${linkData && linkData.url ? `<button onclick="openMeetingModal('${item.id}', '${item.month} ${item.dayNum}', event)" class="text-amber-800 hover:text-amber-950 p-0.5 shrink-0" title="Edit Link"><i data-lucide="edit-3" class="w-3 h-3"></i></button>` : ""}
        </div>`;
      } else {
        statusPillHtml = '<span class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200/70 px-2 py-0.5 rounded-md truncate"><i data-lucide="calendar" class="w-3 h-3 text-slate-400 shrink-0"></i><span class="truncate">Regular Class</span></span>';
      }

      // Online Makeup Zoom Button
      let meetingLinkHtml = "";
      if (item.isMakeup) {
        if (linkData && linkData.url) {
          const aliasText = linkData.alias || "Join Meeting";
          meetingLinkHtml = `
            <div class="mt-2" onclick="event.stopPropagation()">
              <a href="${linkData.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 w-full justify-center text-[11px] font-bold text-amber-950 bg-amber-300 hover:bg-amber-400 px-2 py-1 rounded-lg border border-amber-400 transition-colors truncate touch-manipulation shadow-2xs" title="${linkData.url}">
                <i data-lucide="video" class="w-3.5 h-3.5 text-amber-900 shrink-0"></i>
                <span class="truncate">${aliasText}</span>
                <i data-lucide="external-link" class="w-3 h-3 text-amber-900 shrink-0"></i>
              </a>
            </div>
          `;
        } else {
          meetingLinkHtml = `
            <div class="mt-2" onclick="event.stopPropagation()">
              <button onclick="openMeetingModal('${item.id}', '${item.month} ${item.dayNum}', event)" class="inline-flex items-center gap-1 w-full justify-center text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-lg border border-amber-300 transition-colors touch-manipulation cursor-pointer">
                <i data-lucide="link" class="w-3.5 h-3.5"></i> + Add Link
              </button>
            </div>
          `;
        }
      }

      // Tasks / Evals
      let evalsHtml = "";
      if (dayEvals.length > 0) {
        evalsHtml = `<div class="mt-2 space-y-1" onclick="event.stopPropagation()">`;
        dayEvals.forEach((ev) => {
          let evBadge = "bg-rose-50 text-rose-800 border-rose-200";
          if (ev.type === "Presentation") evBadge = "bg-indigo-50 text-indigo-800 border-indigo-200";
          if (ev.type === "Assignment Deadline") evBadge = "bg-cyan-50 text-cyan-800 border-cyan-200";
          if (ev.type === "Update") evBadge = "bg-amber-50 text-amber-800 border-amber-200";

          evalsHtml += `
            <div class="p-1 rounded-lg border text-[11px] ${evBadge} ${ev.done ? "line-through opacity-60" : "font-semibold"} flex items-center justify-between gap-1 shadow-2xs">
              <div class="truncate">
                <span class="font-extrabold uppercase mr-0.5">${ev.code}:</span>
                <span>${ev.desc}</span>
              </div>
              <button onclick="deleteEvaluation('${ev.id}', event)" class="text-slate-400 hover:text-rose-600 shrink-0 p-0.5" title="Remove Task">
                &times;
              </button>
            </div>
          `;
        });
        evalsHtml += `</div>`;
      }

      card.className = `relative flex flex-col justify-between p-3.5 rounded-2xl transition-all cursor-pointer select-none calendar-tile-pop touch-manipulation h-full min-h-[145px] ${borderStyle}`;
      card.onclick = (e) => toggleClass(item.id, e);

      card.innerHTML = `
        <div>
          <!-- Pinned Top Date & Track Header -->
          <div class="flex items-center justify-between gap-1 mb-2">
            <div class="flex items-baseline gap-1">
              <span class="text-sm font-black text-slate-900 tracking-tight">
                ${item.month} ${item.dayNum}
              </span>
              <span class="text-[11px] font-bold text-slate-500 uppercase">
                ${item.dayName}
              </span>
            </div>
            <span class="text-[11px] px-2 py-0.5 rounded-md ${trackBadgeClass} shrink-0 whitespace-nowrap">
              ${item.isMakeup ? 'MAKEUP' : item.track + ' #' + item.classNo}
            </span>
          </div>

          <!-- Compact Status Pill -->
          <div class="space-y-1">
            ${statusPillHtml}
          </div>

          ${meetingLinkHtml}
          ${evalsHtml}
        </div>

        <!-- Pinned Bottom Action Row -->
        <div class="mt-3 pt-2 border-t ${isDone ? "border-emerald-200" : (temporal === "TODAY" ? "border-indigo-200/80" : "border-slate-100")} flex items-center justify-between gap-1.5" onclick="event.stopPropagation()">
          <button onclick="openEvalModal('${item.id}', '${item.month} ${item.dayNum}, 2026', event)" class="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer touch-manipulation shrink-0" title="Add Assessment for this Date">
            <i data-lucide="plus" class="w-3 h-3"></i> Eval
          </button>
          <button onclick="toggleClass('${item.id}', event)" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer touch-manipulation shrink-0 ${
            isDone
              ? "bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700"
              : (temporal === "TODAY"
                ? "bg-indigo-600 text-white shadow-2xs hover:bg-indigo-700"
                : (temporal === "PAST"
                  ? "bg-slate-200 text-slate-700 border border-slate-300 hover:bg-slate-300"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"))
          }" title="${isDone ? "Marked as attended (tap to unmark)" : "Tap to mark attended"}">
            <i data-lucide="${isDone ? "check" : (temporal === "TODAY" ? "clock" : "circle")}" class="w-3 h-3 stroke-[2.5]"></i>
            <span>${isDone ? "Attended" : (temporal === "TODAY" ? "Attend" : "Mark")}</span>
          </button>
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

  // Auto-scroll to today's active tile if requested (e.g. on navigation, not on toggle)
  if (autoScroll) {
    const todayTile = document.getElementById("today-calendar-tile");
    if (todayTile && typeof todayTile.scrollIntoView === "function") {
      setTimeout(() => {
        todayTile.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }

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
            let cardBorder = "border-2 border-indigo-200 bg-white hover:border-indigo-400";
            let trackPillColor = "bg-indigo-50 text-indigo-700 border border-indigo-200";
            let trackBarColor = "bg-indigo-600";
            if (t === "SUN") {
              cardBorder = "border-2 border-sky-200 bg-white hover:border-sky-400";
              trackPillColor = "bg-sky-50 text-sky-700 border border-sky-200";
              trackBarColor = "bg-sky-600";
            } else if (t === "TUE") {
              cardBorder = "border-2 border-emerald-200 bg-white hover:border-emerald-400";
              trackPillColor = "bg-emerald-50 text-emerald-700 border border-emerald-200";
              trackBarColor = "bg-emerald-600";
            } else if (t === "WED") {
              cardBorder = "border-2 border-purple-200 bg-white hover:border-purple-400";
              trackPillColor = "bg-purple-50 text-purple-700 border border-purple-200";
              trackBarColor = "bg-purple-600";
            }
            card.className = `p-5 rounded-2xl shadow-2xs flex flex-col justify-between space-y-4 card-hover-pop transition-all ${cardBorder}`;
            card.innerHTML = `
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-xs font-bold uppercase tracking-wider text-slate-400">${t} Track</span>
                                <span class="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">${trackDone} / 12</span>
                            </div>
                            <div class="flex items-baseline gap-2 mt-1"><h3 class="text-2xl font-black text-slate-900">${trackPct}%</h3><span class="text-xs font-medium text-slate-500">(${12 - trackDone} remaining)</span></div>
                        </div>

                        <div class="space-y-2">
                            <div class="flex justify-between text-xs font-semibold">
                                <span class="text-slate-500">Progress</span>
                                <span class="text-slate-900 font-bold">${trackPct}%</span>
                            </div>
                            <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <div class="h-full ${trackBarColor} rounded-full transition-all duration-500" style="width: ${trackPct}%"></div>
                            </div>
                        </div>

                        <div class="grid grid-cols-6 gap-1.5 pt-2 border-t border-slate-100">
                            ${trackClasses
                              .map((c) => {
                                const isC = completedClasses.has(c.id);
                                const temporal = getTemporalState(c.dateStr);
                                let pillClass = "";
                                let pillTitle = `${c.month} ${c.dayNum} (${c.dayName}) - Class #${c.classNo}`;
                                if (isC) {
                                  pillClass = "bg-emerald-500 text-white shadow-xs";
                                  pillTitle += " - Attended";
                                } else if (temporal === "TODAY") {
                                  pillClass = "bg-indigo-600 text-white font-extrabold shadow-sm ring-1 ring-indigo-400";
                                  pillTitle += " - Today";
                                } else if (temporal === "PAST") {
                                  pillClass = "bg-slate-200 text-slate-500 border border-slate-300/80 opacity-70";
                                  pillTitle += " - Passed";
                                } else {
                                  pillClass = "bg-slate-100 text-slate-700 border border-slate-200";
                                  pillTitle += " - Upcoming";
                                }
                                return `<div onclick="openClassInGrid('${c.id}', event)" title="${pillTitle} • Click to view in Calendar Grid" class="h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${pillClass} cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-indigo-400 transition-all">${c.classNo}</div>`;
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
            const temporal = getTemporalState(c.dateStr);
            const item = document.createElement("div");

            let temporalPill = "";
            if (temporal === "TODAY") {
              temporalPill = '<span class="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-indigo-600 text-white shadow-xs">Today</span>';
            } else if (temporal === "PAST" && !isDone) {
              temporalPill = '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-600 border border-slate-300">Passed</span>';
            }

            item.onclick = (e) => openClassInGrid(c.id, e);
            item.title = "Click to view lecture in Calendar Grid";
            item.className = `flex items-center justify-between p-2.5 sm:p-3 rounded-xl border text-xs transition-all card-hover-pop-subtle cursor-pointer group hover:border-indigo-300 ${
              isDone
                ? "bg-emerald-50/70 border-emerald-200"
                : (temporal === "TODAY"
                  ? "bg-white border-indigo-500 ring-2 ring-indigo-500/30"
                  : (temporal === "PAST"
                    ? "bg-slate-100/70 border-slate-200 opacity-75 hover:opacity-100"
                    : "bg-white border-slate-200/90 hover:bg-slate-50/80"))
            }`;

            item.innerHTML = `
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <span class="font-bold ${isDone ? "text-slate-900" : (temporal === "PAST" ? "text-slate-500" : "text-slate-900")} w-16 shrink-0">${c.month} ${c.dayNum}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-700 shrink-0">${c.dayName}</span>
                ${temporalPill}
                <span class="text-slate-600 font-medium truncate group-hover:text-indigo-600 transition-colors">
                  Track: <strong class="text-slate-900">${c.track}</strong> (#${c.classNo})
                </span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                ${c.isMakeup ? '<span class="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-200">Makeup</span>' : ""}
                <button onclick="toggleClass('${c.id}', event)" class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  isDone
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                    : (temporal === "PAST"
                      ? "bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold"
                      : "bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200")
                }" title="Toggle Attendance">
                  ${isDone ? "Attended" : (temporal === "PAST" ? "Passed" : "Mark Attended")}
                </button>
                <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors hidden sm:block"></i>
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
            const linkData = makeupMeetingLinks[c.id];
            const item = document.createElement("div");

            item.onclick = (e) => openClassInGrid(c.id, e);
            item.title = "Click to view makeup lecture in Calendar Grid";
            item.className = `p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 card-hover-pop-subtle cursor-pointer group hover:border-amber-400 transition-all ${
              isDone
                ? "bg-emerald-50/70 border-emerald-200"
                : "bg-gradient-to-r from-amber-50/60 via-amber-50/20 to-white border-amber-200/90"
            }`;

            item.innerHTML = `
              <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                <div class="p-2.5 rounded-xl bg-amber-100 text-amber-800 border border-amber-200 shrink-0 mt-0.5 sm:mt-0">
                  <i data-lucide="video" class="w-4 h-4"></i>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-amber-800 transition-colors">${c.month} ${c.dayNum} (${c.dayName})</h4>
                    <span class="text-[10px] font-extrabold px-2 py-0.5 bg-amber-200/80 text-amber-950 border border-amber-300 rounded-md">For ${c.makeupFor} Track</span>
                  </div>
                  <p class="text-xs text-slate-500 font-medium mt-0.5 truncate flex items-center gap-1.5">
                    <span>Counts as ${c.makeupFor} Class #${c.classNo}</span>
                    <span class="text-amber-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">&bull; View in Grid &rarr;</span>
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                ${linkData && linkData.url
                  ? `<a href="${linkData.url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-2xs" title="${linkData.alias || "Join Makeup Class"}">
                      <i data-lucide="video" class="w-3.5 h-3.5"></i>
                      <span>${linkData.alias || "Join"}</span>
                      <i data-lucide="external-link" class="w-3 h-3"></i>
                     </a>`
                  : `<button onclick="openMeetingModal('${c.id}', '${c.month} ${c.dayNum}', event)" class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-100/80 hover:bg-amber-200 text-amber-800 border border-amber-200 transition-colors cursor-pointer" title="Add Meeting Link">
                      <i data-lucide="link" class="w-3 h-3"></i>
                      <span>Link</span>
                     </button>`
                }
                <button onclick="toggleClass('${c.id}', event)" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isDone
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                    : "bg-amber-600 hover:bg-amber-500 text-white shadow-2xs"
                }">
                  ${isDone ? "Attended" : "Mark Attended"}
                </button>
              </div>
            `;
            makeupList.appendChild(item);
          });
        }

        lucide.createIcons();
      }

      function openEvalModal(dateId, dateDisplay, event) {
        if (event) event.stopPropagation();
        const classObj = ALL_CLASSES.find((c) => c.id === dateId);
        const targetDateStr = classObj
          ? classObj.dateStr
          : (dateDisplay && dateDisplay.match(/^\d{4}-\d{2}-\d{2}$/) ? dateDisplay : getTodayStr());

        const dId = document.getElementById("eval-date-id");
        const dStr = document.getElementById("eval-date-str");
        const dInput = document.getElementById("eval-date-input");
        const modal = document.getElementById("eval-modal");

        if (dId) dId.value = classObj ? classObj.id : (dateId || "manual-" + targetDateStr);
        if (dStr) dStr.value = targetDateStr;
        if (dInput) {
          dInput.value = targetDateStr;
          onEvalDateChange(targetDateStr);
        }
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
        const dateInput = document.getElementById("eval-date-input");
        const dateStr = (dateInput && dateInput.value) ? dateInput.value : document.getElementById("eval-date-str").value;
        const matchClass = ALL_CLASSES.find((c) => c.dateStr === dateStr);
        const dateId = matchClass ? matchClass.id : "manual-" + dateStr;
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
        renderHome();
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
          renderHome();
          renderCalendar();
        }
        closeMeetingModal();
      }

      function toggleEvalDone(id, event) {
        if (event) event.stopPropagation();
        const ev = userEvaluations.find((e) => e.id === id);
        if (ev) {
          ev.done = !ev.done;
          saveState();
          renderHome();
          renderEvaluations();
          renderCalendar();
        }
      }

      function toggleExamDone(id, event) {
        if (event) event.stopPropagation();
        if (completedExams.has(id)) {
          completedExams.delete(id);
        } else {
          completedExams.add(id);
        }
        saveState();
        renderHome();
        renderEvaluations();
      }

      function deleteEvaluation(id, event) {
        if (event) event.stopPropagation();
        userEvaluations = userEvaluations.filter((e) => e.id !== id);
        saveState();
        renderHome();
        renderCalendar();
        renderEvaluations();
        renderDashboard();
      }

      function filterEvaluations(type) {
        currentEvalFilter = type;
        document.querySelectorAll(".eval-f-btn").forEach((btn) => {
          btn.className =
            "eval-f-btn px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0 touch-manipulation";
        });

        let btnId = "eval-filter-ALL";
        if (type === "Class Test") btnId = "eval-filter-Test";
        if (type === "Presentation") btnId = "eval-filter-Pres";
        if (type === "Assignment Deadline") btnId = "eval-filter-Assign";
        if (type === "Update") btnId = "eval-filter-Upd";

        const activeBtn = document.getElementById(btnId);
        if (activeBtn) {
          let activeClass = "bg-brand-600 text-white border-brand-600 font-bold";
          if (type === "Class Test") {
            activeClass = "bg-rose-600 text-white border-rose-600 font-bold";
          } else if (type === "Presentation") {
            activeClass = "bg-indigo-600 text-white border-indigo-600 font-bold";
          } else if (type === "Assignment Deadline") {
            activeClass = "bg-cyan-600 text-white border-cyan-600 font-bold";
          } else if (type === "Update") {
            activeClass = "bg-amber-500 text-slate-950 border-amber-500 font-extrabold";
          }
          activeBtn.className = `eval-f-btn px-3.5 py-1.5 rounded-xl text-xs border transition-all ${activeClass} shadow-xs cursor-pointer whitespace-nowrap shrink-0 touch-manipulation`;
        }
        renderEvaluations();
      }

      function toggleSection(secId) {
        const sec = document.getElementById(secId);
        const arrow = document.getElementById(secId + "-arrow");
        if (sec) {
          const isNowHidden = sec.classList.toggle("hidden");
          if (arrow) arrow.classList.toggle("rotate-180");
          if (secId.startsWith("month-sec-")) {
            const m = secId.replace("month-sec-", "");
            userMonthToggles[m] = isNowHidden;
          }
        }
      }

      function renderEvaluations() {
        const container = document.getElementById("evaluations-list");
        const midContainer = document.getElementById("midterm-exam-list");
        const finalContainer = document.getElementById("final-exam-list");

        const today = new Date(getTodayStr() + "T00:00:00");

        // 1. Render Midterm Exam Window Days
        if (midContainer) {
          midContainer.innerHTML = "";
          let midCompletedCount = 0;
          MIDTERM_DAYS.forEach((d) => {
            const isDone = completedExams.has(d.id);
            if (isDone) midCompletedCount++;
            const targetDate = new Date(d.dateStr + "T00:00:00");
            const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));

            let urgencyClass = "bg-slate-100 text-slate-700 border-slate-200";
            let urgencyBadge = "";

            if (diffDays < 0) {
              const pastDays = Math.abs(diffDays);
              urgencyClass = "bg-slate-100 text-slate-600 border-slate-200";
              urgencyBadge = `Concluded (${pastDays === 1 ? "1d ago" : pastDays + "d ago"})`;
            } else if (diffDays === 0) {
              urgencyClass = "bg-rose-100 text-rose-800 border-rose-300 font-black animate-pulse";
              urgencyBadge = "Exam Today!";
            } else if (diffDays < 7) {
              urgencyClass = "bg-rose-100 text-rose-800 border-rose-300 font-bold";
              urgencyBadge = `${diffDays === 1 ? "1 Day Left" : diffDays + " Days Left"}`;
            } else if (diffDays <= 14) {
              urgencyClass = "bg-amber-100 text-amber-900 border-amber-200 font-bold";
              urgencyBadge = `${diffDays} Days Left`;
            } else {
              urgencyClass = "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold";
              urgencyBadge = `${diffDays} Days Left`;
            }

            const item = document.createElement("div");
            item.className = `p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs card-hover-pop-subtle transition-all ${
              isDone
                ? "bg-emerald-50/70 border-emerald-200"
                : "bg-white border-amber-200/80 hover:border-amber-400 shadow-2xs"
            }`;
            item.innerHTML = `
              <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <span class="w-7 h-7 rounded-xl ${isDone ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-amber-100 text-amber-950 border-amber-300"} border font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                  ${d.dayNo}
                </span>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-extrabold ${isDone ? "text-slate-400 line-through" : "text-slate-900"} truncate">${d.display}</span>
                    <span class="px-2 py-0.5 rounded-md border text-[10px] font-bold ${urgencyClass} shrink-0 whitespace-nowrap">${urgencyBadge}</span>
                  </div>
                  <p class="text-[11px] text-slate-500 font-medium">Trimester Mid-Term Exam Day #${d.dayNo}</p>
                </div>
              </div>
              <button onclick="toggleExamDone('${d.id}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer touch-manipulation ${
                isDone
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                  : "bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200"
              }">
                <i data-lucide="${isDone ? "check-check" : "circle"}" class="w-3.5 h-3.5 stroke-[2.5]"></i>
                <span>${isDone ? "Done" : "Mark"}</span>
              </button>
            `;
            midContainer.appendChild(item);
          });

          const midBadge = document.getElementById("midterm-done-count");
          if (midBadge) midBadge.innerText = `${midCompletedCount} / ${MIDTERM_DAYS.length} Done`;
        }

        // 2. Render Final Exam Window Days
        if (finalContainer) {
          finalContainer.innerHTML = "";
          let finalCompletedCount = 0;
          FINAL_DAYS.forEach((d) => {
            const isDone = completedExams.has(d.id);
            if (isDone) finalCompletedCount++;
            const targetDate = new Date(d.dateStr + "T00:00:00");
            const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));

            let urgencyClass = "bg-slate-100 text-slate-700 border-slate-200";
            let urgencyBadge = "";

            if (diffDays < 0) {
              const pastDays = Math.abs(diffDays);
              urgencyClass = "bg-slate-100 text-slate-600 border-slate-200";
              urgencyBadge = `Concluded (${pastDays === 1 ? "1d ago" : pastDays + "d ago"})`;
            } else if (diffDays === 0) {
              urgencyClass = "bg-rose-100 text-rose-800 border-rose-300 font-black animate-pulse";
              urgencyBadge = "Final Exam Today!";
            } else if (diffDays < 7) {
              urgencyClass = "bg-rose-100 text-rose-800 border-rose-300 font-bold";
              urgencyBadge = `${diffDays === 1 ? "1 Day Left" : diffDays + " Days Left"}`;
            } else if (diffDays <= 14) {
              urgencyClass = "bg-amber-100 text-amber-900 border-amber-200 font-bold";
              urgencyBadge = `${diffDays} Days Left`;
            } else {
              urgencyClass = "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold";
              urgencyBadge = `${diffDays} Days Left`;
            }

            const item = document.createElement("div");
            item.className = `p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs card-hover-pop-subtle transition-all ${
              isDone
                ? "bg-emerald-50/70 border-emerald-200"
                : "bg-white border-indigo-200/80 hover:border-indigo-400 shadow-2xs"
            }`;
            item.innerHTML = `
              <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <span class="w-7 h-7 rounded-xl ${isDone ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-indigo-100 text-indigo-950 border-indigo-300"} border font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                  ${d.dayNo}
                </span>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-extrabold ${isDone ? "text-slate-400 line-through" : "text-slate-900"} truncate">${d.display}</span>
                    <span class="px-2 py-0.5 rounded-md border text-[10px] font-bold ${urgencyClass} shrink-0 whitespace-nowrap">${urgencyBadge}</span>
                  </div>
                  <p class="text-[11px] text-slate-500 font-medium">Trimester Final Exam Day #${d.dayNo}</p>
                </div>
              </div>
              <button onclick="toggleExamDone('${d.id}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer touch-manipulation ${
                isDone
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                  : "bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200"
              }">
                <i data-lucide="${isDone ? "check-check" : "circle"}" class="w-3.5 h-3.5 stroke-[2.5]"></i>
                <span>${isDone ? "Done" : "Mark"}</span>
              </button>
            `;
            finalContainer.appendChild(item);
          });

          const finalBadge = document.getElementById("final-done-count");
          if (finalBadge) finalBadge.innerText = `${finalCompletedCount} / ${FINAL_DAYS.length} Done`;
        }

        // 3. Render User Custom Added Evaluations List
        if (!container) return;
        container.innerHTML = "";

        let filtered = userEvaluations;
        if (currentEvalFilter !== "ALL") {
          filtered = userEvaluations.filter((e) => e.type === currentEvalFilter);
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
        const bottomBadge = document.getElementById("bottom-eval-badge");
        if (bottomBadge) {
          if (pendingCount > 0) {
            bottomBadge.innerText = pendingCount;
            bottomBadge.classList.remove("hidden");
          } else {
            bottomBadge.classList.add("hidden");
          }
        }
        const evalCountBadge = document.getElementById("eval-count-badge");
        if (evalCountBadge) {
          evalCountBadge.innerText = `${pendingCount} Active ${pendingCount === 1 ? "Task" : "Tasks"}`;
        }

        if (filtered.length === 0) {
          const isFilterActive = currentEvalFilter !== "ALL";
          container.innerHTML = `
            <div class="bg-white p-6 sm:p-8 text-center rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
              <div class="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 border border-brand-200/80 flex items-center justify-center mx-auto shadow-2xs">
                <i data-lucide="${isFilterActive ? "filter" : "pen-tool"}" class="w-6 h-6"></i>
              </div>
              <div>
                <h3 class="text-sm sm:text-base font-extrabold text-slate-800">
                  ${isFilterActive ? `No ${currentEvalFilter}s Found` : "No Custom Assessments Added Yet"}
                </h3>
                <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  ${isFilterActive ? `No tasks found under the ${currentEvalFilter} filter.` : "Schedule your quizzes, class tests, presentations, or assignment deadlines to track countdowns."}
                </p>
              </div>
              <div class="pt-1 flex items-center justify-center gap-2 flex-wrap">
                ${isFilterActive ? `
                  <button onclick="filterEvaluations('ALL')" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer">
                    <i data-lucide="layers" class="w-4 h-4"></i>
                    <span>Show All Types</span>
                  </button>
                ` : ""}
                <button onclick="openHomeEvalModal(event)" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 shadow-sm shadow-brand-500/20 transition-all cursor-pointer">
                  <i data-lucide="plus" class="w-4 h-4 stroke-[2.5]"></i>
                  <span>${isFilterActive ? `Add ${currentEvalFilter}` : "Add First Assessment"}</span>
                </button>
              </div>
            </div>
          `;
          lucide.createIcons();
          return;
        }

        filtered
          .sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr))
          .forEach((ev) => {
            const isDone = ev.done;
            const targetDate = new Date(ev.dateStr + "T00:00:00");
            const diffTime = targetDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let urgencyBadge = "";
            let urgencyClass = "";

            if (diffDays < 0) {
              const overdueDays = Math.abs(diffDays);
              urgencyClass = "bg-rose-100 text-rose-800 border-rose-300 font-bold";
              urgencyBadge = `<span class="inline-flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3 text-rose-600 shrink-0"></i><span>Overdue (${overdueDays}d)</span></span>`;
            } else if (diffDays === 0) {
              urgencyClass = "bg-rose-100 text-rose-800 border-rose-300 font-black animate-pulse";
              urgencyBadge = '<span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span><span>Due Today!</span></span>';
            } else if (diffDays < 7) {
              urgencyClass = "bg-rose-100 text-rose-800 border-rose-200 font-bold";
              urgencyBadge = `<span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span>${diffDays === 1 ? "1 Day Left" : diffDays + " Days Left"}</span></span>`;
            } else if (diffDays <= 14) {
              urgencyClass = "bg-amber-100 text-amber-900 border-amber-200 font-bold";
              urgencyBadge = `<span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span><span>${diffDays} Days Left</span></span>`;
            } else {
              urgencyClass = "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold";
              urgencyBadge = `<span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span>${diffDays} Days Left</span></span>`;
            }

            // Assessment Type Themes (Border, Icon, Badges)
            let typeBadge = "bg-rose-50 text-rose-800 border-rose-200";
            let typeIcon = "file-text";
            let iconBoxStyle = "bg-rose-100 text-rose-700 border-rose-200";
            let cardBorder = "border-2 border-rose-200/90 hover:border-rose-300";

            if (ev.type === "Presentation") {
              typeBadge = "bg-indigo-50 text-indigo-800 border-indigo-200";
              typeIcon = "presentation";
              iconBoxStyle = "bg-indigo-100 text-indigo-700 border-indigo-200";
              cardBorder = "border-2 border-indigo-200/90 hover:border-indigo-300";
            } else if (ev.type === "Assignment Deadline") {
              typeBadge = "bg-cyan-50 text-cyan-900 border-cyan-200";
              typeIcon = "clipboard";
              iconBoxStyle = "bg-cyan-100 text-cyan-800 border-cyan-200";
              cardBorder = "border-2 border-cyan-200/90 hover:border-cyan-300";
            } else if (ev.type === "Update") {
              typeBadge = "bg-amber-50 text-amber-900 border-amber-200";
              typeIcon = "alert-circle";
              iconBoxStyle = "bg-amber-100 text-amber-800 border-amber-200";
              cardBorder = "border-2 border-amber-200/90 hover:border-amber-300";
            }

            if (isDone) {
              cardBorder = "border-2 border-emerald-300 bg-emerald-50/40 hover:border-emerald-400";
            }

            // Human date and matching academic class
            const formattedDate = formatHumanDate(ev.dateStr);
            const matchClass = ALL_CLASSES.find((c) => c.dateStr === ev.dateStr);

            const item = document.createElement("div");
            item.id = `eval-card-${ev.id}`;
            item.className = `p-4 sm:p-5 rounded-3xl transition-all duration-200 card-hover-pop bg-white ${cardBorder} shadow-2xs space-y-3`;

            item.innerHTML = `
              <!-- Top Row: Course Header, Type Chip & Pinned Urgency Badge -->
              <div class="flex items-start justify-between gap-2.5">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-9 h-9 rounded-2xl ${isDone ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : iconBoxStyle} border flex items-center justify-center shrink-0 shadow-2xs">
                    <i data-lucide="${isDone ? "check" : typeIcon}" class="w-4 h-4 stroke-[2.5]"></i>
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs font-black ${isDone ? "text-emerald-950" : "text-slate-900"} tracking-tight">
                        ${ev.code}
                      </span>
                      ${ev.title ? `<span class="text-xs font-semibold text-slate-500 truncate">• ${ev.title}</span>` : ""}
                      <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${typeBadge} shrink-0">
                        ${ev.type}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Pinned Single-Line Urgency Pill (Never Wraps) -->
                <div class="shrink-0">
                  <span class="px-2.5 py-1 rounded-xl border text-[11px] font-bold ${urgencyClass} whitespace-nowrap shadow-2xs inline-block">
                    ${urgencyBadge}
                  </span>
                </div>
              </div>

              <!-- Middle Section: Main Task Topic & Academic Date Context -->
              <div class="space-y-1.5 pl-0.5">
                <h3 class="text-sm sm:text-base font-extrabold ${isDone ? "text-slate-400 line-through" : "text-slate-900"} leading-snug">
                  ${ev.desc}
                </h3>
                <div class="flex items-center gap-2 flex-wrap text-xs text-slate-500 font-medium">
                  <span class="inline-flex items-center gap-1">
                    <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
                    <strong class="text-slate-700">${formattedDate}</strong>
                  </span>
                  ${matchClass ? `
                    <span class="text-slate-300">•</span>
                    <span class="inline-flex items-center gap-1 font-semibold text-slate-600">
                      <span>Class #${matchClass.classNo} (${matchClass.track} Track)</span>
                      <button onclick="openClassInGrid('${matchClass.id}', event)" class="text-brand-600 hover:text-brand-800 hover:underline font-bold ml-1 cursor-pointer">
                        View in Grid &rarr;
                      </button>
                    </span>
                  ` : ""}
                </div>
              </div>

              <!-- Pinned Bottom Action Footer: Status & Action Buttons -->
              <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2" onclick="event.stopPropagation()">
                <div class="text-xs font-bold">
                  ${isDone ? `
                    <span class="text-emerald-700 flex items-center gap-1.5 text-[11px]">
                      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Completed</span>
                    </span>
                  ` : `
                    <span class="text-amber-700 flex items-center gap-1.5 text-[11px]">
                      <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      <span>Pending Assessment</span>
                    </span>
                  `}
                </div>

                <div class="flex items-center gap-2">
                  <button onclick="toggleEvalDone('${ev.id}')" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer touch-manipulation ${
                    isDone
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                      : "bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
                  }">
                    <i data-lucide="${isDone ? "check-check" : "circle"}" class="w-3.5 h-3.5 stroke-[2.5]"></i>
                    <span>${isDone ? "Completed" : "Mark Done"}</span>
                  </button>
                  <button onclick="deleteEvaluation('${ev.id}', event)" class="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors cursor-pointer touch-manipulation" title="Delete Task">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            `;

            container.appendChild(item);
          });

        lucide.createIcons();
      }

      function toggleEvent(id, event) {
        if (event && typeof event.stopPropagation === "function") {
          event.stopPropagation();
        }
        if (completedEvents.has(id)) {
          completedEvents.delete(id);
        } else {
          completedEvents.add(id);
        }
        saveState();
        renderHome();
        renderEvents();
      }

      function setEventFilter(filter) {
        currentEventFilter = filter;
        document.querySelectorAll(".event-filter-btn").forEach((btn) => {
          btn.className =
            "event-filter-btn px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0 touch-manipulation flex items-center justify-center";
        });
        const activeBtn = document.getElementById(`event-filter-${filter}`);
        if (activeBtn) {
          let activeClass = "bg-brand-600 text-white border-brand-600 font-bold";
          if (filter === "EXAM") activeClass = "bg-rose-600 text-white border-rose-600 font-bold";
          else if (filter === "PAYMENT") activeClass = "bg-emerald-600 text-white border-emerald-600 font-bold";
          else if (filter === "HOLIDAY") activeClass = "bg-amber-500 text-slate-950 border-amber-500 font-extrabold";
          else if (filter === "ACADEMIC") activeClass = "bg-indigo-600 text-white border-indigo-600 font-bold";
          activeBtn.className = `event-filter-btn px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs border transition-all ${activeClass} shadow-xs cursor-pointer whitespace-nowrap shrink-0 touch-manipulation flex items-center justify-center`;
        }
        renderEvents();
      }

      function renderEvents() {
        const container = document.getElementById("events-container");
        if (!container) return;

        container.innerHTML = "";
        const todayStr = getTodayStr();
        const today = new Date(todayStr + "T00:00:00");

        const filtered = ACADEMIC_EVENTS.filter((evt) => {
          if (currentEventFilter === "ALL") return true;
          return evt.category === currentEventFilter;
        });

        if (filtered.length === 0) {
          container.innerHTML = `
            <div class="bg-white p-6 sm:p-8 text-center rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
              <div class="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 border border-brand-200/80 flex items-center justify-center mx-auto shadow-2xs">
                <i data-lucide="calendar" class="w-6 h-6"></i>
              </div>
              <div>
                <h3 class="text-sm sm:text-base font-extrabold text-slate-800">No ${currentEventFilter} Events Found</h3>
                <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1">There are no academic events currently listed under this category.</p>
              </div>
              <div class="pt-1">
                <button onclick="setEventFilter('ALL')" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer">
                  <i data-lucide="layers" class="w-4 h-4"></i>
                  <span>Show All Events</span>
                </button>
              </div>
            </div>
          `;
          lucide.createIcons();
          return;
        }

        filtered.forEach((evt) => {
          const evtDateStr = evt.dateStr || parseEventDate(evt.dateDisplay);
          const targetDate = new Date(evtDateStr + "T00:00:00");
          const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
          const isToday = (evtDateStr === todayStr) || (diffDays === 0);
          const isPast = diffDays < 0;

          // Category Visual Theme Styles
          let catBadge = "bg-indigo-50 text-indigo-800 border-indigo-200";
          let iconName = "calendar";
          let iconBoxStyle = "bg-indigo-100 text-indigo-700 border-indigo-200";
          let cardBorder = "border-2 border-indigo-200/90 hover:border-indigo-300";

          if (evt.category === "EXAM") {
            catBadge = "bg-rose-50 text-rose-800 border-rose-200";
            iconName = "file-text";
            iconBoxStyle = "bg-rose-100 text-rose-700 border-rose-200";
            cardBorder = "border-2 border-rose-200/90 hover:border-rose-300";
          } else if (evt.category === "PAYMENT") {
            catBadge = "bg-emerald-50 text-emerald-800 border-emerald-200";
            iconName = "credit-card";
            iconBoxStyle = "bg-emerald-100 text-emerald-700 border-emerald-200";
            cardBorder = "border-2 border-emerald-200/90 hover:border-emerald-300";
          } else if (evt.category === "HOLIDAY") {
            catBadge = "bg-amber-50 text-amber-900 border-amber-200";
            iconName = "sun";
            iconBoxStyle = "bg-amber-100 text-amber-800 border-amber-200";
            cardBorder = "border-2 border-amber-200/90 hover:border-amber-300";
          } else if (evt.category === "ACADEMIC") {
            catBadge = "bg-indigo-50 text-indigo-800 border-indigo-200";
            iconName = "clock";
            iconBoxStyle = "bg-indigo-100 text-indigo-700 border-indigo-200";
            cardBorder = "border-2 border-indigo-200/90 hover:border-indigo-300";
          }

          if (isToday) {
            cardBorder = "border-2 border-brand-500 bg-gradient-to-r from-brand-50/40 via-white to-white ring-2 ring-brand-500/20 shadow-md";
          } else if (isPast) {
            cardBorder = "border border-slate-200 bg-slate-50/70 text-slate-500 opacity-75 hover:opacity-100 shadow-none";
          }

          // Single-line compact countdown badge (No fake "Acknowledged" status!)
          let urgencyClass = "bg-slate-100 text-slate-700 border-slate-200";
          let urgencyBadge = "";

          if (isToday) {
            urgencyClass = "bg-rose-100 text-rose-800 border-rose-300 font-black animate-pulse";
            urgencyBadge = '<span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span><span>Happening Today!</span></span>';
          } else if (isPast) {
            const pastDays = Math.abs(diffDays);
            urgencyClass = "bg-slate-100 text-slate-600 border-slate-200 font-medium";
            urgencyBadge = `<span class="inline-flex items-center gap-1"><i data-lucide="check" class="w-3 h-3 text-slate-400"></i><span>Concluded (${pastDays === 1 ? "1d ago" : pastDays + "d ago"})</span></span>`;
          } else if (diffDays === 1) {
            urgencyClass = "bg-rose-100 text-rose-800 border-rose-200 font-bold";
            urgencyBadge = '<span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span>Tomorrow</span></span>';
          } else if (diffDays < 7) {
            urgencyClass = "bg-rose-100 text-rose-800 border-rose-200 font-bold";
            urgencyBadge = `<span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span>${diffDays} Days Left</span></span>`;
          } else if (diffDays <= 14) {
            urgencyClass = "bg-amber-100 text-amber-900 border-amber-200 font-bold";
            urgencyBadge = `<span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span><span>${diffDays} Days Left</span></span>`;
          } else {
            urgencyClass = "bg-slate-100 text-slate-700 border-slate-200 font-semibold";
            urgencyBadge = `<span class="inline-flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3 text-slate-400"></i><span>${diffDays} Days Left</span></span>`;
          }

          const item = document.createElement("div");
          item.id = `event-card-${evt.id}`;
          item.className = `p-4 sm:p-5 rounded-3xl transition-all duration-200 card-hover-pop bg-white ${cardBorder} shadow-2xs space-y-3`;

          item.innerHTML = `
            <!-- Top Row: Date, Category Chip & Pinned Urgency Badge -->
            <div class="flex items-start justify-between gap-2.5">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-2xl ${isPast ? "bg-slate-100 text-slate-600 border border-slate-200" : iconBoxStyle} border flex items-center justify-center shrink-0 shadow-2xs">
                  <i data-lucide="${iconName}" class="w-4 h-4 stroke-[2.5]"></i>
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-black ${isPast ? "text-slate-600" : "text-slate-900"} tracking-tight">
                      ${evt.dateDisplay} (${evt.dayName})
                    </span>
                    <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${catBadge} shrink-0">
                      ${evt.category}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Pinned Single-Line Urgency Pill (Never Wraps) -->
              <div class="shrink-0">
                <span class="px-2.5 py-1 rounded-xl border text-[11px] font-bold ${urgencyClass} whitespace-nowrap shadow-2xs inline-block">
                  ${urgencyBadge}
                </span>
              </div>
            </div>

            <!-- Middle Section: Main Event Title & Description Note -->
            <div class="space-y-1 pl-0.5">
              <h3 class="text-sm sm:text-base font-extrabold ${isPast ? "text-slate-600" : "text-slate-900"} leading-snug">
                ${evt.title}
              </h3>
              <p class="text-xs text-slate-500 leading-relaxed">
                ${evt.note}
              </p>
            </div>

            <!-- Pinned Bottom Context Row -->
            <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
              <div class="text-xs font-bold">
                ${isToday ? `
                  <span class="text-brand-700 flex items-center gap-1.5 text-[11px]">
                    <span class="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
                    <span>Active Today</span>
                  </span>
                ` : isPast ? `
                  <span class="text-slate-400 flex items-center gap-1.5 text-[11px]">
                    <span class="w-2 h-2 rounded-full bg-slate-300"></span>
                    <span>Past University Milestone</span>
                  </span>
                ` : `
                  <span class="text-indigo-700 flex items-center gap-1.5 text-[11px]">
                    <i data-lucide="bell" class="w-3.5 h-3.5 text-indigo-500"></i>
                    <span>Official University Notice</span>
                  </span>
                `}
              </div>

              <button onclick="openHomeEvalModal(event)" class="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer touch-manipulation" title="Add personal assessment or task for this event">
                <i data-lucide="plus" class="w-3 h-3"></i> Task
              </button>
            </div>
          `;

          container.appendChild(item);
        });

        lucide.createIcons();
      }

      // ─── Firebase Cloud Sync Engine ──────────────────────────────────────────
      // 8-Character Random String Generator (e.g. X9K2-M7P4)
      function generateRaw8CharToken() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let part1 = "",
          part2 = "";
        for (let i = 0; i < 4; i++) {
          part1 += chars.charAt(Math.floor(Math.random() * chars.length));
          part2 += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `${part1}-${part2}`;
      }

      // Generate Unique 8-Character Sync Code with Database Existence Check
      async function initSyncCode() {
        let code = localStorage.getItem(SYNC_CODE_KEY);

        // If no code saved or upgrading from an old 4-character code format
        if (!code || code.length < 18) {
          let isUnique = false;
          let candidateCode = "";

          while (!isUnique) {
            candidateCode = `FALL-2026-${generateRaw8CharToken()}`;

            // Database existence check
            if (db) {
              try {
                const snapshot = await db
                  .ref("UIU_Calendar_263/sync_sessions/" + candidateCode)
                  .once("value");
                if (!snapshot.exists()) {
                  isUnique = true;
                }
              } catch (e) {
                console.warn(
                  "Could not check database existence, proceeding with high-entropy token.",
                  e,
                );
                isUnique = true;
              }
            } else {
              isUnique = true;
            }
          }

          code = candidateCode;
          localStorage.setItem(SYNC_CODE_KEY, code);
        }

        syncCode = code.toUpperCase();
        const displayEl = document.getElementById("sync-code-display");
        if (displayEl) displayEl.innerText = syncCode;
      }

      function setupFirebaseSync() {
        if (!db || !syncCode) return;

        if (syncRef) syncRef.off();
        syncRef = db.ref("UIU_Calendar_263/sync_sessions/" + syncCode);

        syncRef.on("value", (snapshot) => {
          const data = snapshot.val();
          if (data) {
            isRemoteUpdating = true;
            completedClasses = new Set(data.completedClasses || []);
            completedEvents = new Set(data.completedEvents || []);
            completedExams = new Set(data.completedExams || []);
            userEvaluations = data.userEvaluations || [];
            makeupMeetingLinks = data.makeupMeetingLinks || {};

            // Update Local Storage
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

            // Re-render UI
            syncPastClassesAndEvents();
            renderHome();
            renderCalendar();
            renderDashboard();
            renderEvaluations();
            renderEvents();

            isRemoteUpdating = false;
          } else {
            // Push current state if new node
            saveState();
          }
        });
      }

      function openSyncModal() {
        const modal = document.getElementById("sync-modal");
        const displayEl = document.getElementById("sync-code-display");
        if (displayEl) displayEl.innerText = syncCode || "GENERATING...";
        if (modal) modal.classList.remove("hidden");
      }

      function closeSyncModal() {
        const modal = document.getElementById("sync-modal");
        const msg = document.getElementById("sync-status-msg");
        if (modal) modal.classList.add("hidden");
        if (msg) msg.classList.add("hidden");
      }

      function copySyncCode() {
        if (syncCode) {
          navigator.clipboard.writeText(syncCode);
          const msg = document.getElementById("sync-status-msg");
          if (msg) {
            msg.innerText = "Sync code copied to clipboard!";
            msg.classList.remove("hidden");
          }
        }
      }

      function connectSyncCode(e) {
        e.preventDefault();
        const inputVal = document
          .getElementById("input-sync-code")
          .value.trim()
          .toUpperCase();
        if (!inputVal) return;

        syncCode = inputVal;
        localStorage.setItem(SYNC_CODE_KEY, syncCode);
        const displayEl = document.getElementById("sync-code-display");
        if (displayEl) displayEl.innerText = syncCode;

        setupFirebaseSync();

        const msg = document.getElementById("sync-status-msg");
        if (msg) {
          msg.innerText = "Connected to session " + syncCode + " successfully!";
          msg.classList.remove("hidden");
        }

        setTimeout(() => {
          closeSyncModal();
        }, 1200);
      }

      function syncPastClassesAndEvents() {
        const now = new Date(); // Current live time

        let stateChanged = false;

        ALL_CLASSES.forEach((c) => {
          // Construct target completion time for each class (4:30 PM / 16:30 on class date)
          const classCutoff = new Date(c.dateStr + "T16:30:00");

          if (now >= classCutoff && !completedClasses.has(c.id) && !unmarkedClasses.has(c.id)) {
            completedClasses.add(c.id);
            stateChanged = true;
          }
        });

        if (stateChanged) {
          saveState();
        }
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
        unmarkedClasses.clear();
        localStorage.removeItem(UNMARKED_STORAGE_KEY);
        completedEvents.clear();
        completedExams.clear();
        userEvaluations = [];
        makeupMeetingLinks = {};
        saveState();
        renderHome();
        renderCalendar();
        renderDashboard();
        renderEvaluations();
        renderEvents();
        updateNavigation();
        closeResetModal();
      }

      function exportDataJson() {
        const payload = {
          app: "UIU Academic Calendar 263",
          version: "2.0",
          exportedAt: new Date().toISOString(),
          term: "UIU Trimester 263",
          completedClasses: Array.from(completedClasses),
          unmarkedClasses: Array.from(unmarkedClasses),
          completedEvents: Array.from(completedEvents),
          completedExams: Array.from(completedExams),
          userEvaluations: userEvaluations,
          makeupMeetingLinks: makeupMeetingLinks,
          syncCode: syncCode || null,
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `uiu-calendar-263-backup-${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }

      if (typeof window !== "undefined") {
        // Global click-outside listener to dismiss mobile navigation overlay
        if (typeof document !== "undefined") {
          document.addEventListener("click", (event) => {
            const panel = document.getElementById("mobile-nav-panel");
            const btn = document.getElementById("mobile-menu-btn");
            if (!panel || panel.classList.contains("hidden")) return;
            if (panel.contains(event.target) || (btn && (btn === event.target || btn.contains(event.target)))) return;
            toggleMobileMenu(false);
          });
        }

        window.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            toggleMobileMenu(false);
          }
        });

        window.addEventListener("resize", () => {
          if (window.innerWidth >= 1024) {
            toggleMobileMenu(false);
          }
        });
      }

      // Initialize App on DOM Ready
      window.addEventListener("DOMContentLoaded", async () => {
        await initSyncCode();
        loadState();
        syncPastClassesAndEvents();
        renderHome();
        renderCalendar();
        renderDashboard();
        renderEvaluations();
        renderEvents();
        switchPage(currentPage);
        setupFirebaseSync();
        lucide.createIcons();
      });

      // Synchronize across open tabs on same browser
      window.addEventListener("storage", () => {
        loadState();
        syncPastClassesAndEvents();
        renderHome();
        renderCalendar();
        renderDashboard();
        renderEvaluations();
        renderEvents();
      });

      // Auto-update calculations when returning/focusing on tab
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          syncPastClassesAndEvents();
          renderHome();
          renderCalendar();
          renderDashboard();
          renderEvaluations();
          renderEvents();
        }
      });