chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "auto_fetch_all") {
        runAutoScraper(request.start, request.end).then(sendResponse);
        return true; 
    }
});

async function runAutoScraper(startYear, endYear) {
    const allSyOptions = Array.from(document.querySelectorAll('#school_year option')).map(o => o.value).filter(v => v);
    
    const targetSyOptions = allSyOptions.filter(sy => {
        const yearInt = parseInt(sy);
        return yearInt >= startYear && yearInt <= endYear;
    });

    // Removed the 'S' (Summer) term from the array entirely
    const terms = ['1', '2', '3'];
    let formKey = document.querySelector('input[name="form_key"]')?.value;
    const currentUrl = window.location.href;

    if (!formKey) return { error: "Could not find form_key. Ensure you are on the Grades page." };
    if (targetSyOptions.length === 0) return { error: "No school years found in that range." };

    let allHistory = {};

    for (let sy of targetSyOptions) {
        for (let term of terms) {
            let termName;
            if (term === '1') termName = "1st Term";
            else if (term === '2') termName = "2nd Term";
            else if (term === '3') termName = "3rd Term";
            
            let fetchSuccess = false;
            let retryCount = 0;
            const maxRetries = 3;

            while (!fetchSuccess && retryCount < maxRetries) {
                if (retryCount === 0) {
                    chrome.runtime.sendMessage({ action: "update_status", message: `Fetching ${sy} - ${termName}...` });
                } else {
                    chrome.runtime.sendMessage({ action: "update_status", message: `Server lag. Retrying ${sy} - ${termName}... (${retryCount}/${maxRetries})` });
                }

                const params = new URLSearchParams();
                params.append('form_key', formKey);
                params.append('school_year', sy);
                params.append('term', term);
                params.append('btn_submit', 'Submit');

                try {
                    let res = await fetch(currentUrl, { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: params.toString() 
                    });
                    
                    let text = await res.text();
                    let parser = new DOMParser();
                    let doc = parser.parseFromString(text, 'text/html');

                    let newFormKey = doc.querySelector('input[name="form_key"]')?.value;
                    if (newFormKey) formKey = newFormKey;

                    let table = doc.querySelector("table.listView tbody");
                    
                    let legendText = doc.querySelector("fieldset.bs-top legend")?.textContent || "";
                    let isCorrectPage = legendText.includes(sy.toString()) && legendText.includes(termName);

                    if (table && isCorrectPage) {
                        let data = extractFromTable(table);
                        if (data.totalUnitsTaken > 0) {
                            allHistory[`${sy}-${term}`] = data;
                        }
                        fetchSuccess = true; 
                    } else {
                        retryCount++;
                        await new Promise(r => setTimeout(r, 1000));
                    }
                } catch (e) {
                    console.error("Fetch error:", e);
                    retryCount++;
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            if (fetchSuccess) {
                await new Promise(r => setTimeout(r, 600));
            }
        }
    }
    return { success: true, history: allHistory };
}

function extractFromTable(tbody) {
    const rows = tbody.querySelectorAll("tr");
    let termGradePoints = 0;
    let termGwaUnits = 0;
    let termExcludedGradePoints = 0;
    let termExcludedGwaUnits = 0;
    let termTotalUnitsTaken = 0;
    let subjectsList = []; 

    rows.forEach(row => {
        const cols = row.querySelectorAll("td");
        if (cols.length < 5) return;

        const subjectCode = cols[0].textContent.trim();
        const subjectDesc = cols[1].textContent.trim();
        const rawGrade = cols[3].textContent.trim();
        const finalGrade = parseFloat(rawGrade);
        const units = parseFloat(cols[4].textContent.trim());
        const isExcluded = subjectCode.includes('*');

        if (!isNaN(units)) {
            termTotalUnitsTaken += units; 
            
            if (!isNaN(finalGrade)) {
                if (!isExcluded) {
                    termGradePoints += (finalGrade * units);
                    termGwaUnits += units;
                } else {
                    termExcludedGradePoints += (finalGrade * units);
                    termExcludedGwaUnits += units;
                }
            }

            subjectsList.push({
                code: subjectCode,
                desc: subjectDesc,
                grade: rawGrade, 
                units: units.toFixed(1),
                excluded: isExcluded
            });
        }
    });

    return {
        gwaUnits: termGwaUnits,
        gradePoints: termGradePoints,
        excludedGwaUnits: termExcludedGwaUnits,
        excludedGradePoints: termExcludedGradePoints,
        totalUnitsTaken: termTotalUnitsTaken,
        subjects: subjectsList 
    };
}