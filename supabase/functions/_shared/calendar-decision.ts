/** Compare instants rather than timezone formatting. */
export function remoteChanged(baseline:{title?:string;start?:string},remote:{summary?:string;start?:{dateTime?:string}}){
 return baseline.title!==remote.summary || !baseline.start || !remote.start?.dateTime || new Date(baseline.start).getTime()!==new Date(remote.start.dateTime).getTime();
}
