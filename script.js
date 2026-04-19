console.log("🔥 FINAL PRO SYSTEM");

// ================= TIME =================
function timeToSeconds(t){
    if(!t || t === "-") return 0;
    if(typeof t === "number") return Math.floor(t*86400);
    let p = t.toString().split(":");
    return (+p[0]*3600)+(+p[1]*60)+(+p[2]||0);
}

function secondsToTime(sec){
    sec = Math.max(0, Math.floor(sec));
    let h = String(Math.floor(sec/3600)).padStart(2,'0');
    let m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
    let s = String(sec%60).padStart(2,'0');
    return `${h}:${m}:${s}`;
}

// ================= PROCESS =================
function processFiles(){

    let aprFile = document.getElementById("aprFile")?.files[0];
    let cdrFile = document.getElementById("cdrFile")?.files[0];

    if(!aprFile || !cdrFile){
        alert("Upload both files");
        return;
    }

    document.getElementById("loading").style.display="block";

    readAPR(aprFile,(apr)=>{
        readCDR(cdrFile,(cdr)=>{

            let final = buildDashboard(apr,cdr);

            let payload = {
                final,
                reportTime: window.reportDate || ""
            };

            firebase.database().ref("dashboard").set(payload);

            window.location.href="dashboard.html";
        });
    });
}

// ================= APR =================
function readAPR(file,cb){

    let r = new FileReader();

    r.onload = e=>{
        let wb = XLSX.read(new Uint8Array(e.target.result),{type:"array"});
        let raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});

        let row2 = raw[1]?.[0] || "";
        if(row2.toLowerCase().includes("to")){
            window.reportDate = row2.split("to")[1].trim();
        }

        let data = raw.slice(2);
        let headers = data[0];

        let json = data.slice(1).map(r=>{
            let obj={};
            headers.forEach((h,i)=>obj[h]=r[i]);
            return obj;
        });

        cb(json);
    };

    r.readAsArrayBuffer(file);
}

// ================= CDR =================
function readCDR(file,cb){

    let r = new FileReader();

    r.onload = e=>{
        let wb = XLSX.read(new Uint8Array(e.target.result),{type:"array"});
        let raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});

        let data = raw.slice(1);
        let headers = data[0];

        let json = data.slice(1).map(r=>{
            let obj={};
            headers.forEach((h,i)=>obj[h]=r[i]);
            return obj;
        });

        cb(json);
    };

    r.readAsArrayBuffer(file);
}

// ================= CORE =================
function buildDashboard(apr,cdr){

    let result=[];

    apr.forEach(a=>{

        let emp=(a["Agent Name"]||"").trim();
        let name=a["Agent Full Name"]||"";

        let login=timeToSeconds(a["Total Login Time"]);

        if(login > (8*3600 + 15*60)){
            login = 8*3600;
        }

        let breakTime =
            timeToSeconds(a["LUNCHBREAK"]) +
            timeToSeconds(a["TEABREAK"]) +
            timeToSeconds(a["SHORTBREAK"]);

        let net=login-breakTime;

        let agentCDR=cdr.filter(r=>(r["Username"]||"").trim()===emp);

        let total=agentCDR.filter(r=>{
            let d=(r["Disposition"]||"").toUpperCase();
            return d.includes("CALLMATURED")||d.includes("TRANSFER");
        }).length;

        let ib=agentCDR.filter(r=>{
            let d=(r["Disposition"]||"").toUpperCase();
            let c=(r["Campaign"]||"").toUpperCase();
            return (d.includes("CALLMATURED")||d.includes("TRANSFER")) && c.includes("CSRINBOUND");
        }).length;

        let ob=total-ib;

        let talk=agentCDR.reduce((s,r)=>s+timeToSeconds(r["Talk Duration"]),0);
        let aht= total? talk/total : 0;

        result.push({
            emp,name,
            login:secondsToTime(login),
            netLogin:secondsToTime(net),
            break:secondsToTime(breakTime),
            meeting:a["MEETING"]||"00:00:00",
            aht:secondsToTime(aht),
            calls:total,
            ib,ob
        });

    });

    return result;
}

// ================= LOAD =================
function loadDashboard(data){

    let tbody=document.querySelector("#table tbody");
    tbody.innerHTML="";

    data.final.forEach(r=>{

        let net=timeToSeconds(r.netLogin);
        let brk=timeToSeconds(r.break);
        let meet=timeToSeconds(r.meeting);

        let netCls = net>8*3600?"green3d":"red3d";
        let breakCls = brk>2100?"red3d":"";
        let meetCls = meet>2100?"red3d":"";

        let callCls="";
        if(r.calls>=100) callCls="green3d";
        else if(r.calls>=70) callCls="yellow3d";
        else callCls="red3d";

        let tr=document.createElement("tr");

        tr.innerHTML=`
        <td>${r.emp}</td>
        <td>${r.name}</td>
        <td>${r.login}</td>
        <td class="${netCls}">${r.netLogin}</td>
        <td class="${breakCls}">${r.break}</td>
        <td class="${meetCls}">${r.meeting}</td>
        <td>${r.aht}</td>
        <td class="${callCls}">${r.calls}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>
        `;

        tbody.appendChild(tr);
    });

    document.getElementById("reportTime").innerText =
    "Last Update Till: " + (data.reportTime||"");
}

// ================= COPY =================
function downloadPNG(){
    html2canvas(document.getElementById("table"),{scale:3}).then(canvas=>{
        canvas.toBlob(blob=>{
            navigator.clipboard.write([new ClipboardItem({"image/png": blob})]);
            alert("Copied ✅");
        });
    });
}

// ================= RESET =================
function resetDashboard(){
    firebase.database().ref("dashboard").remove();
    location.href="index.html";
}

// ================= LIVE =================
document.addEventListener("DOMContentLoaded",()=>{
    firebase.database().ref("dashboard").on("value",snap=>{
        let d=snap.val();
        if(d) loadDashboard(d);
    });
});
