// 🔥 TIME CONVERT
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

// 🔥 GRADIENT
function getGradientClass(val,max){
    let p = val/max;
    if(p >= 0.75) return "green";
    if(p >= 0.45) return "yellow";
    return "red";
}

// 🔥 FILE PROCESS
async function processFiles(){

    document.getElementById("loading").style.display="block";

    const apr = await readExcel(document.getElementById("aprFile").files[0],3);
    const cdr = await readExcel(document.getElementById("cdrFile").files[0],2);

    let final = [];
    let ivr = 0;

    cdr.forEach(c=>{
        if((c[7]||"").toUpperCase().includes("INBOUND")) ivr++;
    });

    apr.forEach(r=>{

        if(!r[1]) return;

        let emp = r[1];
        let name = r[2];

        let login = toSeconds(r[3]);

        let breakTime =
            toSeconds(r[19]) +
            toSeconds(r[22]) +
            toSeconds(r[24]);

        let meeting =
            toSeconds(r[20]) +
            toSeconds(r[23]);

        let net = Math.max(0, login - breakTime);

        let calls = cdr.filter(c=>{
            let d = (c[25]||"").toLowerCase();
            return c[1] == emp &&
                (d.includes("callmatured") || d.includes("transfer"));
        });

        let total = calls.length;

        let ib = calls.filter(c =>
            (c[7]||"").toUpperCase().includes("INBOUND")
        ).length;

        let ob = total - ib;

        let aht = total ? Math.round(toSeconds(r[5]) / total) : 0;

        final.push({emp,name,login,net,breakTime,meeting,aht,total,ib,ob});
    });

    sessionStorage.setItem("data", JSON.stringify({final, ivr}));
    location = "dashboard.html";
}

// 🔥 LOAD DASHBOARD
document.addEventListener("DOMContentLoaded", ()=>{

    let d = JSON.parse(sessionStorage.getItem("data") || "{}");
    if(!d.final) return;

    let {final, ivr} = d;

    final.sort((a,b)=>b.total - a.total);

    let max = Math.max(...final.map(x=>x.total));

    const tb = document.querySelector("#table tbody");

    let totalCalls = 0, totalIB = 0, totalOB = 0, totalTalk = 0;

    final.forEach(r=>{

        totalCalls += r.total;
        totalIB += r.ib;
        totalOB += r.ob;
        totalTalk += (r.aht * r.total);

        let callCls = getGradientClass(r.total, max);

        let netCls = r.net >= 28800 ? "netGreen" : "";
        let breakCls = r.breakTime > 2100 ? "breakRed" : "";
        let meetingCls = r.meeting > 2100 ? "meetingRed" : "";

        let tr = document.createElement("tr");

        tr.innerHTML = `
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

    document.getElementById("ivr").innerText = ivr;
    document.getElementById("total").innerText = totalCalls;
    document.getElementById("ib").innerText = totalIB;
    document.getElementById("ob").innerText = totalOB;

    let overallAHT = totalCalls ? totalTalk / totalCalls : 0;
    document.getElementById("aht").innerText = toTime(overallAHT);
});

// 🔍 SEARCH
function searchAgent(){
    let v = document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("#table tbody tr").forEach(r=>{
        r.style.display = r.innerText.toLowerCase().includes(v) ? "" : "none";
    });
}

// 🖼 PNG COPY
function copyImage(){
    html2canvas(document.getElementById("table"), {scale:2}).then(c=>{
        c.toBlob(b=>{
            navigator.clipboard.write([
                new ClipboardItem({"image/png": b})
            ]);
            alert("✅ Table Copied!");
        });
    });
}

// 📊 EXCEL EXPORT (FINAL WORKING)
function exportExcel(){

    let d = JSON.parse(sessionStorage.getItem("data") || "{}");

    if(!d.final || d.final.length === 0){
        alert("No Data Found ❌");
        return;
    }

    let data = d.final;

    let ws_data = [
        ["Employee ID","Agent Full Name","Total Login","Net Login","Total Break","Total Meeting","AHT","Total Mature Call","IB Mature","OB Mature"]
    ];

    data.forEach(r=>{
        ws_data.push([
            r.emp,
            r.name,
            toTime(r.login),
            toTime(r.net),
            toTime(r.breakTime),
            toTime(r.meeting),
            toTime(r.aht),
            r.total,
            r.ib,
            r.ob
        ]);
    });

    let ws = XLSX.utils.aoa_to_sheet(ws_data);

    ws['!cols'] = [
        {wch:12},{wch:25},{wch:15},{wch:15},{wch:15},
        {wch:15},{wch:12},{wch:18},{wch:12},{wch:12}
    ];

    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard");

    XLSX.writeFile(wb, "Agent_Performance_Report.xlsx");

    alert("✅ Excel Downloaded");
}

// 🔄 RESET
function resetApp(){
    sessionStorage.clear();
    location="index.html";
}

// 📂 READ EXCEL
function readExcel(file, skipRows){
    return new Promise(resolve=>{
        let reader = new FileReader();
        reader.onload = e=>{
            let wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
            let data = XLSX.utils.sheet_to_json(
                wb.Sheets[wb.SheetNames[0]],
                {header:1}
            );
            resolve(data.slice(skipRows));
        };
        reader.readAsArrayBuffer(file);
    });
}
