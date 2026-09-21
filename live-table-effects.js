// Aestra Live Table scene rendering primitives.
// Kept separate from GM/application state so animation work can evolve independently.

export function drawImageCover(ctx,img,dx,dy,dw,dh){
  const iw=img?.naturalWidth||img?.width||0;
  const ih=img?.naturalHeight||img?.height||0;
  if(!iw||!ih||!dw||!dh)return;
  const scale=Math.max(dw/iw,dh/ih);
  const sw=dw/scale;
  const sh=dh/scale;
  const sx=(iw-sw)/2;
  const sy=(ih-sh)/2;
  ctx.drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh);
}

class SceneShaderRenderer{
  constructor(canvas,host){
    this.canvas=canvas;
    this.host=host;
    this.gl=null;
    this.program=null;
    this.buffer=null;
    this.texture=null;
    this.textureReady=false;
    this.available=false;
    this.imageWidth=0;
    this.imageHeight=0;
    this.width=0;
    this.height=0;
    this.lastQuality=1;
    this.uniforms={};
    this.init();
  }

  compile(type,source){
    const gl=this.gl;
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
      console.warn('Scene shader compile failed',gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  init(){
    if(!this.canvas)return;
    const gl=this.canvas.getContext('webgl',{
      alpha:true,
      antialias:false,
      premultipliedAlpha:false,
      preserveDrawingBuffer:false,
      powerPreference:'high-performance'
    });
    if(!gl)return;
    this.gl=gl;

    const vertexSource=[
      'attribute vec2 a_position;',
      'varying vec2 v_uv;',
      'void main(){',
      '  v_uv=a_position*0.5+0.5;',
      '  gl_Position=vec4(a_position,0.0,1.0);',
      '}'
    ].join('\n');

    const fragmentSource=[
      'precision mediump float;',
      'varying vec2 v_uv;',
      'uniform sampler2D u_tex;',
      'uniform float u_time;',
      'uniform vec2 u_crop;',
      'uniform vec4 u_fx;',
      'uniform vec4 u_fx2;',
      'uniform float u_intensity;',
      'vec2 coverUv(vec2 uv){return (uv-0.5)*u_crop+0.5;}',
      'float resonanceRing(vec2 uv,vec2 center,float phase){',
      '  float d=distance(uv,center);',
      '  float travel=fract(u_time*0.082+phase);',
      '  return exp(-abs(d-travel*0.43)*92.0)*(1.0-travel);',
      '}',
      'void main(){',
      '  float heat=u_fx.x;',
      '  float dream=u_fx.y;',
      '  float crystal=u_fx.z;',
      '  float relic=u_fx.w;',
      '  float underwater=u_fx2.x;',
      '  float clouds=u_fx2.y;',
      '  float moon=u_fx2.z;',
      '  vec2 uv=v_uv;',
      '  vec2 displacement=vec2(0.0);',
      '  float lower=smoothstep(0.18,1.0,1.0-uv.y);',
      '  float heatWave=sin(uv.y*88.0+u_time*2.15)+0.56*sin(uv.y*47.0-u_time*1.37)+0.28*sin(uv.y*151.0+u_time*0.91);',
      '  displacement.x+=heat*lower*heatWave*(0.0015+0.0037*u_intensity);',
      '  displacement.y+=heat*lower*sin(uv.x*34.0+u_time*1.68)*(0.00045+0.00105*u_intensity);',
      '  vec2 dreamWave=vec2(sin(uv.y*31.0+u_time*0.73)+0.45*sin(uv.y*69.0-u_time*1.04),sin(uv.x*24.0-u_time*0.51)+0.32*sin((uv.x+uv.y)*51.0+u_time*0.61));',
      '  displacement+=dream*dreamWave*(0.00075+0.00175*u_intensity);',
      '  float ringA=resonanceRing(uv,vec2(0.24,0.41),0.04);',
      '  float ringB=resonanceRing(uv,vec2(0.53,0.58),0.41);',
      '  float ringC=resonanceRing(uv,vec2(0.78,0.36),0.73);',
      '  vec2 dirA=normalize(uv-vec2(0.24,0.41)+vec2(0.0001));',
      '  vec2 dirB=normalize(uv-vec2(0.53,0.58)+vec2(0.0001));',
      '  vec2 dirC=normalize(uv-vec2(0.78,0.36)+vec2(0.0001));',
      '  displacement+=crystal*(dirA*ringA+dirB*ringB+dirC*ringC)*(0.0012+0.0022*u_intensity);',
      '  float relicPulse=pow(max(0.0,sin(u_time*1.31+0.8)),20.0)*relic;',
      '  float relicNoise=sin(uv.y*137.0+u_time*7.3)+0.6*sin((uv.x+uv.y)*91.0-u_time*5.1);',
      '  displacement.x+=relicPulse*relicNoise*(0.0008+0.0028*u_intensity);',
      '  displacement.y+=relicPulse*sin(uv.x*119.0-u_time*6.2)*(0.0004+0.0014*u_intensity);',
      '  float waterWaveA=sin(uv.y*42.0+u_time*1.15)+0.55*sin(uv.y*91.0-u_time*0.74);',
      '  float waterWaveB=sin(uv.x*37.0-u_time*0.82)+0.45*sin((uv.x+uv.y)*58.0+u_time*0.63);',
      '  displacement+=underwater*vec2(waterWaveA,waterWaveB)*(0.00075+0.00175*u_intensity);',
      '  vec2 texUv=clamp(coverUv(uv+displacement),vec2(0.001),vec2(0.999));',
      '  vec2 radial=normalize(uv-0.5+vec2(0.0001));',
      '  float chroma=(dream*0.00115+relicPulse*0.0036)*(0.45+u_intensity);',
      '  vec2 chromaShift=radial*chroma*u_crop;',
      '  vec3 color;',
      '  color.r=texture2D(u_tex,clamp(texUv+chromaShift,vec2(0.001),vec2(0.999))).r;',
      '  color.g=texture2D(u_tex,texUv).g;',
      '  color.b=texture2D(u_tex,clamp(texUv-chromaShift,vec2(0.001),vec2(0.999))).b;',
      '  float dreamBreath=0.5+0.5*sin(u_time*0.58);',
      '  float vignette=smoothstep(0.22,0.76,distance(uv,vec2(0.5)));',
      '  color+=dream*vec3(0.020,0.010,0.036)*vignette*dreamBreath*u_intensity;',
      '  color+=heat*vec3(0.024,0.008,-0.004)*lower*u_intensity;',
      '  float crystalGlow=(ringA+ringB+ringC)*crystal;',
      '  color+=vec3(0.020,0.065,0.085)*crystalGlow*u_intensity;',
      '  color+=vec3(0.055,0.090,0.105)*relicPulse*u_intensity;',
      '  float waterCaustic=max(0.0,sin((uv.x+uv.y)*48.0+u_time*1.35)*sin((uv.x-uv.y)*39.0-u_time*1.08));',
      '  waterCaustic=waterCaustic*waterCaustic;',
      '  color=mix(color,color*vec3(0.72,0.90,0.96)+vec3(0.00,0.025,0.042),underwater*(0.30+0.18*u_intensity));',
      '  color+=underwater*waterCaustic*vec3(0.025,0.070,0.075)*(0.45+u_intensity);',
      '  float cloudField=sin(uv.x*7.2+u_time*0.085)+sin(uv.y*5.1-u_time*0.061)+0.72*sin((uv.x+uv.y)*8.7+u_time*0.043);',
      '  float cloudMask=smoothstep(0.32,1.42,cloudField);',
      '  color*=1.0-clouds*cloudMask*(0.055+0.105*u_intensity);',
      '  float moonPulse=0.60+0.22*sin(u_time*0.23)+0.18*sin(u_time*0.071+1.8);',
      '  float moonPool=1.0-smoothstep(0.12,0.82,distance(uv,vec2(0.56,0.28)));',
      '  color+=moon*vec3(0.028,0.052,0.085)*moonPulse*(0.45+0.55*moonPool)*(0.55+u_intensity);',
      '  gl_FragColor=vec4(color,1.0);',
      '}'
    ].join('\n');

    const vs=this.compile(gl.VERTEX_SHADER,vertexSource);
    const fs=this.compile(gl.FRAGMENT_SHADER,fragmentSource);
    if(!vs||!fs)return;

    const program=gl.createProgram();
    gl.attachShader(program,vs);
    gl.attachShader(program,fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
      console.warn('Scene shader link failed',gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return;
    }

    this.program=program;
    this.buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);

    this.texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);

    this.position=gl.getAttribLocation(program,'a_position');
    this.uniforms={
      tex:gl.getUniformLocation(program,'u_tex'),
      time:gl.getUniformLocation(program,'u_time'),
      crop:gl.getUniformLocation(program,'u_crop'),
      fx:gl.getUniformLocation(program,'u_fx'),
      fx2:gl.getUniformLocation(program,'u_fx2'),
      intensity:gl.getUniformLocation(program,'u_intensity')
    };

    gl.clearColor(0,0,0,0);
    this.available=true;
    this.resize(1);
    this.clear();

    this.canvas.addEventListener('webglcontextlost',event=>{
      event.preventDefault();
      this.available=false;
      this.textureReady=false;
      this.canvas.classList.remove('active');
    });
  }

  resize(quality=1){
    if(!this.canvas||!this.host)return;
    const rect=this.host.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    this.width=rect.width;
    this.height=rect.height;
    this.lastQuality=quality;

    const maxPixels=2073600*Math.max(.58,quality);
    const pixelScale=Math.min(
      window.devicePixelRatio||1,
      1,
      Math.sqrt(maxPixels/Math.max(1,this.width*this.height))
    );
    const w=Math.max(1,Math.round(this.width*pixelScale));
    const h=Math.max(1,Math.round(this.height*pixelScale));
    if(this.canvas.width!==w||this.canvas.height!==h){
      this.canvas.width=w;
      this.canvas.height=h;
      this.canvas.style.width=this.width+'px';
      this.canvas.style.height=this.height+'px';
    }
  }

  setBackdropImage(img){
    if(!this.available||!this.gl||!this.texture||!img?.naturalWidth)return;
    const gl=this.gl;
    try{
      gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
      this.imageWidth=img.naturalWidth;
      this.imageHeight=img.naturalHeight;
      this.textureReady=true;
    }catch(err){
      console.warn('Scene shader texture unavailable; using 2D fallback',err);
      this.textureReady=false;
      this.clear();
    }
  }

  clear(){
    if(this.gl&&this.available){
      this.gl.viewport(0,0,this.canvas.width||1,this.canvas.height||1);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
    this.canvas?.classList.remove('active');
  }

  render(now,effects,intensity){
    const heat=effects.has('heat')?1:0;
    const dream=effects.has('dream')?1:0;
    const crystal=effects.has('crystal')?1:0;
    const relic=effects.has('relic')?1:0;
    const underwater=effects.has('underwater')?1:0;
    const clouds=effects.has('clouds')?1:0;
    const moon=effects.has('moon')?1:0;
    if(!(heat||dream||crystal||relic||underwater||clouds||moon)){
      this.clear();
      return false;
    }
    if(!this.available||!this.textureReady||!this.gl||!this.program)return false;

    this.resize(this.lastQuality);
    const gl=this.gl;
    const viewAspect=this.width/Math.max(1,this.height);
    const imageAspect=this.imageWidth/Math.max(1,this.imageHeight);
    let cropX=1,cropY=1;
    if(viewAspect>imageAspect)cropY=imageAspect/viewAspect;
    else cropX=viewAspect/imageAspect;

    gl.viewport(0,0,this.canvas.width,this.canvas.height);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.uniform1i(this.uniforms.tex,0);
    gl.uniform1f(this.uniforms.time,now/1000);
    gl.uniform2f(this.uniforms.crop,cropX,cropY);
    gl.uniform4f(this.uniforms.fx,heat,dream,crystal,relic);
    gl.uniform4f(this.uniforms.fx2,underwater,clouds,moon,0);
    gl.uniform1f(this.uniforms.intensity,Math.max(.12,Math.min(1.35,[0,.18,.38,.65,.95,1.35][Number(intensity||2)]||.38)));
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    this.canvas.classList.add('active');
    return true;
  }
}

export class SceneAtmosphereRenderer{
  constructor(canvas,host,shaderCanvas){
    this.canvas=canvas;
    this.host=host;
    this.ctx=canvas?.getContext('2d',{alpha:true,desynchronized:true})||null;
    this.shader=new SceneShaderRenderer(shaderCanvas,host);
    this.cfg={effects:[],intensity:2,fade_ms:900};
    this.particles=new Map();
    this.running=false;
    this.raf=0;
    this.last=0;
    this.width=0;
    this.height=0;
    this.pixelRatio=1;
    this.quality=1;
    this.frameSamples=[];
    this.recoverFrames=0;
    this.lightningAt=0;
    this.flash=0;
    this.relicAt=0;
    this.relicPulse=0;
    this.relicArcs=[];
    this.backdropSrc='';
    this.backdropReady=false;
    this.backdropImg=new Image();
    this.backdropImg.crossOrigin='anonymous';
    this.backdropImg.onload=()=>{
      this.backdropReady=true;
      this.refreshHeatBuffer();
      this.shader?.setBackdropImage(this.backdropImg);
    };
    this.backdropImg.onerror=()=>{
      this.backdropReady=false;
      this.clearHeatBuffer();
    };
    this.heatBuffer=document.createElement('canvas');
    this.heatCtx=this.heatBuffer.getContext('2d',{alpha:true});
    this.prefersReduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    if(this.host)this.resizeObserver.observe(this.host);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)this.stop();
      else if(this.cfg.effects.length)this.start();
    });
    this.resize();
  }

  resize(){
    if(!this.canvas||!this.host)return;
    const rect=this.host.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    this.width=rect.width;
    this.height=rect.height;
    const dpr=Math.min(window.devicePixelRatio||1,1.35);
    const qualityScale=this.quality>=.95?1:this.quality>=.68?.82:.66;
    this.pixelRatio=dpr*qualityScale;
    const w=Math.max(1,Math.round(this.width*this.pixelRatio));
    const h=Math.max(1,Math.round(this.height*this.pixelRatio));
    if(this.canvas.width!==w||this.canvas.height!==h){
      this.canvas.width=w;
      this.canvas.height=h;
      this.canvas.style.width=this.width+'px';
      this.canvas.style.height=this.height+'px';
    }
    this.shader?.resize(this.quality);
    if(this.heatBuffer&&(this.heatBuffer.width!==w||this.heatBuffer.height!==h)){
      this.heatBuffer.width=w;
      this.heatBuffer.height=h;
      this.refreshHeatBuffer();
    }
  }

  setBackdropSource(src){
    const next=src||'';
    if(next===this.backdropSrc)return;
    this.backdropSrc=next;
    this.backdropReady=false;
    this.shader?.clear();
    if(!next){
      this.backdropImg.removeAttribute('src');
      this.clearHeatBuffer();
      return;
    }
    this.backdropImg.src=next;
  }

  clearHeatBuffer(){
    if(!this.heatCtx||!this.heatBuffer)return;
    this.heatCtx.setTransform(1,0,0,1,0,0);
    this.heatCtx.clearRect(0,0,this.heatBuffer.width,this.heatBuffer.height);
  }

  refreshHeatBuffer(){
    if(!this.heatCtx||!this.heatBuffer)return;
    this.clearHeatBuffer();
    if(!this.backdropReady||!this.backdropImg?.naturalWidth)return;
    drawImageCover(
      this.heatCtx,
      this.backdropImg,
      0,
      0,
      this.heatBuffer.width,
      this.heatBuffer.height
    );
  }

  setConfig(cfg){
    this.cfg={
      effects:Array.isArray(cfg?.effects)?cfg.effects.slice():[],
      intensity:[1,2,3,4,5].includes(Number(cfg?.intensity))?Number(cfg.intensity):2,
      fade_ms:Number(cfg?.fade_ms)||900
    };
    this.syncParticles();
    if(this.cfg.effects.length&&!document.hidden&&!this.prefersReduced)this.start();
    else{
      this.stop();
      this.drawStatic();
    }
  }

  targetCount(type){
    const intensity=[0,.45,.85,1.35,2.05,3.0][this.cfg.intensity]||.85;
    const base={
      rain:190,
      snow:120,
      ash:95,
      wind:40,
      mist:16,
      magic:42,
      spores:34,
      petals:26,
      fireflies:10,
      blackpetals:20,
      rainglass:18
    }[type]||0;
    const stormBoost=type==='rain'&&this.cfg.effects.includes('storm')?1.7:1;
    return Math.round(base*intensity*stormBoost*this.quality);
  }

  syncParticles(){
    const active=new Set(this.cfg.effects);
    if(active.has('storm'))active.add('rain');
    const particleTypes=['rain','snow','ash','wind','mist','magic','spores','petals','fireflies','blackpetals','rainglass'];
    for(const type of particleTypes){
      if(!active.has(type)){
        this.particles.set(type,[]);
        continue;
      }
      const arr=this.particles.get(type)||[];
      const target=this.targetCount(type);
      while(arr.length<target)arr.push(this.makeParticle(type,true));
      if(arr.length>target)arr.length=target;
      this.particles.set(type,arr);
    }
  }

  makeParticle(type,initial=false){
    const w=Math.max(1,this.width),h=Math.max(1,this.height);
    const p={
      type,
      x:Math.random()*w,
      y:initial?Math.random()*h:-20-Math.random()*80,
      z:.35+Math.random()*.65,
      vx:0,
      vy:0,
      size:1,
      phase:Math.random()*Math.PI*2,
      life:Math.random()
    };
    if(type==='rain'){
      p.vx=70+Math.random()*75;
      p.vy=650+Math.random()*720;
      p.size=8+Math.random()*18;
    }else if(type==='snow'){
      p.vx=-18+Math.random()*36;
      p.vy=32+Math.random()*72;
      p.size=1.1+Math.random()*2.4;
    }else if(type==='ash'){
      p.vx=-12+Math.random()*24;
      p.vy=18+Math.random()*48;
      p.size=.7+Math.random()*2;
      p.ember=Math.random()<.07;
    }else if(type==='wind'){
      p.x=initial?Math.random()*w:-60;
      // Wind should always recycle at a visible height. The generic recycled
      // particle Y starts above the canvas, which made streaks disappear after
      // their first pass across the screen.
      p.y=Math.random()*h;
      p.vx=170+Math.random()*280;
      p.vy=-14+Math.random()*28;
      p.size=16+Math.random()*42;
    }else if(type==='mist'){
      p.x=Math.random()*w;
      p.y=h*(.25+Math.random()*.65);
      p.vx=6+Math.random()*16;
      p.vy=-2+Math.random()*4;
      p.size=90+Math.random()*210;
      p.life=.15+Math.random()*.38;
    }else if(type==='magic'){
      p.vx=-9+Math.random()*18;
      p.vy=-15-Math.random()*35;
      p.size=1.4+Math.random()*4.4;
    }else if(type==='spores'){
      p.x=Math.random()*w;
      p.y=initial?Math.random()*h:h+12+Math.random()*30;
      p.vx=-8+Math.random()*16;
      p.vy=-8-Math.random()*24;
      p.size=.8+Math.random()*2.8;
      p.life=Math.random();
    }else if(type==='petals'){
      p.x=initial?Math.random()*w:-24-Math.random()*40;
      p.y=initial?Math.random()*h:-20-Math.random()*60;
      p.vx=18+Math.random()*46;
      p.vy=18+Math.random()*54;
      p.size=3+Math.random()*5.5;
      p.spin=-2.4+Math.random()*4.8;
      p.tone=Math.floor(Math.random()*4);
    }else if(type==='blackpetals'){
      p.x=Math.random()*w;
      p.y=initial?Math.random()*h:h+18+Math.random()*42;
      p.vx=-16+Math.random()*32;
      p.vy=-15-Math.random()*38;
      p.size=3.2+Math.random()*5.4;
      p.spin=-2.8+Math.random()*5.6;
    }else if(type==='fireflies'){
      p.x=Math.random()*w;
      p.y=Math.random()*h;
      p.vx=-10+Math.random()*20;
      p.vy=-8+Math.random()*16;
      p.size=.8+Math.random()*1.7;
      p.turn=Math.random()*Math.PI*2;
    }else if(type==='rainglass'){
      p.x=Math.random()*w;
      p.y=initial?Math.random()*h:-30-Math.random()*h*.3;
      p.vx=-1.5+Math.random()*3;
      p.vy=10+Math.random()*32;
      p.size=4+Math.random()*10;
      p.life=.25+Math.random()*.75;
      p.trail=12+Math.random()*54;
    }
    return p;
  }

  recycle(p){
    const replacement=this.makeParticle(p.type,false);
    Object.assign(p,replacement);
  }

  start(){
    if(this.running||!this.ctx)return;
    this.running=true;
    this.last=performance.now();
    this.raf=requestAnimationFrame(t=>this.frame(t));
  }

  stop(){
    this.running=false;
    if(this.raf)cancelAnimationFrame(this.raf);
    this.raf=0;
    this.last=0;
  }

  frame(now){
    if(!this.running||!this.ctx)return;
    const dt=Math.min(.05,Math.max(.001,(now-this.last)/1000));
    this.last=now;
    this.trackPerformance(dt);
    this.draw(dt,now);
    this.raf=requestAnimationFrame(t=>this.frame(t));
  }

  trackPerformance(dt){
    this.frameSamples.push(dt);
    if(this.frameSamples.length<90)return;
    const avg=this.frameSamples.reduce((a,b)=>a+b,0)/this.frameSamples.length;
    this.frameSamples.length=0;
    if(avg>.027&&this.quality>.5){
      this.quality=this.quality>.8?.72:.5;
      this.recoverFrames=0;
      this.resize();
      this.syncParticles();
    }else if(avg<.019&&this.quality<1){
      this.recoverFrames++;
      if(this.recoverFrames>=3){
        this.quality=this.quality<.7?.72:1;
        this.recoverFrames=0;
        this.resize();
        this.syncParticles();
      }
    }else{
      this.recoverFrames=0;
    }
  }

  clear(){
    if(!this.ctx)return;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.ctx.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);
  }

  drawStatic(){
    this.clear();
    this.shader?.clear();
  }

  draw(dt,now){
    this.clear();
    const ctx=this.ctx;
    const w=this.width,h=this.height;
    const intensity=[0,.22,.42,.66,.84,1][this.cfg.intensity]||.42;
    const effects=new Set(this.cfg.effects);
    if(effects.has('storm'))effects.add('rain');

    const shaderRendered=this.shader?.render(now,effects,this.cfg.intensity)===true;
    if(effects.has('heat')&&!shaderRendered)this.drawHeatHaze(ctx,w,h,now);
    if(effects.has('dream')&&!shaderRendered)this.drawDreamDistortion(ctx,w,h,now);
    if(effects.has('underwater')&&!shaderRendered)this.drawUnderwaterFallback(ctx,w,h,now);
    if(effects.has('clouds')&&!shaderRendered)this.drawCloudShadowsFallback(ctx,w,h,now);
    if(effects.has('moon')&&!shaderRendered)this.drawMoonlightFallback(ctx,w,h,now);
    if(effects.has('rays'))this.drawGodRays(ctx,w,h,now);
    if(effects.has('mist'))this.drawMist(ctx,dt,w,h);
    if(effects.has('wind'))this.drawWind(ctx,dt,w,h);
    if(effects.has('rain'))this.drawRain(ctx,dt,w,h,effects.has('storm'));
    if(effects.has('snow'))this.drawSnow(ctx,dt,w,h);
    if(effects.has('ash'))this.drawAsh(ctx,dt,w,h);
    if(effects.has('spores'))this.drawSpores(ctx,dt,w,h,now);
    if(effects.has('petals'))this.drawPetals(ctx,dt,w,h,now);
    if(effects.has('blackpetals'))this.drawBlackPetals(ctx,dt,w,h,now);
    if(effects.has('fireflies'))this.drawFireflies(ctx,dt,w,h,now);
    if(effects.has('magic'))this.drawMagic(ctx,dt,w,h,now);
    if(effects.has('crystal'))this.drawCrystalResonance(ctx,w,h,now);
    if(effects.has('relic'))this.drawRelicInstability(ctx,w,h,now);
    if(effects.has('rainglass'))this.drawRainOnGlass(ctx,dt,w,h,now);

    if(effects.has('storm'))this.drawLightning(now,intensity);
    else this.setFlash(0);
  }

  drawRain(ctx,dt,w,h,storm){
    const arr=this.particles.get('rain')||[];
    ctx.save();
    ctx.lineCap='round';
    for(const p of arr){
      p.x+=p.vx*p.z*dt;
      p.y+=p.vy*p.z*dt;
      if(p.y>h+50||p.x>w+70)this.recycle(p);
      const alpha=(storm?.48:.34)*p.z;
      ctx.strokeStyle='rgba(205,225,235,'+alpha+')';
      ctx.lineWidth=Math.max(.7,p.z*1.45);
      ctx.beginPath();
      ctx.moveTo(p.x,p.y);
      ctx.lineTo(p.x-p.size*.22,p.y-p.size);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawSnow(ctx,dt,w,h){
    const arr=this.particles.get('snow')||[];
    ctx.save();
    for(const p of arr){
      p.phase+=dt*(.7+p.z);
      p.x+=(p.vx+Math.sin(p.phase)*16)*dt;
      p.y+=p.vy*p.z*dt;
      if(p.y>h+12||p.x<-20||p.x>w+20)this.recycle(p);
      ctx.globalAlpha=.48+.5*p.z;
      ctx.fillStyle='rgba(245,249,250,.92)';
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.size*p.z,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawAsh(ctx,dt,w,h){
    const arr=this.particles.get('ash')||[];
    ctx.save();
    for(const p of arr){
      p.phase+=dt*(.4+p.z);
      p.x+=(p.vx+Math.sin(p.phase)*10)*dt;
      p.y+=p.vy*p.z*dt;
      if(p.y>h+16||p.x<-20||p.x>w+20)this.recycle(p);
      ctx.globalAlpha=.34+.48*p.z;
      ctx.fillStyle=p.ember?'rgba(242,132,58,.88)':'rgba(190,184,170,.72)';
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.size*p.z,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawWind(ctx,dt,w,h){
    const arr=this.particles.get('wind')||[];
    ctx.save();
    ctx.lineCap='round';
    for(const p of arr){
      p.x+=p.vx*p.z*dt;
      p.phase+=dt*(.35+p.z*.35);
      p.y+=p.vy*dt+Math.sin(p.phase+p.x*.01)*3*dt;
      if(p.x>w+80||p.y<-40||p.y>h+40)this.recycle(p);
      ctx.strokeStyle='rgba(226,218,193,'+(.055+.12*p.z)+')';
      ctx.lineWidth=.75+p.z*.9;
      ctx.beginPath();
      ctx.moveTo(p.x,p.y);
      ctx.lineTo(p.x-p.size,p.y+2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMist(ctx,dt,w,h){
    const arr=this.particles.get('mist')||[];
    ctx.save();
    ctx.filter='blur(22px)';
    for(const p of arr){
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
      if(p.x>w+p.size)this.recycle(p);
      const alpha=.03+p.life*.085;
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size);
      g.addColorStop(0,'rgba(224,234,230,'+Math.min(.22,alpha*1.18)+')');
      g.addColorStop(.55,'rgba(211,226,224,'+(alpha*.82)+')');
      g.addColorStop(1,'rgba(211,226,224,0)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.ellipse(p.x,p.y,p.size,p.size*.42,0,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawMagic(ctx,dt,w,h,now){
    const arr=this.particles.get('magic')||[];
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(const p of arr){
      p.phase+=dt*(.8+p.z);
      p.x+=(p.vx+Math.sin(p.phase)*10)*dt;
      p.y+=p.vy*p.z*dt;
      if(p.y<-30||p.x<-30||p.x>w+30)this.recycle(p);
      const pulse=.55+.45*Math.sin(now*.0015+p.phase);
      const r=p.size*(2.5+p.z*2);
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
      g.addColorStop(0,'rgba(153,224,239,'+(.36*pulse)+')');
      g.addColorStop(.45,'rgba(171,115,221,'+(.22*pulse)+')');
      g.addColorStop(1,'rgba(171,115,221,0)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(p.x,p.y,r,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawSpores(ctx,dt,w,h,now){
    const arr=this.particles.get('spores')||[];
    const intensity=this.cfg.intensity||2;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(const p of arr){
      p.phase+=dt*(.35+p.z*.8);
      p.x+=(p.vx+Math.sin(p.phase*1.4)*8)*dt;
      p.y+=p.vy*p.z*dt;
      if(p.y<-24||p.x<-30||p.x>w+30)this.recycle(p);

      const twinkle=.52+.48*Math.sin(now*.0012+p.phase*2.2);
      const halo=p.size*(3.2+p.z*2.6);
      const alpha=(.12+.13*p.z)*twinkle*(.72+intensity*.12);
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,halo);
      g.addColorStop(0,'rgba(239,235,167,'+Math.min(.42,alpha*1.8)+')');
      g.addColorStop(.32,'rgba(176,220,145,'+alpha+')');
      g.addColorStop(1,'rgba(126,193,145,0)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(p.x,p.y,halo,0,Math.PI*2);
      ctx.fill();

      if(p.z>.72){
        ctx.globalAlpha=.28*twinkle;
        ctx.fillStyle='rgba(248,242,194,.95)';
        ctx.beginPath();
        ctx.arc(p.x,p.y,Math.max(.45,p.size*.32),0,Math.PI*2);
        ctx.fill();
        ctx.globalAlpha=1;
      }
    }
    ctx.restore();
  }

  drawPetals(ctx,dt,w,h,now){
    const arr=this.particles.get('petals')||[];
    const palette=['rgba(213,165,82,.72)','rgba(166,96,58,.68)','rgba(236,214,175,.76)','rgba(216,184,198,.70)'];
    ctx.save();
    for(const p of arr){
      p.phase+=dt*(1.1+p.z);
      p.x+=(p.vx+Math.sin(p.phase*1.3)*20)*dt;
      p.y+=(p.vy+Math.cos(p.phase*.7)*5)*dt;
      if(p.y>h+30||p.x>w+40)this.recycle(p);
      const flip=.28+.72*Math.abs(Math.sin(p.phase*1.9));
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.phase+p.spin*now*.00028);
      ctx.scale(1,flip);
      ctx.globalAlpha=.38+.48*p.z;
      ctx.fillStyle=palette[p.tone%palette.length];
      ctx.beginPath();
      ctx.ellipse(0,0,p.size*p.z,p.size*.46*p.z,.18,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle='rgba(83,68,41,.28)';
      ctx.lineWidth=.45;
      ctx.beginPath();
      ctx.moveTo(-p.size*.55,0);
      ctx.lineTo(p.size*.62,0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  drawBlackPetals(ctx,dt,w,h,now){
    const arr=this.particles.get('blackpetals')||[];
    ctx.save();
    for(const p of arr){
      p.phase+=dt*(.7+p.z);
      p.x+=(p.vx+Math.sin(p.phase*1.6)*13)*dt;
      p.y+=p.vy*p.z*dt;
      if(p.y<-30||p.x<-35||p.x>w+35)this.recycle(p);
      const flutter=.22+.78*Math.abs(Math.sin(p.phase*2.1));
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.phase+p.spin*now*.00031);
      ctx.scale(1,flutter);
      ctx.globalAlpha=.40+.46*p.z;
      const g=ctx.createRadialGradient(0,0,0,0,0,p.size*1.2);
      g.addColorStop(0,'rgba(74,48,78,.88)');
      g.addColorStop(.55,'rgba(26,21,30,.94)');
      g.addColorStop(1,'rgba(5,5,7,.75)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.ellipse(0,0,p.size*p.z,p.size*.48*p.z,-.22,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  drawFireflies(ctx,dt,w,h,now){
    const arr=this.particles.get('fireflies')||[];
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(const p of arr){
      p.phase+=dt*(.45+p.z*.55);
      p.turn+=dt*(.22+p.z*.18);
      const steerX=Math.sin(p.turn*1.7+p.phase)*17;
      const steerY=Math.cos(p.turn*1.23-p.phase*.7)*13;
      p.x+=(p.vx+steerX)*dt;
      p.y+=(p.vy+steerY)*dt;
      if(p.x<-30)p.x=w+20;
      if(p.x>w+30)p.x=-20;
      if(p.y<-30)p.y=h+20;
      if(p.y>h+30)p.y=-20;
      const blink=Math.pow(.5+.5*Math.sin(now*.0018*(.7+p.z)+p.phase*2.3),2.2);
      const halo=8+p.size*9;
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,halo);
      g.addColorStop(0,'rgba(255,246,174,'+(.58*blink)+')');
      g.addColorStop(.25,'rgba(212,236,105,'+(.34*blink)+')');
      g.addColorStop(1,'rgba(165,213,85,0)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(p.x,p.y,halo,0,Math.PI*2);
      ctx.fill();
      if(blink>.32){
        ctx.globalAlpha=.45+.5*blink;
        ctx.fillStyle='rgba(255,252,207,.98)';
        ctx.beginPath();
        ctx.arc(p.x,p.y,.65+p.size*.35,0,Math.PI*2);
        ctx.fill();
        ctx.globalAlpha=1;
      }
    }
    ctx.restore();
  }

  drawRainOnGlass(ctx,dt,w,h,now){
    const arr=this.particles.get('rainglass')||[];
    const intensity=this.cfg.intensity||2;
    ctx.save();
    ctx.lineCap='round';
    ctx.globalCompositeOperation='screen';
    for(const p of arr){
      p.phase+=dt*(.22+p.z*.2);
      p.x+=(p.vx+Math.sin(p.phase)*.9)*dt;
      p.y+=p.vy*(.6+.4*p.life)*dt;
      if(p.y>h+p.trail+30)this.recycle(p);
      const r=p.size*(.62+.45*p.z);
      const alpha=(.12+.07*intensity)*(.65+.35*p.life);
      const trail=ctx.createLinearGradient(p.x,p.y-p.trail,p.x,p.y+r);
      trail.addColorStop(0,'rgba(202,226,238,0)');
      trail.addColorStop(.58,'rgba(205,231,241,'+(alpha*.22)+')');
      trail.addColorStop(1,'rgba(238,249,252,'+(alpha*.48)+')');
      ctx.strokeStyle=trail;
      ctx.lineWidth=Math.max(1,r*.28);
      ctx.beginPath();
      ctx.moveTo(p.x,p.y-p.trail);
      ctx.lineTo(p.x+Math.sin(p.phase)*1.4,p.y-r*.35);
      ctx.stroke();
      const g=ctx.createRadialGradient(p.x-r*.22,p.y-r*.3,r*.08,p.x,p.y,r);
      g.addColorStop(0,'rgba(255,255,255,'+(alpha*.78)+')');
      g.addColorStop(.25,'rgba(224,241,248,'+(alpha*.28)+')');
      g.addColorStop(.7,'rgba(154,194,211,'+(alpha*.09)+')');
      g.addColorStop(1,'rgba(214,237,244,'+(alpha*.25)+')');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.ellipse(p.x,p.y,r*.72,r,0,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle='rgba(239,250,252,'+(alpha*.32)+')';
      ctx.lineWidth=.7;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCloudShadowsFallback(ctx,w,h,now){
    const intensity=this.cfg.intensity||2;
    const alpha={1:.07,2:.13,3:.22,4:.34,5:.50}[intensity]||.13;
    ctx.save();
    ctx.globalCompositeOperation='multiply';
    ctx.filter='blur(42px)';
    for(let i=0;i<9;i++){
      const drift=((now*.000011+i*.22)%1.35)-.18;
      const x=w*drift;
      const y=h*(.18+(i%3)*.26);
      const rx=w*(.18+.035*(i%2));
      const ry=h*(.10+.024*(i%3));
      ctx.globalAlpha=alpha*(.72+.28*Math.sin(now*.00031+i*1.4));
      ctx.fillStyle='rgba(20,30,38,.9)';
      ctx.beginPath();
      ctx.ellipse(x,y,rx,ry,.08*(i-2),0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawUnderwaterFallback(ctx,w,h,now){
    const intensity=this.cfg.intensity||2;
    ctx.save();
    ctx.globalCompositeOperation='screen';
    const wash=ctx.createLinearGradient(0,0,0,h);
    wash.addColorStop(0,'rgba(74,175,193,'+(.045*intensity)+')');
    wash.addColorStop(.55,'rgba(37,125,151,'+(.035*intensity)+')');
    wash.addColorStop(1,'rgba(14,68,91,'+(.07*intensity)+')');
    ctx.fillStyle=wash;
    ctx.fillRect(0,0,w,h);
    ctx.lineWidth=1.1;
    for(let row=0;row<8;row++){
      const y=h*(.10+row*.105);
      ctx.strokeStyle='rgba(183,244,235,'+(.025+.012*intensity)+')';
      ctx.beginPath();
      for(let x=-20;x<=w+20;x+=20){
        const yy=y+Math.sin(x*.023+now*.00125+row)*8+Math.sin(x*.011-now*.00081)*5;
        if(x===-20)ctx.moveTo(x,yy); else ctx.lineTo(x,yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMoonlightFallback(ctx,w,h,now){
    const intensity=this.cfg.intensity||2;
    const pulse=.62+.20*Math.sin(now*.00023)+.18*Math.sin(now*.000071+1.8);
    ctx.save();
    ctx.globalCompositeOperation='screen';
    const g=ctx.createRadialGradient(w*.56,h*.27,0,w*.56,h*.27,Math.max(w,h)*.72);
    g.addColorStop(0,'rgba(176,210,238,'+(.055*intensity*pulse)+')');
    g.addColorStop(.48,'rgba(103,157,204,'+(.028*intensity*pulse)+')');
    g.addColorStop(1,'rgba(42,84,132,0)');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,w,h);
    ctx.restore();
  }

  drawGodRays(ctx,w,h,now){
    const intensity=this.cfg.intensity||2;
    const alpha={1:.035,2:.06,3:.09}[intensity]||.06;
    const drift=(now*.000012)%1;
    ctx.save();
    ctx.globalCompositeOperation='screen';
    ctx.filter='blur('+(this.quality>=.8?5:8)+'px)';

    for(let i=0;i<5;i++){
      const phase=(drift+i*.235)%1.18;
      const topX=(-.18+phase)*w;
      const lean=w*(.11+.018*i);
      const topWidth=w*(.026+.012*(i%3));
      const bottomWidth=w*(.15+.032*(i%2));
      const pulse=.58+.42*Math.sin(now*.00042+i*1.9);

      const g=ctx.createLinearGradient(topX,0,topX+lean,h);
      g.addColorStop(0,'rgba(255,247,210,0)');
      g.addColorStop(.14,'rgba(255,244,204,'+(alpha*pulse*.55)+')');
      g.addColorStop(.65,'rgba(231,239,215,'+(alpha*pulse)+')');
      g.addColorStop(1,'rgba(204,226,219,0)');

      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.moveTo(topX-topWidth,0);
      ctx.lineTo(topX+topWidth,0);
      ctx.lineTo(topX+lean+bottomWidth,h);
      ctx.lineTo(topX+lean-bottomWidth,h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawCrystalResonance(ctx,w,h,now){
    const intensity=this.cfg.intensity||2;
    const strength={1:.55,2:.82,3:1.12}[intensity]||.82;
    const anchors=[
      {x:.24,y:.59,phase:.04,tone:0},
      {x:.53,y:.42,phase:.41,tone:1},
      {x:.78,y:.64,phase:.73,tone:0}
    ];

    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(const a of anchors){
      const cycle=(now*.000115+a.phase)%1;
      const fade=Math.pow(1-cycle,2.1)*strength;
      const cx=w*a.x;
      const cy=h*a.y;
      const radius=(18+cycle*Math.min(w,h)*.22)*(1+a.phase*.12);

      const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,34+radius*.2);
      const core=a.tone===0?'132,222,244':'230,199,116';
      glow.addColorStop(0,'rgba('+core+','+(.11*fade)+')');
      glow.addColorStop(1,'rgba('+core+',0)');
      ctx.fillStyle=glow;
      ctx.beginPath();
      ctx.arc(cx,cy,34+radius*.2,0,Math.PI*2);
      ctx.fill();

      ctx.strokeStyle='rgba('+core+','+(.17*fade)+')';
      ctx.lineWidth=.7+intensity*.22;
      ctx.beginPath();
      ctx.arc(cx,cy,radius,0,Math.PI*2);
      ctx.stroke();

      ctx.strokeStyle='rgba('+core+','+(.07*fade)+')';
      ctx.beginPath();
      ctx.arc(cx,cy,radius*.62,0,Math.PI*2);
      ctx.stroke();

      const spoke=radius*.72;
      for(let n=0;n<4;n++){
        const angle=n*Math.PI/2+a.phase*2.4;
        ctx.beginPath();
        ctx.moveTo(cx+Math.cos(angle)*radius*.16,cy+Math.sin(angle)*radius*.16);
        ctx.lineTo(cx+Math.cos(angle)*spoke,cy+Math.sin(angle)*spoke);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawDreamDistortion(ctx,w,h,now){
    if(!this.backdropReady||!this.heatBuffer?.width||!this.heatBuffer?.height)return;
    const intensity=this.cfg.intensity||2;
    const sourceScale=this.pixelRatio;
    const stripH=this.quality>=.95?12:this.quality>=.68?17:24;
    const maxShift={1:1.8,2:3.8,3:6.3}[intensity]||3.8;

    ctx.save();
    ctx.globalAlpha={1:.075,2:.115,3:.16}[intensity]||.115;
    ctx.imageSmoothingEnabled=true;
    for(let y=0;y<h;y+=stripH){
      const slow=Math.sin(y*.017+now*.00074);
      const counter=Math.sin(y*.043-now*.00108+1.9);
      const shift=(slow+counter*.42)*maxShift;
      const rise=Math.sin(y*.012+now*.0005)*1.15*intensity;
      const sy=Math.max(0,Math.floor(y*sourceScale));
      const sh=Math.max(1,Math.min(
        this.heatBuffer.height-sy,
        Math.ceil((stripH+2)*sourceScale)
      ));
      if(sh<=0)continue;
      ctx.drawImage(
        this.heatBuffer,
        0,sy,this.heatBuffer.width,sh,
        shift,y+rise,w,stripH+2
      );
    }

    const breath=.5+.5*Math.sin(now*.00058);
    const vignette=ctx.createRadialGradient(w*.5,h*.47,Math.min(w,h)*.12,w*.5,h*.47,Math.max(w,h)*.68);
    vignette.addColorStop(0,'rgba(160,209,221,0)');
    vignette.addColorStop(.62,'rgba(126,104,179,'+(.018*intensity*breath)+')');
    vignette.addColorStop(1,'rgba(43,30,69,'+(.05*intensity*breath)+')');
    ctx.globalCompositeOperation='screen';
    ctx.globalAlpha=1;
    ctx.fillStyle=vignette;
    ctx.fillRect(0,0,w,h);
    ctx.restore();
  }

  makeRelicBurst(w,h,intensity){
    const count=1+intensity;
    this.relicArcs=Array.from({length:count},(_,index)=>{
      const x=w*(.12+Math.random()*.76);
      const y=h*(.16+Math.random()*.66);
      const length=Math.min(w,h)*(.12+Math.random()*.18);
      const angle=(-.9+Math.random()*1.8)+(index%2?Math.PI*.34:-Math.PI*.18);
      const points=[];
      const segments=5+Math.floor(Math.random()*4);
      for(let i=0;i<=segments;i++){
        const t=i/segments;
        const side=(Math.random()-.5)*length*.18*(1-Math.abs(t-.5));
        points.push({
          x:x+Math.cos(angle)*length*t-Math.sin(angle)*side,
          y:y+Math.sin(angle)*length*t+Math.cos(angle)*side
        });
      }
      return {points,tone:index%2};
    });
  }

  drawRelicInstability(ctx,w,h,now){
    const intensity=this.cfg.intensity||2;
    if(!this.relicAt)this.relicAt=now+1800+Math.random()*3600;
    if(now>=this.relicAt){
      this.relicPulse=1;
      this.makeRelicBurst(w,h,intensity);
      this.relicAt=now+2200+Math.random()*5200;
    }
    if(this.relicPulse<=.012)return;

    const pulse=this.relicPulse;
    this.relicPulse*=.885;

    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.lineCap='round';
    ctx.lineJoin='round';

    for(const arc of this.relicArcs){
      const primary=arc.tone===0?'112,220,239':'234,190,91';
      const secondary=arc.tone===0?'224,191,103':'108,210,239';

      ctx.strokeStyle='rgba('+secondary+','+(.08*pulse*intensity)+')';
      ctx.lineWidth=4.5+intensity*1.1;
      ctx.beginPath();
      arc.points.forEach((point,i)=>i?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));
      ctx.stroke();

      ctx.strokeStyle='rgba('+primary+','+(.5*pulse)+')';
      ctx.lineWidth=.8+intensity*.35;
      ctx.beginPath();
      arc.points.forEach((point,i)=>i?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));
      ctx.stroke();

      const origin=arc.points[Math.floor(arc.points.length/2)];
      const glow=ctx.createRadialGradient(origin.x,origin.y,0,origin.x,origin.y,55+intensity*20);
      glow.addColorStop(0,'rgba('+primary+','+(.12*pulse)+')');
      glow.addColorStop(1,'rgba('+primary+',0)');
      ctx.fillStyle=glow;
      ctx.beginPath();
      ctx.arc(origin.x,origin.y,55+intensity*20,0,Math.PI*2);
      ctx.fill();
    }

    if(pulse>.72){
      ctx.globalAlpha=(pulse-.72)*.12*intensity;
      ctx.fillStyle='rgba(190,230,235,.55)';
      ctx.fillRect(0,0,w,h);
    }
    ctx.restore();
  }

  drawHeatHaze(ctx,w,h,now){
    if(!this.backdropReady||!this.heatBuffer?.width||!this.heatBuffer?.height)return;

    const intensity=this.cfg.intensity||2;
    const strength={1:2.2,2:4.8,3:8.2}[intensity]||4.8;
    const maxShift=strength*(.84+.16*this.quality);
    const startY=Math.floor(h*.34);
    const stripH=this.quality>=.95?4:this.quality>=.68?6:9;
    const sourceScale=this.pixelRatio;

    ctx.save();
    ctx.globalAlpha={1:.58,2:.72,3:.86}[intensity]||.72;
    ctx.imageSmoothingEnabled=true;

    for(let y=startY;y<h;y+=stripH){
      const depth=(y-startY)/Math.max(1,h-startY);
      const weight=.12+Math.pow(depth,1.42)*.88;

      // Several asynchronous waves stop the image looking like one simple sine wobble.
      const waveA=Math.sin(y*.041+now*.00225);
      const waveB=Math.sin(y*.017-now*.00137+1.7);
      const waveC=Math.sin(y*.073+now*.00091+4.1);
      const slow=Math.sin(now*.00047+y*.006);
      const offset=(waveA+waveB*.68+waveC*.31+slow*.24)*maxShift*weight;

      // Tiny vertical refraction helps sell rising hot air without making the image swim.
      const rise=Math.sin(y*.027-now*.00162)*1.25*weight*intensity;

      const sy=Math.max(0,Math.floor(y*sourceScale));
      const sh=Math.max(1,Math.min(
        this.heatBuffer.height-sy,
        Math.ceil((stripH+2)*sourceScale)
      ));
      if(sh<=0)continue;

      ctx.drawImage(
        this.heatBuffer,
        0,sy,this.heatBuffer.width,sh,
        offset,y+rise,w,stripH+2
      );
    }

    // A softer second pass over the lowest part creates the turbulent ground shimmer.
    const lowerY=Math.floor(h*.64);
    ctx.globalAlpha={1:.12,2:.19,3:.28}[intensity]||.19;
    for(let y=lowerY;y<h;y+=stripH*2){
      const depth=(y-lowerY)/Math.max(1,h-lowerY);
      const offset=Math.sin(y*.029-now*.0031)*maxShift*(.45+depth*.8);
      const sy=Math.max(0,Math.floor(y*sourceScale));
      const sh=Math.max(1,Math.min(
        this.heatBuffer.height-sy,
        Math.ceil((stripH*2+3)*sourceScale)
      ));
      if(sh<=0)continue;
      ctx.drawImage(
        this.heatBuffer,
        0,sy,this.heatBuffer.width,sh,
        offset,y,w,stripH*2+3
      );
    }
    ctx.restore();
  }

  drawLightning(now,intensity){
    if(!this.lightningAt)this.lightningAt=now+2600+Math.random()*6200;
    if(now>=this.lightningAt){
      this.flash=.42+.42*intensity;
      this.lightningAt=now+3300+Math.random()*7600;
    }
    if(this.flash>0){
      this.flash*=.76;
      if(this.flash<.015)this.flash=0;
      this.setFlash(this.flash);
    }else{
      this.setFlash(0);
    }
  }

  setFlash(value){
    if(!this.host)return;
    this.host.style.setProperty('--scene-fx-flash',String(Math.max(0,Math.min(.75,value))));
  }
}

