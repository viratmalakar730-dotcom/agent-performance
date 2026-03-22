function readExcel(file, skipRows = 0) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            let json = XLSX.utils.sheet_to_json(sheet, { defval: 0 });

            json = json.slice(skipRows);

            json = json.map(row => {
                Object.keys(row).forEach(k => {
                    if (row[k] === "-") row[k] = 0;
                });
                return row;
            });

            resolve(json);
        };
        reader.readAsArrayBuffer(file);
    });
}

// 🔹 smart column finder
function findKey(obj, possibleNames) {
    return Object.keys(obj).find(k =>
        possibleNames.some(name =>
            k.toLowerCase().includes(name.toLowerCase())
        )
    );
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

    let sampleAPR = apr[0];
    let sampleCDR = cdr[0];

    // 🔥 AUTO DETECT COLUMNS
    let empKey = findKey(sampleAPR, ["agent name", "employee"]);
    let nameKey = findKey(sampleAPR, ["full name"]);
    let loginKey = findKey(sampleAPR, ["login"]);

    let lunchKey = findKey(sampleAPR, ["lunch"]);
    let teaKey = findKey(sampleAPR, ["tea"]);
    let shortKey = findKey(sampleAPR, ["short"]);
    let meetKey = findKey(sampleAPR, ["meeting"]);
    let sysKey = findKey(sampleAPR, ["system"]);

    let userKey = findKey(sampleCDR, ["username"]);
    let dispoKey = findKey(sampleCDR, ["disposition"]);
    let skillKey = findKey(sampleCDR, ["skill"]);
    let talkKey = findKey(sampleCDR, ["talk"]);

    console.log("Detected:", {
        empKey, nameKey, loginKey,
        lunchKey, teaKey, shortKey,
        meetKey, sysKey,
        userKey, dispoKey, skillKey, talkKey
    });

    let final = [];

    apr.forEach(agent => {

        let empID = agent[empKey];
        let fullName = agent[nameKey];

        let totalLogin = toSeconds(agent[loginKey]);

        let totalBreak =
            toSeconds(agent[lunchKey]) +
            toSeconds(agent[teaKey]) +
            toSeconds(agent[shortKey]);

        let meeting =
            toSeconds(agent[meetKey]) +
            toSeconds(agent[sysKey]);

        let netLogin = totalLogin - totalBreak;

        let calls = cdr.filter(c =>
            c[userKey] == empID &&
            ["callmature", "transfer"].includes(
                (c[dispoKey] || "").toLowerCase()
            )
        );

        let totalCalls = calls.length;

        let ib = calls.filter(c =>
            (c[skillKey] || "").toUpperCase() === "INBOUND"
        ).length;

        let ob = totalCalls - ib;

        let totalTalk = calls.reduce((sum, c) =>
            sum + toSeconds(c[talkKey]), 0
        );

        let aht = totalCalls ? totalTalk / totalCalls : 0;

        final.push({
            empID,
            name: fullName,
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
