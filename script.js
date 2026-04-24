console.log("🔥 FINAL PRO SYSTEM");

// ================= FIREBASE =================
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

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

function waitForFirebase(cb){
    let t = setInterval(()=>{
        if(typeof firebase !== "undefined"){
            clearInterval(t);
            cb();
        }
    },100);
}

waitForFirebase(initFirebase);

// ================= COMMON HELPERS =================
const $ = id => document.getElementById(id);

function safeStr(v){ return (v ?? "").toString().trim(); }

function timeToSeconds(t){
    if(!t || t === "-") return 0;
    if(typeof t === "number") return Math.floor(t*86400);
    let [h,m,s=0] = String(t).split(":");
    return (+h*3600)+(+m*60)+(+s);
}

function secondsToTime(sec){
    sec = Math.max(0, Math.floor(sec));
    let h = String(Math.floor(sec/3600)).padStart(2,'0');
    let m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
    let s = String(sec%60).padStart(2,'0');
    return `${h}:${m}:${s}`;
}

// ================= SEARCH =================
function searchTable(){
    let v = $("search")?.value.toLowerCase() || "";
    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.style.display = r.innerText.toLowerCase().includes(v) ? "" : "none";
    });
}

// ================= SOUND + ALERT =================
let lastUpdateTime = "";
let soundUnlocked = false;

document.addEventListener("click",()=>{
    soundUnlocked = true;
    let s = $("notifySound");
    if(s){
        s.muted = false;
        s.play().then(()=>{ s.pause(); s.currentTime=0; }).catch(()=>{});
    }
});

function playSound(){
    let s = $("notifySound");
    if(s && soundUnlocked){
        s.currentTime = 0;
        s.play().catch(()=>{});
    }
}

function showAlert(){
    let el = $("liveAlert");
    if(!el) return;
    el.style.display = "block";
    el.classList.add("blink");
    setTimeout(()=>{
        el.style.display = "none";
        el.classList.remove("blink");
    },3000);
}

// ================= 🔔 NOTIFICATION =================
function requestNotification(){
    if("Notification" in window && Notification.permission !== "granted"){
        Notification.requestPermission();
    }
}

function showDesktopNotification(){
    if("Notification" in window && Notification.permission === "granted"){
        new Notification("📊 Agent Performance Report Updated",{
            body:"New data available"
        });
    }
}

// ================= EXPORT =================
function exportExcel(){
    let table = $("table");
    if(!table) return;
    let wb = XLSX.utils.table_to_book(table, {sheet:"Report"});
    XLSX.writeFile(wb, "Dashboard.xlsx");
}

function downloadPNG(){
    html2canvas(document.body).then(c=>{
        let a = document.createElement("a");
        a.download = "dashboard.png";
        a.href = c.toDataURL();
        a.click();
    });
}

// ================= FILE READ =================
function readExcel(file, skip, cb){
    let r = new FileReader();
    r.onload = e=>{
        let wb = XLSX.read(new Uint8Array(e.target.result),{type:"array"});
        let raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});

        let data = raw.slice(skip);
        let headers = data[0];

        let json = data.slice(1).map(row=>{
            let o = {};
            headers.forEach((h,i)=> o[h]=row[i]);
            return o;
        });

        cb(json, raw);
    };
    r.readAsArrayBuffer(file);
}

// ================= PROCESS =================
function processFiles(){

    if(!db){
        alert("Firebase loading...");
        return;
    }

    let apr = $("aprFile")?.files[0];
    let cdr = $("cdrFile")?.files[0];

    if(!apr || !cdr){
        alert("Upload both files");
        return;
    }

    let btn = document.querySelector("button");
    if(btn){ btn.innerText="⏳ Processing..."; btn.disabled=true; }

    readExcel(apr,2,(aprData,raw)=>{
        let row2 = raw[1]?.join(" ") || "";
        if(row2.includes("to")) window.reportDate = row2.split("to")[1].trim();

        readExcel(cdr,1,(cdrData)=>{

            let final = buildDashboard(aprData,cdrData);
            let summary = buildSummary(cdrData,final);

            db.ref("dashboard").set({
                final, summary,
                reportTime: window.reportDate || new Date().toLocaleString()
            });

            window.location.href = "dashboard.html";
        });
    });
}

