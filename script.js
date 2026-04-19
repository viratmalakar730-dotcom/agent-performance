console.log("🔥 FINAL CALCULATION ENGINE");

// ================= FIREBASE =================
let db = null;

const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "agent-performance-live.firebaseapp.com",
  databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
  projectId: "agent-performance-live"
};

if (typeof firebase !== "undefined") {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
}

// ================= TIME =================
function timeToSeconds(t){
    if(!t || t === "-") return 0;
    if(typeof t === "number") return Math.floor(t*86400);
    let p=t.toString().split(":");
    return (+p[0]*3600)+(+p[1]*60)+(+p[2]||0);
}

function secondsToTime(sec){
    sec=Math.max(0,sec);
    let h=String(Math.floor(sec/3600)).padStart(2,'0');
    let m=String(Math.floor((sec%3600)/60)).padStart(2,'0');
    let s=String(sec%60).padStart(2,'0');
    return `${h}:${m}:${s}`;
}

// ================= PROCESS =================
function processFiles(){

    let aprFile=document.getElementById("aprFile")?.files[0];
    let cdrFile=document.getElementById("cdrFile")?.files[0];

    if(!aprFile || !cdrFile){
        alert("APR + CDR upload karo");
        return;
    }

    document.getElementById("loading").style.display="block";

    readAPR(aprFile,(apr)=>{
        readCDR(cdrFile,(cdr)=>{

            let final=buildDashboard(apr,cdr);

            let payload={
                final,
                reportTime: window.reportDate || ""
            };

            if(db) db.ref("dashboard").set(payload);

            document.getElementById("loading").style.display="none";

            window.location.href="live.html";
        });
    });
}

// ================= APR =================
function readAPR(file,cb){

    let r=new FileReader();

    r.onload=e=>{
        let data=new Uint8Array(e.target.result);
        let wb=XLSX.read(data,{type:"array"});
        let sheet=wb.Sheets[wb.SheetNames[0]];
        let raw=XLSX.utils.sheet_to_json(sheet,{header:1});

        // 🔥 DATE EXTRACT (2nd row)
        let row2 = raw[1]?.[0] || "";
        if(row2.toLowerCase().includes("to")){
            window.reportDate = row2.split("to")[1].trim();
        }

        let trimmed=raw.slice(2);

        let headers=trimmed[0];
        let rows=trimmed.slice(1);

        let json=rows.map(row=>{
            let obj={};
            headers.forEach((h,i)=>obj[h]=row[i]);
            return obj;
        });

        cb(json);
    };

    r.readAsArrayBuffer(file);
}

// ================= CDR =================
function readCDR(file,cb){

    let r=new FileReader();

    r.onload=e=>{
        let data=new Uint8Array(e.target.result);
        let wb=XLSX.read(data,{type:"array"});
        let sheet=wb.Sheets[wb.SheetNames[0]];
        let raw=XLSX.utils.sheet_to_json(sheet,{header:1});

        let trimmed=raw.slice(1);

        let headers=trimmed[0];
        let rows=trimmed.slice(1);

        let json=rows.map(row=>{
            let obj={};
            headers.forEach((h,i)=>obj[h]=row[i]);
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

        let emp=(a["Agent Name"]||"").toString().trim();
        let name=a["Agent Full Name"]||"Unknown";

        let login=timeToSeconds(a["Total Login Time"]);
        let lunch=timeToSeconds(a["LUNCHBREAK"]);
        let tea=timeToSeconds(a["TEABREAK"]);
        let short=timeToSeconds(a["SHORTBREAK"]);

        let totalBreak=lunch+tea+short;
        let netLogin=login-totalBreak;

        // 🔥 EMP ID MATCH
        let agentCDR=cdr.filter(r=>{
            let cEmp=(r["Username"]||"").toString().trim();
            return cEmp===emp;
        });

        // 🔥 TOTAL MATURE
        let totalMature = agentCDR.reduce((sum,r)=>{
            return sum + (Number(r["CALLMATURED"]||0) + Number(r["TRANSFER"]||0));
        },0);

        // 🔥 IB MATURE
        let ibMature = agentCDR.reduce((sum,r)=>{

            let type=(r["Call Type"]||"").toUpperCase();
            let val=(Number(r["CALLMATURED"]||0)+Number(r["TRANSFER"]||0));

            if(type.includes("CSRINBOUND")){
                return sum + val;
            }

            return sum;

        },0);

        // 🔥 OB MATURE
        let obMature = totalMature - ibMature;

        // 🔥 TALK TIME
        let totalTalk = agentCDR.reduce((s,r)=>
            s + timeToSeconds(r["Talk Duration"]),0);

        // 🔥 AHT
        let aht = totalMature ? totalTalk / totalMature : 0;

        result.push({
            emp,name,
            login:secondsToTime(login),
            netLogin:secondsToTime(netLogin),
            break:secondsToTime(totalBreak),
            meeting:a["MEETING"]||"00:00:00",

            aht:secondsToTime(aht),
            calls:totalMature,
            ib:ibMature,
            ob:obMature
        });

    });

    return result;
}

// ================= LOAD =================
function loadDashboard(data){

    let tbody=document.querySelector("#table tbody");
    tbody.innerHTML="";

    data.final.forEach(r=>{

        let tr=document.createElement("tr");

        let sec=timeToSeconds(r.netLogin);
        let cls=sec>7*3600?"green":sec>5*3600?"yellow":"red";

        tr.innerHTML=`
        <td>${r.emp}</td>
        <td>${r.name}</td>
        <td>${r.login}</td>
        <td class="${cls}">${r.netLogin}</td>
        <td>${r.break}</td>
        <td>${r.meeting}</td>
        <td>${r.aht}</td>
        <td>${r.calls}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>
        `;

        tbody.appendChild(tr);
    });

    document.getElementById("reportTime").innerText=
    "Last Update Till: "+(data.reportTime || "");
}

// ================= BUTTONS =================
function exportExcel(){
    let wb=XLSX.utils.table_to_book(document.getElementById("table"));
    XLSX.writeFile(wb,"Report.xlsx");
}

function downloadPNG(){
    html2canvas(document.getElementById("table")).then(canvas=>{
        let a=document.createElement("a");
        a.href=canvas.toDataURL();
        a.download="dashboard.png";
        a.click();
    });
}

function resetDashboard(){
    if(confirm("Reset?")){
        if(db) db.ref("dashboard").remove();
        window.location.href="index.html";
    }
}

// ================= LIVE =================
document.addEventListener("DOMContentLoaded",()=>{
    if(db){
        db.ref("dashboard").on("value",(snap)=>{
            let d=snap.val();
            if(d) loadDashboard(d);
        });
    }
});
