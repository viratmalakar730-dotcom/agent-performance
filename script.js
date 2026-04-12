// 🔥 FIREBASE INIT
const firebaseConfig = {
  apiKey: "AIzaSyCzPyZwPnSST3lv1pnSibq3dQjVIg2o-xs",
  authDomain: "agent-performance-live.firebaseapp.com",
  databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
  projectId: "agent-performance-live",
};

firebase.initializeApp(firebaseConfig);
const firebaseDB = firebase.database();

// 🔥 TIME FUNCTIONS
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

// 🔥 PROCESS FILES
function processFiles(){

    let apr = document.getElementById("aprFile").files[0];
    let cdr = document.getElementById("cdrFile").files[0];

    if(!apr || !cdr){
        alert("Upload both files");
        return;
    }

    document.getElementById("loading").style.display="block";

    let reader1 = new FileReader();
    let reader2 = new FileReader();

    reader1.onload = function(e1){
        reader2.onload = function(e2){

            let wb1 = XLSX.read(e1.target.result, {type:'binary'});
            let wb2 = XLSX.read(e2.target.result, {type:'binary'});

            let aprData = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]]);
            let cdrData = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]);

            let final = [];

            aprData.forEach(a=>{

                let emp = a["Employee ID"];
                let name = a["Agent Full Name"];

                let login = toSeconds(a["Total Login Time"]);
                let breakTime = toSeconds(a["Total Break Duration"]);
                let meeting = toSeconds(a["MEETING"]);
                let net = login - breakTime - meeting;

                let agentCDR = cdrData.filter(c=>c["Username"]==emp);

                let ib = agentCDR.filter(x=>x["Call Type"]=="Inbound").length;
                let ob = agentCDR.filter(x=>x["Call Type"]=="Outbound").length;

                let total = ib + ob;

                let talk = agentCDR.reduce((s,x)=>s+toSeconds(x["Talk Duration"]),0);
                let aht = total ? talk/total : 0;

                final.push({emp,name,login,net,breakTime,meeting,aht,total,ib,ob});
            });

            let ivr = cdrData.filter(x=>x["Call Type"]=="Inbound").length;

            sessionStorage.setItem("data", JSON.stringify({final,ivr}));

            // 🔥 FIREBASE PUSH
            firebaseDB.ref("dashboard").set({
                final: final,
                ivr: ivr
            });

            window.location="dashboard.html";
        }

        reader2.readAsBinaryString(cdr);
    }

    reader1.readAsBinaryString(apr);
}

// 🔥 DASHBOARD LOAD
function loadDashboard(final, ivr){

    const tb = document.querySelector("#table tbody");
    tb.innerHTML="";

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
        <td>${toTime(r.net)}</td>
        <td>${toTime(r.breakTime)}</td>
        <td>${toTime(r.meeting)}</td>
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
}

// 🔥 AUTO LOAD (DASHBOARD)
document.addEventListener("DOMContentLoaded", ()=>{
    let d = JSON.parse(sessionStorage.getItem("data") || "{}");
    if(d.final) loadDashboard(d.final,d.ivr);
});

// 🔥 LIVE LOAD
if(window.location.pathname.includes("live")){
    firebaseDB.ref("dashboard").on("value",(snap)=>{
        let d=snap.val();
        if(d) loadDashboard(d.final,d.ivr);
    });
}

// 🔍 SEARCH
function searchAgent(){
    let v=document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.style.display=r.innerText.toLowerCase().includes(v)?"":"none";
    });
}

// 📸 PNG
function copyImage(){
    html2canvas(document.getElementById("table")).then(c=>{
        c.toBlob(b=>{
            navigator.clipboard.write([new ClipboardItem({"image/png":b})]);
            alert("Copied!");
        });
    });
}

// 🔁 RESET
function resetApp(){
    sessionStorage.clear();
    location="index.html";
}
