console.log("🚀 PRO VERSION LOADED");

// ================= GLOBAL =================
let db;
let originalAPR = [];
let originalCDR = [];

const firebaseConfig = {
  apiKey: "AIzaSyCzPyZwPnSST3lv1pnSibq3dQjVIg2o-xs",
  authDomain: "agent-performance-live.firebaseapp.com",
  databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
  projectId: "agent-performance-live"
};

if (typeof firebase !== "undefined") {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

// ================= TIME UTILS =================
function timeToSeconds(t) {
    if (!t || t === "-") return 0;
    let parts = t.split(":");
    return (+parts[0] * 3600) + (+parts[1] * 60) + (+parts[2] || 0);
}

function secondsToTime(sec) {
    sec = Math.floor(sec);
    let h = String(Math.floor(sec / 3600)).padStart(2, '0');
    let m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    let s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// ================= FILE PROCESS =================
function processFiles() {

    const aprFile = document.getElementById("aprFile")?.files[0];
    const cdrFile = document.getElementById("cdrFile")?.files[0];

    if (!aprFile || !cdrFile) {
        alert("APR + CDR dono upload karo");
        return;
    }

    readExcel(aprFile, (aprData) => {
        readExcel(cdrFile, (cdrData) => {

            originalAPR = aprData;
            originalCDR = cdrData;

            let finalData = buildDashboard(aprData, cdrData);

            let payload = {
                final: finalData,
                reportTime: new Date().toLocaleString()
            };

            // 🔥 HISTORY SAVE (upgrade)
            db.ref("history/" + Date.now()).set(payload);

            // 🔥 LIVE DASHBOARD
            db.ref("dashboard").set(payload);

            alert("✅ Report Generated Successfully");
        });
    });
}

// ================= EXCEL READ =================
function readExcel(file, callback) {
    let reader = new FileReader();

    reader.onload = function (e) {
        let data = new Uint8Array(e.target.result);
        let workbook = XLSX.read(data, { type: "array" });
        let sheet = workbook.Sheets[workbook.SheetNames[0]];
        let json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        callback(json);
    };

    reader.readAsArrayBuffer(file);
}

// ================= CORE LOGIC =================
function buildDashboard(apr, cdr) {

    let result = [];

    apr.forEach(agent => {

        let name = agent["Agent Full Name"];
        let emp = agent["Agent Name"];

        // 🔹 TIME FIELDS
        let login = timeToSeconds(agent["Total Login Time"]);
        let lunch = timeToSeconds(agent["LUNCHBREAK"]);
        let tea = timeToSeconds(agent["TEABREAK"]);
        let short = timeToSeconds(agent["SHORTBREAK"]);
        let system = timeToSeconds(agent["SYSTEMDOWN"]);
        let meeting = timeToSeconds(agent["MEETING"]);

        // 🔥 CALCULATIONS
        let totalBreak = lunch + tea + short;
        let netLogin = login - (totalBreak + system);

        // 🔹 CDR FILTER (MATURE CALLS)
        let agentCDR = cdr.filter(r =>
            r["User Full Name"] === name &&
            r["Call Status"] === "Answered" &&
            timeToSeconds(r["Talk Duration"]) > 0
        );

        let totalCalls = agentCDR.length;

        let totalTalk = agentCDR.reduce((sum, r) =>
            sum + timeToSeconds(r["Talk Duration"]), 0);

        let aht = totalCalls ? totalTalk / totalCalls : 0;

        // 🔹 UTILIZATION
        let utilization = netLogin ? (totalTalk / netLogin) * 100 : 0;

        result.push({
            emp,
            name,
            calls: totalCalls,
            login: secondsToTime(login),
            netLogin: secondsToTime(netLogin),
            break: secondsToTime(totalBreak),
            meeting: secondsToTime(meeting),
            talk: secondsToTime(totalTalk),
            aht: secondsToTime(aht),
            utilization: utilization.toFixed(1) + "%"
        });
    });

    return result;
}

// ================= LIVE TABLE =================
document.addEventListener("DOMContentLoaded", () => {

    if (!db) return;

    db.ref("dashboard").on("value", snap => {

        let d = snap.val();
        if (!d) return;

        let tbody = document.querySelector("#table tbody");
        if (!tbody) return;

        tbody.innerHTML = "";

        d.final.forEach(r => {

            let tr = document.createElement("tr");

            // 🔥 CONDITIONAL COLOR
            let netSec = timeToSeconds(r.netLogin);
            let colorClass = "";

            if (netSec > 7 * 3600) colorClass = "green";
            else if (netSec > 5 * 3600) colorClass = "yellow";
            else colorClass = "red";

            tr.innerHTML = `
                <td>${r.emp}</td>
                <td>${r.name}</td>
                <td>${r.calls}</td>
                <td class="${colorClass}">${r.netLogin}</td>
                <td>${r.break}</td>
                <td>${r.meeting}</td>
                <td>${r.talk}</td>
                <td>${r.aht}</td>
                <td>${r.utilization}</td>
            `;

            tbody.appendChild(tr);
        });

        // 🔹 REPORT TIME
        document.getElementById("reportTime").innerText =
            "Last Update Till: " + d.reportTime;
    });
});
