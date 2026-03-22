function readExcel(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            resolve(XLSX.utils.sheet_to_json(sheet));
        };
        reader.readAsArrayBuffer(file);
    });
}

function toSeconds(time) {
    if (!time) return 0;
    let t = time.toString().split(":").map(Number);
    return (t[0]||0)*3600 + (t[1]||0)*60 + (t[2]||0);
}

async function processFiles() {

    const aprFile = document.getElementById("aprFile").files[0];
    const cdrFile = document.getElementById("cdrFile").files[0];

    if (!aprFile || !cdrFile) {
        alert("Upload both files ❌");
        return;
    }

    document.getElementById("loading").style.display = "block";

    const apr = await readExcel(aprFile);
    const cdr = await readExcel(cdrFile);

    console.log("APR:", apr[0]);
    console.log("CDR:", cdr[0]);

    // 🔹 IVR HIT
    const ivrHit = cdr.filter(r => r["Skill"] === "INBOUND").length;

    let final = [];

    apr.forEach(agent => {

        // 🔥 Employee ID (MAIN MATCH)
        let empID = agent["Agent Name"];

        // 🔹 Display name
        let fullName = agent["Agent Full Name"] || empID;

        // 🔹 Match with CDR Username
        let calls = cdr.filter(c => 
            c["Username"] == empID &&
            (c["Disposition"] === "callmature" || c["Disposition"] === "transfer")
        );

        let totalCalls = calls.length;

        let ib = calls.filter(c => 
            (c["Campaign"] || "").toUpperCase().includes("IB")
        ).length;

        let ob = calls.filter(c => 
            (c["Campaign"] || "").toUpperCase().includes("OB")
        ).length;

        let totalTalk = calls.reduce((sum, c) => 
            sum + toSeconds(c["Talk Duration"]), 0
        );

        let login = toSeconds(agent["Total Login Time"]);

        let breakTime =
            toSeconds(agent["LUNCHBREAK"]) +
            toSeconds(agent["TEABREAK"]) +
            toSeconds(agent["SHORTBREAK"]);

        let meeting =
            toSeconds(agent["MEETING"]) +
            toSeconds(agent["SYSTEMDOWN"]);

        let netLogin = login - breakTime;

        let aht = totalCalls ? totalTalk / totalCalls : 0;

        final.push({
            name: fullName,
            totalCalls,
            ib,
            ob,
            netLogin,
            breakTime,
            meeting,
            aht
        });
    });

    // 🔹 Sorting
    final.sort((a, b) => b.totalCalls - a.totalCalls || b.netLogin - a.netLogin);

    localStorage.setItem("dashboardData", JSON.stringify({
        data: final,
        ivrHit: ivrHit
    }));

    window.location.href = "dashboard.html";
}

// 🔹 Dashboard load
document.addEventListener("DOMContentLoaded", () => {

    const stored = JSON.parse(localStorage.getItem("dashboardData") || "{}");
    if (!stored.data) return;

    document.getElementById("ivr").innerText = "IVR HIT: " + stored.ivrHit;

    const table = document.querySelector("#dataTable tbody");

    stored.data.forEach(r => {

        let rowClass = r.netLogin >= 28800 ? "green" : "red"; // 8 hr = 28800 sec

        const tr = document.createElement("tr");
        tr.className = rowClass;

        tr.innerHTML = `
        <td>${r.name}</td>
        <td>${r.totalCalls}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>
        <td>${(r.netLogin/3600).toFixed(2)}</td>
        <td>${(r.aht).toFixed(0)}</td>
        `;

        table.appendChild(tr);
    });
});

// 🔹 Export Excel
function exportExcel() {
    const data = JSON.parse(localStorage.getItem("dashboardData")).data;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "Dashboard.xlsx");
}
