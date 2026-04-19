console.log("🔥 FINAL PRO MAX SYSTEM");

// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "agent-performance-live.firebaseapp.com",
  databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
  projectId: "agent-performance-live"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
let db = firebase.database();

// ================= HELPERS =================
function safeStr(v){
    if(v === undefined || v === null) return "";
    return String(v).trim();
}

function timeToSeconds(t){
    if(!t || t === "-") return 0;
    if(typeof t === "number") return Math.floor(t*86400);

    let p = String(t).split(":");
    return (+p[0]*3600)+(+p[1]*60)+(+p[2]||0);
}

function secondsToTime(sec){
    sec = Math.max(0, Math.floor(sec));
    let h = String(Math.floor(sec/3600)).padStart(2,'0');
    let m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
    let s = String(sec%60).padStart(2,'0');
    return `${h}:${m}:${s}`;
}

// ================= PROCESS =================
function processFiles(){

    let apr = document.getElementById("aprFile")?.files[0];
    let cdr = document.getElementById("cdrFile")?.files[0];

    if(!apr || !cdr){
        alert("Upload APR + CDR");
        return;
    }

    document.getElementById("loading").style.display="block";

    readAPR(apr,(aprData)=>{
        readCDR(cdr,(cdrData)=>{

            let final = buildDashboard(aprData,cdrData);
            let summary = buildSummary(cdrData,final);

            db.ref("dashboard").set({
                final,
                summary,
                reportTime: window.reportDate || ""
            });

            window.location.href="dashboard.html";
        });
    });
}

// ================= READ APR =================
function readAPR(file,cb){

    let r = new FileReader();

    r.onload = e=>{
        let wb = XLSX.read(new Uint8Array(e.target.result),{type:"array"});
        let raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});

        let row2 = raw[1]?.[0] || "";
        if(row2.toLowerCase().includes("to")){
            window.reportDate = row2.split("to")[1].trim();
        }

        let data = raw.slice(2);
        let headers = data[0];

        let json = data.slice(1).map(r=>{
            let obj = {};
            headers.forEach((h,i)=> obj[h]=r[i]);
            return obj;
        });

        cb(json);
    };

    r.readAsArrayBuffer(file);
}

// ================= READ CDR =================
function readCDR(file,cb){

    let r = new FileReader();

    r.onload = e=>{
        let wb = XLSX.read(new Uint8Array(e.target.result),{type:"array"});
        let raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});

        let data = raw.slice(1);
        let headers = data[0];

        let json = data.slice(1).map(r=>{
            let obj = {};
            headers.forEach((h,i)=> obj[h]=r[i]);
            return obj;
        });

        cb(json);
    };

    r.readAsArrayBuffer(file);
}

// ================= CORE =================
function buildDashboard(apr,cdr){

    let result = [];

    apr.forEach(a=>{

        let emp = safeStr(a["Agent Name"]);
        let name = safeStr(a["Agent Full Name"]);

        let login = timeToSeconds(a["Total Login Time"]);

        // 🔥 LOGIN CAP
        if(login > (8*3600 + 15*60)){
            login = 8*3600;
        }

        let breakTime =
            timeToSeconds(a["LUNCHBREAK"]) +
            timeToSeconds(a["TEABREAK"]) +
            timeToSeconds(a["SHORTBREAK"]);

        let net = login - breakTime;

        let agentCDR = cdr.filter(r =>
            safeStr(r["Username"]) === emp
        );

        let total = agentCDR.filter(r=>{
            let d = safeStr(r["Disposition"]).toUpperCase();
            return d.includes("CALLMATURED") || d.includes("TRANSFER");
        }).length;

        let ib = agentCDR.filter(r=>{
            let d = safeStr(r["Disposition"]).toUpperCase();
            let c = safeStr(r["Campaign"]).toUpperCase();
            return (d.includes("CALLMATURED") || d.includes("TRANSFER")) &&
                   c.includes("CSRINBOUND");
        }).length;

        let ob = total - ib;

        let talk = agentCDR.reduce((s,r)=>
            s + timeToSeconds(r["Talk Duration"]),0);

        let aht = total ? talk/total : 0;

        result.push({
            emp,
            name,
            login:secondsToTime(login),
            netLogin:secondsToTime(net),
            break:secondsToTime(breakTime),
            meeting:a["MEETING"] || "00:00:00",
            aht:secondsToTime(aht),
            calls:total,
            ib,
            ob
        });
    });

    return result;
}

