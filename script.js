// ================= GLOBAL =================
let crmEnabled = false;

// ================= CRM TOGGLE =================
function toggleCRM(){
    crmEnabled = !crmEnabled;
    document.getElementById("crmBox").style.display = crmEnabled ? "block" : "none";
}

// ================= TIME FUNCTIONS =================
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

// ================= PROCESS FILES =================
function processFiles(){

    document.getElementById("loading").style.display="block";

    let aprFile = document.getElementById("aprFile").files[0];
    let cdrFile = document.getElementById("cdrFile").files[0];
    let crmFile = document.getElementById("crmFile")?.files[0];

    if(!aprFile || !cdrFile){
        alert("Upload APR & CDR");
        return;
    }

    let reader1 = new FileReader();
    let reader2 = new FileReader();

    reader1.onload = function(e1){

        let wb1 = XLSX.read(e1.target.result, {type:'binary'});
        let sheet1 = wb1.Sheets[wb1.SheetNames[0]];
        let apr = XLSX.utils.sheet_to_json(sheet1, {header:1}); // 🔥 COLUMN MODE

        reader2.onload = function(e2){

            let wb2 = XLSX.read(e2.target.result, {type:'binary'});
            let sheet2 = wb2.Sheets[wb2.SheetNames[0]];
            let cdr = XLSX.utils.sheet_to_json(sheet2, {header:1}); // 🔥 COLUMN MODE

            // 🔥 CRM OFF → SAME OLD DASHBOARD
            if(!crmEnabled){
                generateDashboard(apr, cdr, null);
                return;
            }

            // 🔥 CRM ON BUT FILE NOT SELECTED
            if(crmEnabled && !crmFile){
                alert("Upload CRM File");
                return;
            }

            let reader3 = new FileReader();

            reader3.onload = function(e3){

                let wb3 = XLSX.read(e3.target.result, {type:'binary'});
                let sheet3 = wb3.Sheets[wb3.SheetNames[0]];
                let crm = XLSX.utils.sheet_to_json(sheet3, {header:1}); // 🔥 COLUMN MODE

                let taggingMap = {};

                // 👉 AK column = index 36
                crm.slice(1).forEach(r=>{
                    let emp = r[36];
                    if(emp){
                        taggingMap[emp] = (taggingMap[emp] || 0) + 1;
                    }
                });

                generateDashboard(apr, cdr, taggingMap);
            };

            reader3.readAsBinaryString(crmFile);
        };

        reader2.readAsBinaryString(cdrFile);
    };

    reader1.readAsBinaryString(aprFile);
}

// ================= GENERATE DASHBOARD =================
function generateDashboard(apr, cdr, taggingMap){

    let final = [];

    // 🔥 APR LOOP (skip header row)
    apr.slice(1).forEach(r=>{

        let emp = r[1];   // Agent Name
        let name = r[2];  // Full Name

        let login = toSeconds(r[3]);     // Total Login
        let breakTime = toSeconds(r[28]); // Total Break
        let meeting = toSeconds(r[20]);   // Meeting

        let net = login - breakTime;

        // 🔥 MATCH WITH CDR
        let empCDR = cdr.slice(1).filter(x=>x[1] == emp);

        let total = empCDR.length;
        let ib = empCDR.filter(x=>x[20] == "Inbound").length;
        let ob = empCDR.filter(x=>x[20] == "Outbound").length;

        let totalTalk = empCDR.reduce((s,x)=>s + toSeconds(x[13]),0);
        let aht = total ? totalTalk/total : 0;

        let tagging = taggingMap ? (taggingMap[emp] || 0) : null;

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
            aht,
            tagging
        });
    });

    sessionStorage.setItem("data", JSON.stringify({
        final,
        ivr: cdr.length - 1,
        crmEnabled: taggingMap ? true : false
    }));

    location = "dashboard.html";
}

// ================= DASHBOARD LOAD =================
document.addEventListener("DOMContentLoaded", ()=>{

    let d = JSON.parse(sessionStorage.getItem("data") || "{}");
    if(!d.final) return;

    let {final, ivr, crmEnabled} = d;

    final.sort((a,b)=>b.total - a.total);

    let max = Math.max(...final.map(x=>x.total));

    const tb = document.querySelector("#table tbody");
    const headerRow = document.getElementById("headerRow");
    const cards = document.getElementById("cards");

    // 🔥 CRM ENABLED → ADD COLUMN + CARD
    if(crmEnabled){

        let th = document.createElement("th");
        th.innerText = "Tagging";
        headerRow.appendChild(th);

        let card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `Total Tagging<br><span id="tagging"></span>`;
        cards.appendChild(card);
    }

    let totalCalls=0,totalIB=0,totalOB=0,totalTalk=0,totalTagging=0;

    final.forEach(r=>{

        totalCalls+=r.total;
        totalIB+=r.ib;
        totalOB+=r.ob;
        totalTalk+=(r.aht*r.total);

        if(crmEnabled){
            totalTagging += r.tagging || 0;
        }

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
        ${crmEnabled ? `<td>${r.tagging || 0}</td>` : ``}
        `;

        tb.appendChild(tr);
    });

    document.getElementById("ivr").innerText=ivr;
    document.getElementById("total").innerText=totalCalls;
    document.getElementById("ib").innerText=totalIB;
    document.getElementById("ob").innerText=totalOB;

    let overallAHT=totalCalls?totalTalk/totalCalls:0;
    document.getElementById("aht").innerText=toTime(overallAHT);

    if(crmEnabled){
        document.getElementById("tagging").innerText = totalTagging;
    }
});

// ================= SEARCH =================
function searchAgent(){
    let v=document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.style.display=r.innerText.toLowerCase().includes(v)?"":"none";
    });
}

// ================= PNG =================
function copyImage(){
    html2canvas(document.getElementById("table"),{scale:2}).then(c=>{
        c.toBlob(b=>{
            navigator.clipboard.write([new ClipboardItem({"image/png":b})]);
            alert("Copied!");
        });
    });
}

// ================= EXCEL =================
function exportExcel(){

    let d=JSON.parse(sessionStorage.getItem("data")||"{}");
    if(!d.final) return;

    let {final, crmEnabled} = d;

    let headers=[
        "Employee ID","Agent Full Name","Total Login","Net Login",
        "Total Break","Total Meeting","AHT",
        "Total Mature Call","IB Mature","OB Mature"
    ];

    if(crmEnabled) headers.push("Tagging");

    let ws_data=[headers];

    final.forEach(r=>{
        let row=[
            r.emp,r.name,
            toTime(r.login),toTime(r.net),
            toTime(r.breakTime),toTime(r.meeting),
            toTime(r.aht),
            r.total,r.ib,r.ob
        ];

        if(crmEnabled) row.push(r.tagging || 0);

        ws_data.push(row);
    });

    let ws=XLSX.utils.aoa_to_sheet(ws_data);
    let wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Dashboard");

    XLSX.writeFile(wb,"Agent_Report.xlsx");
}

// ================= RESET =================
function resetApp(){
    sessionStorage.clear();
    location="index.html";
}
