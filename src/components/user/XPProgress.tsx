

export default function XPProgress(
{
xp
}:{xp:number}
){

const percent =
Math.min(
(xp/2000)*100,
100
);


return (

<div>

<p>
Progression clinique
</p>

<div className="h-3 bg-gray-200 rounded">

<div
className="h-3 rounded"
style={{
width:`${percent}%`
}}
/>

</div>

</div>

)

}