// ================= RESET =================
function resetDashboard(){
    if(db) db.ref("dashboard").remove();
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("index.html?reset="+Date.now());
}

// ================= CORE =================
function buildDashboard(apr,cdr){

    return apr.map(a=>{

        let emp = safeStr(a["Agent Name"]);
        let name = safeStr(a["Agent Full Name"]);

        let login = timeToSeconds(a["Total Login Time"]);
        let breakTime =
            timeToSeconds(a["LUNCHBREAK"]) +
            timeToSeconds(a["TEABREAK"]) +
            timeToSeconds(a["SHORTBREAK"]);

        let net = login - breakTime;

        let agentCDR = cdr.filter(r=> safeStr(r["Username"])===emp);

        let total = agentCDR.filter(r=>{
            let d = safeStr(r["Disposition"]).toUpperCase();
            return d.includes("CALLMATURED") || d.includes("TRANSFER");
        }).length;

        let ib = agentCDR.filter(r=>{
            let d = safeStr(r["Disposition"]).toUpperCase();
            let c = safeStr(r["Campaign"]).toUpperCase();
            return (d.includes("CALLMATURED")||d.includes("TRANSFER")) && c.includes("CSRINBOUND");
        }).length;

        let ob = total - ib;

        let talk = agentCDR.reduce((s,r)=> s + timeToSeconds(r["Talk Duration"]),0);
        let aht = total ? talk/total : 0;

        return {
            emp,name,
            login:secondsToTime(login),
            netLogin:secondsToTime(net),
            break:secondsToTime(breakTime),
            meeting:a["MEETING"]||"00:00:00",
            aht:secondsToTime(aht),
            calls:total, ib, ob
        };
    });
}

// ================= SUMMARY =================
function buildSummary(cdr,data){

    let ivr = cdr.filter(r=> safeStr(r["Skill"]).toUpperCase().includes("INBOUND")).length;

    let total = data.reduce((s,r)=>s+r.calls,0);
    let ib = data.reduce((s,r)=>s+r.ib,0);
    let ob = data.reduce((s,r)=>s+r.ob,0);

    let totalLogin = data.length;

    let totalTalk = data.reduce((s,r)=>s+timeToSeconds(r.aht)*r.calls,0);
    let overallAHT = total ? totalTalk/total : 0;

    return { ivr,total,ib,ob,totalLogin, aht:secondsToTime(overallAHT) };
}

// ================= LOAD =================
function loadDashboard(data){

    let tbody = document.querySelector("#table tbody");
    if(!tbody) return;

    tbody.innerHTML = "";

    data.final.forEach((r,i)=>{

        let netCls = timeToSeconds(r.netLogin) > 28800 ? "green3d" : "";
        let callCls = r.calls>=100 ? "green3d" : r.calls>=70 ? "yellow3d" : "red3d";

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
        <td class="${callCls}">${r.calls}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>`;
        tbody.appendChild(tr);
    });

    let c = data.summary;

    $("cards").innerHTML = `
    <div class="card">Total IVR Hit<br>${c.ivr}</div>
    <div class="card">Total Mature<br>${c.total}</div>
    <div class="card">IB Mature<br>${c.ib}</div>
    <div class="card">OB Mature<br>${c.ob}</div>
    <div class="card">Overall AHT<br>${c.aht}</div>
    <div class="card">Total Login Count<br>${c.totalLogin}</div>
    `;

    $("reportTime").innerText = "Last Update Till: " + data.reportTime;
}

// ================= LIVE =================
document.addEventListener("DOMContentLoaded",()=>{

    requestNotification();

    let t = setInterval(()=>{
        if(db){
            clearInterval(t);

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
        }
    },200);
});

// ================= GLOBAL =================
window.processFiles = processFiles;
window.resetDashboard = resetDashboard;
window.searchTable = searchTable;
window.exportExcel = exportExcel;
window.downloadPNG = downloadPNG;
