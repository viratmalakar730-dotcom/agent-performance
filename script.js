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

// READ EXCEL
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

// PROCESS FILES
async function processFiles(){

    let aprFile=document.getElementById("aprFile").files[0];
    let cdrFile=document.getElementById("cdrFile").files[0];

    if(!aprFile || !cdrFile){
        alert("Upload both files ❌");
        return;
    }

    document.getElementById("loading").style.display="block";

    let apr=await readExcel(aprFile,3);
    let cdr=await readExcel(cdrFile,2);

    let final=[];
    let ivr=0;

    // IVR HIT
    cdr.forEach(c=>{
        if((c[7]||"").toUpperCase().includes("INBOUND")) ivr++;
    });

    apr.forEach(r=>{

        if(!r[1]) return;

        let emp=(r[1]||"").toString().trim();
        let name=r[2];

        let login=toSeconds(r[3]);

        let breakTime=
        toSeconds(r[19])+toSeconds(r[22])+toSeconds(r[24]);

        let meeting=
        toSeconds(r[20])+toSeconds(r[23]);

        let net=Math.max(0,login-breakTime);

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

// LOAD DASHBOARD
document.addEventListener("DOMContentLoaded",()=>{

    let d=JSON.parse(sessionStorage.getItem("data")||"{}");
    if(!d.final) return;

    let {final,ivr}=d;

    final.sort((a,b)=>b.total-a.total);

    let max=Math.max(...final.map(x=>x.total));

    let tb=document.querySelector("#table tbody");

    let totalCalls=0,totalIB=0,totalOB=0,totalTalk=0;

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
        <td class="${getGradientClass(r.total,max)}">${r.total}</td>
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
});

// SEARCH
function searchAgent(){
    let v=document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.style.display=r.innerText.toLowerCase().includes(v)?"":"none";
    });
}

// PNG COPY
function copyImage(){
    html2canvas(document.getElementById("captureArea"),{scale:2}).then(c=>{
        c.toBlob(b=>{
            navigator.clipboard.write([new ClipboardItem({"image/png":b})]);
            alert("Copied!");
        });
    });
}

// RESET
function resetApp(){
    sessionStorage.clear();
    location="index.html";
}
