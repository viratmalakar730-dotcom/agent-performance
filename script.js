console.log("🔥 FINAL UPGRADED SYSTEM");

// ================= FIREBASE =================
let db = null;

const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "agent-performance-live.firebaseapp.com",
  databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
  projectId: "agent-performance-live"
};

if (typeof firebase !== "undefined") {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

// ================= SAFE STRING =================
function safeStr(val){
    if(val === undefined || val === null) return "";
    return String(val).trim();
}

// ================= TIME =================
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

    let aprFile = document.getElementById("aprFile")?.files[0];
    let cdrFile = document.getElementById("cdrFile")?.files[0];

    if(!aprFile || !cdrFile){
        alert("Upload both files");
        return;
    }

    document.getElementById("loading").style.display="block";

    readAPR(aprFile,(apr)=>{
        readCDR(cdrFile,(cdr)=>{

            let final = buildDashboard(apr,cdr);

            let payload = {
                final,
                reportTime: window.reportDate || ""
            };

            if(db) db.ref("dashboard").set(payload);

            document.getElementById("loading").style.display="none";

            window.location.href="dashboard.html";
        });
    });
}

// ================= APR =================
function readAPR(file,cb){

    let r = new FileReader();

    r.onload = e=>{
        let data = new Uint8Array(e.target.result);
        let wb = XLSX.read(data,{type:"array"});
        let sheet = wb.Sheets[wb.SheetNames[0]];
        let raw = XLSX.utils.sheet_to_json(sheet,{header:1});

        let row2 = raw[1]?.[0] || "";
        if(row2.toLowerCase().includes("to")){
            window.reportDate = row2.split("to")[1].trim();
        }

        let trimmed = raw.slice(2);

        let headers = trimmed[0];
        let rows = trimmed.slice(1);

        let json = rows.map(r=>{
            let obj = {};
            headers.forEach((h,i)=> obj[h]=r[i]);
            return obj;
        });

        cb(json);
    };

    r.readAsArrayBuffer(file);
}

// ================= CDR =================
function readCDR(file,cb){

    let r = new FileReader();

    r.onload = e=>{
        let data = new Uint8Array(e.target.result);
        let wb = XLSX.read(data,{type:"array"});
        let sheet = wb.Sheets[wb.SheetNames[0]];
        let raw = XLSX.utils.sheet_to_json(sheet,{header:1});

        let trimmed = raw.slice(1);

        let headers = trimmed[0];
        let rows = trimmed.slice(1);

        let json = rows.map(r=>{
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
            login = 8 * 3600;
        }

        let lunch = timeToSeconds(a["LUNCHBREAK"]);
        let tea = timeToSeconds(a["TEABREAK"]);
        let short = timeToSeconds(a["SHORTBREAK"]);

        let totalBreak = lunch + tea + short;
        let netLogin = login - totalBreak;

        let agentCDR = cdr.filter(r=>{
            return safeStr(r["Username"]) === emp;
        });

        let totalMature = agentCDR.filter(r=>{
            let d = safeStr(r["Disposition"]).toUpperCase();
            return d.includes("CALLMATURED") || d.includes("TRANSFER");
        }).length;

        let ibMature = agentCDR.filter(r=>{
            let d = safeStr(r["Disposition"]).toUpperCase();
            let c = safeStr(r["Campaign"]).toUpperCase();
            return (d.includes("CALLMATURED") || d.includes("TRANSFER")) &&
                   c.includes("CSRINBOUND");
        }).length;

        let obMature = totalMature - ibMature;

        let totalTalk = agentCDR.reduce((s,r)=>
            s + timeToSeconds(r["Talk Duration"]),0);

        let aht = totalMature ? totalTalk / totalMature : 0;

        result.push({
            emp,name,
            login:secondsToTime(login),
            netLogin:secondsToTime(netLogin),
            break:secondsToTime(totalBreak),
            meeting:a["MEETING"] || "00:00:00",
            aht:secondsToTime(aht),
            calls:totalMature,
            ib:ibMature,
            ob:obMature
        });

    });

    return result;
}

// ================= LOAD =================
function loadDashboard(data){

    let tbody = document.querySelector("#table tbody");
    if(!tbody) return;

    tbody.innerHTML = "";

    data.final.forEach(r=>{

        let net = timeToSeconds(r.netLogin);
        let brk = timeToSeconds(r.break);
        let meet = timeToSeconds(r.meeting);

        // 🔥 NET LOGIN
        let netCls = net > 8*3600 ? "green3d" : "red3d";

        // 🔥 BREAK
        let breakCls = brk > 2100 ? "red3d" : "";

        // 🔥 MEETING
        let meetCls = meet > 2100 ? "red3d" : "";

        // 🔥 CALLS
        let callCls="";
        if(r.calls >= 100) callCls="green3d";
        else if(r.calls >= 70) callCls="yellow3d";
        else callCls="red3d";

        let tr = document.createElement("tr");

        tr.innerHTML = `
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

    let rt = document.getElementById("reportTime");
    if(rt){
        rt.innerText = "Last Update Till: " + (data.reportTime || "");
    }
}

// ================= COPY PNG =================
function downloadPNG(){
    html2canvas(document.getElementById("table"),{scale:3}).then(canvas=>{
        canvas.toBlob(blob=>{
            navigator.clipboard.write([
                new ClipboardItem({"image/png": blob})
            ]);
            alert("Copied ✅");
        });
    });
}

// ================= RESET =================
function resetDashboard(){

    if(confirm("Reset dashboard?")){
        if(db) db.ref("dashboard").remove();
        location.href="index.html";
    }
}

// ================= LIVE =================
document.addEventListener("DOMContentLoaded",()=>{
    if(db){
        db.ref("dashboard").on("value",(snap)=>{
            let d = snap.val();
            if(d) loadDashboard(d);
        });
    }
});
