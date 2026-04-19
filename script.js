console.log("🔥 FINAL RESTORED VERSION");

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

// ================= TIME =================
function timeToSeconds(t){
    if(!t || t === "-" || t === undefined) return 0;
    if(typeof t === "number") return Math.floor(t*86400);

    let p = t.toString().split(":");
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
        alert("APR + CDR upload karo");
        return;
    }

    document.getElementById("loading").style.display="block";

    readAPR(aprFile,(apr)=>{
        readCDR(cdrFile,(cdr)=>{

            let final = buildDashboard(apr,cdr);

            let payload = {
                final,
                reportTime: new Date().toLocaleString()
            };

            if(db) db.ref("dashboard").set(payload);

            document.getElementById("loading").style.display="none";
            window.location.href="dashboard.html";
        });
    });
}

// ================= APR =================
function readAPR(file,cb){

    let reader = new FileReader();

    reader.onload = function(e){

        let data = new Uint8Array(e.target.result);
        let wb = XLSX.read(data,{type:"array"});
        let sheet = wb.Sheets[wb.SheetNames[0]];

        let raw = XLSX.utils.sheet_to_json(sheet,{header:1});

        let trimmed = raw.slice(2); // row fix

        let headers = trimmed[0];
        let rows = trimmed.slice(1);

        let json = rows.map(r=>{
            let obj = {};
            headers.forEach((h,i)=> obj[h] = r[i]);
            return obj;
        });

        cb(json);
    };

    reader.readAsArrayBuffer(file);
}

// ================= CDR =================
function readCDR(file,cb){

    let reader = new FileReader();

    reader.onload = function(e){

        let data = new Uint8Array(e.target.result);
        let wb = XLSX.read(data,{type:"array"});
        let sheet = wb.Sheets[wb.SheetNames[0]];

        let raw = XLSX.utils.sheet_to_json(sheet,{header:1});

        let trimmed = raw.slice(1);

        let headers = trimmed[0];
        let rows = trimmed.slice(1);

        let json = rows.map(r=>{
            let obj = {};
            headers.forEach((h,i)=> obj[h] = r[i]);
            return obj;
        });

        cb(json);
    };

    reader.readAsArrayBuffer(file);
}

// ================= CORE =================
function buildDashboard(apr,cdr){

    let result = [];

    apr.forEach(a=>{

        if(!a) return;

        let emp = a["Agent Name"] || "NA";
        let name = a["Agent Full Name"] || "Unknown";

        let login = timeToSeconds(a["Total Login Time"]);
        let lunch = timeToSeconds(a["LUNCHBREAK"]);
        let tea = timeToSeconds(a["TEABREAK"]);
        let short = timeToSeconds(a["SHORTBREAK"]);

        let totalBreak = lunch + tea + short;
        let netLogin = login - totalBreak;

        // ================= CDR FILTER =================

        let agentCDR = cdr.filter(r =>
            (r["User Full Name"] || "").trim() === name.trim()
        );

        // 🔥 IVR HIT
        let ivrHit = agentCDR.length;

        // 🔥 MATURE CALL (Answered + Talk > 0)
        let mature = agentCDR.filter(r =>
            r["Call Status"] === "Answered" &&
            timeToSeconds(r["Talk Duration"]) > 0
        );

        let totalMature = mature.length;

        let totalTalk = mature.reduce((s,r)=>
            s + timeToSeconds(r["Talk Duration"]),0);

        // 🔥 AHT
        let aht = totalMature ? totalTalk / totalMature : 0;

        // 🔥 IB / OB Mature
        let ibMature = mature.filter(r=>r["Call Type"]==="IB").length;
        let obMature = mature.filter(r=>r["Call Type"]==="OB").length;

        result.push({
            emp,
            name,
            login: secondsToTime(login),
            netLogin: secondsToTime(netLogin),
            break: secondsToTime(totalBreak),

            ivrHit,
            totalMature,
            ibMature,
            obMature,

            talk: secondsToTime(totalTalk),
            aht: secondsToTime(aht)
        });
    });

    return result;
}

// ================= LOAD =================
function loadDashboard(data){

    let tbody = document.querySelector("#table tbody");
    tbody.innerHTML = "";

    data.final.forEach(r=>{

        let tr = document.createElement("tr");

        // 🔥 3D COLOR वापस
        let sec = timeToSeconds(r.netLogin);
        let cls = sec>7*3600 ? "green" : sec>5*3600 ? "yellow" : "red";

        tr.innerHTML = `
        <td>${r.emp}</td>
        <td>${r.name}</td>
        <td>${r.login}</td>
        <td class="${cls}">${r.netLogin}</td>
        <td>${r.break}</td>
        <td>${r.ivrHit}</td>
        <td>${r.totalMature}</td>
        <td>${r.ibMature}</td>
        <td>${r.obMature}</td>
        <td>${r.aht}</td>
        `;

        tbody.appendChild(tr);
    });

    document.getElementById("reportTime").innerText =
        "Last Update Till: " + data.reportTime;
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