// ================= SUMMARY =================
function buildSummary(cdr,data){

    let ivr = cdr.filter(r =>
        safeStr(r["Skill"]).toUpperCase().includes("INBOUND")
    ).length;

    let total = data.reduce((s,r)=>s+r.calls,0);
    let ib = data.reduce((s,r)=>s+r.ib,0);
    let ob = data.reduce((s,r)=>s+r.ob,0);

    let totalLogin = data.length;

    let totalTalk = data.reduce((s,r)=>s+timeToSeconds(r.aht)*r.calls,0);
    let overallAHT = total ? totalTalk/total : 0;

    return {
        ivr,
        total,
        ib,
        ob,
        totalLogin,
        aht: secondsToTime(overallAHT)
    };
}

// ================= LOAD =================
function loadDashboard(data){

    let tbody = document.querySelector("#table tbody");
    if(!tbody) return;

    tbody.innerHTML = "";

    data.final.forEach((r,i)=>{

        let loginSec = timeToSeconds(r.login);
        let netSec = timeToSeconds(r.netLogin);

        let netCls = "";

        // 🔥 FINAL NET LOGIN CONDITION
        if(loginSec >= (8*3600 + 15*60) && netSec < 8*3600){
            netCls = "red3d";
        }

        let tr = document.createElement("tr");

        tr.innerHTML = `
        <td>${i+1}</td>
        <td>${r.emp}</td>
        <td>${r.name}</td>
        <td>${r.login}</td>
        <td class="${netCls}">${r.netLogin}</td>
        <td>${r.break}</td>
        <td>${r.meeting}</td>
        <td>${r.aht}</td>
        <td>${r.calls}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>
        `;

        tbody.appendChild(tr);
    });

    // 🔥 CARDS
    let c = data.summary;

    document.getElementById("cards").innerHTML = `
    <div class="card">Total IVR Hit<br>${c.ivr}</div>
    <div class="card">Total Mature<br>${c.total}</div>
    <div class="card">IB Mature<br>${c.ib}</div>
    <div class="card">OB Mature<br>${c.ob}</div>
    <div class="card">Overall AHT<br>${c.aht}</div>
    <div class="card">Total Login Count<br>${c.totalLogin}</div>
    `;

    document.getElementById("reportTime").innerText =
    "Last Update Till: " + (data.reportTime || "");
}

// ================= SEARCH =================
function searchTable(){
    let input = document.getElementById("search").value.toLowerCase();
    let rows = document.querySelectorAll("#table tbody tr");

    rows.forEach(r=>{
        let text = r.innerText.toLowerCase();
        r.style.display = text.includes(input) ? "" : "none";
    });
}

// ================= EXPORT =================
function exportExcel(){
    let wb = XLSX.utils.table_to_book(document.getElementById("table"));
    XLSX.writeFile(wb,"Dashboard.xlsx");
}

// ================= COPY =================
function downloadPNG(){
    html2canvas(document.getElementById("table"),{scale:3}).then(canvas=>{
        canvas.toBlob(blob=>{
            navigator.clipboard.write([
                new ClipboardItem({"image/png":blob})
            ]);
            alert("Copied ✅");
        });
    });
}

// ================= RESET =================
function resetDashboard(){
    db.ref("dashboard").remove();
    location.href="index.html";
}

// ================= LIVE =================
document.addEventListener("DOMContentLoaded",()=>{
    db.ref("dashboard").on("value",snap=>{
        let d = snap.val();
        if(d) loadDashboard(d);
    });
});
