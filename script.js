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
        let apr = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]]);

        reader2.onload = function(e2){
            let wb2 = XLSX.read(e2.target.result, {type:'binary'});
            let cdr = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]);

            // ===== CRM DATA =====
            if(crmEnabled && crmFile){

                let reader3 = new FileReader();

                reader3.onload = function(e3){
                    let wb3 = XLSX.read(e3.target.result, {type:'binary'});
                    let crm = XLSX.utils.sheet_to_json(wb3.Sheets[wb3.SheetNames[0]]);

                    let taggingMap = {};

                    crm.forEach(r=>{
                        let emp = r["CreatedByID"]; // Column AK
                        if(emp){
                            taggingMap[emp] = (taggingMap[emp] || 0) + 1;
                        }
                    });

                    generateDashboard(apr, cdr, taggingMap);
                };

                reader3.readAsBinaryString(crmFile);

            } else {
                generateDashboard(apr, cdr, {});
            }
        };

        reader2.readAsBinaryString(cdrFile);
    };

    reader1.readAsBinaryString(aprFile);
}

// ================= GENERATE DASHBOARD =================
function generateDashboard(apr, cdr, taggingMap){

    let final = [];

    apr.forEach(r=>{

        let emp = r["Agent Name"];
        let name = r["Agent Full Name"];

        let login = toSeconds(r["Total Login Time"]);
        let breakTime = toSeconds(r["Total Break Duration"]);
        let meeting = toSeconds(r["MEETING"]);

        let net = login - breakTime;

        let empCDR = cdr.filter(x=>x.Username == emp);

        let total = empCDR.length;
        let ib = empCDR.filter(x=>x["Call Type"]=="Inbound").length;
        let ob = empCDR.filter(x=>x["Call Type"]=="Outbound").length;

        let totalTalk = empCDR.reduce((s,x)=>s + toSeconds(x["Talk Duration"]),0);
        let aht = total ? totalTalk/total : 0;

        let tagging = taggingMap[emp] || 0;

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

    let ivr = cdr.length;

    sessionStorage.setItem("data", JSON.stringify({final, ivr}));

    location = "dashboard.html";
}

// ================= DASHBOARD LOAD =================
document.addEventListener("DOMContentLoaded", ()=>{

    let d = JSON.parse(sessionStorage.getItem("data") || "{}");
    if(!d.final) return;

    let {final, ivr} = d;

    final.sort((a,b)=>b.total - a.total);

    let max = Math.max(...final.map(x=>x.total));

    const tb = document.querySelector("#table tbody");

    let totalCalls=0,totalIB=0,totalOB=0,totalTalk=0,totalTagging=0;

    final.forEach(r=>{

        totalCalls+=r.total;
        totalIB+=r.ib;
        totalOB+=r.ob;
        totalTalk+=(r.aht*r.total);
        totalTagging+=(r.tagging || 0);

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
        <td>${r.tagging || 0}</td>
        `;

        tb.appendChild(tr);
    });

    document.getElementById("ivr").innerText=ivr;
    document.getElementById("total").innerText=totalCalls;
    document.getElementById("ib").innerText=totalIB;
    document.getElementById("ob").innerText=totalOB;

    let overallAHT=totalCalls?totalTalk/totalCalls:0;
    document.getElementById("aht").innerText=toTime(overallAHT);

    // 🔥 NEW TAGGING CARD
    let tagEl = document.getElementById("tagging");
    if(tagEl) tagEl.innerText = totalTagging;
});

// ================= SEARCH =================
function searchAgent(){
    let v=document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.style.display=r.innerText.toLowerCase().includes(v)?"":"none";
    });
}

// ================= PNG COPY =================
function copyImage(){
    html2canvas(document.getElementById("table"),{scale:2}).then(c=>{
        c.toBlob(b=>{
            navigator.clipboard.write([new ClipboardItem({"image/png":b})]);
            alert("Copied!");
        });
    });
}

// ================= EXCEL EXPORT =================
function exportExcel(){

    let d=JSON.parse(sessionStorage.getItem("data")||"{}");
    if(!d.final) return;

    let data=d.final;

    let ws_data=[[
        "Employee ID","Agent Full Name","Total Login","Net Login",
        "Total Break","Total Meeting","AHT",
        "Total Mature Call","IB Mature","OB Mature","Tagging"
    ]];

    data.forEach(r=>{
        ws_data.push([
            r.emp,r.name,
            toTime(r.login),toTime(r.net),
            toTime(r.breakTime),toTime(r.meeting),
            toTime(r.aht),
            r.total,r.ib,r.ob,
            r.tagging || 0
        ]);
    });

    let ws=XLSX.utils.aoa_to_sheet(ws_data);
    let wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Dashboard");

    let now=new Date();
    let name=`Agent_Report_${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}_${now.getHours()}-${now.getMinutes()}.xlsx`;

    XLSX.writeFile(wb,name);
}

// ================= RESET =================
function resetApp(){
    sessionStorage.clear();
    location="index.html";
}
