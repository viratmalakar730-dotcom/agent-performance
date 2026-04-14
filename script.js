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


// ===============================
// 🔥 AUTO REPORT BUTTON (ADDED)
// ===============================
function runAutoReport(){

    let loader = document.getElementById("loading");
    if(loader) loader.style.display="block";

    fetch("http://localhost:3000/run-flow")
    .then(res => res.text())
    .then(data => {

        if(loader) loader.style.display="none";

        alert("✅ Auto Report Generated");

        window.location = "dashboard.html";
    })
    .catch(err=>{
        if(loader) loader.style.display="none";
        alert("❌ Error: " + err);
    });
}


// ===============================
// 🔥 PNG COPY FIX (FINAL)
// ===============================
function copyImage(){

    html2canvas(document.body).then(canvas => {

        canvas.toBlob(blob => {

            const item = new ClipboardItem({ "image/png": blob });
            navigator.clipboard.write([item]);

            alert("📸 PNG Copied Successfully");

        });

    });

}


// ===============================
// 🔥 EXCEL EXPORT FIX (FINAL)
// ===============================
function exportExcel(){

    let table = document.getElementById("table");

    let wb = XLSX.utils.table_to_book(table, {sheet:"Report"});

    XLSX.writeFile(wb, "Agent_Report.xlsx");

}


// ===============================
// 🔥 PROCESS FILES (UNCHANGED)
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

            let reportRow = aprData[1]?.[0] || "";
            let reportTime = reportRow.split("to")[1]?.trim() || "";

            aprData.splice(0,3);
            cdrData.splice(0,2);

            let map = {};
            let ivr = 0;

            aprData.forEach(r=>{
                let emp = r[1];
                if(!emp) return;

                let login = toSeconds(r[3]);

                let breakTime =
                    toSeconds(r[19]) +
                    toSeconds(r[22]) +
                    toSeconds(r[24]);

                let meeting =
                    toSeconds(r[20]) +
                    toSeconds(r[23]);

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

            if(!final.length){
                alert("No data generated ❌");
                return;
            }

            sessionStorage.setItem("data", JSON.stringify({
                final,
                ivr,
                reportTime
            }));

            db.ref("dashboard").set({
                final,
                ivr,
                reportTime
            });

            window.location = "dashboard.html";
        };

        reader2.readAsBinaryString(cdrFile);
    };

    reader1.readAsBinaryString(aprFile);
}


// ===============================
// 🔥 LOAD DASHBOARD
// ===============================
function loadDashboard(final, ivr, reportTime){

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

        let tr=document.createElement("tr");

        tr.innerHTML=`
        <td>${r.emp}</td>
        <td>${r.name}</td>
        <td>${toTime(r.login)}</td>
        <td>${toTime(r.net)}</td>
        <td>${toTime(r.breakTime)}</td>
        <td>${toTime(r.meeting)}</td>
        <td>${toTime(r.aht)}</td>
        <td>${r.total}</td>
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

    document.getElementById("reportTime").innerText =
        "Report Time: " + (reportTime || "");
}


// ===============================
// 🔥 AUTO LOAD + LIVE
// ===============================
document.addEventListener("DOMContentLoaded", ()=>{

    let d = JSON.parse(sessionStorage.getItem("data") || "{}");

    if(d.final){
        loadDashboard(d.final, d.ivr, d.reportTime);
    }

    db.ref("dashboard").on("value",(snap)=>{
        let data = snap.val();

        if(data && data.final){
            loadDashboard(data.final, data.ivr, data.reportTime);
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
