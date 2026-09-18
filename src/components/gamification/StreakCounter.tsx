export default function StreakCounter(
{
days=0
}
){

return (

<div className="border rounded-xl p-4">

🔥 Série actuelle :

<b>
{days} jours
</b>

</div>

)

}
