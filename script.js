// 🔥 FIREBASE INIT
const firebaseConfig = {
  apiKey: "AIzaSyCzPyZwPnSST3lv1pnSibq3dQjVIg2o-xs",
  authDomain: "agent-performance-live.firebaseapp.com",
  databaseURL: "https://agent-performance-live-default-rtdb.firebaseio.com/",
  projectId: "agent-performance-live"
};

firebase.initializeApp(firebaseConfig);
const firebaseDB = firebase.database();


// 🔥 TIME
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
        let aprData = XLSX.utils.sheet_to_json(apr.Sheets[0], {header:1});

        reader2.onload = function(e2){

            let cdr = XLSX.read(e2.target.result, {type:'binary'});
            let cdrData = XLSX.utils.sheet_to_json(cdr.Sheets[0], {header:1});

            aprData.splice(0,2);
            cdrData.splice(0,1);

            let map = {};
            let ivr = 0;

            // 🔥 APR LOOP (FINAL CORRECT)
            aprData.forEach(r=>{

                let emp = r[1];
                if(!emp) return;

                let login = toSeconds(r[3]);

                // ✅ BREAK (FIXED INDEX)
                let lunch = toSeconds(r[19]);
                let tea = toSeconds(r[23]);
                let shortB = toSeconds(r[25]);

                let breakTime = lunch + tea + shortB;

                // ✅ MEETING (FIXED INDEX)
                let meeting = toSeconds(r[20]);
                let systemDown = toSeconds(r[24]);

                let totalMeeting = meeting + systemDown;

                map[emp] = {
                    emp: String(emp),
                    name: r[2] || "",
                    login: login,
                    breakTime: breakTime,
                    meeting: totalMeeting,
                    net: login - breakTime,
                    total: 0,
                    ib: 0,
                    talk: 0
                };
            });

            // 🔥 CDR LOOP
            cdrData.forEach(r=>{

                let emp = r[1];
                let skill = r[7];
                let dispo = (r[25] || "").toLowerCase();
                let talk = toSeconds(r[11]);

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

            let final = Object.values(map).map(r=>{

                let ob = r.total - r.ib;
                let aht = r.total ? r.talk / r.total : 0;

                return {
                    emp: r.emp,
                    name: r.name,
                    login: r.login,
                    net: r.net,
                    breakTime: r.breakTime,
                    meeting: r.meeting,
                    aht: aht,
                    total: r.total,
                    ib: r.ib,
                    ob: ob
                };
            });

            sessionStorage.setItem("data", JSON.stringify({final,ivr}));

            firebaseDB.ref("dashboard").set({
                final: final,
                ivr: ivr
            });

            window.location = "dashboard.html";
        }

        reader2.readAsBinaryString(cdrFile);
    }

    reader1.readAsBinaryString(aprFile);
}
