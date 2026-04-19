console.log("🔥 ULTIMATE DASHBOARD");

// ================= FIREBASE =================
let db;

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

  let aprFile=document.getElementById("aprFile").files[0];
  let cdrFile=document.getElementById("cdrFile").files[0];

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
        reportTime:new Date().toLocaleString()
      };

      db.ref("dashboard").set(payload);

      document.getElementById("loading").style.display="none";

      window.location.href="dashboard.html";
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

    let trimmed=raw.slice(2); // remove top 2 rows

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

    let emp=a["Agent Name"] || "NA";
    let name=a["Agent Full Name"] || "Unknown";

    let login=timeToSeconds(a["Total Login Time"]);
    let lunch=timeToSeconds(a["LUNCHBREAK"]);
    let tea=timeToSeconds(a["TEABREAK"]);
    let short=timeToSeconds(a["SHORTBREAK"]);
    let meeting=timeToSeconds(a["MEETING"]);

    let totalBreak=lunch+tea+short;
    let netLogin=login-totalBreak;

    let agentCDR=cdr.filter(r=>
      (r["User Full Name"]||"")===name &&
      r["Call Status"]==="Answered"
    );

    let calls=agentCDR.length;

    let totalTalk=agentCDR.reduce((s,r)=>
      s+timeToSeconds(r["Talk Duration"]),0);

    let aht=calls?totalTalk/calls:0;

    let ib=agentCDR.filter(r=>r["Call Type"]==="IB").length;
    let ob=agentCDR.filter(r=>r["Call Type"]==="OB").length;

    result.push({
      emp,name,
      login:secondsToTime(login),
      netLogin:secondsToTime(netLogin),
      break:secondsToTime(totalBreak),
      meeting:secondsToTime(meeting),
      aht:secondsToTime(aht),
      calls,ib,ob
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

    tr.innerHTML=`
    <td>${r.emp}</td>
    <td>${r.name}</td>
    <td>${r.login}</td>
    <td>${r.netLogin}</td>
    <td>${r.break}</td>
    <td>${r.meeting}</td>
    <td>${r.aht}</td>
    <td>${r.calls}</td>
    <td>${r.ib}</td>
    <td>${r.ob}</td>
    `;

    tbody.appendChild(tr);
  });

  loadCards(data.final);

  document.getElementById("reportTime").innerText=
    "Last Update Till: "+data.reportTime;
}

// ================= CARDS =================
function loadCards(data){

  let totalCalls=0;

  data.forEach(r=> totalCalls+=r.calls);

  document.getElementById("cards").innerHTML=`
    <div class="card">👥 Agents<br>${data.length}</div>
    <div class="card">📞 Calls<br>${totalCalls}</div>
  `;
}

// ================= EXPORT =================
function exportExcel(){
  let table=document.getElementById("table");
  let wb=XLSX.utils.table_to_book(table,{sheet:"Report"});
  XLSX.writeFile(wb,"Agent_Report.xlsx");
}

// ================= PNG =================
function downloadPNG(){
  html2canvas(document.getElementById("table"),{scale:2})
  .then(canvas=>{
    let link=document.createElement("a");
    link.download="dashboard.png";
    link.href=canvas.toDataURL();
    link.click();
  });
}

// ================= RESET =================
function resetDashboard(){
  if(confirm("Reset?")){
    db.ref("dashboard").remove();
    document.querySelector("#table tbody").innerHTML="";
    document.getElementById("cards").innerHTML="";
    document.getElementById("reportTime").innerText="";
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
