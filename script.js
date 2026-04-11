// ================= GLOBAL =================
let crmEnabled = false;

// ================= TIME =================
function toSeconds(t){
    if(!t || t === "-") return 0;
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

// ================= PROCESS =================
function processFiles(){

    let aprFile = document.getElementById("aprFile").files[0];
    let cdrFile = document.getElementById("cdrFile").files[0];

    if(!aprFile || !cdrFile){
        alert("Upload APR & CDR");
        return;
    }

    let reader1 = new FileReader();
    let reader2 = new FileReader();

    reader1.onload = function(e1){

        let wb1 = XLSX.read(e1.target.result, {type:'binary'});
        let apr = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], {header:1});

        reader2.onload = function(e2){

            let wb2 = XLSX.read(e2.target.result, {type:'binary'});
            let cdr = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], {header:1});

            generateDashboard(apr, cdr);
        };

        reader2.readAsBinaryString(cdrFile);
    };

    reader1.readAsBinaryString(aprFile);
}

// ================= GENERATE =================
function generateDashboard(apr, cdr){

    let final = [];

    // 🔥 CLEAN DATA
    let aprData = apr.slice(2); // remove top 2 rows
    let cdrData = cdr.slice(1); // remove top 1 row

    // 🔥 IVR HIT (Skill = INBOUND → Column H = index 7)
    let ivr = cdrData.filter(r => (r[7] || "").toString().toUpperCase() === "INBOUND").length;

    aprData.forEach(r=>{

        let emp = r[1]; // Column B
        let name = r[2]; // Column C

        if(!emp) return;

        // 🔥 TIME CALCULATION
        let login = toSeconds(r[3]); // D

        let breakTime =
            toSeconds(r[19]) + // T
            toSeconds(r[22]) + // W
            toSeconds(r[24]);  // Y

        let meeting =
            toSeconds(r[20]) + // U
            toSeconds(r[23]);  // X

        let net = login - breakTime;

        // 🔥 VALID CALL FILTER
        let empCalls = cdrData.filter(x=>{
            let dispo = (x[25] || "").toString().toLowerCase(); // Z
            return x[1] == emp &&
                (dispo.includes("callmatured") || dispo.includes("transfer"));
        });

        let total = empCalls.length;

        // 🔥 IB / OB
        let ib = empCalls.filter(x => (x[7] || "").toString().toUpperCase() === "INBOUND").length;
        let ob = total - ib;

        // 🔥 AHT (APR Column F = index 5)
        let totalTalk = toSeconds(r[5]);
        let aht = total ? totalTalk / total : 0;

        final.push({
            emp,
            name,
            login,
            breakTime,
            meeting,
            net,
            total,
            ib,
            ob,
            aht
        });
    });

    // 🔥 SORTING
    final.sort((a,b)=>b.total - a.total);

    sessionStorage.setItem("data", JSON.stringify({
        final,
        ivr
    }));

    location = "dashboard.html";
}

// ================= DASHBOARD LOAD =================
document.addEventListener("DOMContentLoaded", ()=>{

    let d = JSON.parse(sessionStorage.getItem("data") || "{}");
    if(!d.final) return;

    let {final, ivr} = d;

    let tb = document.querySelector("#table tbody");

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
        <td class="${r.net>=28800?"netGreen":""}">${toTime(r.net)}</td>
        <td class="${r.breakTime>2100?"breakRed":""}">${toTime(r.breakTime)}</td>
        <td class="${r.meeting>2100?"meetingRed":""}">${toTime(r.meeting)}</td>
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

    let overallAHT=totalCalls?totalTalk/totalCalls:0;
    document.getElementById("aht").innerText=toTime(overallAHT);
});

// ================= SEARCH =================
function searchAgent(){
    let v=document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.style.display=r.innerText.toLowerCase().includes(v)?"":"none";
    });
}

// ================= RESET =================
function resetApp(){
    sessionStorage.clear();
    location="index.html";
}
