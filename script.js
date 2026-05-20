console.log("🔥 FINAL PRO SYSTEM ULTRA");

// ================= FIREBASE =================
let db = null;

function initFirebase(){

    if(typeof firebase === "undefined"){
        console.error("❌ Firebase not loaded");
        return;
    }

    const firebaseConfig = {
        apiKey: "AIzaSy...",
        authDomain: "agent-performance-live.firebaseapp.com",
        databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
        projectId: "agent-performance-live"
    };

    if (!firebase.apps.length){
        firebase.initializeApp(firebaseConfig);
    }

    db = firebase.database();

    console.log("🔥 Firebase Connected");
}

function waitForFirebase(cb){

    let t = setInterval(()=>{

        if(typeof firebase !== "undefined"){

            clearInterval(t);
            cb();
        }

    },100);
}

waitForFirebase(initFirebase);

// ================= COMMON HELPERS =================

const $ = id => document.getElementById(id);

function safeStr(v){
    return (v ?? "").toString().trim();
}

function timeToSeconds(t){

    if(!t || t === "-") return 0;

    if(typeof t === "number"){
        return Math.floor(t * 86400);
    }

    let [h,m,s=0] = String(t).split(":");

    return (+h*3600)+(+m*60)+(+s);
}

function secondsToTime(sec){

    sec = Math.max(0, Math.floor(sec));

    let h = String(Math.floor(sec/3600)).padStart(2,'0');
    let m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
    let s = String(sec%60).padStart(2,'0');

    return `${h}:${m}:${s}`;
}

// ================= SEARCH =================

function searchTable(){

    let v = $("search")?.value.toLowerCase() || "";

    document.querySelectorAll("#table tbody tr").forEach(r=>{

        r.style.display =
            r.innerText.toLowerCase().includes(v)
            ? ""
            : "none";
    });
}

// ================= SOUND SYSTEM =================

let lastUpdateTime = "";
let soundEnabled = false;

/* 🔓 SOUND UNLOCK */

function unlockSound(){

    const sound = $("notifySound");

    if(sound){

        sound.volume = 1;

        sound.play()
        .then(()=>{

            sound.pause();
            sound.currentTime = 0;

            soundEnabled = true;

            console.log("🔊 Sound Enabled");

        })
        .catch(err=>{
            console.log("❌ Sound Blocked", err);
        });
    }
}

document.addEventListener("click", unlockSound, { once:true });
document.addEventListener("touchstart", unlockSound, { once:true });

/* 🔔 PLAY */

function playSound(){

    const sound = $("notifySound");

    if(sound && soundEnabled){

        sound.currentTime = 0;

        sound.play()
        .then(()=>{
            console.log("🔔 Notification Played");
        })
        .catch(err=>{
            console.log("❌ Play Failed", err);
        });
    }
}

// ================= LIVE ALERT =================

function showAlert(){

    let el = $("liveAlert");

    if(!el) return;

    el.style.display = "block";

    el.classList.add("blink");

    setTimeout(()=>{

        el.style.display = "none";
        el.classList.remove("blink");

    },3000);
}

// ================= 🔔 DESKTOP NOTIFICATION =================

function requestNotification(){

    if("Notification" in window &&
        Notification.permission !== "granted"){

        Notification.requestPermission();
    }
}

function showDesktopNotification(){

    if("Notification" in window &&
        Notification.permission === "granted"){

        let n = new Notification(
            "📊 Agent Performance Report Updated",
            {
                body:"New Live Data Available",
                icon:"https://cdn-icons-png.flaticon.com/512/1827/1827392.png"
            }
        );

        n.onclick = ()=>{

            window.focus();

            window.location.href = "dashboard.html";
        };
    }
}

// ================= EXPORT EXCEL =================

