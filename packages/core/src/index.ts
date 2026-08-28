export type TimeParts={hour:number;minute:number;second:number;millisecond:number};
export type Pattern={id:string;name:string;rarity:"COMMON"|"UNCOMMON"|"RARE"|"EPIC"|"LEGENDARY"|"MYTHIC";rank:number};
export function detectPatterns(t:TimeParts):Pattern[]{
 const out:Pattern[]=[]; const add=(id:string,name:string,rarity:Pattern["rarity"],rank:number)=>out.push({id,name,rarity,rank});
 const hh=String(t.hour).padStart(2,"0"), mm=String(t.minute).padStart(2,"0");
 if(t.hour===t.minute) add("couscous","COUSCOUS","COMMON",1);
 if(hh===mm.split("").reverse().join("") && hh!==mm) add("mirror","MIRROR COUSCOUS","UNCOMMON",2);
 if(t.hour===11&&t.minute===11) add("angel","ANGEL","LEGENDARY",5);
 return out.sort((a,b)=>b.rank-a.rank);
}
export function accuracyMs(t:TimeParts){return t.second*1000+t.millisecond}
