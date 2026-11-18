/* Auth: validation + Supabase calls. Returns {ok,error}. Nothing works until supabase.js is configured. */
LL.auth={
 msg:{email:'შეიყვანეთ სწორი ელფოსტა',pass:'პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს',match:'პაროლები არ ემთხვევა',nick:'მეტსახელი 2–20 სიმბოლოა',cfg:'Supabase ჯერ არ არის გამართული (იხილეთ README)',fail:'ოპერაცია ვერ შესრულდა: '},
 validate(v,register){
  if(!/^\S+@\S+\.\S+$/.test(v.email))return this.msg.email;
  if((v.password||'').length<6)return this.msg.pass;
  if(register){if(v.password!==v.confirm)return this.msg.match;if(!v.nickname||v.nickname.trim().length<2||v.nickname.length>20)return this.msg.nick}
  return null},
 async register(v){const e=this.validate(v,true);if(e)return{ok:false,error:e};if(!LL.sb)return{ok:false,error:this.msg.cfg};
  const{error}=await LL.sb.auth.signUp({email:v.email,password:v.password,options:{data:{nickname:v.nickname.trim()}}});
  return error?{ok:false,error:this.msg.fail+error.message}:{ok:true}},
 async login(v){const e=this.validate(v,false);if(e)return{ok:false,error:e};if(!LL.sb)return{ok:false,error:this.msg.cfg};
  const{error}=await LL.sb.auth.signInWithPassword(v);return error?{ok:false,error:this.msg.fail+error.message}:{ok:true}},
 async logout(){if(LL.sb)await LL.sb.auth.signOut()},
 async user(){if(!LL.sb)return null;const{data}=await LL.sb.auth.getUser().catch(()=>({data:{}}));return data&&data.user||null}
};
