export interface OptimusUser {
 id:string;
 email?:string|null;
 profile?:UserProfile;
 clinical?:ClinicalUserProfile;
}

export interface UserProfile {
 name?:string;
 role?:string;
}

export interface ClinicalUserProfile {
 patientId?:string;
 conditions?:string[];
}
