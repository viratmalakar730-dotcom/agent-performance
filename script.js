setTimeout(() => {
    document.getElementById("welcome").style.display="none";
    document.getElementById("main").classList.remove("hidden");
},2000);

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

function getGradientClass(val,max){
    let p=val/max;
    if(p>=0.75) return "green";
    if(p>=0.45) return "yellow";
    return "red";
}

async function processFiles(){

    document.getElementById("loading").style.display="block";

    const apr=await readExcel(document.getElementById("aprFile").files[0],3);
    const cdr=await readExcel(document.getElementById("cdrFile").files[0],2);

    let final=[],ivr=0;

    cdr.forEach(c=>{
        if((c[7]||"").toUpperCase().includes("INBOUND")) ivr++;
    });

    apr.forEach(r=>{

        if(!r[1]) return;

        let emp=r[1],name=r[2];

        let login=toSeconds(r[3]);

        let breakTime=(toSeconds(r[19])||0)+(toSeconds(r[22])||0)+(toSeconds(r[24])||0);
        let meeting=(toSeconds(r[20])||0)+(toSeconds(r[23])||0);

        let net=Math.max(0,login-breakTime);

        let calls=cdr.filter(c=>{
            let d=(c[25]||"").toLowerCase();
            return c[1]==emp&&(d.includes("callmatured")||d.includes("transfer"));
        });

        let total=calls.length;

        let ib=calls.filter(c=>(c[7]||"").toUpperCase().includes("INBOUND")).length;
        let ob=total-ib;

        let aht=total?Math.round(toSeconds(r[5])/total):0;

        final.push({emp,name,login,net,breakTime,meeting,aht,total,ib,ob});
    });

    sessionStorage.setItem("data",JSON.stringify({final,ivr}));
    location="dashboard.html";
}

document.addEventListener("DOMContentLoaded",()=>{

    let d=JSON.parse(sessionStorage.getItem("data")||"{}");
    if(!d.final) return;

    let {final,ivr}=d;

    final.sort((a,b)=>b.total-a.total);

    let max=Math.max(...final.map(x=>x.total));

    document.getElementById("ivr").innerText=ivr;

    const tb=document.querySelector("#table tbody");

    final.forEach(r=>{

        let cls=getGradientClass(r.total,max);
        let netCls=r.net>28800?"green":"";

        let tr=document.createElement("tr");

        tr.innerHTML=`
        <td>${r.emp}</td>
        <td>${r.name}</td>
        <td>${toTime(r.login)}</td>
        <td class="${netCls}">${toTime(r.net)}</td>
        <td>${toTime(r.breakTime)}</td>
        <td>${toTime(r.meeting)}</td>
        <td>${toTime(r.aht)}</td>
        <td class="${cls}">${r.total}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>
        `;

        tb.appendChild(tr);
    });
});

function searchAgent(){
    let v=document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.style.display=r.innerText.toLowerCase().includes(v)?"":"none";
    });
}

function copyImage(){
    html2canvas(document.getElementById("table"),{scale:2}).then(c=>{
        c.toBlob(b=>{
            navigator.clipboard.write([new ClipboardItem({"image/png":b})]);
            alert("Copied ✅");
        });
    });
}

function resetApp(){
    sessionStorage.clear();
    location="index.html";
}

function readExcel(f,s){
    return new Promise(res=>{
        let r=new FileReader();
        r.onload=e=>{
            let wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
            let d=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});
            res(d.slice(s));
        };
        r.readAsArrayBuffer(f);
    });
}
