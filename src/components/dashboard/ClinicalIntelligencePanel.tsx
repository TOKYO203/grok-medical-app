
import ClinicalStatsCard from "./ClinicalStatsCard";
import AchievementCard from "./AchievementCard";
import LearningStreakCard from "./LearningStreakCard";
import RecommendationCard from "./RecommendationCard";


export default function ClinicalIntelligencePanel(){

return (

<section className="grid md:grid-cols-2 gap-5">

<ClinicalStatsCard/>

<AchievementCard/>

<LearningStreakCard/>

<RecommendationCard/>

</section>

)

}

