
import {
buildProfile
} from "@/lib/user/clinical-profile-engine"


export function useClinicalProfile(){

const xp=750

return buildProfile(
xp,
12,
4
)

}

