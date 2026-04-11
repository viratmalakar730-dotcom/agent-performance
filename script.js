// ================= 🔐 LOGIN =================
const supervisor = { id:"Supervisor", pass:"1962" };
const agent = { id:"1962", pass:"1962" };

function login(){

    let user = document.getElementById("user")?.value.trim();
    let pass = document.getElementById("pass")?.value.trim();

    if(user === supervisor.id && pass === supervisor.pass){
        sessionStorage.setItem("role","supervisor");
        location = "upload.html";
        return;
    }

    if(user === agent.id && pass === agent.pass){
        sessionStorage.setItem("role","agent");
        sessionStorage.setItem("loginTime", Date.now());
        location = "dashboard.html";
        return;
    }

    alert("Invalid ID or Password ❌");
}

// ================= 🔥 TIMER =================
let timerInterval;

function startAgentTimer(){

    if(timerInterval) clearInterval(timerInterval);

    let loginTime = sessionStorage.getItem("loginTime");
    if(!loginTime) return;

    timerInterval = setInterval(()=>{

        let diff = Math.floor((Date.now() - loginTime)/1000);
        let remaining = 300 - diff;

        if(remaining <= 0){
            alert("Session Expired ⏳");
            resetApp();
            return;
        }

        let m = Math.floor(remaining/60);
        let s = remaining % 60;

        let t = document.getElementById("agentTimer");
        if(t){
            t.innerText = `Session: ${m}:${String(s).padStart(2,'0')}`;
        }

    },1000);
}

// ================= TIME =================
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

// ================= REPORT TIME =================
function extractReportTime(aprRaw){
    let row = aprRaw[1]?.[0] || "";
    let match = row.match(/to\s([\d\-:\s]+)/i);
    if(!match) return "";

    let d = new Date(match[1].trim());

    let day = String(d.getDate()).padStart(2,'0');
    let month = d.toLocaleString('en-US',{month:'short'});
    let year = String(d.getFullYear()).slice(-2);
    let time = d.toLocaleTimeString('en-US',{hour12:true});

    return `${day}-${month}-${year} ${time}`;
}

// ================= READ EXCEL =================
function readExcel(file, skipRows){
    return new Promise(resolve=>{
        let reader = new FileReader();
        reader.onload = e=>{
            let wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
            let data = XLSX.utils.sheet_to_json(
                wb.Sheets[wb.SheetNames[0]],
                {header:1}
            );
            resolve(data.slice(skipRows));
        };
        reader.readAsArrayBuffer(file);
    });
}

// ================= PROCESS FILES =================
async function processFiles(){

    let aprFile = document.getElementById("aprFile").files[0];
    let cdrFile = document.getElementById("cdrFile").files[0];

    if(!aprFile || !cdrFile){
        alert("Please upload both files ❌");
        return;
    }

    document.getElementById("loading").style.display = "block";

    let aprRaw = await readExcel(aprFile,0);
    let reportTime = extractReportTime(aprRaw);

    let apr = aprRaw.slice(3);
    let cdr = await readExcel(cdrFile,2);

    let final = [];
    let ivr = 0;

    // IVR HIT
    cdr.forEach(c=>{
        if((c[7]||"").toUpperCase().includes("INBOUND")) ivr++;
    });

    // MAIN CALCULATION
    apr.forEach(r=>{

        if(!r[1]) return;

        let emp = (r[1]||"").toString().trim();
        let name = r[2];

        let login = toSeconds(r[3]);

        let breakTime =
            toSeconds(r[19]) +
            toSeconds(r[22]) +
            toSeconds(r[24]);

        let meeting =
            toSeconds(r[20]) +
            toSeconds(r[23]);

        let net = Math.max(0, login - breakTime);

        let calls = cdr.filter(c=>{
            let empCDR = (c[1]||"").toString().trim();
            let disp = (c[25]||"").toLowerCase();

            return empCDR === emp &&
                (disp.includes("callmatured") || disp.includes("transfer"));
        });

        let total = calls.length;

        let ib = calls.filter(c =>
            (c[7]||"").toUpperCase().includes("INBOUND")
        ).length;

        let ob = total - ib;

        let aht = total ? Math.round(toSeconds(r[5]) / total) : 0;

        final.push({
            emp, name, login, net,
            breakTime, meeting,
            aht, total, ib, ob
        });
    });

    sessionStorage.setItem("data", JSON.stringify({
        final,
        ivr,
        reportTime
    }));

    location = "dashboard.html";
}

