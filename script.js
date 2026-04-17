// ===============================
// 🔥 SAFE FIREBASE INIT
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
// 🔥 CALL COLOR (DYNAMIC)
// ===============================
function getCallClass(val, max){
    if(max === 0) return "";
    let r = val/max;

    if(r >= 0.75) return "green3D";
    if(r >= 0.4) return "yellow3D";
    return "red3D";
}

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
// 🔥 LOAD DATA (SAFE)
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

// ===============================
// 🔥 PNG COPY (FIXED)
// ===============================
function copyImage(){
    if(typeof html2canvas === "undefined"){
        alert("PNG library missing ❌");
        return;
    }

    html2canvas(document.getElementById("table"),{scale:2}).then(canvas=>{
        canvas.toBlob(blob=>{
            navigator.clipboard.write([
                new ClipboardItem({"image/png":blob})
            ]);
            alert("Copied ✅");
        });
    });
}

// ===============================
// 🔥 EXCEL EXPORT (FIXED)
// ===============================
function exportExcel(){

    if(typeof XLSX === "undefined"){
        alert("Excel library missing ❌");
        return;
    }

    let d = JSON.parse(sessionStorage.getItem("data") || "{}");
    if(!d.final) return;

    let ws_data=[["Emp","Name","Login","Net","Break","Meeting","AHT","Call","IB","OB"]];

    d.final.forEach(r=>{
        ws_data.push([
            r.emp,r.name,
            toTime(r.login),toTime(r.net),
            toTime(r.breakTime),toTime(r.meeting),
            toTime(r.aht),r.total,r.ib,r.ob
        ]);
    });

    let ws = XLSX.utils.aoa_to_sheet(ws_data);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Report");

    XLSX.writeFile(wb,"Agent_Report.xlsx");
}

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

// ===============================
// 🔥 ROW CLICK
// ===============================
document.addEventListener("click", function(e){
    let row = e.target.closest("tr");
    if(!row || row.parentNode.tagName !== "TBODY") return;

    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.classList.remove("rowActive");
    });

    row.classList.add("rowActive");
});
