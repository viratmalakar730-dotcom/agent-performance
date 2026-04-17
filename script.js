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
// 🔥 PROCESS FILES
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

            // 🔥 REPORT TIME
            let reportRow = aprData[1]?.[0] || "";
            let reportTime = reportRow.split("to")[1]?.trim() || "";

            aprData.splice(0,3);
            cdrData.splice(0,2);

            let map = {};
            let ivr = 0;

            // 🔥 APR LOOP
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
                    emp,
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

            // 🔥 CDR LOOP
            cdrData.forEach(r=>{
                let emp = r[1];
                let skill = r[7];
                let dispo = (r[25] || "").toLowerCase();

                if(skill === "INBOUND") ivr++;

                if(!map[emp]) return;

                if(dispo === "callmatured" || dispo === "transfer"){
                    map[emp].total++;
                    if(skill === "INBOUND") map[emp].ib++;
                }
            });

            let final = Object.values(map).map(r=>({
                ...r,
                aht: r.total ? r.ahtRaw / r.total : 0,
                ob: r.total - r.ib
            }));

            sessionStorage.setItem("data", JSON.stringify({final, ivr, reportTime}));
            db.ref("dashboard").set({final, ivr, reportTime});

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

    tb.innerHTML = "";

    final.forEach(r=>{

        // 🔥 FINAL CONDITIONAL (3D)
        let netCls = r.net >= 28800 ? "netGreen3D" : "";
        let breakCls = r.breakTime > 2100 ? "red3D" : "";
        let meetingCls = r.meeting > 2100 ? "red3D" : "";

        let tr = document.createElement("tr");

        tr.innerHTML = `
        <td>${r.emp}</td>
        <td>${r.name}</td>
        <td>${toTime(r.login)}</td>
        <td class="${netCls}">${toTime(r.net)}</td>
        <td class="${breakCls}">${toTime(r.breakTime)}</td>
        <td class="${meetingCls}">${toTime(r.meeting)}</td>
        <td>${toTime(r.aht)}</td>
        <td>${r.total}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>
        `;

        tb.appendChild(tr);
    });

    // 🔥 SUMMARY
    document.getElementById("ivr").innerText = ivr;
    document.getElementById("total").innerText = final.reduce((a,b)=>a+b.total,0);
    document.getElementById("ib").innerText = final.reduce((a,b)=>a+b.ib,0);
    document.getElementById("ob").innerText = final.reduce((a,b)=>a+b.ob,0);

    let totalTalk = final.reduce((a,b)=>a+(b.aht*b.total),0);
    let totalCalls = final.reduce((a,b)=>a+b.total,0);

    document.getElementById("aht").innerText =
        totalCalls ? toTime(totalTalk/totalCalls) : "00:00:00";

    document.getElementById("reportTime").innerText =
        "Last Update Till: " + (reportTime || "");
}

// ===============================
// 🔥 LIVE + AUTO REFRESH
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

    // 🔥 AUTO REFRESH
    setInterval(()=>{
        location.reload();
    },120000);
});

// ===============================
// 🔥 PNG COPY
// ===============================
function copyImage(){
    html2canvas(document.getElementById("table"), {scale:2}).then(canvas=>{
        canvas.toBlob(blob=>{
            navigator.clipboard.write([
                new ClipboardItem({"image/png": blob})
            ]);
            alert("Copied as PNG ✅");
        });
    });
}

// ===============================
// 🔥 EXCEL EXPORT
// ===============================
function exportExcel(){

    let d = JSON.parse(sessionStorage.getItem("data") || "{}");
    if(!d.final) return;

    let ws_data = [[
        "Emp","Name","Login","Net","Break","Meeting","AHT","Call","IB","OB"
    ]];

    d.final.forEach(r=>{
        ws_data.push([
            r.emp,r.name,
            toTime(r.login),toTime(r.net),
            toTime(r.breakTime),toTime(r.meeting),
            toTime(r.aht),
            r.total,r.ib,r.ob
        ]);
    });

    let ws = XLSX.utils.aoa_to_sheet(ws_data);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");

    XLSX.writeFile(wb, "Agent_Report.xlsx");
}

// ===============================
// 🔍 SEARCH
// ===============================
function searchAgent(){
    let v = document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("tbody tr").forEach(r=>{
        r.style.display = r.innerText.toLowerCase().includes(v) ? "" : "none";
    });
}

// ===============================
// 🔄 RESET
// ===============================
function resetApp(){
    sessionStorage.clear();
    location = "index.html";
}

// ===============================
// 🔥 ROW HIGHLIGHT
// ===============================
document.addEventListener("click", function(e){
    let row = e.target.closest("tr");
    if(!row || row.parentNode.tagName !== "TBODY") return;

    document.querySelectorAll("tbody tr").forEach(r=>{
        r.classList.remove("rowActive");
    });

    row.classList.add("rowActive");
});
