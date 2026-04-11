// LOGIN DATA
const supervisor = { id:"Supervisor", pass:"Bfil@123" };
const agent = { id:"1962", pass:"1962" };

// LOGIN
function login(){

 let role=document.getElementById("role").value;
 let user=document.getElementById("user").value;
 let pass=document.getElementById("pass").value;

 if(role==="supervisor"){

   if(user===supervisor.id && pass===supervisor.pass){
     sessionStorage.setItem("role","supervisor");
     location="upload.html";
   } else alert("Invalid Supervisor ❌");

 }

 else{

   if(user===agent.id && pass===agent.pass){
     sessionStorage.setItem("role","agent");
     startTimer();
     location="dashboard.html";
   } else alert("Invalid Agent ❌");

 }
}

// TIMER
let timeLeft = 300; // 5 min

function startTimer(){

 setInterval(()=>{

   if(sessionStorage.getItem("role")!=="agent") return;

   timeLeft--;

   let m=Math.floor(timeLeft/60);
   let s=timeLeft%60;

   let t=document.getElementById("timer");
   if(t) t.innerText=`Session: ${m}:${s}`;

   if(timeLeft<=0){
     alert("Session Expired ⏳");
     logout();
   }

 },1000);
}

// LOGOUT
function logout(){
 sessionStorage.clear();
 location="index.html";
}

// PROCESS FILE (demo)
function processFiles(){

 let data=[
   {emp:"1962",name:"Agent",total:50,ib:30,ob:20},
   {emp:"1963",name:"Agent2",total:30,ib:15,ob:15}
 ];

 localStorage.setItem("dashboard",JSON.stringify(data));

 location="dashboard.html";
}

// LOAD DASHBOARD
document.addEventListener("DOMContentLoaded",()=>{

 let data=JSON.parse(localStorage.getItem("dashboard")||"[]");

 let tb=document.querySelector("#table tbody");

 if(!tb) return;

 let max=Math.max(...data.map(x=>x.total));

 data.forEach(r=>{

   let cls=r.total>=max*0.75?"green":r.total>=max*0.4?"yellow":"red";

   tb.innerHTML+=`
   <tr>
   <td>${r.emp}</td>
   <td>${r.name}</td>
   <td class="${cls}">${r.total}</td>
   <td>${r.ib}</td>
   <td>${r.ob}</td>
   </tr>`;
 });

 startTimer();

});
