(()=>{'use strict';
const W=10,H=20,S=30,canvas=document.querySelector('#board'),ctx=canvas.getContext('2d'),nextCanvas=document.querySelector('#next'),nctx=nextCanvas.getContext('2d');
const PIECES={I:[[1,1,1,1]],O:[[1,1],[1,1]],T:[[0,1,0],[1,1,1]],S:[[0,1,1],[1,1,0]],Z:[[1,1,0],[0,1,1]],J:[[1,0,0],[1,1,1]],L:[[0,0,1],[1,1,1]]};
const COLORS={I:'#51d9ff',O:'#ffe15b',T:'#bd67ff',S:'#5cff87',Z:'#ff5d7a',J:'#6687ff',L:'#ff9a4d'};
let save={score:0,highScore:0,lines:0,totalLines:0,level:1,combo:0,bestCombo:0,stardust:0,theme:'Classic',music:true,sfx:true,muted:false,musicVolume:45,sfxVolume:32,shopkeeperClicks:0,demonModeUnlocked:false,highscores:[],achievements:{},...JSON.parse(localStorage.getItem('starfallSave')||'{}')};
save.highscores=Array.isArray(save.highscores)?save.highscores:[];
const persist=()=>localStorage.setItem('starfallSave',JSON.stringify(save)); const $=id=>document.getElementById(id); const show=n=>document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id===n));

