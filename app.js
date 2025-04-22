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
                highlightDates();
            }
            );
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
                dateSpan.firstChild.style.background = achieveColor;
            }
        }
    }
}

window.onload = initFn;
