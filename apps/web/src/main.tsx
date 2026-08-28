import React,{useEffect,useState} from "react";
import{createRoot}from"react-dom/client";
import{accuracyMs,detectPatterns}from"@couscous/core";
import"./styles.css";

type SavedCatch={ts:string;local:string;name:string;accuracy:number};
const load=():SavedCatch[]=>JSON.parse(localStorage.getItem("cc:catches")||"[]");
const save=(x:SavedCatch[])=>localStorage.setItem("cc:catches",JSON.stringify(x));
const pad=(n:number,l=2)=>String(n).padStart(l,"0");
const parts=(d=new Date())=>({hour:d.getHours(),minute:d.getMinutes(),second:d.getSeconds(),millisecond:d.getMilliseconds()});
const display=(d:Date,ms=false)=>{const p=parts(d);return `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${ms?"."+pad(p.millisecond,3):""}`};

function App(){
 const[tab,setTab]=useState<"catch"|"ultimate"|"collection">("catch");
 const[now,setNow]=useState(new Date()); const[result,setResult]=useState<SavedCatch|null>(null);
 const[catches,setCatches]=useState(load());
 useEffect(()=>{const i=setInterval(()=>setNow(new Date()),40);return()=>clearInterval(i)},[]);
 const doCatch=()=>{const d=new Date(),p=parts(d),patterns=detectPatterns(p),best=patterns[0];if(!best){setResult({ts:d.toISOString(),local:display(d,true),name:"NO COUSCOUS",accuracy:accuracyMs(p)});return}
 const item={ts:d.toISOString(),local:display(d,true),name:best.name,accuracy:accuracyMs(p)};const next=[...catches,item];setCatches(next);save(next);setResult(item)};
 const share=async()=>{if(!result)return;const text=`I caught ${result.name} at ${result.local} · +${result.accuracy} ms\nCouscous Catcher`;if(navigator.share)await navigator.share({title:"Couscous Catcher",text});else navigator.clipboard?.writeText(text)};
 return <main><header><b>COUSCOUS<br/>CATCHER</b><span>🔥 {new Set(catches.map(x=>x.ts.slice(0,10))).size}</span></header>
 <section>
 {tab==="catch"&&!result&&<><div className="clock">{display(now)}</div><div className="hint">catch the right time</div><button className="catch" onClick={doCatch}>COUSCOUS!</button></>}
 {tab==="catch"&&result&&<div className="result"><small>{result.name==="NO COUSCOUS"?"NOT YET":"CAUGHT"}</small><h1>{result.name}</h1><div>{result.local}</div>{result.name!=="NO COUSCOUS"&&<strong>+{result.accuracy} ms</strong>}<div className="actions">{result.name!=="NO COUSCOUS"&&<button onClick={share}>SHARE</button>}<button onClick={()=>setResult(null)}>CONTINUE</button></div></div>}
 {tab==="ultimate"&&<Ultimate/>}
 {tab==="collection"&&<div className="collection"><small>ALL TIME</small><h1>{catches.length}</h1><p>couscous caught</p>{catches.slice(-5).reverse().map((x,i)=><div key={i}>{x.name} · {x.local}</div>)}</div>}
 </section>
 <nav>{(["catch","ultimate","collection"] as const).map(x=><button className={tab===x?"on":""} onClick={()=>{setTab(x);setResult(null)}}>{x.toUpperCase()}</button>)}</nav></main>
}
function Ultimate(){const[running,setRunning]=useState(false),[elapsed,setElapsed]=useState(0),[start,setStart]=useState(0);useEffect(()=>{if(!running)return;let id=0;const tick=()=>{setElapsed(performance.now()-start);id=requestAnimationFrame(tick)};id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id)},[running,start]);const mm=Math.floor(elapsed/60000)%60,ss=Math.floor(elapsed/1000)%60,ms=Math.floor(elapsed)%1000;return <><small>COUSCOUS ULTIMATE</small><div className="clock">{pad(mm)}:{pad(ss)}.{pad(ms,3)}</div><button className="mini" onClick={()=>{if(!running){setElapsed(0);setStart(performance.now())}setRunning(!running)}}>{running?"STOP":"START"}</button><div className="hint">training mode</div></>}
createRoot(document.getElementById("root")!).render(<App/>);
