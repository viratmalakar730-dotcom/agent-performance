// ================= LOGIN =================

const supervisor = { id:"Supervisor", pass:"Bfil@123" };
const agent = { id:"1962", pass:"1962" };

function login(){

    let role = document.getElementById("role").value;
    let user = document.getElementById("user").value;
    let pass = document.getElementById("pass").value;

    if(role === "supervisor"){
        if(user === supervisor.id && pass === supervisor.pass){
            sessionStorage.setItem("role","supervisor");
            location = "index.html";
        } else alert("Invalid Supervisor ❌");
    }

    else{
        if(user === agent.id && pass === agent.pass){
            sessionStorage.setItem("role","agent");
            sessionStorage.setItem("loginTime", Date.now());
            location = "dashboard.html";
        } else alert("Invalid Agent ❌");
    }
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

// ================= TIMER =================

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

// ================= REPORT TIME =================

function extractReportTime(aprRaw){
    let row = aprRaw[1]?.[0] || "";
    let match = row.match(/to\s([\d\-:\s]+)/i);
    if(!match) return "";

    let d = new Date(match[1].trim());
    return d.toLocaleString();
}

// ================= PROCESS FILES =================

async function processFiles(){

    let aprFile = document.getElementById("aprFile").files[0];
    let cdrFile = document.getElementById("cdrFile").files[0];

    if(!aprFile || !cdrFile){
        alert("Upload both files ❌");
        return;
    }

    let aprRaw = await readExcel(aprFile,0);
    let reportTime = extractReportTime(aprRaw);

    let apr = aprRaw.slice(3);
    let cdr = await readExcel(cdrFile,2);

    let final = [];
    let ivr = 0;

    // IVR HIT
    cdr.forEach(c=>{
        if((c[7]||"").toString().toUpperCase().includes("INBOUND")) ivr++;
    });

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

        let net = login - breakTime;

        let calls = cdr.filter(c=>{
            let empCDR = (c[1]||"").toString().trim();
            let disp = (c[25]||"").toLowerCase();

            return empCDR === emp &&
                (disp.includes("callmatured") || disp.includes("transfer"));
        });

        let total = calls.length;

        let ib = calls.filter(c =>
            (c[7]||"").toString().toUpperCase().includes("INBOUND")
        ).length;

        let ob = total - ib;

        let aht = total ? Math.round(toSeconds(r[5]) / total) : 0;

        final.push({
            emp, name, login, net,
            breakTime, meeting,
            aht, total, ib, ob
        });
    });

    localStorage.setItem("dashboard", JSON.stringify({
        final, ivr, reportTime
    }));

    location = "dashboard.html";
}

// ================= LOAD DASHBOARD =================

document.addEventListener("DOMContentLoaded", ()=>{

    let d = JSON.parse(localStorage.getItem("dashboard") || "{}");
    if(!d.final) return;

    document.getElementById("reportTime").innerText = d.reportTime;

    let tb = document.querySelector("#table tbody");

    let totalCalls=0,totalIB=0,totalOB=0,totalTalk=0;

    let max = Math.max(...d.final.map(x=>x.total));

    d.final.forEach(r=>{

        totalCalls+=r.total;
        totalIB+=r.ib;
        totalOB+=r.ob;
        totalTalk+=(r.aht*r.total);

        let cls =
            r.total>=max*0.75 ? "green" :
            r.total>=max*0.45 ? "yellow" :
            "red";

        let netCls = r.net >= 28800 ? "netGreen" : "";
        let breakCls = r.breakTime > 2100 ? "breakRed" : "";
        let meetingCls = r.meeting > 2100 ? "meetingRed" : "";

        let tr = document.createElement("tr");

        tr.innerHTML = `
        <td><b><i>${r.emp}</i></b></td>
        <td><b><i>${r.name}</i></b></td>
        <td>${toTime(r.login)}</td>
        <td class="${netCls}">${toTime(r.net)}</td>
        <td class="${breakCls}">${toTime(r.breakTime)}</td>
        <td class="${meetingCls}">${toTime(r.meeting)}</td>
        <td>${toTime(r.aht)}</td>
        <td class="${cls}">${r.total}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>
        `;

        tb.appendChild(tr);
    });

    document.getElementById("ivr").innerText=d.ivr;
    document.getElementById("total").innerText=totalCalls;
    document.getElementById("ib").innerText=totalIB;
    document.getElementById("ob").innerText=totalOB;
    document.getElementById("aht").innerText=toTime(totalTalk/totalCalls||0);

    if(sessionStorage.getItem("role")==="agent"){
        startAgentTimer();
    }
});

// ================= RESET =================

function resetApp(){
    sessionStorage.clear();
    location="index.html";
}
