// Welcome
setTimeout(() => {
    document.getElementById("welcome").style.display="none";
    document.getElementById("main").classList.remove("hidden");
},2000);

function toSeconds(t){
    if(!t) return 0;
    let a=t.split(":").map(Number);
    return a[0]*3600+a[1]*60+a[2];
}

function toTime(sec){
    sec=Math.round(sec);
    let h=Math.floor(sec/3600);
    let m=Math.floor((sec%3600)/60);
    let s=sec%60;
    return [h,m,s].map(v=>String(v).padStart(2,'0')).join(":");
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

        let emp=r[1],name=r[2];
        let login=toSeconds(r[3]);

        let br=toSeconds(r[19])+toSeconds(r[22])+toSeconds(r[24]);
        let meet=toSeconds(r[20])+toSeconds(r[23]);

        let net=login-br;

        let calls=cdr.filter(c=>{
            let d=(c[25]||"").toLowerCase();
            return c[1]==emp&&(d.includes("callmatured")||d.includes("transfer"));
        });

        let total=calls.length;

        let ib=calls.filter(c=>(c[7]||"").toUpperCase().includes("INBOUND")).length;
        let ob=total-ib;

        let aht=total?Math.round(toSeconds(r[5])/total):0;

        final.push({emp,name,login,net,br,meet,aht,total,ib,ob});
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

    let total=0,ib=0,ob=0,aht=0;

    const tb=document.querySelector("#table tbody");

    final.forEach(r=>{

        total+=r.total;
        ib+=r.ib;
        ob+=r.ob;
        aht+=r.aht;

        let cls=r.total>max*0.7?"high":r.total>max*0.4?"medium":"low";

        let tr=document.createElement("tr");

        tr.innerHTML=`
        <td>${r.emp}</td>
        <td>${r.name}</td>
        <td>${toTime(r.login)}</td>
        <td>${toTime(r.net)}</td>
        <td>${toTime(r.br)}</td>
        <td>${toTime(r.meet)}</td>
        <td>${toTime(r.aht)}</td>
        <td class="${cls}">${r.total}</td>
        <td>${r.ib}</td>
        <td>${r.ob}</td>
        `;

        tb.appendChild(tr);
    });

    document.getElementById("total").innerText=total;
    document.getElementById("ib").innerText=ib;
    document.getElementById("ob").innerText=ob;
    document.getElementById("aht").innerText=toTime(aht/final.length);
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
    html2canvas(document.getElementById("table"),{scale:2}).then(c=>{
        c.toBlob(b=>{
            navigator.clipboard.write([new ClipboardItem({"image/png":b})]);
            alert("Copied ✅");
        });
    });
}

// RESET
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
