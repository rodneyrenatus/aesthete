// SkSL runtime effects for the Aesthete look engine.
// Coordinates are output pixels, y pointing down. Pass A handles geometry and
// neighbourhood effects; pass B handles tone, colour and film effects and
// samples pass A as its child shader.

const COMMON = `
float luma(float3 c){return dot(c,float3(0.2126,0.7152,0.0722));}
float hash(float2 p){p=fract(p*float2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(float2 p){float2 i=floor(p);float2 f=fract(p);f=f*f*(3.0-2.0*f);
  float a=hash(i);float b=hash(i+float2(1.0,0.0));float c=hash(i+float2(0.0,1.0));float d=hash(i+float2(1.0,1.0));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float fbm(float2 p){float v=0.0;float a=0.5;for(int i=0;i<4;i++){v+=a*vnoise(p);p*=2.03;a*=0.5;}return v;}
`;

export const PASS_A = `
uniform shader image;
uniform float2 uOut;
uniform float2 uSrc;
uniform float2 uFrame;
uniform float4 uCrop;
uniform float uRot;
uniform float uFlip;
uniform float uAngle;
uniform float uScale;
uniform float uNR;
uniform float uSharp;
uniform float uDef;
uniform float uMotion;
uniform float uMotionAngle;
uniform float uCA;
uniform float uHal;
${COMMON}
float2 mapUV(float2 uv){
  float2 f=uCrop.xy+uv*uCrop.zw;
  float2 P=(f-0.5)*uFrame;float c=cos(uAngle);float s=sin(uAngle);
  float2 Q=float2(c*P.x+s*P.y,-s*P.x+c*P.y)/uScale;
  float2 q=Q/uFrame+0.5;
  if(uFlip>0.5){q.x=1.0-q.x;}
  float2 sp=q;
  if(uRot>0.5&&uRot<1.5){sp=float2(q.y,1.0-q.x);}
  else if(uRot>1.5&&uRot<2.5){sp=float2(1.0-q.x,1.0-q.y);}
  else if(uRot>2.5){sp=float2(1.0-q.y,q.x);}
  return clamp(sp,0.0,1.0)*uSrc;
}
float3 tap(float2 uv){return image.eval(mapUV(uv)).rgb;}
half4 main(float2 xy){
  float2 uv=xy/uOut;float2 px=1.0/uOut;float mn=min(uOut.x,uOut.y);float2 unit=float2(mn/uOut.x,mn/uOut.y);
  float3 c=float3(0.0);
  if(uMotion>0.001){
    float2 dir=float2(cos(uMotionAngle),-sin(uMotionAngle))*unit*uMotion*0.07;
    for(int i=0;i<15;i++){float t=float(i)/14.0-0.5;c+=tap(uv+dir*t);}
    c/=15.0;
  } else { c=tap(uv); }
  if(uCA>0.001){float2 d=(uv-0.5)*uCA*0.014;c.r=tap(uv+d).r;c.b=tap(uv-d).b;}
  if(uNR>0.001){
    float3 sum=c;float ws=1.0;float r=1.0+uNR*1.6;
    for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){
      if(x!=0||y!=0){
        float3 s=tap(uv+float2(float(x),float(y))*px*r);float3 d=s-c;
        float w=exp(-dot(d,d)*30.0)*((x==0||y==0)?1.0:0.7);sum+=s*w;ws+=w;}
    }}
    c=mix(c,sum/ws,clamp(uNR*1.2,0.0,1.0));
  }
  if(uSharp>0.001){
    float3 b=(tap(uv+float2(px.x,0.0))+tap(uv-float2(px.x,0.0))+tap(uv+float2(0.0,px.y))+tap(uv-float2(0.0,px.y)))*0.25;
    c+=(c-b)*uSharp*2.2;
  }
  if(abs(uDef)>0.001){
    float2 r=unit*0.012;float L=0.0;
    for(int i=0;i<8;i++){float a=float(i)*0.785398;L+=luma(tap(uv+float2(cos(a),sin(a))*r));}
    L/=8.0;c+=(luma(c)-L)*uDef*0.9;
  }
  if(uHal>0.001){
    float2 r=unit*0.009;float g=0.0;
    for(int i=0;i<8;i++){float a=float(i)*0.785398+0.39;g+=max(luma(tap(uv+float2(cos(a),sin(a))*r))-0.68,0.0);}
    g/=8.0;c+=float3(1.0,0.3,0.12)*g*uHal*3.0;
  }
  return half4(half3(clamp(c,0.0,1.0)),1.0);
}`;

