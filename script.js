// ===============================
// 🔥 SAFE FIREBASE
// ===============================
let db=null;
try{
const firebaseConfig={
apiKey:"AIzaSyCzPyZwPnSST3lv1pnSibq3dQjVIg2o-xs",
authDomain:"agent-performance-live.firebaseapp.com",
databaseURL:"https://agent-performance-live-default-rtdb.firebaseio.com/",
projectId:"agent-performance-live"
};
if(typeof firebase!=="undefined"){
if(!firebase.apps.length){firebase.initializeApp(firebaseConfig);}
db=firebase.database();
}
}catch(e){}

// ===============================
// 🔥 TIME
// ===============================
function toSeconds(t){
if(!t) return 0;
let a=t.toString().split(":").map(Number);
return (a[0]||0)*3600+(a[1]||0)*60+(a[2]||0);
}

function toTime(sec){
sec=Math.max(0,Math.round(sec));
let h=Math.floor(sec/3600);
let m=Math.floor((sec%3600)/60);
let s=sec%60;
return [h,m,s].map(v=>String(v).padStart(2,'0')).join(":");
}

// ===============================
// 🔥 CALL COLOR
// ===============================
function getCallClass(val,max){
if(max===0) return "";
let r=val/max;
if(r>=0.75) return "green3D";
if(r>=0.4) return "yellow3D";
return "red3D";
}

// ===============================
// 🔥 PROCESS FILES
// ===============================
function processFiles(){

let aprFile=document.getElementById("aprFile").files[0];
let cdrFile=document.getElementById("cdrFile").files[0];

if(!aprFile||!cdrFile){alert("Upload both files");return;}

document.getElementById("loading").style.display="block";

let r1=new FileReader();
let r2=new FileReader();

r1.onload=function(e){

let apr=XLSX.read(e.target.result,{type:'binary'});
let aprData=XLSX.utils.sheet_to_json(apr.Sheets[apr.SheetNames[0]],{header:1});

r2.onload=function(e2){

let cdr=XLSX.read(e2.target.result,{type:'binary'});
let cdrData=XLSX.utils.sheet_to_json(cdr.Sheets[cdr.SheetNames[0]],{header:1});

let reportRow=aprData[1]?.[0]||"";
let reportTime=reportRow.split("to")[1]?.trim()||"";

aprData.splice(0,3);
cdrData.splice(0,2);

let map={},ivr=0;

aprData.forEach(r=>{
let emp=r[1]; if(!emp) return;

let login=toSeconds(r[3]);
let breakTime=toSeconds(r[19])+toSeconds(r[22])+toSeconds(r[24]);
let meeting=toSeconds(r[20])+toSeconds(r[23]);

map[emp]={
emp,name:r[2],login,
breakTime,meeting,
net:login-breakTime,
ahtRaw:toSeconds(r[5]),
total:0,ib:0
};
});

cdrData.forEach(r=>{
let emp=r[1];
let skill=r[7];
let dispo=(r[25]||"").toLowerCase();

if(skill==="INBOUND") ivr++;

if(!map[emp]) return;

if(dispo==="callmatured"||dispo==="transfer"){
map[emp].total++;
if(skill==="INBOUND") map[emp].ib++;
}
});

let final=Object.values(map).map(r=>({
...r,
aht:r.total?r.ahtRaw/r.total:0,
ob:r.total-r.ib
}));

sessionStorage.setItem("data",JSON.stringify({final,ivr,reportTime}));
if(db) db.ref("dashboard").set({final,ivr,reportTime});

window.location="dashboard.html";
};

r2.readAsBinaryString(cdrFile);
};

r1.readAsBinaryString(aprFile);
}

// ===============================
// 🔥 LOAD DASHBOARD
// ===============================
function loadDashboard(final,ivr,reportTime){

let tb=document.querySelector("#table tbody");
if(!tb) return;
tb.innerHTML="";

let max=Math.max(...final.map(x=>x.total));

let totalCalls=0,totalIB=0,totalOB=0,totalTalk=0;

final.forEach(r=>{

totalCalls+=r.total;
totalIB+=r.ib;
totalOB+=r.ob;
totalTalk+=(r.aht*r.total);

let netCls=r.net>=28800?"netGreen3D":"";
let breakCls=r.breakTime>2100?"red3D":"";
let meetingCls=r.meeting>2100?"red3D":"";
let callCls=getCallClass(r.total,max);

let tr=document.createElement("tr");

tr.innerHTML=`
<td>${r.emp}</td>
<td>${r.name}</td>
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

document.getElementById("aht").innerText=
totalCalls?toTime(totalTalk/totalCalls):"00:00:00";

document.getElementById("reportTime").innerText=
"Last Update Till: "+reportTime;
}

// ===============================
// 🔥 LOAD + LIVE
// ===============================
document.addEventListener("DOMContentLoaded",()=>{

let d=JSON.parse(sessionStorage.getItem("data")||"{}");
if(d.final){loadDashboard(d.final,d.ivr,d.reportTime);}

if(db){
db.ref("dashboard").on("value",snap=>{
let data=snap.val();
if(data&&data.final){
loadDashboard(data.final,data.ivr,data.reportTime);
}
});
}
});

// ===============================
// 🔥 PNG
// ===============================
function copyImage(){
html2canvas(document.getElementById("table")).then(c=>{
c.toBlob(b=>{
navigator.clipboard.write([new ClipboardItem({"image/png":b})]);
alert("Copied!");
});
});
}

// ===============================
// 🔥 EXCEL
// ===============================
function exportExcel(){
let d=JSON.parse(sessionStorage.getItem("data")||"{}");
if(!d.final) return;

let ws_data=[["Emp","Name","Login","Net","Break","Meeting","AHT","Call","IB","OB"]];

d.final.forEach(r=>{
ws_data.push([
r.emp,r.name,
toTime(r.login),toTime(r.net),
toTime(r.breakTime),toTime(r.meeting),
toTime(r.aht),r.total,r.ib,r.ob
]);
});

let ws=XLSX.utils.aoa_to_sheet(ws_data);
let wb=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb,ws,"Report");

XLSX.writeFile(wb,"Agent_Report.xlsx");
}

// ===============================
// 🔍 SEARCH
// ===============================
function searchAgent(){
let v=document.getElementById("search").value.toLowerCase();
document.querySelectorAll("#table tbody tr").forEach(r=>{
r.style.display=r.innerText.toLowerCase().includes(v)?"":"none";
});
}

// ===============================
// 🔄 RESET
// ===============================
function resetApp(){
sessionStorage.clear();
location="index.html";
}
