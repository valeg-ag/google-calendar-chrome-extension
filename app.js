// ==UserScript==
// @name         Google Calendar tweaks
// @match        https://calendar.google.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

const DEBUG = false;

function mark(text) {
    if( !DEBUG ) return;

    let box = document.getElementById("tm-debug");
    if (!box) {
        box = document.createElement("div");
        box.id = "tm-debug";
        box.style.cssText = "position:fixed;top:0;left:0;z-index:999999;background:#ff0;color:#000;font:12px monospace;padding:2px";
        (document.body || document.documentElement).appendChild(box);
    }
    box.textContent += text + " ";
}

function addFullscreenButton() {
    if (document.getElementById("tm-fs-btn")) return;

    const btn = document.createElement("button");
    btn.id = "tm-fs-btn";
    btn.textContent = "⛶";
    btn.style.cssText =
        "position:fixed;right:8px;bottom:8px;z-index:2147483647;" +
        "width:40px;height:40px;border-radius:20px;border:none;" +
        "background:rgba(0,0,0,.55);color:#fff;font-size:18px;line-height:1;" +
        "box-shadow:0 2px 6px rgba(0,0,0,.3)";

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen().catch((err) => {
                console.warn("fullscreen failed", err);
            });
        }
    });

    (document.body || document.documentElement).appendChild(btn);
}

addFullscreenButton();
setInterval(addFullscreenButton, 2000);

mark("injected");

// ---------------------------------------------------------------------------
// Hide calendar chips (tasks and events alike) whose title matches a mask
// ---------------------------------------------------------------------------

const HIDE_TASKS_LS_ENABLED = "gc-tweaks-hide-tasks-enabled";
const HIDE_TASKS_LS_MASK = "gc-tweaks-hide-tasks-mask";

function lsGet(key, def) {
    try {
        const v = localStorage.getItem(key);
        return v === null ? def : v;
    } catch (e) {
        return def;
    }
}

function lsSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) { /* ignore */ }
}

function getHideTasksMask() {
    return lsGet(HIDE_TASKS_LS_MASK, '');
}

// The mask is a regular expression matched against the title,
// so "таб.*" means "title contains таб" and "^таб.*" means
// "title starts with таб". For ^ to be useful the title has to be stripped
// of what google prepends to it (time, "Задача:", bullets) - see
// expandTitleVariants below.
function getHideTasksMaskRegExp() {
    const mask = getHideTasksMask();
    if (!mask) {
        return undefined;
    }

    try {
        return new RegExp(mask, "i");
    } catch (e) {
        console.warn("[gc-tweaks] bad mask, ignored:", mask, e);
        return undefined;
    }
}

// Several selectors, because the markup differs between calendar views.
const GC_CHIP_SELECTORS = [
    "[data-eventchip]",
    "[data-eventid]",
    "[role='button'][data-eventid]",
    "[data-stable-eventid]",
    "div[jslog][data-eventid]"
];

function collectChips() {
    const seen = new Set();
    const chips = [];

    for (const sel of GC_CHIP_SELECTORS) {
        for (const el of document.querySelectorAll(sel)) {
            if (!seen.has(el)) {
                seen.add(el);
                chips.push(el);
            }
        }
    }

    return chips;
}

// Every string that could carry the title, so the mask has a chance to match
// even when google puts the time or a prefix into the visible text.
function getChipTitleCandidates(chip) {
    const out = [];

    const push = (v) => {
        if (v) {
            const t = String(v).trim();
            if (t && out.indexOf(t) === -1) {
                out.push(t);
            }
        }
    };

    const withText = chip.querySelector("[data-text]");
    if (withText) {
        push(withText.getAttribute("data-text"));
    }

    push(chip.getAttribute("data-text"));
    push(chip.getAttribute("aria-label"));
    push(chip.getAttribute("title"));
    push(chip.getAttribute("data-tooltip"));
    push(chip.textContent);

    return out;
}

