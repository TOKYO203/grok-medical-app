

import type {

 ClinicalPatientContext

} from "./clinical.types";



export function buildClinicalContext(

 input:ClinicalPatientContext

){


return {


patientId:input.patientId,

summary:{

age:input.age,

conditions:input.conditions ?? [],

symptoms:input.symptoms ?? []

}


};


}

