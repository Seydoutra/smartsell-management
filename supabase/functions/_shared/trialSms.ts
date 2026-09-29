export function isSingleSms(message:string){
 const basic="@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
 const extended='^{}\\[~]|€';let length=0;
 for(const c of message){if(basic.includes(c))length++;else if(extended.includes(c))length+=2;else return message.length<=70;}
 return length<=160;
}