// Google puts the time and various prefixes in front of the title and glues
// extra parts behind it, so one raw string is not enough for an anchored mask
// like "^таб.*". Produce the plausible "bare title" variants of a string:
// the string itself, the parts it splits into, and those parts without a
// leading time / label / bullet.
function expandTitleVariants(text) {
    const out = [];

    const push = (v) => {
        if (v) {
            const t = String(v).trim();
            if (t && out.indexOf(t) === -1) {
                out.push(t);
            }
        }
    };

    // leading time: "10:00", "10:00 - 11:30", "10:00 AM", "10.00"
    const TIME_PREFIX = /^\s*\d{1,2}[:.]\d{2}(\s*(?:AM|PM|am|pm))?(\s*[-–—\u2192]\s*\d{1,2}[:.]\d{2}(\s*(?:AM|PM|am|pm))?)?\s*[,;:·\u2022]?\s*/;
    // leading label: "Задача:", "Task:", bullets, dashes
    const LABEL_PREFIX = /^\s*(?:Задача|Задачи|Task|Tasks|Событие|Event)\s*[:–—-]\s*/i;
    const BULLET_PREFIX = /^\s*[\u2022·\u25cf\u25aa*–—-]\s*/;

    const strip = (v) => {
        let t = String(v).trim();
        for (let i = 0; i < 4; i++) {
            const before = t;
            t = t.replace(TIME_PREFIX, "").replace(LABEL_PREFIX, "").replace(BULLET_PREFIX, "").trim();
            if (t === before) {
                break;
            }
        }
        return t;
    };

    push(text);
    push(strip(text));

    // the string often packs several fields: "10:00 – 11:00, таб отчёт, календарь"
    for (const part of String(text).split(/[\n\r,;·\u2022|]+/)) {
        push(part);
        push(strip(part));
    }

    return out;
}

function chipMatchesMask(chip, re) {
    for (const candidate of getChipTitleCandidates(chip)) {
        for (const variant of expandTitleVariants(candidate)) {
            if (re.test(variant)) {
                return true;
            }
        }
    }

    return false;
}

function applyTaskHiding() {
    const enabled = lsGet(HIDE_TASKS_LS_ENABLED, "1") === "1";
    const re = enabled ? getHideTasksMaskRegExp() : undefined;

    for (const chip of collectChips()) {
        const hide = re ? chipMatchesMask(chip, re) : false;

        if (hide) {
            if (chip.dataset.gcTweaksHidden !== "1") {
                chip.dataset.gcTweaksHidden = "1";
                chip.style.setProperty("display", "none", "important");
            }
        } else if (chip.dataset.gcTweaksHidden === "1") {
            delete chip.dataset.gcTweaksHidden;
            chip.style.removeProperty("display");
        }
    }
}

function ensureHideTasksControls() {
    if (document.getElementById("hide-tasks-ch-box")) {
        return;
    }

    const leftPanelLastElem = document.querySelectorAll("div[class='erDb5d']");
    if (!leftPanelLastElem.length) {
        return;
    }

    const chBox = document.createElement("input");
    chBox.id = "hide-tasks-ch-box";
    chBox.type = "checkbox";
    chBox.className = "hide-tasks-div";
    chBox.checked = lsGet(HIDE_TASKS_LS_ENABLED, "1") === "1";

    const label = document.createElement("label");
    label.htmlFor = "hide-tasks-ch-box";
    label.textContent = "Hide by mask";

    const maskInput = document.createElement("input");
    maskInput.id = "hide-tasks-mask";
    maskInput.type = "text";
    maskInput.value = getHideTasksMask();
    maskInput.placeholder = '';
    maskInput.style.width = "120px";
    maskInput.style.marginTop = "2px";

    chBox.addEventListener("click", () => {
        lsSet(HIDE_TASKS_LS_ENABLED, chBox.checked ? "1" : "0");
        applyTaskHiding();
    });

    maskInput.addEventListener("input", () => {
        lsSet(HIDE_TASKS_LS_MASK, maskInput.value);
        applyTaskHiding();
    });

    maskInput.addEventListener("keydown", (e) => {
        // keep google calendar hotkeys away from the input
        e.stopPropagation();
    });

    const div = document.createElement("div");
    div.style.marginLeft = "24px";

    const firstLine = document.createElement("div");
    firstLine.appendChild(chBox);
    firstLine.appendChild(label);

    const secondLine = document.createElement("div");
    secondLine.appendChild(maskInput);

    div.appendChild(firstLine);
    div.appendChild(secondLine);

    leftPanelLastElem[0].parentNode.insertBefore(div, leftPanelLastElem[0]);
}

setInterval(() => {
    ensureHideTasksControls();
    applyTaskHiding();
}, 1500);


