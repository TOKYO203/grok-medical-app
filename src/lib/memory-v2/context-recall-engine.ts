
import {getMemory} from "./long-term-memory-engine"


export function recallContext(keyword:string){

 return getMemory()
 .filter(item =>
 item.content
 .toLowerCase()
 .includes(keyword.toLowerCase())
 )

}