const SAVE_PREFIX='STARFALL_SAVE_V1:';
const SAVE_SHIFT=7;
function caesarEncode(text,shift=SAVE_SHIFT){return [...text].map(ch=>{const c=ch.charCodeAt(0);if(c>=65&&c<=90)return String.fromCharCode((c-65+shift)%26+65);if(c>=97&&c<=122)return String.fromCharCode((c-97+shift)%26+97);return ch}).join('')}
function caesarDecode(text,shift=SAVE_SHIFT){return caesarEncode(text,26-(shift%26))}
function bytesToBase64(text){return btoa(unescape(encodeURIComponent(text)))}
function base64ToText(b64){return decodeURIComponent(escape(atob(b64)))}
function makeSav(){
  const payload={
    format:'STARFALL_SAVE_V1',
    exportedAt:new Date().toISOString(),
    data:{
      highScore:save.highScore, stardust:save.stardust, theme:save.theme, music:save.music, sfx:save.sfx, muted:save.muted,
      musicVolume:save.musicVolume, sfxVolume:save.sfxVolume, shopkeeperClicks:save.shopkeeperClicks,
      demonModeUnlocked:save.demonModeUnlocked, highscores:save.highscores, achievements:save.achievements
    }
  };
  const b64=bytesToBase64(JSON.stringify(payload));
  return SAVE_PREFIX+caesarEncode(b64);
}
function downloadSav(){
  const blob=new Blob([makeSav()],{type:'application/octet-stream'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='STARFALL.sav';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function validateImportedData(d){
  if(!d||typeof d!=='object')throw new Error('Invalid save data.');
  if(!Array.isArray(d.highscores)||!Array.isArray(d.achievements))throw new Error('Invalid STARFALL save.');
  if(typeof d.stardust!=='number'||typeof d.highScore!=='number')throw new Error('Invalid progression data.');
  if(!['Classic','Nebula','Supernova','Void','Starlight'].includes(d.theme))throw new Error('Unknown theme.');
  if(typeof d.demonModeUnlocked!=='boolean')throw new Error('Invalid Demon Mode data.');
}
function importSavText(text){
  text=text.trim();if(!text.startsWith(SAVE_PREFIX))throw new Error('This is not a STARFALL save file.');
  const decoded=base64ToText(caesarDecode(text.slice(SAVE_PREFIX.length)));
  const payload=JSON.parse(decoded);
  if(payload.format!=='STARFALL_SAVE_V1')throw new Error('Unsupported STARFALL save version.');
  validateImportedData(payload.data);
  const d=payload.data;
  save={...save,...d,score:0,lines:0,totalLines:save.totalLines||0,level:1,combo:0,bestCombo:save.bestCombo||0};
  persist();applyTheme(save.theme);syncSettings();hud();updateShop();renderHighscores();
}
async function importSavFile(file){
  try{importSavText(await file.text());alert('STARFALL save loaded successfully.')}catch(err){alert('Could not load save: '+err.message)}
}

const audio={};
const soundNames=['drop','game-over','line-clear','menu','move','pause','rotate','dialogue'];
function makeAudio(name,kind='sfx'){let a=new Audio();a.preload='auto';a.src='assets/Sounds/mp3/'+name+'.mp3';a.dataset.fallback='assets/Sounds/wav/'+name+'.wav';a.addEventListener('error',()=>{if(a.src.endsWith('.mp3')){a.src=a.dataset.fallback;a.load()}},{once:true});audio[name]=a;if(kind==='sfx')a.volume=save.sfxVolume/100;return a}
soundNames.forEach(n=>makeAudio(n));
audio.demon=makeAudio('demonmodelaugh');audio.demon.volume=.38;
audio.music=new Audio('assets/Music/mp3/Starfall Theme.mp3');audio.music.loop=true;audio.music.volume=save.musicVolume/100;
function sfx(n){if(save.sfx&&!save.muted&&audio[n]){audio[n].volume=(save.sfxVolume/100)*(n==='demon'?.38:1);audio[n].currentTime=0;audio[n].play().catch(()=>{})}}
function music(){audio.music.volume=save.musicVolume/100;if(save.music&&!save.muted)audio.music.play().catch(()=>{});else audio.music.pause()}
let board,current,next,running=false,paused=false,last=0,fall=0;
const reset=()=>board=Array.from({length:H},()=>Array(W).fill(null)); const rotate=m=>m[0].map((_,i)=>m.map(r=>r[i]).reverse()); const randomPiece=()=>{let t=Object.keys(PIECES)[Math.floor(Math.random()*7)];return{type:t,m:PIECES[t].map(r=>r.slice()),x:3,y:0}};
const collide=(p,dx,dy,m=p.m)=>{for(let y=0;y<m.length;y++)for(let x=0;x<m[y].length;x++)if(m[y][x]){let nx=p.x+x+dx,ny=p.y+y+dy;if(nx<0||nx>=W||ny>=H||(ny>=0&&board[ny][nx]))return true}return false};
function spawn(){current=next||randomPiece();current.x=3;current.y=0;next=randomPiece();drawNext();if(collide(current,0,0)){gameOver();return false}return true}
function move(dx){if(running&&!paused&&!collide(current,dx,0)){current.x+=dx;sfx('move')}}
function soft(){if(!running||paused)return;if(!collide(current,0,1)){current.y++;save.score++}else lock();hud()}
function hard(){if(!running||paused)return;let d=0;while(!collide(current,0,1)){current.y++;d++}save.score+=d*2;sfx('drop');lock();hud()}
function turn(){if(!running||paused)return;let m=rotate(current.m);for(let dx of [0,-1,1,-2,2])if(!collide(current,dx,0,m)){current.x+=dx;current.m=m;sfx('rotate');break}}
function lock(){for(let y=0;y<current.m.length;y++)for(let x=0;x<current.m[y].length;x++)if(current.m[y][x]&&current.y+y>=0)board[current.y+y][current.x+x]=current.type;let n=0;for(let y=H-1;y>=0;y--)if(board[y].every(Boolean)){board.splice(y,1);board.unshift(Array(W).fill(null));n++}if(n){save.lines+=n;save.totalLines+=n;save.combo++;save.bestCombo=Math.max(save.bestCombo,save.combo);save.score+=[0,100,300,500,800][n]*save.level;save.stardust+=n*10+(n===4?25:0);if(n===4)unlock('tetris');if(save.totalLines>=1)unlock('firstLine');if(save.combo>=5)unlock('combo5');sfx('line-clear')}else save.combo=0;save.level=1+Math.floor(save.lines/10);if(save.level>=10)unlock('level10');if(save.score>=10000)unlock('score10k');persist();spawn();hud()}
function qualifies(score){return save.highscores.length<10||score>Math.min(...save.highscores.map(x=>x.score));}
function renderHighscores(){let e=$('highscoreList');if(!e)return;e.innerHTML='';if(!save.highscores.length){e.innerHTML='<p class="empty-scores">No scores yet. Someone has to go first.</p>';return}save.highscores.forEach((x,i)=>{let d=document.createElement('div');d.className='score-row';d.innerHTML=`<span class="rank">${String(i+1).padStart(2,'0')}</span><span class="score-name">${escapeHtml(x.name)}</span><b>${x.score}</b>`;e.appendChild(d)})}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function gameOver(){if(!running)return;running=false;paused=false;audio.music.pause();save.highScore=Math.max(save.highScore,save.score);persist();sfx('game-over');$('finalScore').textContent=save.score;const entry=$('highscoreEntry');if(qualifies(save.score)){entry.classList.remove('hidden');$('highscoreName').value='';setTimeout(()=>$('highscoreName').focus(),100)}else entry.classList.add('hidden');$('gameOverOverlay').classList.remove('hidden')}
function submitScore(){if(!qualifies(save.score))return;let input=$('highscoreName');let name=input.value.toUpperCase().replace(/[^A-Z0-9 ]/g,'').trim().slice(0,8)||'PLAYER';save.highscores.push({name,score:save.score});save.highscores.sort((a,b)=>b.score-a.score);save.highscores=save.highscores.slice(0,10);persist();renderHighscores();$('highscoreEntry').classList.add('hidden');sfx('menu')}

function loop(t){if(!running)return;let dt=t-last;last=t;if(!paused){fall+=dt;if(fall>=Math.max(90,800-(save.level-1)*65)){fall=0;soft()}draw()}requestAnimationFrame(loop)}
function start(){save.score=0;save.lines=0;save.combo=0;save.level=1;reset();current=null;next=null;running=true;paused=false;$('gameOverOverlay').classList.add('hidden');spawn();show('gameScreen');music();last=performance.now();requestAnimationFrame(loop);hud()}
function hud(){$('score').textContent=save.score;$('level').textContent=save.level;$('lines').textContent=save.lines;$('combo').textContent=save.combo;$('stardust').textContent=save.stardust}
function cell(c,x,y,size=S){ctx.fillStyle=COLORS[c];ctx.fillRect(x*size,y*size,size-1,size-1);ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(x*size+2,y*size+2,size-5,4)}
function draw(){ctx.clearRect(0,0,300,600);for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x])cell(board[y][x],x,y);if(current)for(let y=0;y<current.m.length;y++)for(let x=0;x<current.m[y].length;x++)if(current.m[y][x])cell(current.type,current.x+x,current.y+y)}
function drawNext(){nctx.clearRect(0,0,120,120);if(!next)return;let m=next.m,ox=(4-m[0].length)/2,oy=(4-m.length)/2;nctx.fillStyle=COLORS[next.type];for(let y=0;y<m.length;y++)for(let x=0;x<m[y].length;x++)if(m[y][x])nctx.fillRect((ox+x)*30,(oy+y)*30,29,29)}
const achievements={firstLine:['First Line Clear','Clear your first line.'],tetris:['Tetris','Clear four lines at once.'],combo5:['Combo','Reach a five-piece combo.'],level10:['Level 10','Reach level 10.'],score10k:['Score 10,000','Reach a score of 10,000.'],demon:['???','Pester the shopkeeper 66 times.']};
function unlock(k){if(!save.achievements[k]){save.achievements[k]=true;persist()}} function renderAchievements(){let e=$('achievementList');e.innerHTML='';for(let[k,v]of Object.entries(achievements)){let d=document.createElement('div');d.className='achievement '+(save.achievements[k]?'unlocked':'');d.innerHTML=`<b>${save.achievements[k]?'★':'☆'} ${v[0]}</b><br><small>${v[1]}</small>`;e.appendChild(d)}}
const normal=['* the shopkeeper looks up from the counter.\n\n"Welcome."','* the shopkeeper smiles.\n\n"Take your time."','* the shopkeeper straightens a few things on the stand.\n\n"See anything you like?"'];
const peeved=['* the shopkeeper watches you for a moment.\n\n"...again?"','* the shopkeeper slowly looks up.\n\n"I am still here."','* the shopkeeper sighs.\n\n"You could actually buy something."'];
let typing=false,timer=null;
function setShopkeeperTalking(on){const img=document.querySelector('.shopkeeper-art');if(!img)return;img.src=on?'assets/Images/shopkeeper-talking.svg':'assets/Images/shopkeeper.svg'}
function say(text){clearInterval(timer);let out=$('dialogueText');$('dialogue').classList.remove('hidden');out.textContent='';typing=true;setShopkeeperTalking(true);let i=0;timer=setInterval(()=>{out.textContent+=text[i++]||'';if(i%3===0)sfx('dialogue');if(i>=text.length){clearInterval(timer);typing=false;setShopkeeperTalking(false)}},22)}
function shopTalk(){save.shopkeeperClicks++;persist();let n=save.shopkeeperClicks;if(n===66){demon();return}let pool=n>=25?peeved:normal;say(pool[Math.floor(Math.random()*pool.length)])}
function demon(){save.demonModeUnlocked=true;unlock('demon');persist();$('shopScene').classList.add('demon');let f=$('blurpleFlash');f.classList.remove('fire');void f.offsetWidth;f.classList.add('fire');sfx('demon');let device=/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)?'mobile':'desktop';say(`* the shopkeeper stares at you.\n\n"...you did this."\n\n* the shopkeeper looks directly at the screen.\n\n"${device==='mobile'?'You are on a mobile device.':'You are on a computer.'}"\n\n"Fine. Let us see how well you do now."`)}
function updateShop(){$('shopDust').textContent=save.stardust;let s=$('shopScene');s.classList.toggle('peevish',save.shopkeeperClicks>=25);s.classList.toggle('demon',save.demonModeUnlocked)}
function pause(){if(!running)return;paused=!paused;$('pauseOverlay').classList.toggle('hidden',!paused);if(paused)audio.music.pause();else music();sfx('pause')}
function syncSettings(){ $('musicToggle').checked=!!save.music;$('sfxToggle').checked=!!save.sfx;$('musicVolume').value=save.musicVolume;$('sfxVolume').value=save.sfxVolume;$('musicVolumeValue').textContent=save.musicVolume+'%';$('sfxVolumeValue').textContent=save.sfxVolume+'%';document.querySelector('[data-action="mute"]').textContent=save.muted?'🔊 UNMUTE':'🔇 MUTE'}
// Stop browser double-tap zoom and accidental page gestures on mobile.
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});document.addEventListener('touchend',e=>{const now=Date.now(),lastTouch=window.__sfLastTouch||0;if(now-lastTouch<320)e.preventDefault();window.__sfLastTouch=now},{passive:false});
document.addEventListener('keydown',e=>{if(e.key==='Escape')pause();if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);if(e.key==='ArrowDown')soft();if(e.key==='ArrowUp')turn();if(e.key===' '){e.preventDefault();hard()}});
document.querySelectorAll('[data-key]').forEach(b=>b.onclick=()=>{let k=b.dataset.key;if(k==='ArrowLeft')move(-1);else if(k==='ArrowRight')move(1);else if(k==='ArrowDown')soft();else if(k==='ArrowUp')turn();else hard()});
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{let a=b.dataset.action;if(a==='play'||a==='restart')start();if(a==='shop'){show('shop');updateShop()}if(a==='settings'){show('settings');syncSettings()}if(a==='highscores'){show('highscores');renderHighscores()}if(a==='submitScore')submitScore();if(a==='clearScores'){save.highscores=[];persist();renderHighscores()}if(a==='achievements'){show('achievements');renderAchievements()}if(a==='pause'||a==='resume')pause();if(a==='menu'){running=false;audio.music.pause();$('gameOverOverlay').classList.add('hidden');show('menu')}if(a==='mute'){save.muted=!save.muted;persist();syncSettings();music()}if(a==='exportSave')downloadSav();if(a==='importSave')$('saveFileInput').click()});
$('saveFileInput').onchange=e=>{if(e.target.files[0])importSavFile(e.target.files[0]);e.target.value=''};
$('shopkeeper').onclick=shopTalk;$('dialogueContinue').onclick=()=>{if(!typing){$('dialogue').classList.add('hidden');setShopkeeperTalking(false)}};
$('musicToggle').onchange=e=>{save.music=e.target.checked;persist();music()};$('sfxToggle').onchange=e=>{save.sfx=e.target.checked;persist()};$('musicVolume').oninput=e=>{save.musicVolume=+e.target.value;$('musicVolumeValue').textContent=save.musicVolume+'%';persist();music()};$('sfxVolume').oninput=e=>{save.sfxVolume=+e.target.value;$('sfxVolumeValue').textContent=save.sfxVolume+'%';persist()};
function applyTheme(theme){document.body.className='theme-'+theme;save.theme=theme;persist()}
function createStars(){const field=document.querySelector('#starfield');for(let i=0;i<90;i++){const star=document.createElement('i');star.className='star';star.style.setProperty('--x',(Math.random()*100)+'vw');star.style.setProperty('--dx',((Math.random()*18)-9)+'vw');star.style.setProperty('--dur',(7+Math.random()*13)+'s');star.style.setProperty('--op',(0.35+Math.random()*0.65).toFixed(2));star.style.width=star.style.height=(1+Math.random()*3)+'px';star.style.animationDelay=(-Math.random()*20)+'s';field.appendChild(star)}}
document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{let t=b.dataset.theme;applyTheme(t);updateShop()});
applyTheme(save.theme||'Classic');createStars();
renderHighscores();updateShop();syncSettings();hud();draw();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
