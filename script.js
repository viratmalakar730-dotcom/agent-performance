// 🔥 FIREBASE SAFE INIT (NO DUPLICATE ERROR)
if (typeof firebase !== "undefined" && !firebase.apps.length) {
    firebase.initializeApp({
        apiKey: "AIzaSyCzPyZwPnSST3lv1pnSibq3dQjVIg2o-xs",
        authDomain: "agent-performance-live.firebaseapp.com",
        databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com",
        projectId: "agent-performance-live"
    });
}

// 🔥 TIME FUNCTIONS
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

// 🔥 PROCESS FILES
function processFiles(){

    let aprFile = document.getElementById("aprFile").files[0];
    let cdrFile = document.getElementById("cdrFile").files[0];

    if(!aprFile || !cdrFile){
        alert("Upload both files");
        return;
    }

    document.getElementById("loading").style.display = "block";

    let reader1 = new FileReader();
    let reader2 = new FileReader();

    reader1.onload = function(e){
        let apr = XLSX.read(e.target.result, {type:'binary'});
        let aprData = XLSX.utils.sheet_to_json(apr.Sheets[apr.SheetNames[0]], {header:1});

        reader2.onload = function(e2){
            let cdr = XLSX.read(e2.target.result, {type:'binary'});
            let cdrData = XLSX.utils.sheet_to_json(cdr.Sheets[cdr.SheetNames[0]], {header:1});

            generateDashboard(aprData, cdrData);
        }

        reader2.readAsBinaryString(cdrFile);
    }

    reader1.readAsBinaryString(aprFile);
}
// 🔥 Firebase send
if (window.firebaseDB) {
    firebaseDB.ref("dashboard").set({
        final: final,
        ivr: ivr
    });
}
// 🔥 GENERATE DASHBOARD
function generateDashboard(apr, cdr){

    apr.splice(0,2);
    cdr.splice(0,1);

    let map = {};

    // 🔥 APR DATA
    apr.forEach(r=>{
        let emp = r[1];
        if(!emp) return;

        map[emp] = {
            emp: emp,
            name: r[2] || "",
            login: toSeconds(r[3]),
            breakTime: toSeconds(r[19]) + toSeconds(r[23]) + toSeconds(r[21]),
            meeting: toSeconds(r[20]) + toSeconds(r[22]),
            aht: toSeconds(r[5]),
            total: 0,
            ib: 0,
            ob: 0
        };

        map[emp].net = map[emp].login - map[emp].breakTime;
    });

    let ivr = 0;

    // 🔥 CDR DATA
    cdr.forEach(r=>{
        let emp = r[1];
        let skill = r[7];
        let dispo = (r[25] || "").toString().toLowerCase();

        if(skill === "INBOUND") ivr++;

        if(!map[emp]) return;

        if(dispo === "callmatured" || dispo === "transfer"){

            map[emp].total++;

            if(skill === "INBOUND"){
                map[emp].ib++;
            }else{
                map[emp].ob++;
            }
        }
    });

    let final = Object.values(map);

    // 🔥 SAVE SESSION
    sessionStorage.setItem("data", JSON.stringify({
        final: final,
        ivr: ivr
    }));

    // 🔥 FIREBASE SAVE (FIXED)
    if(typeof firebase !== "undefined"){
        firebase.database().ref("liveData").set({
            final: final,   // ✅ IMPORTANT FIX
            ivr: ivr,
            updated: new Date().toISOString()
        });
    }

    location = "dashboard.html";
}

// 🔥 LOAD DASHBOARD
document.addEventListener("DOMContentLoaded", ()=>{

    let d = JSON.parse(sessionStorage.getItem("data") || "{}");
    if(!d.final) return;

    let {final, ivr} = d;

    final.sort((a,b)=>b.total - a.total);

    let max = Math.max(...final.map(x=>x.total));

    const tb = document.querySelector("#table tbody");

    let totalCalls=0,totalIB=0,totalOB=0,totalTalk=0;

    final.forEach(r=>{

        totalCalls+=r.total;
        totalIB+=r.ib;
        totalOB+=r.ob;
        totalTalk+=(r.aht*r.total);

        let callCls=getGradientClass(r.total,max);

        let netCls=r.net>=28800?"netGreen":"";
        let breakCls=r.breakTime>2100?"breakRed":"";
        let meetingCls=r.meeting>2100?"meetingRed":"";

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

    let overallAHT=totalCalls?totalTalk/totalCalls:0;
    document.getElementById("aht").innerText=toTime(overallAHT);
});

// 🔍 SEARCH
function searchAgent(){
    let v=document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.style.display=r.innerText.toLowerCase().includes(v)?"":"none";
    });
}

// 📸 PNG
function copyImage(){
    html2canvas(document.getElementById("table"),{scale:2}).then(c=>{
        c.toBlob(b=>{
            navigator.clipboard.write([new ClipboardItem({"image/png":b})]);
            alert("Copied!");
        });
    });
}

// 📊 EXCEL
function exportExcel(){
    let table = document.getElementById("table");
    let wb = XLSX.utils.table_to_book(table, {sheet:"Dashboard"});
    XLSX.writeFile(wb, "Agent_Report.xlsx");
}

// 🔄 RESET
function resetApp(){
    sessionStorage.clear();
    location="index.html";
}
