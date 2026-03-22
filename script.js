function readExcel(file, skipRows = 0) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            // 🔥 ARRAY MODE (NO HEADER)
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

    const apr = await readExcel(document.getElementById("aprFile").files[0], 2);
    const cdr = await readExcel(document.getElementById("cdrFile").files[0], 1);

    let final = [];

    apr.forEach(row => {

        // 🔥 APR COLUMN INDEX BASED
        let empID = row[1];   // B
        let name = row[2];    // C
        let totalLogin = toSeconds(row[3]); // D

        let lunch = toSeconds(row[19]); // T
        let tea = toSeconds(row[22]);   // W
        let shortb = toSeconds(row[24]); // Y

        let meeting =
            toSeconds(row[20]) + // U
            toSeconds(row[23]);  // X

        let totalBreak = lunch + tea + shortb;
        let netLogin = totalLogin - totalBreak;

        // 🔥 CDR FILTER
        let calls = cdr.filter(c =>
            c[1] == empID &&  // Username
            ["callmature", "transfer"].includes(
                (c[25] || "").toLowerCase()
            )
        );

        let totalCalls = calls.length;

        let ib = calls.filter(c =>
            (c[7] || "").toUpperCase() === "INBOUND"
        ).length;

        let ob = totalCalls - ib;

        let totalTalk = calls.reduce((sum, c) =>
            sum + toSeconds(c[13]), 0
        );

        let aht = totalCalls ? totalTalk / totalCalls : 0;

        final.push({
            empID,
            name,
            totalLogin,
            netLogin,
            totalBreak,
            meeting,
            aht,
            totalCalls,
            ib,
            ob
        });
    });

    localStorage.setItem("dashboardData", JSON.stringify(final));
    window.location.href = "dashboard.html";
}

// DASHBOARD
document.addEventListener("DOMContentLoaded", () => {

    const data = JSON.parse(localStorage.getItem("dashboardData") || "[]");
    const table = document.querySelector("#dataTable tbody");

    data.forEach(r => {

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
});