export const PASS_B = `
uniform shader photo;
uniform float2 uOut;
uniform float uExp;
uniform float uBril;
uniform float uHi;
uniform float uSh;
uniform float uCon;
uniform float uBri;
uniform float uBlk;
uniform float uSat;
uniform float uVib;
uniform float uWarm;
uniform float uTint;
uniform float uVig;
uniform float uFade;
uniform float uShoulder;
uniform float3 uHueA;
uniform float3 uHueB;
uniform float3 uSatA;
uniform float3 uSatB;
uniform float3 uLumA;
uniform float3 uLumB;
uniform float3 uSplitS;
uniform float uSplitSA;
uniform float3 uSplitH;
uniform float uSplitHA;
uniform float uMono;
uniform float3 uMonoMix;
uniform float3 uTone;
uniform float uLeak;
uniform float uLeakAmt;
uniform float uLeakShift;
uniform float uGrain;
uniform float uGrainSize;
uniform float uGrainChroma;
uniform float uGrainRough;
uniform float uTexT;
uniform float uTexAmt;
uniform float uDith;
uniform float uDithMix;
uniform float uDithLevels;
uniform float uDithScale;
${COMMON}
float3 rgb2hsv(float3 c){float4 K=float4(0.0,-1.0/3.0,2.0/3.0,-1.0);
  float4 p=mix(float4(c.bg,K.wz),float4(c.gb,K.xy),step(c.b,c.g));
  float4 q=mix(float4(p.xyw,c.r),float4(c.r,p.yzx),step(p.x,c.r));
  float d=q.x-min(q.w,q.y);float e=1.0e-6;
  return float3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x);}
float3 hsv2rgb(float3 c){float4 K=float4(1.0,2.0/3.0,1.0/3.0,3.0);float3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);
  return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y);}
float bw(float h,float ctr){float d=abs(fract(h-ctr+0.5)-0.5);return max(0.0,1.0-d*6.0);}
float bayer2(float2 a){a=floor(a);return fract(dot(a,float2(0.5,a.y*0.75)));}
float bayer4(float2 a){return bayer2(0.5*a)*0.25+bayer2(a);}
float bayer8(float2 a){return bayer4(0.5*a)*0.25+bayer2(a);}
float3 leakCol(float2 uv,float t,float sh,float asp){
  float2 p=float2(uv.x*asp,uv.y);float3 col=float3(0.0);float x=uv.x;
  if(t<1.5){float g=exp(-pow((1.0-x)*3.2-sh*0.8,2.0)*1.3);g*=0.6+0.4*sin(uv.y*4.0+sh*3.0+1.0);
    col=float3(1.0,0.32,0.08)*g+float3(1.0,0.78,0.38)*g*g*0.8;}
  else if(t<2.5){float2 o=float2(asp*(0.66+sh*0.25),0.16);float2 dir=normalize(float2(-0.5,1.0));float2 nr=float2(dir.y,-dir.x);
    float2 d=p-o;float al=dot(d,dir);float ac=dot(d,nr);float w=0.04;
    float m=(1.0-smoothstep(0.55,1.0,abs(ac)/w))*exp(-al*al*14.0);
    col=hsv2rgb(float3(clamp(ac/w*0.5+0.5,0.0,1.0)*0.82,0.9,1.0))*m;
    col+=float3(1.0,0.9,0.8)*exp(-dot(d,d)*60.0)*0.25;}
  else if(t<3.5){float d=distance(p,float2(-0.05+sh*0.35,1.05));float g=exp(-d*d*3.2);
    col=mix(float3(1.0,0.16,0.32),float3(1.0,0.66,0.2),g)*g*1.25;}
  else if(t<4.5){float g=smoothstep(0.35,1.08,uv.y+sin(p.x*2.2+sh*4.0)*0.08);col=float3(1.0,0.86,0.62)*g*0.75;}
  else if(t<5.5){float g=exp(-pow(x*3.4-sh*0.8,2.0)*1.4);col=float3(0.18,0.52,1.0)*g+float3(0.85,0.3,1.0)*g*g*0.55;}
  else {float gl=exp(-pow(x*4.2,2.0));float gr=exp(-pow((1.0-x)*4.2,2.0));
    col=float3(1.0,0.16,0.08)*gl*(0.7+0.3*sin(uv.y*5.0+sh*4.0))+float3(1.0,0.7,0.2)*gr*(0.6+0.4*sin(uv.y*6.0+sh*5.0+2.0));}
  return col;
}
float3 filmTexture(float3 c,float2 uv,float asp,float t,float amt){
  float2 p=float2(uv.x*asp,uv.y);
  bool dust=(t>0.5&&t<1.5)||t>4.5;bool scr=(t>1.5&&t<2.5)||t>4.5;bool pap=(t>2.5&&t<3.5)||t>4.5;bool can=(t>3.5&&t<4.5);
  if(dust){float dd=0.0;
    for(int k=0;k<2;k++){float sc=k==0?55.0:130.0;float2 g=p*sc;float2 id=floor(g);float2 f=fract(g);float r=hash(id+float(k)*17.0);
      if(r>0.94){float2 ctr=float2(0.2,0.2)+0.6*float2(hash(id+3.1),hash(id+7.7));float rad=0.07+0.22*hash(id+1.3);
        float s=1.0-smoothstep(rad*0.5,rad,length(f-ctr));dd+=s*(hash(id+9.0)>0.45?1.0:-0.7);}}
    c+=dd*0.4*amt;}
  if(scr){float g=p.x*70.0;float id=floor(g);float r=hash(float2(id,3.0));
    if(r>0.9){float xx=fract(g)-0.5+(vnoise(float2(id,uv.y*3.0))-0.5)*0.5;float ln=1.0-smoothstep(0.0,0.05,abs(xx));
      ln*=smoothstep(0.25,0.65,vnoise(float2(id*3.0,uv.y*5.0)));c+=ln*0.3*amt*(r>0.955?1.0:-0.8);}}
  if(pap){float m=fbm(p*5.0);float fib=vnoise(float2(p.x*420.0,p.y*40.0));
    c*=1.0-(m-0.5)*0.35*amt;c=mix(c,c*float3(1.03,1.0,0.92)+0.035,amt*0.55);c+=(fib-0.5)*0.05*amt;}
  if(can){float s=sin(p.x*1100.0)*0.5+0.5;float tt=sin(p.y*1100.0)*0.5+0.5;
    c*=1.0-((s*tt)*0.22+(1.0-s)*(1.0-tt)*0.08)*amt;c*=1.0-(fbm(p*4.0)-0.5)*0.2*amt;}
  if(t>4.5){float e=length((uv-0.5)*float2(1.0,1.15));c*=1.0-smoothstep(0.45,0.85,e+(fbm(p*3.0)-0.5)*0.25)*0.45*amt;}
  return c;
}
half4 main(float2 xy){
  float2 uvd=xy/uOut;
  float2 uv=float2(uvd.x,1.0-uvd.y);
  float asp=uOut.x/uOut.y;
  float2 cells=float2(asp,1.0)*(600.0/uDithScale);
  float2 dp=floor(uvd*cells);
  float2 sxy=xy;
  if(uDith>0.5&&uDith<4.5&&uDithMix>0.0&&uDithScale>1.01){sxy=(dp+0.5)/cells*uOut;}
  float3 c=photo.eval(sxy).rgb;
  float3 lin=pow(max(c,0.0),float3(2.2));
  lin*=exp2(uExp*2.0);
  lin*=float3(1.0+uWarm*0.22+uTint*0.04,1.0-uTint*0.14,1.0-uWarm*0.22+uTint*0.04);
  c=pow(max(lin,0.0),float3(1.0/2.2));
  c=mix(c,0.82+0.18*(1.0-exp(-(c-0.82)/0.18)),step(0.82,c));
  float L=luma(c);
  float sh=uSh+uBril*0.6;float hi=uHi-uBril*0.5;
  float sm=1.0-smoothstep(0.0,0.55,L);float hm=smoothstep(0.42,1.0,L);
  float nL=clamp(L+sh*0.32*sm+hi*0.3*hm,0.0,1.2);
  float dl=nL-L;c=mix(c+dl,c*(nL/max(L,0.02)),0.5);
  c=pow(max(c,0.0),float3(1.0/(1.0+uBri*0.45)));
  float k=uCon*0.55+uBril*0.08;c=(c-0.5)*(1.0+k)+0.5;
  float bp=uBlk*0.12;c=(c-bp)/(1.0-bp);
  c=clamp(c,0.0,1.0);
  float3 hsv=rgb2hsv(c);
  float3 wa=float3(bw(hsv.x,0.0),bw(hsv.x,1.0/6.0),bw(hsv.x,2.0/6.0));
  float3 wb=float3(bw(hsv.x,3.0/6.0),bw(hsv.x,4.0/6.0),bw(hsv.x,5.0/6.0));
  float hs=dot(wa,uHueA)+dot(wb,uHueB);float ss=dot(wa,uSatA)+dot(wb,uSatB);float ls=dot(wa,uLumA)+dot(wb,uLumB);
  hsv.x=fract(hsv.x+hs/12.0);hsv.y=clamp(hsv.y*(1.0+ss),0.0,1.0);hsv.z=clamp(hsv.z*(1.0+ls*0.35*hsv.y),0.0,1.0);
  c=hsv2rgb(hsv);
  L=luma(c);
  c+=(uSplitS-float3(luma(uSplitS)))*uSplitSA*0.35*(1.0-smoothstep(0.0,0.6,L));
  c+=(uSplitH-float3(luma(uSplitH)))*uSplitHA*0.35*smoothstep(0.4,1.0,L);
  L=luma(c);c=mix(float3(L),c,1.0+uSat);
  float cs=max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b));
  c=mix(float3(L),c,1.0+uVib*(1.0-clamp(cs,0.0,1.0))*1.2);
  c=mix(float3(uFade*0.18),float3(1.0-uShoulder*0.16),clamp(c,0.0,1.0));
  float m=dot(c,uMonoMix);c=mix(c,clamp(float3(m)*uTone,0.0,1.0),uMono);
  if(uLeak>0.5&&uLeakAmt>0.0){float3 lk=clamp(leakCol(uv,uLeak,uLeakShift,asp)*uLeakAmt,0.0,1.0);c=1.0-(1.0-c)*(1.0-lk);}
  if(abs(uVig)>0.001){float dv=length((uv-0.5)*2.0)/1.4142;float f=smoothstep(0.25,1.1,dv);
    if(uVig>0.0){c*=1.0-f*uVig*0.85;}else{c=mix(c,float3(1.0),f*(-uVig)*0.7);}}
  if(uTexT>0.5&&uTexAmt>0.0){c=filmTexture(c,uv,asp,uTexT,uTexAmt);}
  if(uGrain>0.001){
    float2 gp=float2(uv.x*asp,uv.y)*(1100.0/uGrainSize);
    float n=vnoise(gp+3.7);if(uGrainRough>0.5){n=mix(n,vnoise(gp*0.42+11.3),0.5);}
    float3 nn=float3(n-0.5);
    if(uGrainChroma>0.0){nn=mix(nn,float3(vnoise(gp+31.7),vnoise(gp+57.1),vnoise(gp+93.3))-0.5,uGrainChroma);}
    L=luma(c);float gm=1.0-pow(abs(L-0.5)*2.0,2.0)*0.65;
    c+=nn*uGrain*0.55*gm;
  }
  if(uDith>0.5&&uDithMix>0.0){
    float3 q=c;float nlev=max(uDithLevels-1.0,1.0);
    if(uDith<4.5){
      float th=uDith<1.5?bayer2(dp):(uDith<2.5?bayer4(dp):(uDith<3.5?bayer8(dp):hash(dp*0.731+0.17)));
      q=floor(clamp(c,0.0,1.0)*nlev+th)/nlev;
    } else if(uDith<5.5){
      float L2=luma(c);float an=0.7854;
      float2 g0=uvd*cells*0.5;float2 g=float2(cos(an)*g0.x-sin(an)*g0.y,sin(an)*g0.x+cos(an)*g0.y);
      float2 f=fract(g)-0.5;float rad=sqrt(clamp(1.0-L2,0.0,1.0))*0.72;
      float ink=1.0-smoothstep(rad-0.06,rad+0.06,length(f));
      q=mix(float3(0.95,0.93,0.88),c*0.35,ink);
    } else {
      float L2=luma(c);float b=step(bayer4(dp),L2);q=mix(float3(0.07,0.07,0.08),float3(0.95,0.93,0.88),b);
    }
    c=mix(c,q,uDithMix);
  }
  return half4(half3(clamp(c,0.0,1.0)),1.0);
}`;
