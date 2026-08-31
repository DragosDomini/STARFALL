(()=>{

'use strict';


/* =========================================================
   STARFALL
   ========================================================= */

const W = 10;
const H = 20;
const S = 30;

const canvas = document.querySelector('#board');
const ctx = canvas.getContext('2d');

const nextCanvas = document.querySelector('#next');
const nctx = nextCanvas.getContext('2d');


/* =========================================================
   PIECES
   ========================================================= */

const PIECES = {

  I:[[1,1,1,1]],

  O:[
    [1,1],
    [1,1]
  ],

  T:[
    [0,1,0],
    [1,1,1]
  ],

  S:[
    [0,1,1],
    [1,1,0]
  ],

  Z:[
    [1,1,0],
    [0,1,1]
  ],

  J:[
    [1,0,0],
    [1,1,1]
  ],

  L:[
    [0,0,1],
    [1,1,1]
  ]

};


const COLORS = {

  I:'#51d9ff',
  O:'#ffe15b',
  T:'#bd67ff',
  S:'#5cff87',
  Z:'#ff5d7a',
  J:'#6687ff',
  L:'#ff9a4d'

};


/* =========================================================
   SAVE DATA
   ========================================================= */

const DEFAULT_SAVE = {

  score:0,
  highScore:0,

  lines:0,
  totalLines:0,

  level:1,
  combo:0,
  bestCombo:0,

  stardust:0,

  theme:'Classic',

  music:true,
  sfx:true,
  muted:false,

  musicVolume:45,
  sfxVolume:32,

  threeD:true,
  photoSensitivity:false,

  shopkeeperClicks:0,
  demonModeUnlocked:false,
  demonMode:false,

  ownedThemes:['Classic'],

  highscores:[],

  achievements:{}

};


let save = {

  ...DEFAULT_SAVE,

  ...JSON.parse(
    localStorage.getItem('starfallSave') || '{}'
  )

};


if(!Array.isArray(save.highscores)){
  save.highscores = [];
}


if(!Array.isArray(save.ownedThemes)){
  save.ownedThemes = ['Classic'];
}


if(typeof save.photoSensitivity !== 'boolean'){
  save.photoSensitivity = false;
}


if(typeof save.threeD !== 'boolean'){
  save.threeD = true;
}


const persist = () => {

  localStorage.setItem(
    'starfallSave',
    JSON.stringify(save)
  );

};


const $ = id =>
  document.getElementById(id);


function show(name){

  document
    .querySelectorAll('.screen')
    .forEach(screen =>
      screen.classList.toggle(
        'active',
        screen.id === name
      )
    );

}


/* =========================================================
   SAVE EXPORT / IMPORT
   ========================================================= */

const SAVE_PREFIX = 'STARFALL_SAVE_V2:';
const SAVE_SHIFT = 7;


function caesarEncode(text,shift=SAVE_SHIFT){

  return [...text]
    .map(ch=>{

      const c = ch.charCodeAt(0);

      if(c>=65 && c<=90){

        return String.fromCharCode(
          (c-65+shift)%26+65
        );

      }

      if(c>=97 && c<=122){

        return String.fromCharCode(
          (c-97+shift)%26+97
        );

      }

      return ch;

    })
    .join('');

}


function caesarDecode(text,shift=SAVE_SHIFT){

  return caesarEncode(
    text,
    26-(shift%26)
  );

}


function bytesToBase64(text){

  return btoa(
    unescape(
      encodeURIComponent(text)
    )
  );

}


function base64ToText(b64){

  return decodeURIComponent(
    escape(
      atob(b64)
    )
  );

}


function makeSav(){

  const payload = {

    format:'STARFALL_SAVE_V2',

    exportedAt:new Date().toISOString(),

    data:{

      highScore:save.highScore,

      stardust:save.stardust,

      theme:save.theme,

      ownedThemes:save.ownedThemes,

      music:save.music,

      sfx:save.sfx,

      muted:save.muted,

      musicVolume:save.musicVolume,

      sfxVolume:save.sfxVolume,

      threeD:save.threeD,

      photoSensitivity:save.photoSensitivity,

      shopkeeperClicks:
        save.shopkeeperClicks,

      demonModeUnlocked:
        save.demonModeUnlocked,

      demonMode:
        save.demonMode,

      highscores:
        save.highscores,

      achievements:
        save.achievements

    }

  };


  const encoded =
    bytesToBase64(
      JSON.stringify(payload)
    );


  return SAVE_PREFIX +
    caesarEncode(encoded);

}


function downloadSav(){

  const blob = new Blob(
    [makeSav()],
    {
      type:'application/octet-stream'
    }
  );


  const a =
    document.createElement('a');

  a.href =
    URL.createObjectURL(blob);

  a.download =
    'STARFALL.sav';

  a.click();


  setTimeout(
    ()=>URL.revokeObjectURL(a.href),
    1000
  );

}


function validateImportedData(data){

  if(!data ||
     typeof data !== 'object'){

    throw new Error(
      'Invalid save data.'
    );

  }


  if(
    typeof data.stardust !== 'number' ||
    typeof data.highScore !== 'number'
  ){

    throw new Error(
      'Invalid progression data.'
    );

  }


  if(
    !['Classic',
     'Nebula',
     'Supernova',
     'Void',
     'Starlight'
    ].includes(data.theme)
  ){

    throw new Error(
      'Unknown theme.'
    );

  }


  if(
    typeof data.demonModeUnlocked !==
    'boolean'
  ){

    throw new Error(
      'Invalid Demon Mode data.'
    );

  }

}


function importSavText(text){

  text = text.trim();


  if(!text.startsWith(SAVE_PREFIX)){

    throw new Error(
      'This is not a STARFALL save file.'
    );

  }


  const decoded =
    base64ToText(
      caesarDecode(
        text.slice(
          SAVE_PREFIX.length
        )
      )
    );


  const payload =
    JSON.parse(decoded);


  if(
    payload.format !==
    'STARFALL_SAVE_V2'
  ){

    throw new Error(
      'Unsupported save version.'
    );

  }


  validateImportedData(
    payload.data
  );


  save = {

    ...DEFAULT_SAVE,
    ...save,
    ...payload.data,

    score:0,
    lines:0,
    level:1,
    combo:0

  };


  persist();

  applyTheme(save.theme);

  syncSettings();

  hud();

  updateShop();

  renderHighscores();

  renderAchievements();

}


async function importSavFile(file){

  try{

    importSavText(
      await file.text()
    );

    alert(
      'STARFALL save loaded successfully.'
    );

  }catch(error){

    alert(
      'Could not load save: ' +
      error.message
    );

  }

}


/* =========================================================
   AUDIO
   ========================================================= */

const audio = {};

const soundNames = [

  'drop',
  'game-over',
  'line-clear',
  'menu',
  'move',
  'pause',
  'rotate',
  'dialogue'

];


function makeAudio(name){

  const a =
    new Audio();

  a.preload =
    'auto';

  a.src =
    'assets/Sounds/mp3/' +
    name +
    '.mp3';

  a.dataset.fallback =
    'assets/Sounds/wav/' +
    name +
    '.wav';


  a.addEventListener(
    'error',
    ()=>{

      if(
        a.src.endsWith('.mp3')
      ){

        a.src =
          a.dataset.fallback;

        a.load();

      }

    },
    {once:true}
  );


  audio[name] = a;

  a.volume =
    save.sfxVolume/100;

  return a;

}


soundNames.forEach(
  name=>makeAudio(name)
);


audio.demon =
  new Audio(
    'assets/Sounds/mp3/demonmodelaugh.mp3'
  );

audio.demon.volume =
  .38;


/* =========================================================
   REVERSED UNPAUSE SOUND
   ========================================================= */

let pauseBuffer = null;
let pauseAudioContext = null;


async function prepareReversePause(){

  if(
    pauseBuffer ||
    !window.AudioContext
  ){

    return;

  }


  try{

    pauseAudioContext =
      new AudioContext();


    const response =
      await fetch(
        'assets/Sounds/mp3/pause.mp3'
      );


    const data =
      await response.arrayBuffer();


    pauseBuffer =
      await pauseAudioContext.decodeAudioData(
        data
      );

  }catch{

    pauseBuffer = null;

  }

}


function playReversePause(){

  if(
    !pauseBuffer ||
    !pauseAudioContext
  ){

    sfx('pause');

    return;

  }


  const reversed =
    pauseBuffer.getChannelData(0)
      .slice()
      .reverse();


  const buffer =
    pauseAudioContext.createBuffer(
      1,
      reversed.length,
      pauseBuffer.sampleRate
    );


  buffer.copyToChannel(
    reversed,
    0
  );


  const source =
    pauseAudioContext.createBufferSource();

  source.buffer =
    buffer;

  const gain =
    pauseAudioContext.createGain();

  gain.gain.value =
    save.sfxVolume/100;


  source.connect(gain);

  gain.connect(
    pauseAudioContext.destination
  );

  source.start();

}


function sfx(name){

  if(
    !save.sfx ||
    save.muted
  ){

    return;

  }


  const sound =
    audio[name];

  if(!sound)return;


  sound.volume =
    (save.sfxVolume/100) *
    (name==='demon' ? .38 : 1);


  sound.currentTime = 0;

  sound.play().catch(
    ()=>{}
  );

}


audio.music =
  new Audio(
    'assets/Music/mp3/Starfall Theme.mp3'
  );

audio.music.loop = true;


function music(){

  audio.music.volume =
    save.musicVolume/100;


  if(
    save.music &&
    !save.muted
  ){

    audio.music
      .play()
      .catch(()=>{});

  }else{

    audio.music.pause();

  }

}


/* =========================================================
   GAME STATE
   ========================================================= */

let board;

let current;
let next;

let running = false;
let paused = false;

let last = 0;
let fall = 0;


/* =========================================================
   GAME
   ========================================================= */

function reset(){

  board =
    Array.from(
      {length:H},
      ()=>Array(W).fill(null)
    );

}


function rotate(matrix){

  return matrix[0]
    .map(
      (_,i)=>
        matrix
          .map(row=>row[i])
          .reverse()
    );

}


function randomPiece(){

  const types =
    Object.keys(PIECES);

  const type =
    types[
      Math.floor(
        Math.random()*types.length
      )
    ];


  return {

    type,

    m:PIECES[type]
      .map(row=>row.slice()),

    x:3,
    y:0

  };

}


function collide(
  piece,
  dx,
  dy,
  matrix=piece.m
){

  for(
    let y=0;
    y<matrix.length;
    y++
  ){

    for(
      let x=0;
      x<matrix[y].length;
      x++
    ){

      if(!matrix[y][x])
        continue;


      const nx =
        piece.x+x+dx;

      const ny =
        piece.y+y+dy;


      if(
        nx<0 ||
        nx>=W ||
        ny>=H ||
        (
          ny>=0 &&
          board[ny][nx]
        )
      ){

        return true;

      }

    }

  }


  return false;

}


function spawn(){

  current =
    next ||
    randomPiece();


  current.x = 3;
  current.y = 0;


  next =
    randomPiece();


  drawNext();


  if(
    collide(
      current,
      0,
      0
    )
  ){

    gameOver();

    return false;

  }


  return true;

}


/* =========================================================
   CONTROLS
========================================================= */

function move(dx){

  if(
    !running ||
    paused ||
    !current
  ){

    return;

  }


  if(
    !collide(
      current,
      dx,
      0
    )
  ){

    current.x += dx;

    sfx('move');

  }

}


function soft(){

  if(
    !running ||
    paused
  ){

    return;

  }


  if(
    !collide(
      current,
      0,
      1
    )
  ){

    current.y++;

    save.score++;

  }else{

    lock();

  }


  hud();

}


function hard(){

  if(
    !running ||
    paused
  ){

    return;

  }


  let distance = 0;


  while(
    !collide(
      current,
      0,
      1
    )
  ){

    current.y++;

    distance++;

  }


  save.score +=
    distance*2;


  sfx('drop');

  lock();

  hud();

}


function turn(){

  if(
    !running ||
    paused ||
    !current
  ){

    return;

  }


  const matrix =
    rotate(current.m);


  for(
    const dx of [
      0,-1,1,-2,2
    ]
  ){

    if(
      !collide(
        current,
        dx,
        0,
        matrix
      )
    ){

      current.x += dx;

      current.m =
        matrix;

      sfx('rotate');

      break;

    }

  }

}


/* =========================================================
   LOCK / LINES
========================================================= */

function lock(){

  for(
    let y=0;
    y<current.m.length;
    y++
  ){

    for(
      let x=0;
      x<current.m[y].length;
      x++
    ){

      if(
        current.m[y][x] &&
        current.y+y>=0
      ){

        board[
          current.y+y
        ][
          current.x+x
        ] =
          current.type;

      }

    }

  }


  let cleared = 0;


  for(
    let y=H-1;
    y>=0;
    y--
  ){

    if(
      board[y].every(Boolean)
    ){

      board.splice(y,1);

      board.unshift(
        Array(W).fill(null)
      );

      cleared++;

      y++;

    }

  }


  if(cleared){

    save.lines += cleared;

    save.totalLines += cleared;

    save.combo++;

    save.bestCombo =
      Math.max(
        save.bestCombo,
        save.combo
      );


    save.score +=
      [0,100,300,500,800][cleared] *
      save.level;


    save.stardust +=
      cleared*10 +
      (cleared===4 ? 25 : 0);


    if(cleared===4)
      unlock('tetris');


    if(save.totalLines>=1)
      unlock('firstLine');


    if(save.combo>=5)
      unlock('combo5');


    sfx('line-clear');

  }else{

    save.combo = 0;

  }


  save.level =
    1 +
    Math.floor(
      save.lines/10
    );


  if(save.level>=10)
    unlock('level10');


  if(save.score>=10000)
    unlock('score10k');


  persist();

  spawn();

  hud();

}


/* =========================================================
   GAME OVER
========================================================= */

function qualifies(score){

  return (
    save.highscores.length < 10 ||
    score >
      Math.min(
        ...save.highscores
          .map(x=>x.score)
      )
  );

}


function gameOver(){

  if(!running)
    return;


  running = false;

  paused = false;

  audio.music.pause();


  save.highScore =
    Math.max(
      save.highScore,
      save.score
    );


  persist();

  sfx('game-over');


  $('finalScore')
    .textContent =
    save.score;


  const entry =
    $('highscoreEntry');


  if(
    qualifies(save.score)
  ){

    entry.classList.remove(
      'hidden'
    );

    $('highscoreName')
      .value = '';

    setTimeout(
      ()=>{

        const input =
          $('highscoreName');

        input.focus();

      },
      100
    );

  }else{

    entry.classList.add(
      'hidden'
    );

  }


  $('gameOverOverlay')
    .classList.remove(
      'hidden'
    );

}


/* =========================================================
   HIGH SCORES
========================================================= */

function escapeHtml(value){

  return String(value)
    .replace(
      /[&<>"']/g,
      c=>({

        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'

      }[c])
    );

}


function renderHighscores(){

  const element =
    $('highscoreList');


  if(!element)
    return;


  element.innerHTML = '';


  if(
    !save.highscores.length
  ){

    element.innerHTML =
      '<p class="empty-scores">' +
      'No scores yet. Someone has to go first.' +
      '</p>';

    return;

  }


  save.highscores
    .forEach(
      (score,index)=>{

        const row =
          document.createElement('div');


        row.className =
          'score-row';


        row.innerHTML = `

          <span class="rank">
            ${String(index+1).padStart(2,'0')}
          </span>

          <span class="score-name">
            ${escapeHtml(score.name)}
          </span>

          <b>
            ${score.score}
          </b>

        `;


        element.appendChild(row);

      }
    );

}


function submitScore(){

  if(
    !qualifies(save.score)
  ){

    return;

  }


  const input =
    $('highscoreName');


  const name =
    input.value
      .toUpperCase()
      .replace(
        /[^A-Z0-9 ]/g,
        ''
      )
      .trim()
      .slice(0,8) ||
    'PLAYER';


  save.highscores.push({

    name,
    score:save.score

  });


  save.highscores.sort(
    (a,b)=>b.score-a.score
  );


  save.highscores =
    save.highscores.slice(0,10);


  persist();

  renderHighscores();


  $('highscoreEntry')
    .classList.add(
      'hidden'
    );


  sfx('menu');

}


/* =========================================================
   GAME LOOP
========================================================= */

function loop(time){

  if(!running)
    return;


  const delta =
    time-last;


  last = time;


  if(!paused){

    fall += delta;


    if(
      fall >=
      Math.max(
        90,
        800-
        (save.level-1)*65
      )
    ){

      fall = 0;

      soft();

    }


    draw();

  }


  requestAnimationFrame(loop);

}


/* =========================================================
   START
========================================================= */

function start(){

  save.score = 0;

  save.lines = 0;

  save.combo = 0;

  save.level = 1;


  reset();


  current = null;

  next = null;


  running = true;

  paused = false;


  $('gameOverOverlay')
    .classList.add(
      'hidden'
    );


  $('pauseOverlay')
    .classList.add(
      'hidden'
    );


  spawn();


  show('gameScreen');

  music();


  last =
    performance.now();


  requestAnimationFrame(
    loop
  );


  hud();

}


/* =========================================================
   HUD
========================================================= */

function hud(){

  $('score').textContent =
    save.score;

  $('level').textContent =
    save.level;

  $('lines').textContent =
    save.lines;

  $('combo').textContent =
    save.combo;

  $('stardust').textContent =
    save.stardust;

}


/* =========================================================
   COSMIC BLOCK RENDERING
========================================================= */

function drawCosmicCell(
  type,
  x,
  y,
  size=S,
  target=ctx
){

  const color =
    COLORS[type];


  const px =
    x*size;

  const py =
    y*size;


  target.save();


  /* glow */

  target.shadowColor =
    color;

  target.shadowBlur =
    save.photoSensitivity
      ? 4
      : 14;


  target.fillStyle =
    color;


  target.fillRect(
    px+1,
    py+1,
    size-2,
    size-2
  );


  target.shadowBlur = 0;


  /* cosmic interior */

  const gradient =
    target.createRadialGradient(
      px+size*.32,
      py+size*.25,
      1,
      px+size*.55,
      py+size*.55,
      size*.75
    );


  gradient.addColorStop(
    0,
    'rgba(255,255,255,.38)'
  );

  gradient.addColorStop(
    .25,
    'rgba(255,255,255,.10)'
  );

  gradient.addColorStop(
    .7,
    'rgba(0,0,0,.10)'
  );

  gradient.addColorStop(
    1,
    'rgba(0,0,0,.35)'
  );


  target.fillStyle =
    gradient;


  target.fillRect(
    px+1,
    py+1,
    size-2,
    size-2
  );


  /* stars */

  target.fillStyle =
    'rgba(255,255,255,.75)';


  const stars = [

    [.22,.28,1.1],
    [.68,.18,.7],
    [.48,.62,.8],
    [.78,.73,.55]

  ];


  for(
    const [sx,sy,r] of stars
  ){

    target.beginPath();

    target.arc(
      px+size*sx,
      py+size*sy,
      r,
      0,
      Math.PI*2
    );

    target.fill();

  }


  /* 3D bevel */

  if(save.threeD){

    target.fillStyle =
      'rgba(255,255,255,.25)';

    target.fillRect(
      px+2,
      py+2,
      size-4,
      3
    );


    target.fillStyle =
      'rgba(0,0,0,.32)';

    target.fillRect(
      px+2,
      py+size-5,
      size-4,
      3
    );


    target.fillRect(
      px+size-5,
      py+2,
      3,
      size-4
    );

  }


  target.restore();

}


function draw(){

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  /* board background */

  ctx.fillStyle =
    '#080613';

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  /* grid */

  ctx.strokeStyle =
    'rgba(130,100,210,.08)';

  ctx.lineWidth = 1;


  for(
    let x=0;
    x<=W;
    x++
  ){

    ctx.beginPath();

    ctx.moveTo(
      x*S,
      0
    );

    ctx.lineTo(
      x*S,
      H*S
    );

    ctx.stroke();

  }


  for(
    let y=0;
    y<=H;
    y++
  ){

    ctx.beginPath();

    ctx.moveTo(
      0,
      y*S
    );

    ctx.lineTo(
      W*S,
      y*S
    );

    ctx.stroke();

  }


  for(
    let y=0;
    y<H;
    y++
  ){

    for(
      let x=0;
      x<W;
      x++
    ){

      if(board[y][x]){

        drawCosmicCell(
          board[y][x],
          x,
          y
        );

      }

    }

  }


  if(current){

    for(
      let y=0;
      y<current.m.length;
      y++
    ){

      for(
        let x=0;
        x<current.m[y].length;
        x++
      ){

        if(
          current.m[y][x]
        ){

          drawCosmicCell(
            current.type,
            current.x+x,
            current.y+y
          );

        }

      }

    }

  }

}


/* =========================================================
   NEXT PIECE
========================================================= */

function drawNext(){

  nctx.clearRect(
    0,
    0,
    120,
    120
  );


  if(!next)
    return;


  const matrix =
    next.m;


  const ox =
    (4-matrix[0].length)/2;

  const oy =
    (4-matrix.length)/2;


  for(
    let y=0;
    y<matrix.length;
    y++
  ){

    for(
      let x=0;
      x<matrix[y].length;
      x++
    ){

      if(
        matrix[y][x]
      ){

        drawCosmicCell(
          next.type,
          ox+x,
          oy+y,
          30,
          nctx
        );

      }

    }

  }

}


/* =========================================================
   ACHIEVEMENTS
========================================================= */

const achievements = {

  firstLine:[
    'First Line Clear',
    'Clear your first line.'
  ],

  tetris:[
    'Tetris',
    'Clear four lines at once.'
  ],

  combo5:[
    'Combo',
    'Reach a five-piece combo.'
  ],

  level10:[
    'Level 10',
    'Reach level 10.'
  ],

  score10k:[
    'Score 10,000',
    'Reach a score of 10,000.'
  ],

  demon:[
    '???',
    'Pester the shopkeeper 66 times.'
  ]

};


function unlock(key){

  if(
    !save.achievements[key]
  ){

    save.achievements[key] =
      true;

    persist();

  }

}


function renderAchievements(){

  const element =
    $('achievementList');


  if(!element)
    return;


  element.innerHTML = '';


  for(
    const [key,value]
    of Object.entries(achievements)
  ){

    const row =
      document.createElement('div');


    row.className =
      'achievement ' +
      (
        save.achievements[key]
          ? 'unlocked'
          : ''
      );


    row.innerHTML = `

      <b>
        ${
          save.achievements[key]
            ? '★'
            : '☆'
        }
        ${value[0]}
      </b>

      <br>

      <small>
        ${value[1]}
      </small>

    `;


    element.appendChild(row);

  }

}


/* =========================================================
   SHOPKEEPER
========================================================= */

const normalDialogue = [

  '* The shopkeeper looks up from the counter.\n\n"Welcome."',

  '* The shopkeeper smiles.\n\n"Take your time."',

  '* The shopkeeper straightens a few things on the stand.\n\n"See anything you like?"'

];


const peevedDialogue = [

  '* The shopkeeper watches you for a moment.\n\n"...again?"',

  '* The shopkeeper slowly looks up.\n\n"I am still here."',

  '* The shopkeeper sighs.\n\n"You could actually buy something."'

];


const poorDialogue = [

  '* The shopkeeper looks at your Stardust.\n\n"Sorry, I don\'t give credit. Come back when you are a little mmmmm richer."',

  '* The shopkeeper checks the price, then looks back at you.\n\n"You are a little short."',

  '* The shopkeeper folds their arms.\n\n"Come back when you have enough Stardust."'

];


let typing = false;
let dialogueTimer = null;


function setShopkeeperTalking(active){

  const image =
    document.querySelector(
      '.shopkeeper-art'
    );


  if(!image)
    return;


  image.src =
    active
      ? 'assets/Images/shopkeeper-talking.svg'
      : 'assets/Images/shopkeeper.svg';

}


function say(text){

  clearInterval(
    dialogueTimer
  );


  const output =
    $('dialogueText');


  $('dialogue')
    .classList.remove(
      'hidden'
    );


  output.textContent = '';

  typing = true;

  setShopkeeperTalking(
    true
  );


  let index = 0;


  dialogueTimer =
    setInterval(
      ()=>{

        output.textContent +=
          text[index++] || '';


        if(
          index%4===0
        ){

          sfx('dialogue');

        }


        if(
          index>=text.length
        ){

          clearInterval(
            dialogueTimer
          );

          typing = false;

          setShopkeeperTalking(
            false
          );

        }

      },
      18
    );

}


function shopTalk(){

  save.shopkeeperClicks++;

  persist();


  const clicks =
    save.shopkeeperClicks;


  if(
    clicks===66 &&
    !save.demonModeUnlocked
  ){

    demon();

    return;

  }


  const pool =
    clicks>=25
      ? peevedDialogue
      : normalDialogue;


  say(
    pool[
      Math.floor(
        Math.random()*pool.length
      )
    ]
  );

}


/* =========================================================
   DEMON MODE
========================================================= */

function demon(){

  save.demonModeUnlocked =
    true;

  save.demonMode =
    true;


  unlock('demon');

  persist();


  updateShop();


  const scene =
    $('shopScene');


  scene.classList.add(
    'demon'
  );


  if(
    !save.photoSensitivity
  ){

    const flash =
      $('blurpleFlash');


    flash.classList.remove(
      'fire'
    );


    void flash.offsetWidth;


    flash.classList.add(
      'fire'
    );

  }


  sfx('demon');


  say(

    '* The shopkeeper stares at you.\n\n' +

    '"...you did this."\n\n' +

    '* The shopkeeper looks directly at the screen.\n\n' +

    '"Fine. Let us see how well you do now."'

  );

}


/* =========================================================
   SHOP PURCHASES
========================================================= */

function buyTheme(theme){

  const button =
    document.querySelector(
      `[data-theme="${theme}"]`
    );


  if(!button)
    return;


  const cost =
    Number(
      button.dataset.cost || 0
    );


  if(
    save.ownedThemes.includes(
      theme
    )
  ){

    applyTheme(theme);

    say(
      '* The shopkeeper gestures toward the theme.\n\n"Already yours."'
    );

    updateShop();

    return;

  }


  if(
    save.stardust < cost
  ){

    say(
      poorDialogue[
        Math.floor(
          Math.random() *
          poorDialogue.length
        )
      ]
    );

    return;

  }


  save.stardust -= cost;


  save.ownedThemes.push(
    theme
  );


  applyTheme(theme);

  persist();

  updateShop();


  say(
    `* The shopkeeper hands over the ${theme} theme.\n\n"Pleasure doing business."`
  );

}


function updateShop(){

  $('shopDust')
    .textContent =
    save.stardust;


  const scene =
    $('shopScene');


  scene.classList.toggle(
    'peevish',
    save.shopkeeperClicks>=25
  );


  scene.classList.toggle(
    'demon',
    save.demonModeUnlocked
  );


  const demonItem =
    $('demonShopItem');


  if(demonItem){

    demonItem.classList.toggle(
      'hidden',
      !save.demonModeUnlocked
    );

  }


  document
    .querySelectorAll(
      '[data-theme]'
    )
    .forEach(button=>{

      const theme =
        button.dataset.theme;


      const owned =
        save.ownedThemes.includes(
          theme
        );


      const cost =
        Number(
          button.dataset.cost || 0
        );


      button.classList.toggle(
        'owned',
        owned
      );


      if(owned){

        button
          .querySelector('small')
          ?.replaceChildren(
            document.createTextNode(
              theme===save.theme
                ? 'EQUIPPED'
                : 'OWNED'
            )
          );

      }else{

        button
          .querySelector('small')
          ?.replaceChildren(
            document.createTextNode(
              cost===0
                ? 'FREE'
                : `${cost} ✦`
            )
          );

      }

    });

}


/* =========================================================
   PAUSE
========================================================= */

function pause(){

  if(!running)
    return;


  paused =
    !paused;


  $('pauseOverlay')
    .classList.toggle(
      'hidden',
      !paused
    );


  if(paused){

    audio.music.pause();

    sfx('pause');

  }else{

    music();

    playReversePause();

  }

}


/* =========================================================
   SETTINGS
========================================================= */

function syncSettings(){

  $('musicToggle').checked =
    !!save.music;

  $('sfxToggle').checked =
    !!save.sfx;


  $('musicVolume').value =
    save.musicVolume;

  $('sfxVolume').value =
    save.sfxVolume;


  $('musicVolumeValue')
    .textContent =
    save.musicVolume+'%';


  $('sfxVolumeValue')
    .textContent =
    save.sfxVolume+'%';


  $('threeDToggle').checked =
    !!save.threeD;


  $('photoSensitivityToggle')
    .checked =
    !!save.photoSensitivity;


  document.querySelector(
    '[data-action="mute"]'
  ).textContent =
    save.muted
      ? '🔊 UNMUTE'
      : '🔇 MUTE';

}


/* =========================================================
   THEME
========================================================= */

function applyTheme(theme){

  document.body.className =
    'theme-' + theme;


  save.theme =
    theme;


  persist();

}


/* =========================================================
   STARS
========================================================= */

function createStars(){

  const field =
    document.querySelector(
      '#starfield'
    );


  if(!field)
    return;


  field.innerHTML = '';


  for(
    let i=0;
    i<90;
    i++
  ){

    const star =
      document.createElement('i');


    star.className =
      'star';


    star.style.setProperty(
      '--x',
      Math.random()*100+'vw'
    );


    star.style.setProperty(
      '--dx',
      (
        Math.random()*18-9
      )+'vw'
    );


    star.style.setProperty(
      '--dur',
      (
        7+
        Math.random()*13
      )+'s'
    );


    star.style.setProperty(
      '--op',
      (
        .35+
        Math.random()*.65
      ).toFixed(2)
    );


    const size =
      1+
      Math.random()*3;


    star.style.width =
      size+'px';

    star.style.height =
      size+'px';


    star.style.animationDelay =
      -Math.random()*20+'s';


    field.appendChild(
      star
    );

  }

}


/* =========================================================
   INPUT
========================================================= */

document.addEventListener(
  'keydown',
  event=>{

    /*
      Don't let the high-score text field
      receive game controls.
    */

    const target =
      event.target;


    const typingField =
      target &&
      (
        target.tagName==='INPUT' ||
        target.tagName==='TEXTAREA' ||
        target.isContentEditable
      );


    if(typingField){

      if(
        target.id==='highscoreName'
      ){

        if(
          event.key==='Enter'
        ){

          event.preventDefault();

          submitScore();

        }

      }


      return;

    }


    switch(event.key){

      case 'ArrowLeft':
      case 'a':
      case 'A':

        event.preventDefault();

        move(-1);

        break;


      case 'ArrowRight':
      case 'd':
      case 'D':

        event.preventDefault();

        move(1);

        break;


      /* E = ROTATE */

      case 'e':
      case 'E':

        event.preventDefault();

        turn();

        break;


      /* R = HARD DROP */

      case 'r':
      case 'R':

        event.preventDefault();

        hard();

        break;


      case 'ArrowDown':
      case 's':
      case 'S':

        event.preventDefault();

        soft();

        break;


      case 'ArrowUp':

        event.preventDefault();

        turn();

        break;


      case ' ':

        event.preventDefault();

        hard();

        break;


      case 'Escape':

        event.preventDefault();

        pause();

        break;

    }

  }
);


/* =========================================================
   MOBILE BUTTONS
========================================================= */

document
  .querySelectorAll(
    '[data-key]'
  )
  .forEach(button=>{

    button.addEventListener(
      'click',
      ()=>{

        const key =
          button.dataset.key;


        if(key==='ArrowLeft')
          move(-1);

        else if(
          key==='ArrowRight'
        )
          move(1);

        else if(
          key==='ArrowDown'
        )
          soft();

        else if(
          key==='ArrowUp'
        )
          turn();

        else if(
          key===' '
        )
          hard();

      }
    );

  });


/* =========================================================
   ACTION BUTTONS
========================================================= */

document
  .querySelectorAll(
    '[data-action]'
  )
  .forEach(button=>{

    button.addEventListener(
      'click',
      ()=>{

        const action =
          button.dataset.action;


        if(
          action==='play' ||
          action==='restart'
        ){

          start();

        }


        else if(
          action==='shop'
        ){

          show('shop');

          updateShop();

        }


        else if(
          action==='settings'
        ){

          show('settings');

          syncSettings();

        }


        else if(
          action==='highscores'
        ){

          show('highscores');

          renderHighscores();

        }


        else if(
          action==='submitScore'
        ){

          submitScore();

        }


        else if(
          action==='clearScores'
        ){

          save.highscores = [];

          persist();

          renderHighscores();

        }


        else if(
          action==='achievements'
        ){

          show('achievements');

          renderAchievements();

        }


        else if(
          action==='pause'
        ){

          pause();

        }


        else if(
          action==='resume'
        ){

          if(paused)
            pause();

        }


        else if(
          action==='menu'
        ){

          running = false;

          paused = false;

          audio.music.pause();

          $('gameOverOverlay')
            .classList.add(
              'hidden'
            );

          $('pauseOverlay')
            .classList.add(
              'hidden'
            );

          show('menu');

        }


        else if(
          action==='mute'
        ){

          save.muted =
            !save.muted;

          persist();

          syncSettings();

          music();

        }


        else if(
          action==='exportSave'
        ){

          downloadSav();

        }


        else if(
          action==='importSave'
        ){

          $('saveFileInput').click();

        }


        else if(
          action==='demonMode'
        ){

          save.demonMode =
            !save.demonMode;

          persist();

          updateShop();

        }

      }
    );

  });


/* =========================================================
   SAVE FILE INPUT
========================================================= */

$('saveFileInput')
  .addEventListener(
    'change',
    event=>{

      if(
        event.target.files[0]
      ){

        importSavFile(
          event.target.files[0]
        );

      }


      event.target.value = '';

    }
  );


/* =========================================================
   SHOPKEEPER
========================================================= */

$('shopkeeper')
  .addEventListener(
    'click',
    shopTalk
  );


$('dialogueContinue')
  .addEventListener(
    'click',
    ()=>{

      if(!typing){

        $('dialogue')
          .classList.add(
            'hidden'
          );

        setShopkeeperTalking(
          false
        );

      }

    }
  );


document
  .querySelectorAll(
    '[data-theme]'
  )
  .forEach(button=>{

    button.addEventListener(
      'click',
      ()=>buyTheme(
        button.dataset.theme
      )
    );

  });


/* =========================================================
   SETTINGS EVENTS
========================================================= */

$('musicToggle')
  .addEventListener(
    'change',
    event=>{

      save.music =
        event.target.checked;

      persist();

      music();

    }
  );


$('sfxToggle')
  .addEventListener(
    'change',
    event=>{

      save.sfx =
        event.target.checked;

      persist();

    }
  );


$('musicVolume')
  .addEventListener(
    'input',
    event=>{

      save.musicVolume =
        Number(
          event.target.value
        );


      $('musicVolumeValue')
        .textContent =
        save.musicVolume+'%';


      persist();

      music();

    }
  );


$('sfxVolume')
  .addEventListener(
    'input',
    event=>{

      save.sfxVolume =
        Number(
          event.target.value
        );


      $('sfxVolumeValue')
        .textContent =
        save.sfxVolume+'%';


      persist();

    }
  );


$('threeDToggle')
  .addEventListener(
    'change',
    event=>{

      save.threeD =
        event.target.checked;

      persist();

      draw();

    }
  );


$('photoSensitivityToggle')
  .addEventListener(
    'change',
    event=>{

      save.photoSensitivity =
        event.target.checked;

      persist();

      document.body.classList.toggle(
        'photo-sensitive',
        save.photoSensitivity
      );

    }
  );


/* =========================================================
   TOUCH SAFETY
========================================================= */

document.addEventListener(
  'dblclick',
  event=>event.preventDefault(),
  {
    passive:false
  }
);


document.addEventListener(
  'touchend',
  event=>{

    const now =
      Date.now();

    const lastTouch =
      window.__sfLastTouch || 0;


    if(
      now-lastTouch < 320
    ){

      event.preventDefault();

    }


    window.__sfLastTouch =
      now;

  },
  {
    passive:false
  }
);


/* =========================================================
   INITIALIZE
========================================================= */

applyTheme(
  save.theme || 'Classic'
);


document.body.classList.toggle(
  'photo-sensitive',
  save.photoSensitivity
);


createStars();

renderHighscores();

renderAchievements();

updateShop();

syncSettings();

hud();

reset();

draw();

prepareReversePause();


if(
  'serviceWorker' in navigator
){

  navigator.serviceWorker
    .register('sw.js')
    .catch(
      ()=>{}
    );

}

})();