// ================= LOAD DASHBOARD =================
document.addEventListener("DOMContentLoaded", ()=>{

    let d = JSON.parse(sessionStorage.getItem("data") || "{}");
    if(!d.final) return;

    document.getElementById("reportTime").innerText = d.reportTime || "";

    let {final, ivr} = d;

    final.sort((a,b)=>b.total - a.total);

    let max = Math.max(...final.map(x=>x.total));
    let tb = document.querySelector("#table tbody");

    let totalCalls=0,totalIB=0,totalOB=0,totalTalk=0;

    final.forEach(r=>{

        totalCalls += r.total;
        totalIB += r.ib;
        totalOB += r.ob;
        totalTalk += (r.aht * r.total);

        let tr = document.createElement("tr");

        tr.innerHTML = `
        <td><b><i>${r.emp}</i></b></td>
        <td><b><i>${r.name}</i></b></td>
        <td>${toTime(r.login)}</td>
        <td class="${r.net>=28800?"netGreen":""}">${toTime(r.net)}</td>
        <td class="${r.breakTime>2100?"breakRed":""}">${toTime(r.breakTime)}</td>
        <td class="${r.meeting>2100?"meetingRed":""}">${toTime(r.meeting)}</td>
        <td>${toTime(r.aht)}</td>
        <td class="${getGradientClass(r.total,max)}">${r.total}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>
        `;

        tb.appendChild(tr);
    });

    document.getElementById("ivr").innerText = ivr;
    document.getElementById("total").innerText = totalCalls;
    document.getElementById("ib").innerText = totalIB;
    document.getElementById("ob").innerText = totalOB;

    let overallAHT = totalCalls ? totalTalk / totalCalls : 0;
    document.getElementById("aht").innerText = toTime(overallAHT);

    // 🔥 TIMER ONLY FOR AGENT
    if(sessionStorage.getItem("role")==="agent"){
        startAgentTimer();
    }
});

// ================= SEARCH =================
function searchAgent(){
    let v = document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.style.display = r.innerText.toLowerCase().includes(v) ? "" : "none";
    });
}

// ================= PNG =================
function copyImage(){
    html2canvas(document.getElementById("captureArea"),{
        scale:3,
        backgroundColor:"#ffffff"
    }).then(canvas=>{
        canvas.toBlob(blob=>{
            navigator.clipboard.write([
                new ClipboardItem({"image/png":blob})
            ]);
            alert("✅ Clean PNG Copied");
        });
    });
}

// ================= EXCEL =================
function exportExcel(){

    let d = JSON.parse(sessionStorage.getItem("data")||"{}");
    if(!d.final) return;

    let data = d.final;

    let ws_data = [["Employee ID","Agent Full Name","Total Login","Net Login","Total Break","Total Meeting","AHT","Total Mature Call","IB Mature","OB Mature"]];

    data.forEach(r=>{
        ws_data.push([
            r.emp,r.name,
            toTime(r.login),toTime(r.net),
            toTime(r.breakTime),toTime(r.meeting),
            toTime(r.aht),r.total,r.ib,r.ob
        ]);
    });

    let ws = XLSX.utils.aoa_to_sheet(ws_data);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard");

    XLSX.writeFile(wb, "Agent_Report.xlsx");
}

// ================= RESET =================
function resetApp(){
    sessionStorage.clear();
    location = "index.html";
}
