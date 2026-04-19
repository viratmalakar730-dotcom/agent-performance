console.log("🔥 FINAL FIXED SYSTEM");

// ================= FIREBASE FIX =================
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "agent-performance-live.firebaseapp.com",
  databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
  projectId: "agent-performance-live"
};

if (typeof firebase !== "undefined") {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
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

// ================= CORE =================
function buildDashboard(apr,cdr){

    let result=[];

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

// ================= LOAD =================
function loadDashboard(data){

    let tbody = document.querySelector("#table tbody");
    if(!tbody) return;

    tbody.innerHTML = "";

    data.final.forEach(r=>{

        let net = timeToSeconds(r.netLogin);
        let brk = timeToSeconds(r.break);
        let meet = timeToSeconds(r.meeting);

        let netCls = net > 8*3600 ? "green3d" : "red3d";
        let breakCls = brk > 2100 ? "red3d" : "";
        let meetCls = meet > 2100 ? "red3d" : "";

        let callCls="";
        if(r.calls >= 100) callCls="green3d";
        else if(r.calls >= 70) callCls="yellow3d";
        else callCls="red3d";

        let tr=document.createElement("tr");

        tr.innerHTML=`
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

    document.getElementById("reportTime").innerText =
    "Last Update Till: " + (data.reportTime || "");
}

// ================= FIREBASE LISTENER =================
document.addEventListener("DOMContentLoaded",()=>{
    if (typeof firebase !== "undefined") {
        firebase.database().ref("dashboard").on("value",(snap)=>{
            let d = snap.val();
            if(d) loadDashboard(d);
        });
    }
});