const HOLIDAYS_COLOR = "hsl(2 100% 98%)";
const YEAR_HOLIDAYS_COLOR = "hsl(2 100% 92%)";

const OFFICEDAYS_COLOR = "hsl(210 100% 97%)";
const YEAR_OFFICEDAYS_COLOR = "hsl(210 100% 90%)";
const FUTURE_OFFICEDAYS_COLOR = `repeating-linear-gradient( -45deg, hsl(210 100% 97%), hsl(210 100% 97%) 3px, transparent 3px, transparent 15px)`;

const REGULAR_COLOR = 'white';

let holidays = [];
let notholidays = [];
let officedays = [];
let achieves = [];

let year_achieve = undefined; // "b"
let refreshes = [];

const onCalendarJsonFetched = (calendar) => {
    for (const h of calendar["holidays"] || []) {
        if (Array.isArray(h)) {
            holidays.push([new Date(h[0]), new Date(h[1])]);
        }
        else {
            holidays.push(new Date(h));
        }
    }

    for (const h of calendar["notholidays"] || []) {
        if (Array.isArray(h)) {
            notholidays.push([new Date(h[0]), new Date(h[1])]);
        }
        else {
            notholidays.push(new Date(h));
        }
    }

    for (const o of calendar["officedays"] || []) {
        officedays.push(new Date(o));
    }

    for (const a of calendar["achieves"] || []) {
        let achieve = undefined;
        let newAchieve = false;
        for (let existingAchieve of achieves) {
            if (existingAchieve.name === a.name) {
                achieve = existingAchieve;
                break;
            }
        }

        if (!achieve) {
            achieve = { name: a.name, color: a.color, dates: [] };
            newAchieve = true;
        }

        for (const d of a.dates) {
            if (Array.isArray(d)) {
                const dateInInterval = new Date(d[0]);
                const to = new Date(d[1]);
                while (!isDaysEqual(dateInInterval, to)) {
                    achieve.dates.push(new Date(dateInInterval));
                    dateInInterval.setDate(dateInInterval.getDate() + 1);
                }
                achieve.dates.push(new Date(to));
            }
            else {
                achieve.dates.push(new Date(d));
            }
        }

        if (newAchieve) {
            achieves.push(achieve);
        }
    }
}

function initFn() {
    mark("init");

    // document.addEventListener("DOMNodeInserted", highlightDates);

    // fetch("https://raw.githubusercontent.com/valeg-ag/valeg-ag.github.io/main/calendar.json", { cache: "no-cache" }).then((response) => {
    //     response.text().then((text) => {
    //         const calendar = JSON.parse(text);
    //         onCalendarJsonFetched(calendar);

    //         fetch("https://raw.githubusercontent.com/valeg-ag/valeg-ag.github.io/main/calendar.old.json", { cache: "no-cache" })
    //             .then((oldResponse) => {
    //                 oldResponse.text().then((oldText) => {
    //                     const oldCalendar = JSON.parse(oldText);
    //                     onCalendarJsonFetched(oldCalendar);
    //                 }
    //                 );
    //             });
    //     });
    // });

           
//    fetch("https://script.google.com/macros/s/AKfycbyXVHO3MbkJ1Ln67OwDAFfRzCIxjb_W1vxoPmgXwcv9oFTB5tKhjH_VX1SkZmlxMxBtCw/exec", {
    fetch("https://script.google.com/macros/s/AKfycbz-r6yKVyZOKDZkO0zO_jA07FtiBfcjRJoEdGwBoeFWzV01z6R7K2GPACzvOYslEs1HeA/exec", {
        redirect: "follow",
        method: "GET",
        cache: "no-cache"
    })
        .then((response) => {
            response.text().then((text) => {
                const calendar = JSON.parse(text);
                onCalendarJsonFetched(calendar);
                mark("fetched");
                highlightDates();
            }
            );
        })
        .catch((err) => {
            alert("calendar fetch failed: " + err);
        });

    const observer = new MutationObserver(function (mutations_list) {
        for (let mutation of mutations_list) {
            if (refreshes.length) {
                break;
            }

            if (mutation.type === "childList" && (mutation.addedNodes.length || mutation.removedNodes.length)) {
                for (const node of mutation.addedNodes) {
                    if (node.className !== "achieves" && node.className !== "achieve") {
                        refreshes.push({});
                        break;
                    }
                }

                for (const node of mutation.removedNodes) {
                    if (node.className === "achieves" || node.className === "achieve") {
                        refreshes.push({});
                        break;
                    }
                }
            }
        }

        if (refreshes.length) {
            setTimeout(() => {
                if (refreshes.length) {
                    refreshes = [];
                    highlightDates();
                }
            }, 300);
        }
    });

    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
}

