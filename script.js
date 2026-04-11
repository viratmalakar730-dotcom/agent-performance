// ================= LOGIN =================
function login(){

    let user = document.getElementById("user").value.trim().toLowerCase();
    let pass = document.getElementById("pass").value.trim();

    if(user === "supervisor" && pass === "1962"){
        sessionStorage.setItem("role","supervisor");
        location = "index.html";
        return;
    }

    if(pass === "1962"){
        sessionStorage.setItem("role","agent");
        sessionStorage.setItem("loginTime", Date.now());
        location = "dashboard.html";
        return;
    }

    alert("Invalid ID or Password ❌");
}

// ================= TIMER =================
function startAgentTimer(){
    setInterval(()=>{
        let loginTime = sessionStorage.getItem("loginTime");
        if(!loginTime) return;

        let diff = Math.floor((Date.now() - loginTime)/1000);
        let remain = 300 - diff;

        if(remain <= 0){
            alert("Session Expired");
            resetApp();
        }

        let m = Math.floor(remain/60);
        let s = remain%60;

        let t = document.getElementById("agentTimer");
        if(t) t.innerText = `Session: ${m}:${String(s).padStart(2,'0')}`;

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

// ================= PROCESS =================
async function processFiles(){

    let aprFile = document.getElementById("aprFile").files[0];
    let cdrFile = document.getElementById("cdrFile").files[0];

    if(!aprFile || !cdrFile){
        alert("Upload both files");
        return;
    }

    document.getElementById("loading").style.display="block";

    let apr = await readExcel(aprFile,3);
    let cdr = await readExcel(cdrFile,2);

    let final=[];
    let ivr=0;

    cdr.forEach(c=>{
        if((c[7]||"").toUpperCase().includes("INBOUND")) ivr++;
    });

    apr.forEach(r=>{
        if(!r[1]) return;

        let emp=r[1].toString().trim();
        let name=r[2];

        let login=toSeconds(r[3]);

        let breakTime=
        toSeconds(r[19])+toSeconds(r[22])+toSeconds(r[24]);

        let meeting=
        toSeconds(r[20])+toSeconds(r[23]);

        let net=login-breakTime;

        let calls=cdr.filter(c=>{
            return (c[1]||"").toString().trim()===emp &&
            ((c[25]||"").toLowerCase().includes("callmatured") ||
             (c[25]||"").toLowerCase().includes("transfer"));
        });

        let total=calls.length;

        let ib=calls.filter(c=>
            (c[7]||"").toUpperCase().includes("INBOUND")
        ).length;

        let ob=total-ib;

        let aht=total?Math.round(toSeconds(r[5])/total):0;

        final.push({emp,name,login,net,breakTime,meeting,aht,total,ib,ob});
    });

    sessionStorage.setItem("data",JSON.stringify({final,ivr}));

    location="dashboard.html";
}

// ================= READ =================
function readExcel(file,skip){
    return new Promise(res=>{
        let r=new FileReader();
        r.onload=e=>{
            let wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
            let d=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
            res(d.slice(skip));
        };
        r.readAsArrayBuffer(file);
    });
}

// ================= LOAD =================
document.addEventListener("DOMContentLoaded",()=>{

    let d=JSON.parse(sessionStorage.getItem("data")||"{}");
    if(!d.final) return;

    let {final,ivr}=d;

    let tb=document.querySelector("#table tbody");

    let totalCalls=0,totalIB=0,totalOB=0,totalTalk=0;

    final.sort((a,b)=>b.total-a.total);

    final.forEach(r=>{

        totalCalls+=r.total;
        totalIB+=r.ib;
        totalOB+=r.ob;
        totalTalk+=(r.aht*r.total);

        let tr=document.createElement("tr");

        tr.innerHTML=`
        <td><b><i>${r.emp}</i></b></td>
        <td><b><i>${r.name}</i></b></td>
        <td>${toTime(r.login)}</td>
        <td class="${r.net>=28800?'netGreen':''}">${toTime(r.net)}</td>
        <td class="${r.breakTime>2100?'breakRed':''}">${toTime(r.breakTime)}</td>
        <td class="${r.meeting>2100?'meetingRed':''}">${toTime(r.meeting)}</td>
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

    let overall=totalCalls?totalTalk/totalCalls:0;
    document.getElementById("aht").innerText=toTime(overall);

    if(sessionStorage.getItem("role")==="agent"){
        startAgentTimer();
    }
});

// ================= OTHER =================
function searchAgent(){
    let v=document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.style.display=r.innerText.toLowerCase().includes(v)?"":"none";
    });
}

function copyImage(){
    html2canvas(document.getElementById("captureArea")).then(c=>{
        c.toBlob(b=>{
            navigator.clipboard.write([new ClipboardItem({"image/png":b})]);
            alert("Copied!");
        });
    });
}

function exportExcel(){
    let d=JSON.parse(sessionStorage.getItem("data")||"{}");
    if(!d.final) return;

    let ws=XLSX.utils.json_to_sheet(d.final);
    let wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Report");
    XLSX.writeFile(wb,"Report.xlsx");
}

function resetApp(){
    sessionStorage.clear();
    location="login.html";
}
