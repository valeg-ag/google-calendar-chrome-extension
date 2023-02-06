const HOLIDAYS_COLOR = "hsl(2 100% 99%)";
const YEAR_HOLIDAYS_COLOR = "hsl(2 100% 92%)";

const OFFICEDAYS_COLOR = "hsl(210 100% 97%)";
const YEAR_OFFICEDAYS_COLOR = "hsl(210 100% 90%)";
const FUTURE_OFFICEDAYS_COLOR = `repeating-linear-gradient( -45deg, hsl(210 100% 97%), hsl(210 100% 97%) 3px, transparent 3px, transparent 15px)`;

let holidays = [];
let officedays = [];
let achieves = [];

function initFn() {
    document.addEventListener("DOMNodeInserted", highlightDates);

    // fetch("https://valeg-ag.github.io/calendar.json", { cache: "no-cache" }).then((response) => {
    fetch("https://raw.githubusercontent.com/valeg-ag/valeg-ag.github.io/main/calendar.json", { cache: "no-cache" }).then((response) => {
        response.text().then((text) => {
            const calendar = JSON.parse(text);
            for (const h of calendar["holidays"] || []) {
                if (Array.isArray(h)) {
                    holidays.push([new Date(h[0]), new Date(h[1])]);
                }
                else {
                    holidays.push(new Date(h));
                }
            }

            for (const o of calendar["officedays"] || []) {
                officedays.push(new Date(o));
            }

            for (const a of calendar["achieves"] || []) {
                const achieve = { color: a.color, dates: [] };
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
                achieves.push(achieve);
            }
        });
    });
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

function highlightElementIfNecessary(e, date, holidayColor, officedayColor, officedayFutureColor) {
    if (date.getDay() === 6 || date.getDay() === 0) {
        e.style.background = holidayColor;
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
                e.style.background = officedayColor;
            } else {
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
    achievesOnDate = [];
    for (const a of achieves) {
        if (hasDateInArray(a.dates, date)) {
            achievesOnDate.push(a.color);
        }
    }

    return achievesOnDate;
}

function highlightDates(e) {
    const visibleDatakeys = document.querySelectorAll("[role='main']>[data-view-heading]>[role='grid']>[role='presentation']>[role='row']>[aria-hidden='true']>div[data-datekey]");

    const visibleYearDates = document.querySelectorAll("[data-viewkey='YEAR']>div>div>div>div>div>div>div>div>div>div>div[role='grid']>div[role='rowgroup']>div[role='row']>span[data-date]");

    if (!visibleDatakeys.length && !visibleYearDates.length) {
        return;
    }

    for (const dateDiv of visibleDatakeys) {
        const date = datekeyToDate(dateDiv.getAttribute("data-datekey"));

        highlightElementIfNecessary(dateDiv, date, HOLIDAYS_COLOR, OFFICEDAYS_COLOR, FUTURE_OFFICEDAYS_COLOR);

        if (dateDiv.getElementsByClassName("achieves").length === 0) {
            const achievesColors = getAchievesOnDate(date);
            if (achievesColors.length !== 0) {
                const achieveGr = document.createElement('div');
                achieveGr.className = "achieves";
                achieveGr.style.height = "8px";
                achieveGr.style.position = "absolute";
                achieveGr.style.bottom = "0px";
                achieveGr.style.margin = "4px"

                dateDiv.appendChild(achieveGr);

                for (const color of achievesColors) {
                    const achieveEl = document.createElement('div');
                    achieveEl.style.float = "left";
                    achieveEl.style.width = "8px";
                    achieveEl.style.height = "8px";
                    achieveEl.style.background = color;
                    achieveEl.style.borderRadius = "4px";
                    achieveEl.style.marginRight = "2px";

                    achieveGr.appendChild(achieveEl);
                }
            }
        }
    }

    for (const dateSpan of visibleYearDates) {
        const datestr = dateSpan.getAttribute("data-date");
        const date = new Date(parseInt(datestr.substring(0, 4)), parseInt(datestr.substring(4, 6)) - 1, parseInt(datestr.substring(6, 8)))

        highlightElementIfNecessary(dateSpan.firstChild, date, YEAR_HOLIDAYS_COLOR, YEAR_OFFICEDAYS_COLOR, YEAR_OFFICEDAYS_COLOR);
    }
}

window.onload = initFn;
