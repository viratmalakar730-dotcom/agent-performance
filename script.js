console.log("🚀 FINAL PRO SCRIPT (THEME SAFE)");

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

// Firebase Init
if (typeof firebase !== "undefined") {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

// ================= TIME UTILS =================
function timeToSeconds(t) {
    if (!t || t === "-" || t === undefined) return 0;

    if (typeof t === "number") {
        return Math.floor(t * 24 * 60 * 60);
    }

    let parts = t.toString().split(":");
    return (+parts[0] * 3600) + (+parts[1] * 60) + (+parts[2] || 0);
}

function secondsToTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    let h = String(Math.floor(sec / 3600)).padStart(2, '0');
    let m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    let s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// ================= PROCESS =================
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

            // 🔥 REMOVE UNDEFINED (Firebase fix)
            finalData = finalData.map(r => ({
                emp: r.emp || "NA",
                name: r.name || "Unknown",
                calls: r.calls || 0,
                netLogin: r.netLogin || "00:00:00",
                break: r.break || "00:00:00",
                meeting: r.meeting || "00:00:00",
                talk: r.talk || "00:00:00",
                aht: r.aht || "00:00:00",
                util: r.util || "0%"
            }));

            let payload = {
                final: finalData,
                reportTime: new Date().toLocaleString()
            };

            // 🔥 HISTORY SAFE
            if (db) {
                db.ref("history/" + Date.now()).set(payload);
                db.ref("dashboard").set(payload);
            }

            alert("✅ Report Generated Successfully");
        });
    });
}

// ================= READ =================
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

// ================= CORE =================
function buildDashboard(apr, cdr) {

    let result = [];

    apr.forEach(a => {

        if (!a || Object.keys(a).length === 0) return;

        // ✅ SAFE COLUMN
        let emp = a["Agent Name"] || a["Username"] || "NA";
        let name = a["Agent Full Name"] || a["User Full Name"] || "Unknown";

        if (emp === "NA" && name === "Unknown") return;

        // TIME
        let login = timeToSeconds(a["Total Login Time"]);
        let lunch = timeToSeconds(a["LUNCHBREAK"]);
        let tea = timeToSeconds(a["TEABREAK"]);
        let short = timeToSeconds(a["SHORTBREAK"]);
        let system = timeToSeconds(a["SYSTEMDOWN"]);
        let meeting = timeToSeconds(a["MEETING"]);

        let totalBreak = lunch + tea + short;
        let netLogin = login - (totalBreak + system);

        // CDR
        let agentCDR = cdr.filter(r =>
            (r["User Full Name"] || "") === name &&
            r["Call Status"] === "Answered" &&
            timeToSeconds(r["Talk Duration"]) > 0
        );

        let calls = agentCDR.length;

        let totalTalk = agentCDR.reduce((sum, r) =>
            sum + timeToSeconds(r["Talk Duration"]), 0);

        let aht = calls ? totalTalk / calls : 0;
        let util = netLogin ? (totalTalk / netLogin) * 100 : 0;

        result.push({
            emp,
            name,
            calls,
            netLogin: secondsToTime(netLogin),
            break: secondsToTime(totalBreak),
            meeting: secondsToTime(meeting),
            talk: secondsToTime(totalTalk),
            aht: secondsToTime(aht),
            util: util.toFixed(1) + "%"
        });
    });

    return result;
}

// ================= LIVE =================
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

            // 🔥 COLOR SAFE (theme compatible)
            let sec = timeToSeconds(r.netLogin);
            let cls = "";

            if (sec > 7 * 3600) cls = "green";
            else if (sec > 5 * 3600) cls = "yellow";
            else cls = "red";

            tr.innerHTML = `
                <td>${r.emp}</td>
                <td>${r.name}</td>
                <td>${r.calls}</td>
                <td class="${cls}">${r.netLogin}</td>
                <td>${r.break}</td>
                <td>${r.meeting}</td>
                <td>${r.talk}</td>
                <td>${r.aht}</td>
                <td>${r.util}</td>
            `;

            tbody.appendChild(tr);
        });

        // ✅ REPORT TIME SAFE
        let rt = document.getElementById("reportTime");
        if (rt) {
            rt.innerText = "Last Update Till: " + d.reportTime;
        }
    });
});
