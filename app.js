let holidays = [];
let officedays = [];

function initFn() {
    document.addEventListener("DOMNodeInserted", highlightDates);

    fetch("https://valeg-ag.github.io/calendar.json", { cache: "no-cache" }).then((response) => {
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

function highlightElementIfNecessary(e, date, space){
    if (date.getDay() === 6 || date.getDay() === 0) {
        e.style.background = `repeating-linear-gradient( -45deg, #fce8eb, #fce8eb 3px, transparent 3px, transparent ${space})`;
    }

    for (const h of holidays) {
        if (Array.isArray(h)) {
            if (h[0] <= date && date <= h[1]) {
                e.style.background = `repeating-linear-gradient( -45deg, #fce8eb, #fce8eb 3px, transparent 3px, transparent ${space})`;
            }
        } else {
            if (isDaysEqual(h, date)) {
                e.style.background = `repeating-linear-gradient( -45deg, #fce8eb, #fce8eb 3px, transparent 3px, transparent ${space})`;
            }
        }
    }

    for (const o of officedays) {
        if (isDaysEqual(o, date)) {
            e.style.background = `repeating-linear-gradient( -45deg, #cadefc, #cadefc 3px, transparent 3px, transparent ${space})`;
        }
    }
}

function highlightDates(e) {
    const visibleDatakeys = document.querySelectorAll("[role='main']>[data-view-heading]>[role='grid']>[role='presentation']>[role='row']>[aria-hidden='true']>div[data-datekey]");

    const visibleYearDates = document.querySelectorAll("[data-viewkey='YEAR']>div>div>div>div>div>div>div>div>div>div>div[role='grid']>div[role='rowgroup']>div[role='row']>span[data-date]");

    if (!visibleDatakeys.length && !visibleYearDates.length) {
        return;
    }

    for (const dateDiv of visibleDatakeys) {
        const date = datekeyToDate(dateDiv.getAttribute("data-datekey"));

        highlightElementIfNecessary(dateDiv, date, "20px");
    }

    for (const dateSpan of visibleYearDates) {
        const datestr = dateSpan.getAttribute("data-date");
        const date = new Date(parseInt(datestr.substring(0,4)), parseInt(datestr.substring(4,6))-1, parseInt(datestr.substring(6,8)))

        highlightElementIfNecessary(dateSpan.firstChild, date, "3px");
    }
}

window.onload = initFn;