function datekeyToDate(dateKey) {
    const yearOffset = (dateKey - 32) % 512;
    const year = (dateKey - 32 - yearOffset) / 512;
    const day = yearOffset % 32;
    const month = (yearOffset - day) / 32;
    return new Date(year + 1970, month, day);
}

function isDaysEqual(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function isNotHoliday(date) {
    for (const h of notholidays) {
        if (Array.isArray(h)) {
            if (h[0] <= date && date <= h[1]) {
                return true;
            }
        } else {
            if (isDaysEqual(h, date)) {
                return true;
            }
        }
    }

    return false;
}

function highlightElementIfNecessary(e, date, holidayColor, officedayColor, officedayFutureColor) {

    e.style.background = REGULAR_COLOR;

    if (date.getDay() === 6 || date.getDay() === 0) {
        if (!isNotHoliday(date)) {
            e.style.background = holidayColor;
        }
    }

    for (const h of holidays) {
        if (Array.isArray(h)) {
            if (h[0] <= date && date <= h[1]) {
                e.style.background = holidayColor;
            }
        } else {
            if (isDaysEqual(h, date)) {
                e.style.background = holidayColor;
            }
        }
    }

    for (const o of officedays) {
        if (isDaysEqual(o, date)) {
            if (date <= new Date()) {
                if (officedayColor)
                    e.style.background = officedayColor;
            } else {
                if (officedayFutureColor)
                    e.style.background = officedayFutureColor;
            }
        }
    }
}

function hasDateInArray(arr, date) {
    for (const d of arr) {
        if (isDaysEqual(d, date)) {
            return true;
        }
    }

    return false;
}

function getAchievesOnDate(date) {
    let achievesOnDate = [];
    for (const a of achieves) {
        if (hasDateInArray(a.dates, date)) {
            achievesOnDate.push({ name: a.name, color: a.color });
        }
    }

    return achievesOnDate;
}

function hasAchieveOnDate(date, achieveName) {
    for (const a of achieves) {
        if (a.name !== achieveName) {
            continue;
        }

        if (hasDateInArray(a.dates, date)) {
            return a.color;
        }

        break;
    }

    return undefined;
}

function highlightDates(e) {
    console.log('called highlightDates()');

    ensureHideTasksControls();
    applyTaskHiding();

    if (!holidays.length)
        return;

    const showAchievesDivsList = document.querySelectorAll("input[class='show-achieves-div']");

    if (showAchievesDivsList.length === 0) {
        const leftPanelLastElem = document.querySelectorAll("div[class='erDb5d']");

        const showAchievesChBox = document.createElement('input');
        showAchievesChBox.id = "show-achieves-ch-box";
        showAchievesChBox.type = "checkbox";
        showAchievesChBox.className = "show-achieves-div";

        showAchievesChBox.addEventListener("click", (e) => {
            if( !showAchievesChBox.checked) {
                const achievesList = document.querySelectorAll("div[class='achieves']");
                for(const achieves of  achievesList) {
                    achieves.remove();
                }
            }

            highlightDates();
        });

        const showAchievesLabel = document.createElement('label');
        showAchievesLabel.htmlFor = "show-achieves-ch-box";
        showAchievesLabel.textContent = "Show achieves";

        const showAchievesDiv = document.createElement('div');
        showAchievesDiv.style.marginLeft = "24px";

        showAchievesDiv.appendChild(showAchievesChBox);
        showAchievesDiv.appendChild(showAchievesLabel);

        leftPanelLastElem[0].parentNode.insertBefore(showAchievesDiv, leftPanelLastElem[0]);
    }

    const visibleDatakeys = document.querySelectorAll("[role='main']>[data-view-heading]>[role='grid']>[role='presentation']>[role='row']>[aria-hidden='true']>div[data-datekey]");
    const visibleYearDates = document.querySelectorAll("[data-viewkey='YEAR']>div>div>div>div>div>div>div>div>div>div>table[role='grid']>tbody>tr>td[data-date]");

    if (!visibleDatakeys.length && !visibleYearDates.length) {
        return;
    }

    const showAchievesChBox = document.getElementById("show-achieves-ch-box");

    for (const dateDiv of visibleDatakeys) {
        const date = datekeyToDate(dateDiv.getAttribute("data-datekey"));

        highlightElementIfNecessary(dateDiv, date, HOLIDAYS_COLOR, OFFICEDAYS_COLOR, FUTURE_OFFICEDAYS_COLOR);

        if (showAchievesChBox.checked && dateDiv.getElementsByClassName("achieves").length === 0) {
            const achievesColors = getAchievesOnDate(date);
            if (achievesColors.length !== 0) {
                const achieveGr = document.createElement('div');
                achieveGr.className = "achieves";
                achieveGr.style.height = "12px";
                achieveGr.style.position = "absolute";
                achieveGr.style.bottom = "0px";
                achieveGr.style.margin = "4px"

                dateDiv.appendChild(achieveGr);

                for (const a of achievesColors) {
                    const achieveEl = document.createElement('span');
                    achieveEl.className = "achieve";
                    achieveEl.title = a.name;
                    achieveEl.style.float = "left";
                    achieveEl.style.width = "12px";
                    achieveEl.style.height = "12px";
                    achieveEl.style.background = a.color;
                    achieveEl.style.borderRadius = "6px";
                    achieveEl.style.marginRight = "2px";

                    achieveGr.appendChild(achieveEl);

                    achieveEl.onclick = (e) => {
                        year_achieve = a.name;
                        e.stopPropagation();
                    }
                }
            }
        }
    }

    for (const dateSpan of visibleYearDates) {
        const datestr = dateSpan.getAttribute("data-date");
        const date = new Date(parseInt(datestr.substring(0, 4)), parseInt(datestr.substring(4, 6)) - 1, parseInt(datestr.substring(6, 8)))

        const monthDiv = dateSpan.parentNode.parentNode.parentNode.parentNode;
        const monthstr = monthDiv.getAttribute("data-month");

        const isDayFromOtherMonth = datestr.substring(0, 6) !== monthstr.substring(0, 6);

        dateSpan.firstChild.style.opacity = isDayFromOtherMonth ? 0.2 : 1;

        // don't show office-days in mode "achieves"-mode
        if (year_achieve) {
            highlightElementIfNecessary(dateSpan.firstChild, date, YEAR_HOLIDAYS_COLOR, undefined, undefined);
        } else {
            highlightElementIfNecessary(dateSpan.firstChild, date, YEAR_HOLIDAYS_COLOR, YEAR_OFFICEDAYS_COLOR, YEAR_OFFICEDAYS_COLOR);
        }

        if (isDayFromOtherMonth) {
            continue;
        }

        if (year_achieve) {
            const achieveColor = hasAchieveOnDate(date, year_achieve);
            if (achieveColor) {
                dateSpan.firstChild.style.background = `${achieveColor}60`;
            }
        }

        if (showAchievesChBox.checked && dateSpan.getElementsByClassName("achieves").length === 0) {
            const achievesColors = getAchievesOnDate(date);
            if (achievesColors.length !== 0) {
                const achieveGr = document.createElement('div');
                achieveGr.className = "achieves";
                achieveGr.style.height = "6px";
                achieveGr.style.position = "absolute";
                achieveGr.style.bottom = "0px";
                achieveGr.style.margin = "2px"

                dateSpan.appendChild(achieveGr);

                for (const a of achievesColors) {
                    const achieveEl = document.createElement('span');
                    achieveEl.className = "achieve";
                    achieveEl.title = a.name;
                    achieveEl.style.float = "left";
                    achieveEl.style.width = "6px";
                    achieveEl.style.height = "6px";
                    achieveEl.style.background = a.color;
                    achieveEl.style.borderRadius = "3px";
                    achieveEl.style.marginRight = "2px";
                    achieveEl.style.position = "relative";
                    achieveEl.style.zIndex = 1000;

                    achieveGr.appendChild(achieveEl);

                    achieveEl.onclick = (e) => {
                        year_achieve = a.name;
                        e.stopPropagation();
                    }
                }
            }
        }
    }
}

// window.onload = initFn;

if (document.readyState === "complete") {
    initFn();
} else {
    window.addEventListener("load", initFn);
}