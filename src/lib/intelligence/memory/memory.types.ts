export type MemoryType =
 | "clinical"
 | "conversation"
 | "profile"
 | "knowledge";


export interface OptimusMemory {

 id:string;

 userId:string;

 type:MemoryType;

 content:unknown;

 createdAt:string;

 tags?:string[];

}
