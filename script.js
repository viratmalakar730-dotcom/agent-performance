console.log("🔥 FINAL PRO SYSTEM");

// ================= FIREBASE SAFE INIT =================
let db = null;

function initFirebase(){

    if(typeof firebase === "undefined"){
        console.error("❌ Firebase not loaded");
        return;
    }

    const firebaseConfig = {
        apiKey: "AIzaSy...",
        authDomain: "agent-performance-live.firebaseapp.com",
        databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
        projectId: "agent-performance-live"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    db = firebase.database();
}

// INIT
initFirebase();

// ================= SOUND =================
let lastUpdateTime = "";
let soundUnlocked = false;

document.addEventListener("click",()=>{
    soundUnlocked = true;
});

// ================= 🔔 DESKTOP =================
function requestNotificationPermission(){
    if("Notification" in window){
        if(Notification.permission !== "granted"){
            Notification.requestPermission();
        }
    }
}

function showDesktopNotification(){
    if("Notification" in window && Notification.permission === "granted"){
        new Notification("📊 Dashboard Updated",{
            body:"New data uploaded"
        });
    }
}

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

// ================= 🔔 ALERT =================
function showAlert(){
    let el = document.getElementById("liveAlert");

    if(el){
        el.style.display = "block";
        el.classList.add("blink");

        setTimeout(()=>{
            el.style.display = "none";
            el.classList.remove("blink");
        },3000);
    }
}

// ================= 🔊 SOUND =================
function playSound(){
    let sound = document.getElementById("notifySound");

    if(sound && soundUnlocked){
        sound.currentTime = 0;
        sound.play().catch(()=>{});
    }
}

// ================= PROCESS FILES =================
function processFiles(){

    if(!db){
        alert("Firebase not ready");
        return;
    }

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
                reportTime: window.reportDate || new Date().toLocaleString()
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

// ================= LIVE =================
document.addEventListener("DOMContentLoaded",()=>{

    requestNotificationPermission();

    if(!db) return;

    db.ref("dashboard").on("value",snap=>{

        let d = snap.val();
        if(!d) return;

        if(!lastUpdateTime){
            lastUpdateTime = d.reportTime;
            loadDashboard(d);
            return;
        }

        if(d.reportTime !== lastUpdateTime){

            playSound();
            showAlert();
            showDesktopNotification();

            lastUpdateTime = d.reportTime;
        }

        loadDashboard(d);
    });

});
