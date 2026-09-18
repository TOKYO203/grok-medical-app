

import type {
 ClinicalProfile
} from "./clinical-profile-engine";



const KEY="optimus-clinical-profile";



export function saveProfile(
 profile:ClinicalProfile
){

localStorage.setItem(
 KEY,
 JSON.stringify(profile)
);

}



export function loadProfile()
:ClinicalProfile|null{


const raw =
localStorage.getItem(KEY);


if(!raw)
 return null;


return JSON.parse(raw);

}


