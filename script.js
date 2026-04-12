// ===============================
// 🔥 FIREBASE CONFIG
// ===============================
const firebaseConfig = {
  apiKey: "AIzaSyCzPyZwPnSST3lv1pnSibq3dQjVIg2o-xs",
  authDomain: "agent-performance-live.firebaseapp.com",
  databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
  projectId: "agent-performance-live"
};

if (typeof firebase !== "undefined" && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();


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

function getGradientClass(val,max){
    let p = val/max;
    if(p >= 0.75) return "green";
    if(p >= 0.45) return "yellow";
    return "red";
}


// ===============================
// 🔥 PROCESS FILES (MAIN ENGINE)
// ===============================
function processFiles(){

    let aprFile = document.getElementById("aprFile").files[0];
    let cdrFile = document.getElementById("cdrFile").files[0];

    if(!aprFile || !cdrFile){
        alert("Upload both files");
        return;
    }

    document.getElementById("loading").style.display="block";

    let reader1 = new FileReader();
    let reader2 = new FileReader();

    reader1.onload = function(e){

        let apr = XLSX.read(e.target.result, {type:'binary'});
        let aprData = XLSX.utils.sheet_to_json(apr.Sheets[apr.SheetNames[0]], {header:1});

        reader2.onload = function(e2){

            let cdr = XLSX.read(e2.target.result, {type:'binary'});
            let cdrData = XLSX.utils.sheet_to_json(cdr.Sheets[cdr.SheetNames[0]], {header:1});

            // ===============================
            // 🔥 REPORT TIME
            // ===============================
            let reportRow = aprData[1][0] || "";
            let reportTime = reportRow.split("to")[1]?.trim() || "";

            // ===============================
            // 🔥 REMOVE HEADER ROWS
            // ===============================
            aprData.splice(0,3);
            cdrData.splice(0,2);

            let map = {};
            let ivr = 0;

            // ===============================
            // 🔥 APR DATA PROCESS
            // ===============================
            aprData.forEach(r=>{

                let emp = r[1];
                if(!emp) return;

                let login = toSeconds(r[3]);

                let breakTime =
                    toSeconds(r[19]) + // LUNCH
                    toSeconds(r[22]) + // SHORT
                    toSeconds(r[24]);  // TEA

                let meeting =
                    toSeconds(r[20]) + // MEETING
                    toSeconds(r[23]);  // SYSTEMDOWN

                map[emp] = {
                    emp: String(emp),
                    name: r[2] || "",
                    login,
                    breakTime,
                    meeting,
                    net: login - breakTime,
                    ahtRaw: toSeconds(r[5]),
                    total: 0,
                    ib: 0
                };
            });

            // ===============================
            // 🔥 CDR DATA PROCESS
            // ===============================
            cdrData.forEach(r=>{

                let emp = r[1];
                let skill = r[7];
                let dispo = (r[25] || "").toLowerCase();

                if(skill === "INBOUND") ivr++;

                if(!map[emp]) return;

                if(dispo === "callmatured" || dispo === "transfer"){
                    map[emp].total++;

                    if(skill === "INBOUND"){
                        map[emp].ib++;
                    }
                }
            });

            // ===============================
            // 🔥 FINAL ARRAY
            // ===============================
            let final = Object.values(map).map(r=>({
                emp: r.emp,
                name: r.name,
                login: r.login,
                net: r.net,
                breakTime: r.breakTime,
                meeting: r.meeting,
                aht: r.total ? r.ahtRaw / r.total : 0,
                total: r.total,
                ib: r.ib,
                ob: r.total - r.ib
            }));

            console.log("FINAL:", final);

            // ❌ STOP IF EMPTY
            if(!final || final.length === 0){
                alert("No data generated ❌");
                return;
            }

            // ===============================
            // 🔥 SAVE LOCAL
            // ===============================
            sessionStorage.setItem("data", JSON.stringify({
                final,
                ivr,
                reportTime
            }));

            // ===============================
            // 🔥 FIREBASE PUSH (FIXED)
            // ===============================
            db.ref("dashboard").set({
                final: final,
                ivr: ivr,
                reportTime: reportTime
            })
            .then(()=>{
                console.log("🔥 Firebase SUCCESS");
                window.location = "dashboard.html";
            })
            .catch(err=>{
                console.error("Firebase Error:", err);
                alert("Firebase push failed ❌");
            });

        };

        reader2.readAsBinaryString(cdrFile);
    };

    reader1.readAsBinaryString(aprFile);
}


// ===============================
// 🔥 LOAD DASHBOARD (UI)
// ===============================
function loadDashboard(final, ivr){

    let tb = document.querySelector("#table tbody");
    if(!tb) return;

    tb.innerHTML="";

    let max = Math.max(...final.map(x=>x.total));

    let totalCalls=0,totalIB=0,totalOB=0,totalTalk=0;

    final.forEach(r=>{

        totalCalls+=r.total;
        totalIB+=r.ib;
        totalOB+=r.ob;
        totalTalk+=(r.aht*r.total);

        let netCls = r.net >= 28800 ? "netGreen" : "";
        let breakCls = r.breakTime > 2100 ? "breakRed" : "";
        let meetingCls = r.meeting > 2100 ? "meetingRed" : "";
        let callCls = getGradientClass(r.total, max);

        let tr=document.createElement("tr");

        tr.innerHTML=`
        <td><b><i>${r.emp}</i></b></td>
        <td><b><i>${r.name}</i></b></td>
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

    document.getElementById("ivr").innerText=ivr;
    document.getElementById("total").innerText=totalCalls;
    document.getElementById("ib").innerText=totalIB;
    document.getElementById("ob").innerText=totalOB;

    let overallAHT = totalCalls ? totalTalk/totalCalls : 0;
    document.getElementById("aht").innerText = toTime(overallAHT);
}


// ===============================
// 🔥 AUTO LOAD + LIVE
// ===============================
document.addEventListener("DOMContentLoaded", ()=>{

    let d = JSON.parse(sessionStorage.getItem("data") || "{}");

    if(d.final){
        loadDashboard(d.final, d.ivr);
    }

    // 🔥 LIVE SYNC
    db.ref("dashboard").on("value",(snap)=>{

        let data = snap.val();

        console.log("LIVE:", data);

        if(data && data.final){
            loadDashboard(data.final, data.ivr);
        }
    });
});


// ===============================
// 🔍 SEARCH
// ===============================
function searchAgent(){
    let v=document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.style.display=r.innerText.toLowerCase().includes(v)?"":"none";
    });
}


// ===============================
// 🔄 RESET
// ===============================
function resetApp(){
    sessionStorage.clear();
    location="index.html";
}
