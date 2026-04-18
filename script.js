// ===============================
// 🔥 SAFE FIREBASE INIT (UPGRADED)
// ===============================
let db = null;

try{
    const firebaseConfig = {
        apiKey: "AIzaSyCzPyZwPnSST3lv1pnSibq3dQjVIg2o-xs",
        authDomain: "agent-performance-live.firebaseapp.com",
        databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
        projectId: "agent-performance-live"
    };

    if (typeof firebase !== "undefined") {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.database();
    }
}catch(e){
    console.log("Firebase Disabled:", e);
}

// 🔥 SAFE CLOUD SAVE (NON-BLOCKING)
function saveToCloud(payload){
    try{
        if(db){
            db.ref("dashboard").set(payload);
        }
    }catch(e){
        console.log("Cloud Save Error:", e);
    }
}

// ===============================
// 🔥 TIME FUNCTIONS
// ===============================
function toSeconds(t){
    if(!t) return 0;
    let a = t.toString().split(":").map(Number);
    return (a[0]||0)*3600 + (a[1]||0)*60 + (a[2]||0);
}

function toTime(sec){
    sec = Math.max(0, Math.round(sec));
    let h = Math.floor(sec/3600);
    let m = Math.floor((sec%3600)/60);
    let s = sec%60;
    return [h,m,s].map(v=>String(v).padStart(2,'0')).join(":");
}

// ===============================
// 🔥 CALL COLOR
// ===============================
function getCallClass(val, max){
    if(max === 0) return "";
    let r = val/max;

    if(r >= 0.75) return "green3D";
    if(r >= 0.4) return "yellow3D";
    return "red3D";
}

// ===============================
// 📂 READ EXCEL
// ===============================
function readExcel(file,skip){
    return new Promise(res=>{
        let r=new FileReader();
        r.onload=e=>{
            let wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
            let d=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
            res(d.slice(skip));
        };
        r.readAsArrayBuffer(file);
    });
}

// ===============================
// 🔥 PROCESS FILES (NEW ADD - IMPORTANT)
// ===============================
async function processFiles(){

    let aprFile=document.getElementById("aprFile")?.files[0];
    let cdrFile=document.getElementById("cdrFile")?.files[0];

    if(!aprFile || !cdrFile){
        alert("Upload both files ❌");
        return;
    }

    document.getElementById("loading").style.display="block";

    let apr=await readExcel(aprFile,3);
    let cdr=await readExcel(cdrFile,2);

    let final=[];
    let ivr=0;

    cdr.forEach(c=>{
        if((c[7]||"").toUpperCase().includes("INBOUND")) ivr++;
    });

    apr.forEach(r=>{

        if(!r[1]) return;

        let emp=(r[1]||"").toString().trim();
        let name=r[2];

        let login=toSeconds(r[3]);

        let breakTime=
        toSeconds(r[19])+toSeconds(r[22])+toSeconds(r[24]);

        let meeting=
        toSeconds(r[20])+toSeconds(r[23]);

        let net=Math.max(0,login-breakTime);

        let calls=cdr.filter(c=>{
            return (c[1]||"").toString().trim()===emp &&
            ((c[25]||"").toLowerCase().includes("callmatured") ||
             (c[25]||"").toLowerCase().includes("transfer"));
        });

        let total=calls.length;

        let ib=calls.filter(c=>
            (c[7]||"").toUpperCase().includes("INBOUND")
        ).length;

        let ob=total-ib;

        let aht=total?Math.round(toSeconds(r[5])/total):0;

        final.push({emp,name,login,net,breakTime,meeting,aht,total,ib,ob});
    });

    let payload = { final, ivr };

    // LOCAL SAVE
    sessionStorage.setItem("data", JSON.stringify(payload));

    // 🔥 CLOUD SAVE (NO BLOCK)
    saveToCloud(payload);

    // REDIRECT
    location="dashboard.html";
}

// 🔥 GLOBAL FIX (BUTTON ISSUE)
window.processFiles = processFiles;

// ===============================
// 🔥 LOAD DASHBOARD
// ===============================
function loadDashboard(final, ivr, reportTime){

    let tb = document.querySelector("#table tbody");
    if(!tb) return;

    tb.innerHTML = "";

    let max = Math.max(...final.map(x=>x.total));

    let totalCalls=0,totalIB=0,totalOB=0,totalTalk=0;

    final.forEach(r=>{

        totalCalls+=r.total;
        totalIB+=r.ib;
        totalOB+=r.ob;
        totalTalk+=(r.aht*r.total);

        let netCls = r.net >= 28800 ? "netGreen3D" : "";
        let breakCls = r.breakTime > 2100 ? "red3D" : "";
        let meetingCls = r.meeting > 2100 ? "red3D" : "";
        let callCls = getCallClass(r.total, max);

        let tr=document.createElement("tr");

        tr.innerHTML=`
        <td>${r.emp}</td>
        <td>${r.name}</td>
        <td>${toTime(r.login)}</td>
        <td class="${netCls}">${toTime(r.net)}</td>
        <td class="${breakCls}">${toTime(r.breakTime)}</td>
        <td class="${meetingCls}">${toTime(r.meeting)}</td>
        <td>${toTime(r.aht)}</td>
        <td class="${callCls}">${r.total}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>
        `;

        tb.appendChild(tr);
    });

    document.getElementById("ivr").innerText=ivr || 0;
    document.getElementById("total").innerText=totalCalls;
    document.getElementById("ib").innerText=totalIB;
    document.getElementById("ob").innerText=totalOB;

    document.getElementById("aht").innerText =
        totalCalls ? toTime(totalTalk/totalCalls) : "00:00:00";

    document.getElementById("reportTime").innerText =
        "Last Update Till: " + (reportTime || "");
}

// ===============================
// 🔥 LOAD DATA
// ===============================
document.addEventListener("DOMContentLoaded", ()=>{

    try{
        let d = JSON.parse(sessionStorage.getItem("data") || "{}");

        if(d.final){
            loadDashboard(d.final, d.ivr, d.reportTime);
        }

        if(db){
            db.ref("dashboard").on("value",(snap)=>{
                let data = snap.val();
                if(data && data.final){
                    loadDashboard(data.final, data.ivr, data.reportTime);
                }
            });
        }

    }catch(e){
        console.log("Load Error:", e);
    }
});

// बाकी functions SAME (copyImage, exportExcel, search, reset, click etc.)
