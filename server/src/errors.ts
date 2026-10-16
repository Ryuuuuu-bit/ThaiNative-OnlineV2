export class AppError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
export const missing=()=>new AppError(404,'NOT_FOUND','ไม่พบตัวละครนี้');
