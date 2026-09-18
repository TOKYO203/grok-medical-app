

export type TimelineEvent={

title:string

date:string

}


export function createTimelineEvent(
title:string
){

return {

title,

date:
new Date().toISOString()

}

}


