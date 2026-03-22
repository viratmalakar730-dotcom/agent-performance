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

// 🔹 Convert time safely
function toSeconds(time) {
    if (!time) return 0;
    let parts = time.toString().split(":").map(Number);
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

// 🔹 Get value safely (handles different column names)
function getVal(obj, keys) {
    for (let k of keys) {
        if (obj[k] !== undefined) return obj[k];
    }
    return "";
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

    console.log("APR Sample:", apr[0]);
    console.log("CDR Sample:", cdr[0]);

    // 🔹 IVR HIT
    const ivrHit = cdr.filter(r => getVal(r, ["Skill"]) === "INBOUND").length;

    let final = [];

    apr.forEach(agent => {

        let name = getVal(agent, ["Agent Name", "Agent Full Name"]);

        let calls = cdr.filter(c => 
            getVal(c, ["Username", "User Full Name"]) === name &&
            ["callmature", "transfer"].includes(
                getVal(c, ["Disposition"])
            )
        );

        let totalCalls = calls.length;

        let ib = calls.filter(c => 
            getVal(c, ["Campaign"]).includes("IB")
        ).length;

        let ob = calls.filter(c => 
            getVal(c, ["Campaign"]).includes("OB")
        ).length;

        let totalTalk = calls.reduce((sum, c) => 
            sum + toSeconds(getVal(c, ["Talk Duration"])), 0
        );

        let login = toSeconds(getVal(agent, ["Total Login Time"]));

        let breakTime = 
            toSeconds(getVal(agent, ["LUNCHBREAK"])) +
            toSeconds(getVal(agent, ["TEABREAK"])) +
            toSeconds(getVal(agent, ["SHORTBREAK"]));

        let meeting = 
            toSeconds(getVal(agent, ["MEETING"])) +
            toSeconds(getVal(agent, ["SYSTEMDOWN"]));

        let netLogin = login - breakTime;

        let aht = totalCalls ? totalTalk / totalCalls : 0;

        final.push({
            name: name || "N/A",
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

// 🔹 DASHBOARD LOAD
document.addEventListener("DOMContentLoaded", () => {

    const stored = JSON.parse(localStorage.getItem("dashboardData") || "{}");
    if (!stored.data) return;

    document.getElementById("ivr").innerText = "IVR HIT: " + stored.ivrHit;

    const table = document.querySelector("#dataTable tbody");

    stored.data.forEach(r => {

        let rowClass = r.breakTime > r.netLogin ? "red" : "green";

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

// 🔹 EXPORT EXCEL
function exportExcel() {
    const data = JSON.parse(localStorage.getItem("dashboardData")).data;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "Dashboard.xlsx");
}