function exportExcel(){

    const table = $("table");

    if(!table) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);

    let data = [];

    // 🔥 HEADER

    let headers = [];

    table.querySelectorAll("thead th").forEach(th=>{

        headers.push(th.innerText);
    });

    data.push(headers);

    // 🔥 BODY

    table.querySelectorAll("tbody tr").forEach(tr=>{

        if(tr.style.display === "none") return;

        let row = [];

        tr.querySelectorAll("td").forEach(td=>{

            row.push(td.innerText);
        });

        data.push(row);
    });

    XLSX.utils.sheet_add_aoa(ws,data);

    // ================= STYLING =================

    const range = XLSX.utils.decode_range(ws['!ref']);

    for(let R = 0; R <= range.e.r; ++R){

        for(let C = 0; C <= range.e.c; ++C){

            const cellAddress =
                XLSX.utils.encode_cell({r:R,c:C});

            if(!ws[cellAddress]) continue;

            ws[cellAddress].s = {

                border:{
                    top:{style:"thin"},
                    bottom:{style:"thin"},
                    left:{style:"thin"},
                    right:{style:"thin"}
                },

                alignment:{
                    horizontal:"center",
                    vertical:"center"
                },

                font:{
                    bold:R===0
                }
            };

            // 🔥 HEADER

            if(R===0){

                ws[cellAddress].s.fill = {
                    fgColor:{rgb:"0B3D91"}
                };

                ws[cellAddress].s.font = {
                    bold:true,
                    color:{rgb:"FFFFFF"}
                };
            }
        }
    }

    // ================= CONDITIONAL COLORS =================

    table.querySelectorAll("tbody tr").forEach((tr,rowIndex)=>{

        tr.querySelectorAll("td").forEach((td,colIndex)=>{

            const cellAddress =
                XLSX.utils.encode_cell({
                    r:rowIndex+1,
                    c:colIndex
                });

            if(!ws[cellAddress]) return;

            if(td.classList.contains("green3d")){

                ws[cellAddress].s.fill = {
                    fgColor:{rgb:"22C55E"}
                };

                ws[cellAddress].s.font = {
                    color:{rgb:"FFFFFF"}
                };
            }

            if(td.classList.contains("yellow3d")){

                ws[cellAddress].s.fill = {
                    fgColor:{rgb:"FACC15"}
                };

                ws[cellAddress].s.font = {
                    color:{rgb:"000000"}
                };
            }

            if(td.classList.contains("red3d")){

                ws[cellAddress].s.fill = {
                    fgColor:{rgb:"DC2626"}
                };

                ws[cellAddress].s.font = {
                    color:{rgb:"FFFFFF"}
                };
            }
        });
    });

    // 🔥 COLUMN WIDTH

    ws['!cols'] = headers.map(()=>({wch:22}));

    XLSX.utils.book_append_sheet(
        wb,
        ws,
        "Dashboard"
    );

    XLSX.writeFile(
        wb,
        "Agent_Performance_CM.xlsx"
    );
}

// ================= FILE READ =================

function readExcel(file,skip,cb){

    let r = new FileReader();

    r.onload = e=>{

        let wb = XLSX.read(
            new Uint8Array(e.target.result),
            {type:"array"}
        );

        let raw = XLSX.utils.sheet_to_json(
            wb.Sheets[wb.SheetNames[0]],
            {header:1}
        );

        let data = raw.slice(skip);

        let headers = data[0];

        let json = data.slice(1).map(row=>{

            let o = {};

            headers.forEach((h,i)=>{

                o[h] = row[i];
            });

            return o;
        });

        cb(json,raw);
    };

    r.readAsArrayBuffer(file);
}

// ================= PROCESS =================

function processFiles(){

    if(!db){

        alert("Firebase loading...");
        return;
    }

    let apr = $("aprFile")?.files[0];
    let cdr = $("cdrFile")?.files[0];

    if(!apr || !cdr){

        alert("Upload both files");
        return;
    }

    let btn = $("generateBtn");

    if(btn){

        btn.innerText = "⏳ Processing...";
        btn.disabled = true;
    }

    let loading = $("loading");

    if(loading){
        loading.style.display = "block";
    }

    readExcel(apr,2,(aprData,raw)=>{

        let row2 = raw[1]?.join(" ") || "";

        if(row2.includes("to")){

            window.reportDate =
                row2.split("to")[1].trim();
        }

        readExcel(cdr,1,(cdrData)=>{

            let final =
                buildDashboard(aprData,cdrData);

            let summary =
                buildSummary(cdrData,final);

            db.ref("dashboard").set({

                final,
                summary,

                reportTime:
                    window.reportDate ||
                    new Date().toLocaleString()
            });

            window.location.href =
                "dashboard.html";
        });
    });
}

// ================= RESET =================

function resetDashboard(){

    const pass =
        prompt("🔐 Enter Code to Reset");

    if(pass !== "1122"){

        alert("❌ Wrong Code");
        return;
    }

    if(db){

        db.ref("dashboard").remove();
    }

    localStorage.removeItem("dashboard");

    sessionStorage.clear();

    localStorage.removeItem("auth_ok");

    window.location.replace(
        "index.html?reset="+Date.now()
    );
}

// ================= CORE =================

