console.log("🔥 ULTIMATE FINAL SYSTEM");

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
    return (v ?? "").toString().trim();
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

// ================= PROCESS FILES =================
function processFiles(){

    let aprFile = document.getElementById("aprFile")?.files[0];
    let cdrFile = document.getElementById("cdrFile")?.files[0];

    if(!aprFile || !cdrFile){
        alert("Please upload APR and CDR files");
        return;
    }

    readAPR(aprFile,(aprData)=>{
        readCDR(cdrFile,(cdrData)=>{

            let final = buildDashboard(aprData,cdrData);
            let summary = buildSummary(cdrData,final);

            db.ref("dashboard").set({
                final,
                summary,
                reportTime: window.reportDate || ""
            });

            window.location.href = "dashboard.html";
        });
    });
}

// ================= READ APR =================
function readAPR(file,cb){

    let r = new FileReader();

    r.onload = e=>{
        let wb = XLSX.read(new Uint8Array(e.target.result),{type:"array"});
        let raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});

        let row2 = raw[1] || [];
        let fullText = row2.join(" ");

        if(fullText.includes("to")){
            window.reportDate = fullText.split("to")[1].trim();
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
            emp,name,
            login:secondsToTime(login),
            netLogin:secondsToTime(net),
            break:secondsToTime(breakTime),
            meeting:a["MEETING"] || "00:00:00",
            aht:secondsToTime(aht),
            calls:total,
            ib,ob
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
        ivr,total,ib,ob,totalLogin,
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
        let breakSec = timeToSeconds(r.break);
        let meetSec = timeToSeconds(r.meeting);

        let netCls = "";
        if(netSec > 8*3600){
            netCls = "green3d";
        }
        else if(loginSec >= (8*3600 + 15*60) && netSec < 8*3600){
            netCls = "red3d";
        }

        let breakCls = breakSec > 2100 ? "red3d" : "";
        let meetCls = meetSec > 2100 ? "red3d" : "";

        let callCls="";
        if(r.calls >= 100) callCls="green3d";
        else if(r.calls >= 70) callCls="yellow3d";
        else callCls="red3d";

        let tr = document.createElement("tr");

        tr.innerHTML = `
        <td>${i+1}</td>
        <td>${r.emp}</td>
        <td>${r.name}</td>
        <td>${r.login}</td>
        <td class="${netCls}">${r.netLogin}</td>
        <td class="${breakCls}">${r.break}</td>
        <td class="${meetCls}">${r.meeting}</td>
        <td>${r.aht}</td>
        <td class="${callCls}">${r.calls}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>
        `;

        tbody.appendChild(tr);
    });

    let c = data.summary || {ivr:0,total:0,ib:0,ob:0,totalLogin:0,aht:"00:00:00"};

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

// ================= FULL PAGE COPY =================
function downloadPNG(){

    let tableBox = document.querySelector(".table-container");

    if(tableBox){
        tableBox.style.maxHeight = "none";
        tableBox.style.overflow = "visible";
    }

    html2canvas(document.body,{scale:3}).then(canvas=>{
        canvas.toBlob(blob=>{
            navigator.clipboard.write([
                new ClipboardItem({"image/png":blob})
            ]);
            alert("Full Page Copied ✅");
        });

        if(tableBox){
            tableBox.style.maxHeight = "520px";
            tableBox.style.overflow = "auto";
        }
    });
}

// ================= EXPORT =================
function exportExcel(){
    let wb = XLSX.utils.table_to_book(document.getElementById("table"));
    XLSX.writeFile(wb,"Dashboard.xlsx");
}

// ================= RESET =================
function resetDashboard(){
    db.ref("dashboard").remove();
    location.href="index.html";
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

// ================= LIVE =================
document.addEventListener("DOMContentLoaded",()=>{
    db.ref("dashboard").on("value",snap=>{
        let d = snap.val();
        if(d) loadDashboard(d);
    });
});
