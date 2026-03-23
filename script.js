function readExcel(file, skipRows = 0) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            let json = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: 0
            });

            json = json.slice(skipRows);

            resolve(json);
        };
        reader.readAsArrayBuffer(file);
    });
}

function toSeconds(time) {
    if (!time) return 0;
    let t = time.toString().split(":").map(Number);
    return (t[0]||0)*3600 + (t[1]||0)*60 + (t[2]||0);
}

function toTime(sec) {
    let h = Math.floor(sec/3600);
    let m = Math.floor((sec%3600)/60);
    let s = sec%60;
    return [h,m,s].map(v=>String(v).padStart(2,'0')).join(":");
}

async function processFiles() {

    const apr = await readExcel(document.getElementById("aprFile").files[0], 3);
    const cdr = await readExcel(document.getElementById("cdrFile").files[0], 2);

    let final = [];

    apr.forEach(row => {

        if (!row[1]) return;

        let empID = row[1];
        let name = row[2];
        let totalLogin = toSeconds(row[3]);

        let totalBreak =
            toSeconds(row[19]) +
            toSeconds(row[22]) +
            toSeconds(row[24]);

        let meeting =
            toSeconds(row[20]) +
            toSeconds(row[23]);

        let netLogin = totalLogin - totalBreak;

        let calls = cdr.filter(c => {
            let dispo = (c[25] || "").toString().toLowerCase();
            return c[1] == empID &&
                   (dispo.includes("callmatured") || dispo.includes("transfer"));
        });

        let totalCalls = calls.length;

        let ib = calls.filter(c =>
            (c[7] || "").toString().toUpperCase().includes("INBOUND")
        ).length;

        let ob = totalCalls - ib;

        let totalTalk = toSeconds(row[5]);
        let aht = totalCalls ? totalTalk / totalCalls : 0;

        final.push({
            empID, name, totalLogin, netLogin,
            totalBreak, meeting, aht,
            totalCalls, ib, ob
        });
    });

    localStorage.setItem("dashboardData", JSON.stringify(final));
    window.location.href = "dashboard.html";
}

// DASHBOARD LOAD
document.addEventListener("DOMContentLoaded", () => {

    const data = JSON.parse(localStorage.getItem("dashboardData") || "[]");
    const table = document.querySelector("#dataTable tbody");

    let totalCalls = 0, totalIB = 0, totalOB = 0, totalAHT = 0;

    data.forEach(r => {

        totalCalls += r.totalCalls;
        totalIB += r.ib;
        totalOB += r.ob;
        totalAHT += r.aht;

        const tr = document.createElement("tr");

        tr.innerHTML = `
        <td>${r.empID}</td>
        <td>${r.name}</td>
        <td>${toTime(r.totalLogin)}</td>
        <td>${toTime(r.netLogin)}</td>
        <td>${toTime(r.totalBreak)}</td>
        <td>${toTime(r.meeting)}</td>
        <td>${Math.round(r.aht)}</td>
        <td>${r.totalCalls}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>
        `;

        table.appendChild(tr);
    });

    document.getElementById("totalCalls").innerText = totalCalls;
    document.getElementById("ibCalls").innerText = totalIB;
    document.getElementById("obCalls").innerText = totalOB;
    document.getElementById("aht").innerText = Math.round(totalAHT / data.length || 0);

});

// PNG COPY
function copyImage() {
    html2canvas(document.body).then(canvas => {
        canvas.toBlob(blob => {
            navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob })
            ]);
            alert("Copied as Image ✅");
        });
    });
}

// EXPORT
function exportExcel() {
    const data = JSON.parse(localStorage.getItem("dashboardData"));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "Dashboard.xlsx");
}
