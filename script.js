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

document.addEventListener("DOMContentLoaded",()=>{

    let d=JSON.parse(sessionStorage.getItem("data")||"{}");
    if(!d.final) return;

    let {final,ivr}=d;

    final.sort((a,b)=>b.total-a.total);

    let max=Math.max(...final.map(x=>x.total));

    document.getElementById("ivr").innerText=ivr;

    const tb=document.querySelector("#table tbody");

    final.forEach(r=>{

        let callCls=getGradientClass(r.total,max);

        // 🔥 CONDITIONAL FORMATTING
        let netCls = r.net > 29700 ? "netGreen" : "";   // 8:15 hr
        let breakCls = r.breakTime > 2100 ? "breakRed" : ""; // 35 min
        let meetingCls = r.meeting > 2100 ? "meetingRed" : "";

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

});
