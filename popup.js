chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "update_status") {
        document.getElementById('status-msg').innerText = request.message;
    }
});

document.getElementById('auto-fetch-btn').addEventListener('click', async () => {
    const btn = document.getElementById('auto-fetch-btn');
    btn.disabled = true; 
    
    const startYear = parseInt(document.getElementById('start-year').value) || 0;
    const endYear = parseInt(document.getElementById('end-year').value) || 9999;

    document.getElementById('status-msg').innerText = `Initializing bot for years ${startYear} to ${endYear}...`;

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { 
        action: "auto_fetch_all", 
        start: startYear, 
        end: endYear 
    }, function(response) {
        btn.disabled = false;

        if (chrome.runtime.lastError || !response) {
            document.getElementById('status-msg').innerText = "Error: Please refresh the Grades page.";
            return;
        }

        if (response.error) {
            document.getElementById('status-msg').innerText = response.error;
            return;
        }

        chrome.storage.local.set({ 'nu_academic_history': response.history }, () => {
            const termsFound = Object.keys(response.history).length;
            document.getElementById('status-msg').innerText = `Success! Fetched records for ${termsFound} terms.`;
            triggerCalculation();
        });
    });
});

document.getElementById('start-year').addEventListener('input', triggerCalculation);
document.getElementById('end-year').addEventListener('input', triggerCalculation);
document.getElementById('chk-1').addEventListener('change', triggerCalculation);
document.getElementById('chk-2').addEventListener('change', triggerCalculation);
document.getElementById('chk-3').addEventListener('change', triggerCalculation);
document.getElementById('chk-ast').addEventListener('change', triggerCalculation);

function getFilteredData(history) {
    const startYear = parseInt(document.getElementById('start-year').value) || 0;
    const endYear = parseInt(document.getElementById('end-year').value) || 9999;
    const include1 = document.getElementById('chk-1').checked;
    const include2 = document.getElementById('chk-2').checked;
    const include3 = document.getElementById('chk-3').checked;
    const includeAst = document.getElementById('chk-ast').checked;

    let totalGradePoints = 0;
    let totalGwaUnits = 0;
    let activeTerms = [];

    const sortedKeys = Object.keys(history).sort();

    for (let key of sortedKeys) {
        const parts = key.split('-');
        const recordYear = parseInt(parts[0]);
        const recordTerm = parts[1]; 

        if (recordYear >= startYear && recordYear <= endYear) {
            let termAllowed = false;
            if (recordTerm === '1' && include1) termAllowed = true;
            if (recordTerm === '2' && include2) termAllowed = true;
            if (recordTerm === '3' && include3) termAllowed = true;

            if (termAllowed) {
                activeTerms.push({ key: key, data: history[key] });

                totalGradePoints += history[key].gradePoints;
                totalGwaUnits += history[key].gwaUnits;
                
                if (includeAst) {
                    totalGradePoints += (history[key].excludedGradePoints || 0);
                    totalGwaUnits += (history[key].excludedGwaUnits || 0);
                }
            }
        }
    }

    const cumulativeGWA = totalGwaUnits > 0 ? (totalGradePoints / totalGwaUnits) : 0;

    return {
        activeTerms,
        totalGwaUnits,
        cumulativeGWA,
        includeAst
    };
}

function triggerCalculation() {
    chrome.storage.local.get(['nu_academic_history'], function(result) {
        if (!result.nu_academic_history || Object.keys(result.nu_academic_history).length === 0) {
            document.getElementById('status-msg').innerText = "No data to calculate. Pre-load first!";
            return;
        }
        
        const filtered = getFilteredData(result.nu_academic_history);
        
        document.getElementById('total-units').innerText = filtered.totalGwaUnits;
        document.getElementById('cumulative-gwa').innerText = filtered.cumulativeGWA.toFixed(2);
        document.getElementById('status-msg').innerText = `Calculated ${filtered.activeTerms.length} terms in range.`;
    });
}

