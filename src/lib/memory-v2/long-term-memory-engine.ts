
export type MemoryRecord={
 id:string
 type:string
 content:string
 timestamp:number
}


const memory:MemoryRecord[]=[]


export function saveMemory(record:MemoryRecord){

 memory.push(record)

 return record

}


export function getMemory(){

 return memory

}

