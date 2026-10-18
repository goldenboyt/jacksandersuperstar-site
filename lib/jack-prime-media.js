export const maxPhotoBytes=2100000;

export function photoMediaType(photo){
  if(!(photo instanceof Uint8Array)||photo.length<16||photo.length>maxPhotoBytes)return null;
  if([137,80,78,71,13,10,26,10].every((byte,index)=>photo[index]===byte))return 'image/png';
  if(photo[0]===255&&photo[1]===216&&photo[2]===255)return 'image/jpeg';
  if(Buffer.from(photo.subarray(0,4)).toString()==='RIFF'&&Buffer.from(photo.subarray(8,12)).toString()==='WEBP')return 'image/webp';
  return null;
}

export async function uploadedPhoto(value){
  if(!value)return null;
  if(typeof value.arrayBuffer!=='function'||value.size>maxPhotoBytes)throw new Error('Use a JPEG, PNG, or WebP image under 2.1 MB.');
  const photo=new Uint8Array(await value.arrayBuffer());
  if(!photoMediaType(photo))throw new Error('Choose a JPEG, PNG, or WebP image.');
  return photo;
}

export function withPhoto(messages,photo){
  if(!photo)return messages;
  const last=messages.at(-1);
  return [...messages.slice(0,-1),{role:'user',content:[{type:'text',text:last.content},{type:'file',mediaType:photoMediaType(photo),data:photo}]}];
}