document.getElementById('export-pdf-btn').addEventListener('click', () => {
    chrome.storage.local.get(['nu_academic_history'], function(result) {
        if (!result.nu_academic_history || Object.keys(result.nu_academic_history).length === 0) {
            alert("No data to export! Please Pre-load your records first.");
            return;
        }

        const filtered = getFilteredData(result.nu_academic_history);
        
        let html = `
        <html>
        <head>
            <style>
                body { font-family: sans-serif; padding: 40px; color: #000; }
                .header-logo { text-align: center; margin-bottom: 20px; }
                .header-logo img { width: 80px; }
                h2 { text-align: center; margin: 5px 0; color: #1e3a8a; }
                .summary-box { border: 2px solid #1e3a8a; padding: 15px; margin: 20px 0; border-radius: 8px; background-color: #f8fafc; }
                .summary-box div { margin: 5px 0; font-size: 16px; font-weight: bold; }
                
                /* FIX: table-layout: fixed ensures columns are identical across every table */
                table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: fixed; }
                th { background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #000; overflow: hidden; }
                td { padding: 8px; border: 1px solid #000; text-align: center; word-wrap: break-word; }
                
                /* Precise Column Widths */
                .col-code { width: 15%; }
                .col-desc { width: 40%; text-align: left; }
                .col-grade { width: 12%; }
                .col-units { width: 10%; }
                .col-status { width: 13%; }
                
                .footer-row { font-weight: bold; background-color: #f3f4f6; }
                .excluded { color: #dc2626; text-decoration: line-through; }
                @media print { body { -webkit-print-color-adjust: exact; } }
            </style>
        </head>
        <body>
            <div class="header-logo">
                <h2>MY GRADES</h2>
            </div>
            
            <div class="summary-box">
                <div>Total Cumulative Units: ${filtered.totalGwaUnits}</div>
                <div>Overall Cumulative GWA: ${filtered.cumulativeGWA.toFixed(2)}</div>
            </div>
        `;

        filtered.activeTerms.forEach(termObj => {
            const parts = termObj.key.split('-');
            const termNameMapping = { '1': '1st', '2': '2nd', '3': '3rd' };
            html += `<h3>AY ${parts[0]} - ${termNameMapping[parts[1]]} Term</h3>`;

            html += `
            <table>
                <tr>
                    <th class="col-code">Subject Code</th>
                    <th class="col-desc">Subject Description</th>
                    <th class="col-grade">Midterm</th>
                    <th class="col-grade">Final</th>
                    <th class="col-units">Units</th>
                    <th class="col-status">Status</th>
                </tr>`;

            termObj.data.subjects.forEach(sub => {
                const rowClass = sub.excluded ? 'class="excluded"' : '';
                const statusText = sub.excluded ? 'Excluded' : 'Counted';
                
                html += `<tr ${rowClass}>
                    <td>${sub.code}</td>
                    <td class="col-desc">${sub.desc}</td>
                    <td>${sub.grade}</td>
                    <td>${sub.grade}</td>
                    <td>${sub.units}</td>
                    <td>${statusText}</td>
                </tr>`;
            });

            const termUnits = termObj.data.totalUnitsTaken;
            const termGwa = (termObj.data.gradePoints / termObj.data.gwaUnits).toFixed(2);

            html += `
                <tr class="footer-row">
                    <td colspan="4" style="text-align:right">TOTAL UNITS</td>
                    <td>${termUnits.toFixed(2)}</td>
                    <td></td>
                </tr>
                <tr class="footer-row">
                    <td colspan="4" style="text-align:right">GENERAL WEIGHTED AVERAGE (GWA)</td>
                    <td>${termGwa}</td>
                    <td></td>
                </tr>
            </table>`;
        });

        html += `<script>window.onload = function() { window.print(); }</script></body></html>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
    });
});

document.getElementById('clear-btn').addEventListener('click', () => {
    if(confirm("Are you sure you want to delete your saved GWA history?")) {
        chrome.storage.local.remove('nu_academic_history', () => {
            document.getElementById('total-units').innerText = "--";
            document.getElementById('cumulative-gwa').innerText = "--";
            document.getElementById('status-msg').innerText = "History cleared.";
        });
    }
});

window.onload = () => {
    chrome.storage.local.get(['nu_academic_history'], function(result) {
        if (result.nu_academic_history && Object.keys(result.nu_academic_history).length > 0) {
            document.getElementById('status-msg').innerText = "History loaded. Ready to calculate.";
            triggerCalculation(); 
        }
    });
};