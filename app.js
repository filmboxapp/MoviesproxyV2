const $ = id => document.getElementById(id);
const D = {
  urlInput:$('urlInput'), extractBtn:$('extractBtn'), status:$('status'), result:$('result'),
  video:$('videoPlayer'), badge:$('providerBadge'), quality:$('qualityInfo'),
  dot:$('statusDot'), stxt:$('statusText'), embedInput:$('embedUrlInput'),
  embedCode:$('embedCode'), origUrl:$('originalUrl'), dirUrl:$('directUrl'), streamStatus:$('streamStatus')
};
let hls = null;

function initHLS(vid, sid) {
  if (hls) { hls.destroy(); hls = null; }
  const url = `/api/stream/${sid}/playlist.m3u8`;
  if (Hls.isSupported()) {
    hls = new Hls({enableWorker:true,lowLatencyMode:false,backbufferLength:30,maxBufferLength:60,startLevel:-1,capLevelToPlayerSize:true});
    hls.loadSource(url); hls.attachMedia(vid);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const l = hls.levels; if(l&&l.length) { const h=l[l.length-1].height||0; D.quality.textContent = h>=2160?'4K':h>=1440?'2K':h>=1080?'1080p':h>=720?'720p':h>=480?'480p':'SD'; }
      setStatus('live','Reproduciendo'); vid.play().catch(()=>{});
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (e,d) => { const l=hls.levels[d.level]; if(l) { const h=l.height||0; D.quality.textContent = h>=2160?'4K':h>=1440?'2K':h>=1080?'1080p':h>=720?'720p':h>=480?'480p':'SD'; }});
    hls.on(Hls.Events.ERROR, (e,d) => { if(d.fatal) setStatus('error','Error'); });
  } else if(vid.canPlayType('application/vnd.apple.mpegurl')) { vid.src=url; vid.addEventListener('loadedmetadata',()=>{setStatus('live','Reproduciendo');vid.play().catch(()=>{});}); }
  else setStatus('error','No soportado');
}

function setStatus(s,t) {
  D.dot.className='status-dot'+(s==='live'?' live':s==='buffering'?' buffering':' error');
  D.stxt.textContent = t||'...';
  D.streamStatus.textContent = s==='live'?'En vivo':s==='buffering'?'Cargando':'Error';
  D.streamStatus.className = 'value'+(s==='live'?' live':'');
}

async function extractStream(url) {
  try { new URL(url); } catch { showStatus('error','URL inválida'); return; }
  D.extractBtn.classList.add('loading'); D.extractBtn.disabled=true; D.result.style.display='none'; hideStatus();
  try {
    const r = await fetch('/api/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});
    const d = await r.json();
    if(!d.success) { showStatus('error',d.message||'Error'); D.extractBtn.classList.remove('loading'); D.extractBtn.disabled=false; return; }
    D.result.style.display='block'; D.badge.textContent=d.title;
    const eu = window.location.origin+d.embedUrl; D.embedInput.value=eu; D.embedCode.textContent=`<iframe src="${eu}" width="100%" height="480" frameborder="0" allowfullscreen></iframe>`;
    D.origUrl.textContent=url; D.dirUrl.textContent=d.directUrl; initHLS(D.video,d.streamId);
    D.result.scrollIntoView({behavior:'smooth',block:'start'});
  } catch { showStatus('error','Error de conexión'); }
  D.extractBtn.classList.remove('loading'); D.extractBtn.disabled=false;
}

function showStatus(t,m){D.status.style.display='block';D.status.className='status '+t;D.status.textContent=m;}
function hideStatus(){D.status.style.display='none';D.status.className='status';}
function copyEmbedUrl(){D.embedInput.select();document.execCommand('copy');feedback('copyEmbedBtn','Copiado!');}
function copyEmbedCode(){const c=D.embedCode.textContent;navigator.clipboard.writeText(c).then(()=>feedback(document.querySelector('.embed-preview .btn-copy'),'Copiado!')).catch(()=>{const t=document.createElement('textarea');t.value=c;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);feedback(document.querySelector('.embed-preview .btn-copy'),'Copiado!');});}
function feedback(el,msg){const b=typeof el==='string'?document.getElementById(el):el;if(!b)return;const o=b.innerHTML;b.innerHTML=msg;setTimeout(()=>{b.innerHTML=o;},2000);}
D.extractBtn.addEventListener('click',()=>{const u=D.urlInput.value.trim();u?extractStream(u):showStatus('error','Pega una URL');});
D.urlInput.addEventListener('keydown',e=>{if(e.key==='Enter'){const u=D.urlInput.value.trim();if(u)extractStream(u);}});
