// 🔥 FIREBASE SAFE INIT
const firebaseConfig = {
  apiKey: "AIzaSyCzPyZwPnSST3lv1pnSibq3dQjVIg2o-xs",
  authDomain: "agent-performance-live.firebaseapp.com",
  databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
  projectId: "agent-performance-live"
};

let firebaseDB;

if (typeof firebase !== "undefined") {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    firebaseDB = firebase.database();
}


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

function getGradientClass(val,max){
    let p = val/max;
    if(p >= 0.75) return "green";
    if(p >= 0.45) return "yellow";
    return "red";
}


// 🔍 HEADER FIND
function findCol(header, name){
    return header.findIndex(h => 
        h && h.toString().toLowerCase().replace(/\s+/g,'')
        .includes(name.toLowerCase().replace(/\s+/g,''))
    );
}


// 🔥 PROCESS FILES
function processFiles(){

    let aprFile = document.getElementById("aprFile").files[0];
    let cdrFile = document.getElementById("cdrFile").files[0];

    if(!aprFile || !cdrFile){
        alert("Upload both files");
        return;
    }

    document.getElementById("loading").style.display="block";

    let reader1 = new FileReader();
    let reader2 = new FileReader();

    reader1.onload = function(e){

        let apr = XLSX.read(e.target.result, {type:'binary'});
        let aprData = XLSX.utils.sheet_to_json(apr.Sheets[apr.SheetNames[0]], {header:1});

        reader2.onload = function(e2){

            let cdr = XLSX.read(e2.target.result, {type:'binary'});
            let cdrData = XLSX.utils.sheet_to_json(cdr.Sheets[cdr.SheetNames[0]], {header:1});

            // 🔥 ✅ REPORT TIME (Row 2)
            let reportRow = aprData[1][0] || "";
            let reportTime = "";

            if(reportRow.includes("to")){
                reportTime = reportRow.split("to")[1].trim();
            }

            // 🔥 ✅ HEADER = ROW 3
            let aprHeader = aprData[2];

            // 🔥 REMOVE TOP 3 ROWS
            aprData.splice(0,3);

            // 🔥 COLUMN DETECT
            let empCol = findCol(aprHeader, "agentname");
            let nameCol = findCol(aprHeader, "agentfullname");
            let loginCol = findCol(aprHeader, "totallogintime");

            let lunchCol = findCol(aprHeader, "lunchbreak");
            let teaCol = findCol(aprHeader, "teabreak");
            let shortCol = findCol(aprHeader, "shortbreak");

            let meetCol = findCol(aprHeader, "meeting");
            let sysCol = findCol(aprHeader, "systemdown");

            let map = {};
            let ivr = 0;

            // 🔥 APR LOOP
            aprData.forEach(r=>{

                let emp = r[empCol];
                if(!emp) return;

                let login = toSeconds(r[loginCol]);

                let breakTime =
                    toSeconds(r[lunchCol]) +
                    toSeconds(r[teaCol]) +
                    toSeconds(r[shortCol]);

                let meeting =
                    toSeconds(r[meetCol]) +
                    toSeconds(r[sysCol]);

                map[emp] = {
                    emp: String(emp),
                    name: r[nameCol] || "",
                    login,
                    breakTime,
                    meeting,
                    net: login - breakTime,
                    total: 0,
                    ib: 0,
                    talk: 0
                };
            });

            // 🔥 CDR HEADER
            let cdrHeader = cdrData[0];

            let empColC = findCol(cdrHeader, "username");
            let skillCol = findCol(cdrHeader, "skill");
            let dispoCol = findCol(cdrHeader, "disposition");
            let talkCol = findCol(cdrHeader, "talk");

            cdrData.splice(0,1);

            // 🔥 CDR LOOP
            cdrData.forEach(r=>{

                let emp = r[empColC];
                let skill = r[skillCol];
                let dispo = (r[dispoCol] || "").toLowerCase();
                let talk = toSeconds(r[talkCol]);

                if(skill === "INBOUND") ivr++;

                if(!map[emp]) return;

                if(dispo === "callmatured" || dispo === "transfer"){

                    map[emp].total++;
                    map[emp].talk += talk;

                    if(skill === "INBOUND"){
                        map[emp].ib++;
                    }
                }
            });

            let final = Object.values(map).map(r=>({

                emp: r.emp,
                name: r.name,
                login: r.login,
                net: r.net,
                breakTime: r.breakTime,
                meeting: r.meeting,
                aht: r.total ? r.talk / r.total : 0,
                total: r.total,
                ib: r.ib,
                ob: r.total - r.ib
            }));

            sessionStorage.setItem("data", JSON.stringify({
                final,
                ivr,
                reportTime
            }));

            if(firebaseDB){
                firebaseDB.ref("dashboard").set({
                    final,
                    ivr,
                    reportTime
                });
            }

            window.location = "dashboard.html";
        }

        reader2.readAsBinaryString(cdrFile);
    }

    reader1.readAsBinaryString(aprFile);
}