function buildDashboard(apr,cdr){

    return apr.map(a=>{

        let emp =
            safeStr(a["Agent Name"]);

        let name =
            safeStr(a["Agent Full Name"]);

        let login =
            timeToSeconds(a["Total Login Time"]);

        let breakTime =
            timeToSeconds(a["LUNCHBREAK"]) +
            timeToSeconds(a["TEABREAK"]) +
            timeToSeconds(a["SHORTBREAK"]);

        let net = login - breakTime;

        let agentCDR = cdr.filter(r=>
            safeStr(r["Username"])===emp
        );

        let total = agentCDR.filter(r=>{

            let d =
                safeStr(r["Disposition"])
                .toUpperCase();

            return d.includes("CALLMATURED") ||
                   d.includes("TRANSFER");

        }).length;

        let ib = agentCDR.filter(r=>{

            let d =
                safeStr(r["Disposition"])
                .toUpperCase();

            let c =
                safeStr(r["Campaign"])
                .toUpperCase();

            return (
                d.includes("CALLMATURED") ||
                d.includes("TRANSFER")
            ) &&
            c.includes("CSRINBOUND");

        }).length;

        let ob = total - ib;

        let talk = agentCDR.reduce(
            (s,r)=>
                s +
                timeToSeconds(r["Talk Duration"]),
            0
        );

        let aht = total ? talk/total : 0;

        return {

            emp,
            name,

            login:
                secondsToTime(login),

            netLogin:
                secondsToTime(net),

            break:
                secondsToTime(breakTime),

            meeting:
                a["MEETING"] ||
                "00:00:00",

            aht:
                secondsToTime(aht),

            calls:total,

            ib,
            ob
        };
    });
}

// ================= SUMMARY =================

function buildSummary(cdr,data){

    let ivr = cdr.filter(r=>
        safeStr(r["Skill"])
        .toUpperCase()
        .includes("INBOUND")
    ).length;

    let total =
        data.reduce((s,r)=>s+r.calls,0);

    let ib =
        data.reduce((s,r)=>s+r.ib,0);

    let ob =
        data.reduce((s,r)=>s+r.ob,0);

    let totalLogin =
        data.length;

    let totalTalk =
        data.reduce(
            (s,r)=>
                s +
                timeToSeconds(r.aht) *
                r.calls,
            0
        );

    let overallAHT =
        total ? totalTalk/total : 0;

    return {

        ivr,
        total,
        ib,
        ob,
        totalLogin,

        aht:
            secondsToTime(overallAHT)
    };
}

// ================= LOAD DASHBOARD =================

function loadDashboard(data){

    let tbody =
        document.querySelector("#table tbody");

    if(!tbody) return;

    tbody.innerHTML = "";

    data.final.forEach((r,i)=>{

        let loginSec =
            timeToSeconds(r.login);

        let netSec =
            timeToSeconds(r.netLogin);

        let breakSec =
            timeToSeconds(r.break);

        let meetSec =
            timeToSeconds(r.meeting);

        // 🔥 NET LOGIN

        let netCls = "";

        if(netSec >= 8*3600){

            netCls = "green3d";
        }
        else if(
            loginSec >= (8*3600 + 15*60)
            &&
            netSec < 8*3600
        ){

            netCls = "red3d";
        }

        // 🔥 BREAK

        let breakCls =
            breakSec > 2100
            ? "red3d"
            : "";

        // 🔥 MEETING

        let meetCls =
            meetSec > 2100
            ? "red3d"
            : "";

        // 🔥 CALLS

        let callCls = "";

        if(r.calls >= 100){

            callCls = "green3d";
        }
        else if(r.calls >= 70){

            callCls = "yellow3d";
        }
        else{

            callCls = "red3d";
        }

        let tr =
            document.createElement("tr");

        tr.innerHTML = `
        <td>${i+1}</td>
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

    let c = data.summary;

    $("cards").innerHTML = `
    <div class="card">Total IVR Hit<br>${c.ivr}</div>
    <div class="card">Total Mature<br>${c.total}</div>
    <div class="card">IB Mature<br>${c.ib}</div>
    <div class="card">OB Mature<br>${c.ob}</div>
    <div class="card">Overall AHT<br>${c.aht}</div>
    <div class="card">Total Login Count<br>${c.totalLogin}</div>
    `;

    $("reportTime").innerText =
        "Last Update Till: " + data.reportTime;
}

// ================= LIVE =================

document.addEventListener(
    "DOMContentLoaded",
    ()=>{

    requestNotification();

    let t = setInterval(()=>{

        if(db){

            clearInterval(t);

            db.ref("dashboard")
            .on("value",snap=>{

                let d = snap.val();

                if(!d) return;

                if(!lastUpdateTime){

                    lastUpdateTime =
                        d.reportTime;

                    loadDashboard(d);

                    return;
                }

                if(
                    d.reportTime !==
                    lastUpdateTime
                ){

                    playSound();

                    showAlert();

                    showDesktopNotification();

                    lastUpdateTime =
                        d.reportTime;
                }

                loadDashboard(d);
            });
        }

    },200);
});

// ================= GLOBAL =================

window.processFiles = processFiles;
window.resetDashboard = resetDashboard;
window.searchTable = searchTable;
window.exportExcel = exportExcel;
