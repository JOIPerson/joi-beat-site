// src/App.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSound from 'use-sound';

// Dirty persona lines
const textLines = {
  submissive: [
    "Please pound me harder, I live for your cock…",
    "I’m dripping wet, fill me up…",
    "Fuck me until I can’t feel my legs…",
    "I’ll do anything to make you cum…",
    "Make me your filthy little slut…",
    "I love when you fuck me raw…",
    "Spank my tight ass, daddy…",
    "I want to taste your cum dripping…",
    "Ride me like the whore I am…",
    "I ache for your hot load inside me…",
    "Use my mouth, don’t hold back…",
    "Fill my asshole with that big cock…",
    "Make me beg for every thrust…",
    "I need your hard rod in me now…",
    "My pussy is throbbing for your rhythm…",
    "Tell me I’m your personal fuck toy…",
    "I wanna feel you pulse deep inside…",
    "Pull my hair and fuck me harder…",
    "I’m nothing without your pounding…",
    "Use me like the dirty bitch I am…",
    "Cum on my face, I deserve it…",
    "I’m your slut, give me everything…",
    "I’ll squirt for you, don’t stop…",
    "Choke me with your length…",
    "Take me as hard as you want…"
  ],
  dominant: [
    "Kneel and worship my hard cock…",
    "You exist to serve me, fuck that pussy…",
    "I’ll train you to obey every command…",
    "Crawl on your knees and beg for release…",
    "I own you, and I’ll break you…",
    "Do as I say or taste the whip…",
    "You’re my toy—use that mouth…",
    "Beg me to let you cum…",
    "My rod decides your fate…",
    "Submit to my raw power…",
    "You’ll ache for every thrust of my cock…",
    "I demand your complete surrender…",
    "Prove your devotion with each stroke…",
    "Consume my seed on command…",
    "You’re nothing without my pleasure…",
    "Obey or suffer my discipline…",
    "My cock, your obedience—no exceptions…",
    "I’ll break you, then build you back…",
    "My filthy cock owns your wetness…",
    "Face down, ass up, and take it…"
  ],
  tease: [
    "Bet you can’t keep up with my pace…",
    "Feel that build? You want more…",
    "Just a taste, then I’ll stop… or not…",
    "You’re so close, aren’t you?…",
    "I love seeing you struggle…",
    "Don’t you dare quit on me…",
    "I’ll edge you until you scream…",
    "You’re pathetic, but I like it…",
    "Come on, show me what you’ve got…"
  ]
};

function usePreloadMedia(list, count = 5) {
  const cache = useRef(new Set());
  useEffect(() => {
    list
      .filter(m => m.type === 'image')
      .slice(0, count)
      .forEach(m => {
        if (!cache.current.has(m.file_url)) {
          const img = new Image();
          img.src = m.file_url;
          cache.current.add(m.file_url);
        }
      });
  }, [list, count]);
}

export default function App() {
  // ——— Settings States ———
  const [site, setSite]           = useState('gelbooru');
  const [shuffleImages, setShuffleImages] = useState(false);
  const [tags, setTags]           = useState('');
  const [blacklist, setBlacklist] = useState('');
  const [minBpm, setMinBpm]       = useState(60);
  const [maxBpm, setMaxBpm]       = useState(180);
  const [persona, setPersona]     = useState('submissive');
  const [darkMode, setDarkMode]   = useState(true);
  const [ttsEnabled, setTts]      = useState(false);
  const [clickVol, setClickVol]   = useState(0.5);

  // ——— New: Phase Durations & Image Rate ———
  const [introDur,   setIntroDur]   = useState(30);
  const [buildupDur, setBuildupDur] = useState(90);
  const [critDur,    setCritDur]    = useState(30);
  const [imgRate,    setImgRate]    = useState(5);   // seconds per image

  // ——— Session State ———
  const [mediaList,     setMediaList]     = useState([]);   // { file_url, type }
  const [beatTimes,     setBeatTimes]     = useState([]);   // ms offsets
  const [sessionActive, setSessionActive] = useState(false);
  const [currentMedia,  setCurrentMedia]  = useState(0);
  const [loading,       setLoading]       = useState(false);

  // ——— Mini-Game State ———
  const [hits,     setHits]     = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [score,    setScore]    = useState(0);
  const beatHitsRef = useRef([]);

  // ——— TTS Voices ———
  const [elevenApiKey, setElevenApiKey]       = useState('');
  const [elevenVoices, setElevenVoices]       = useState([]);
  const [elevenVoiceId, setElevenVoiceId]     = useState('');

  // ——— Refs & Sounds ———
  const startRef   = useRef(0);
  const rafRef     = useRef(null);
  const canvasRef  = useRef(null);
  const [playClick, { sound: clickSound }] = useSound(
    '/click.mp3',
    { volume: clickVol }
  );
  
    // ——— Overlay Prompt State ———
  const [overlayText, setOverlayText]       = useState('');
  const [overlayVisible, setOverlayVisible] = useState(false);
  const lastPromptRef = useRef(0);

  // ——— showPrompt: display & TTS ———
  const showPrompt = useCallback((idx) => {
	const now = Date.now();
    // if we showed within the last 2s, skip
    if (now - lastPromptRef.current < 2000) return;
    lastPromptRef.current = now;
    // pick a random line for the current persona
    const lines = textLines[persona] || [];
    if (!lines.length) return;
    const txt = lines[Math.floor(Math.random() * lines.length)];
    setOverlayText(txt);
    setOverlayVisible(true);
    // hide after 2s
    setTimeout(() => setOverlayVisible(false), 2000);

    // ElevenLabs TTS
if (ttsEnabled && elevenApiKey) {
       fetch('/api/eleven', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           text: txt,
           voiceId: elevenVoiceId,
           apiKey: elevenApiKey
         })
       })
        .then(res => {
          // if we got HTML back, it’s an error
          const ct = res.headers.get('Content-Type') || '';
          if (!ct.startsWith('audio/')) {
            // disable ElevenLabs and fallback
            setTts(false);
            alert('ElevenLabs TTS failed (free tier locked or invalid key). Falling back to browser TTS.');
            throw new Error('Invalid TTS response: ' + ct);
          }
          return res.blob();
        })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          new Audio(url).play();
        })
        .catch(err => {
          console.warn('ElevenLabs TTS error, falling back:', err);
          // fallback to native speechSynthesis
          if (window.speechSynthesis) {
            const u = new SpeechSynthesisUtterance(txt);
            window.speechSynthesis.speak(u);
          }
        });
    }
  }, [persona, ttsEnabled, elevenApiKey, elevenVoiceId]);

  // Unlock Howler on first click for audio
  useEffect(() => {
    const unlock = () => {
      clickSound?._sounds?.forEach(s => s._sounds?.[0]?.play?.());
      window.removeEventListener('click', unlock);
    };
    window.addEventListener('click', unlock, { once: true });
  }, [clickSound]);
  
useEffect(() => {
  if (ttsEnabled && elevenApiKey) {
    fetch(`/api/eleven/voices?apiKey=${encodeURIComponent(elevenApiKey)}`)
      .then(res => res.json())
      .then(data => {
        if (data.voices) {
          setElevenVoices(data.voices);
          // default to the first one if none selected yet
          if (!elevenVoiceId && data.voices.length) {
            setElevenVoiceId(data.voices[0].voice_id);
          }
        }
      })
      .catch(err => {
        console.error('Failed to load ElevenLabs voices', err);
        setElevenVoices([]);
      });
  } else {
    setElevenVoices([]);
  }
}, [ttsEnabled, elevenApiKey]);

  usePreloadMedia(mediaList);

  // ——— Fetch & Normalize Media ———
  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/booru?site=${site}` +
                  `&tags=${encodeURIComponent(tags)}` +
                  `&blacklist=${encodeURIComponent(blacklist)}`;
      const res = await fetch(url);
      const data = await res.json();
      return (data.posts||[]).map(p => {
        const u = p.file_url;
        return { file_url: u, type: /\.(mp4|webm)$/i.test(u)? 'video':'image' };
      }).slice(0,50);
    } catch(e) {
      console.error(e);
      return [];
    } finally {
      setLoading(false);

    }
  }, [site,tags,blacklist]);

  // ——— Generate Beats in 20s Chunks ———
  const BEAT_PATTERNS = [
    { name:'Half-Time', steps:[2] },
    { name:'Normal',    steps:[1] },
    { name:'Gallop',    steps:[0.5,0.5,1] },
    { name:'Double-Time',    steps:[0.5] },
  ];
  const DOUBLE_TIME = { name:'Double-Time', steps:[0.5] };
  const CHUNK_SEC   = 20;

  const genBeats = useCallback(() => {
    // dynamic sections
    const sections = [
      { name:'Intro',   dur:introDur },
      { name:'Buildup', dur:buildupDur },
      { name:'Critical',dur:critDur }
    ];
    const totalSec = sections.reduce((s,sec)=>s+sec.dur,0);
    const totalMs  = totalSec * 1000;
    const numChunks= Math.ceil(totalSec/CHUNK_SEC);
    const critStart= introDur + buildupDur;

    let times = [], offset=0;
    for(let c=0;c<numChunks;c++){
      const startSec = c*CHUNK_SEC;
      const durSec   = Math.min(CHUNK_SEC, totalSec-startSec);
      const durMs    = durSec*1000;
      const ratio    = startSec/totalSec;
      const bpm      = minBpm + (maxBpm-minBpm)*ratio;
      const ms       = 60000/bpm;

      const pat = startSec>=critStart ? DOUBLE_TIME
                : BEAT_PATTERNS[Math.floor(Math.random()*BEAT_PATTERNS.length)];

      let t=0,idx=0;
      while(t<durMs){
        times.push(offset+t);
        t+=pat.steps[idx++%pat.steps.length]*ms;
      }
      offset += durMs;
    }
    setBeatTimes(times);
  }, [introDur,buildupDur,critDur,minBpm,maxBpm]);

  // ——— Start Session ———
  const startSession = async () => {
    const list = await fetchMedia();
    if (!list.length) {
      alert('No media found, try different tags');
      return;
    }
	
    const ordered = shuffleImages
      ? [...list].sort(() => Math.random() - 0.5)
      : list;
    setMediaList(ordered);

    genBeats();
    startRef.current = performance.now();
    setCurrentMedia(0);
    setHits(0);
    setAttempts(0);
    setFeedback('');
    setSessionActive(true);
	showPrompt(0);
  };

  // init beatHits
  useEffect(()=>{
    if(sessionActive && beatTimes.length){
      beatHitsRef.current = new Array(beatTimes.length).fill(false);
    }
  },[sessionActive,beatTimes]);

  // ——— Tap-to-the-beat & Miss logic (Space only) ———
  useEffect(()=>{
    const TH = 150;

    function onKey(e){
      if (e.code !== 'Space') return;
      e.preventDefault();                // never let space hit a button
	  e.stopPropagation();
	  e.stopImmediatePropagation();
      if (!sessionActive) return;

      setAttempts(a=>a+1);
      const now = performance.now() - startRef.current;
      let bestDiff=Infinity, bestIdx=-1;

      beatTimes.forEach((bt,i)=>{
        const d = Math.abs(bt - now);
        if (d < bestDiff) { bestDiff = d; bestIdx = i; }
      });

      if (
        bestIdx >= 0 &&
        bestIdx < beatHitsRef.current.length &&
        bestDiff <= TH &&
        !beatHitsRef.current[bestIdx]
      ) {
        beatHitsRef.current[bestIdx] = true;

        // decide rating & points
        let points=0, label='Miss';
        if      (bestDiff < 50)  { label='Perfect'; points=5; }
        else if (bestDiff < 100) { label='Good';    points=3; }
        else                     { label='Ok';      points=1; }

        setHits(h=>h+1);
        setScore(s=>s+points);
        setFeedback(label);
      } else {
        setFeedback('Miss');
		setScore(s => s - 5);
      }
    }

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [sessionActive, beatTimes]);


  // ——— Canvas & Beat Crossing ———
  useEffect(()=>{
    if(!sessionActive||!beatTimes.length) return;
    const c=canvasRef.current,ctx=c.getContext('2d');
    const resize=()=>{
      c.width=window.innerWidth;
      c.height=window.innerHeight*0.25;
    };
    resize();window.addEventListener('resize',resize);

    const W=c.width,H=c.height,hitX=W*0.1,lead=2000;
    const pPx=16,gPx=32,oPx=64;
    let bi=0;

    function draw(ts){
      const e=ts-startRef.current;
      ctx.clearRect(0,0,W,H);

      // zones
      ctx.fillStyle='rgba(0,255,0,0.2)'; ctx.fillRect(hitX-pPx,0,pPx*2,H);
      ctx.fillStyle='rgba(255,255,0,0.15)'; ctx.fillRect(hitX-gPx,0,gPx*2,H);
      ctx.fillStyle='rgba(255,165,0,0.1)'; ctx.fillRect(hitX-oPx,0,oPx*2,H);

      // line
      ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(hitX-4,0,8,H);

      // beat cross
      if(bi<beatTimes.length && e>=beatTimes[bi]){
        setAttempts(a=>a+1);
        if(!beatHitsRef.current[bi]) setFeedback('Miss');
        playClick();
        bi++;
      }

      // notes
      ctx.fillStyle='#0ff';ctx.shadowColor='#0ff';ctx.shadowBlur=8;
      beatTimes.slice(bi,bi+20).forEach(bt=>{
        const dt=bt-e;
        if(dt<=lead&&dt>=-50){
          const p=1-dt/lead;
          const x=W-(W-hitX)*p;
          ctx.beginPath();ctx.arc(x,H/2,8,0,2*Math.PI);ctx.fill();
        }
      });ctx.shadowBlur=0;

      rafRef.current=requestAnimationFrame(draw);
    }
    rafRef.current=requestAnimationFrame(draw);
    return ()=>{
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize',resize);
    };
  },[sessionActive,beatTimes,playClick]);

  // ——— Timer ———
  const totalMs = beatTimes.length?beatTimes[beatTimes.length-1]:0;
  const [timeLeft,setTimeLeft]=useState(0);
  useEffect(()=>{
    if(!sessionActive||!totalMs) return;
    const iv=setInterval(()=>{
      const e=performance.now()-startRef.current;
      setTimeLeft(Math.max(0,Math.ceil((totalMs-e)/1000)));
    },200);
    return ()=>clearInterval(iv);
  },[sessionActive,totalMs]);

  // ——— Media Switch ———
  useEffect(()=>{
    if(!sessionActive||!mediaList.length) return;
    let tm;
    const next = () =>
      setCurrentMedia(i => {
        const ni = (i + 1) % mediaList.length;
        showPrompt(ni);
        return ni;
      });
    if(mediaList[currentMedia].type==='image'){
      tm = setTimeout(next, imgRate*1000);
    }
    return ()=>clearTimeout(tm);
  },[sessionActive,mediaList,currentMedia,imgRate]);

  // ——— Fullscreen ———
  const toggleFS=()=>{
    if(!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  // ——— Render ———
  if (loading) return (<div className="h-screen flex items-center justify-center bg-black text-white">Loading…</div>);

  if (!sessionActive) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-900 to-indigo-900 p-6">
        <div className="bg-gray-900 bg-opacity-90 p-8 rounded-2xl shadow-xl w-full max-w-lg space-y-8">
          <h1 className="text-4xl text-white font-extrabold text-center">🔥 JOI Beat 🔥</h1>

          {/* Media Source */}
          <fieldset className="space-y-2">
            <legend className="text-lg text-indigo-300">Media Source</legend>
            <label className="block text-white">Site</label>
            <select
              value={site}
              onChange={e => setSite(e.target.value)}
              className="w-full p-3 bg-gray-800 rounded text-white focus:outline-none"
            >
              <option value="gelbooru">Gelbooru</option>
              <option value="rule34">Rule34.xxx</option>
              <option value="realbooru">Realbooru</option>
            </select>

            <label className="block text-white mt-4">
              Tags <span className="text-gray-400">(e.g. 1girl nsfw)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="1girl nsfw"
              className="w-full p-3 bg-gray-800 rounded text-white focus:outline-none"
            />

            <label className="block text-white mt-4">
              Blacklist <span className="text-gray-400">(e.g. -loli -gore)</span>
            </label>
            <input
              type="text"
              value={blacklist}
              onChange={e => setBlacklist(e.target.value)}
              placeholder="-loli -gore"
              className="w-full p-3 bg-gray-800 rounded text-white focus:outline-none"
            />
          </fieldset>

          {/* Phases */}
          <fieldset className="space-y-2">
            <legend className="text-lg text-indigo-300">Phases (seconds)</legend>

            <label className="block text-white">Intro Phase</label>
            <input
              type="number"
              min="1"
              value={introDur}
              onChange={e => setIntroDur(+e.target.value)}
              className="w-full p-3 bg-gray-800 rounded text-white focus:outline-none"
            />

            <label className="block text-white">Build-Up Phase</label>
            <input
              type="number"
              min="1"
              value={buildupDur}
              onChange={e => setBuildupDur(+e.target.value)}
              className="w-full p-3 bg-gray-800 rounded text-white focus:outline-none"
            />

            <label className="block text-white">Critical Phase</label>
            <input
              type="number"
              min="1"
              value={critDur}
              onChange={e => setCritDur(+e.target.value)}
              className="w-full p-3 bg-gray-800 rounded text-white focus:outline-none"
            />
          </fieldset>

          {/* Pace */}
          <fieldset className="space-y-2">
            <legend className="text-lg text-indigo-300">Pace (BPM)</legend>

            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block text-white">Min BPM</label>
                <input
                  type="number"
                  min="1"
                  value={minBpm}
                  onChange={e => setMinBpm(+e.target.value)}
                  className="w-full p-3 bg-gray-800 rounded text-white focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-white">Max BPM</label>
                <input
                  type="number"
                  min="1"
                  value={maxBpm}
                  onChange={e => setMaxBpm(+e.target.value)}
                  className="w-full p-3 bg-gray-800 rounded text-white focus:outline-none"
                />
              </div>
            </div>

            <label className="block text-white mt-4">Image Change Rate (sec)</label>
            <input
              type="number"
              min="1"
              value={imgRate}
              onChange={e => setImgRate(+e.target.value)}
              className="w-full p-3 bg-gray-800 rounded text-white focus:outline-none"
            />
			 <div className="flex items-center mt-2">
				<input
				type="checkbox"
				checked={shuffleImages}
				onChange={e => setShuffleImages(e.target.checked)}
				className="form-checkbox h-5 w-5 text-indigo-400"
				/>
				<span className="ml-2 text-white">Shuffle Image Order</span>
			</div>
          </fieldset>

          {/* Persona & TTS */}
          <fieldset className="space-y-2">
            <legend className="text-lg text-indigo-300">Persona &amp; Voice</legend>

            <label className="block text-white">Persona</label>
            <select
              value={persona}
              onChange={e => setPersona(e.target.value)}
              className="w-full p-3 bg-gray-800 rounded text-white focus:outline-none"
            >
              <option value="submissive">Submissive</option>
              <option value="dominant">Dominant</option>
              <option value="tease">Tease</option>
            </select>

            <div className="flex items-center mt-4">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={e => setDarkMode(e.target.checked)}
                className="form-checkbox h-5 w-5 text-indigo-400"
              />
              <span className="ml-2 text-white">Dark Mode</span>
            </div>

            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                checked={ttsEnabled}
                onChange={e => setTts(e.target.checked)}
                className="form-checkbox h-5 w-5 text-indigo-400"
              />
              <span className="ml-2 text-white">Enable TTS</span>
            </div>

            {ttsEnabled && (
              <>
                <input
                  type="password"
                  placeholder="ElevenLabs API Key"
                  value={elevenApiKey}
                  onChange={e => setElevenApiKey(e.target.value)}
                  className="w-full p-3 bg-gray-800 rounded text-white focus:outline-none"
                />

                {elevenVoices.length > 0 ? (
                  <select
                    value={elevenVoiceId}
                    onChange={e => setElevenVoiceId(e.target.value)}
                    className="w-full p-3 bg-gray-800 rounded text-white focus:outline-none"
                  >
                    {elevenVoices.map(v => (
                      <option key={v.voice_id} value={v.voice_id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-gray-400 text-sm">Enter your API key to load voices…</p>
                )}
              </>
            )}

          </fieldset>

          <button
            onClick={startSession}
            className="w-full py-3 bg-pink-600 hover:bg-pink-500 rounded-xl text-white font-bold shadow-lg transition"
          >
            Start JOI Session
          </button>
        </div>
      </div>
    );
  }


// compute progress & timer strings
  const timerText = `${String(Math.floor(timeLeft/60)).padStart(2,'0')}:${String(timeLeft%60).padStart(2,'0')}`;
  const progress  = totalMs ? ((totalMs - timeLeft*1000)/totalMs) : 0;
  
	const elapsedMs = performance.now() - startRef.current;

// count how many beats have passed
const passedBeats = beatTimes.filter(bt => bt <= elapsedMs).length;

// avoid division by zero
const accuracy = passedBeats > 0 ? score / (passedBeats * 5) : 0;
	let grade = 'F';
	if      (accuracy >= 0.95) grade = 'S';
	else if (accuracy >= 0.85) grade = 'A';
	else if (accuracy >= 0.70) grade = 'B';
	else if (accuracy >= 0.60) grade = 'C';
	else if (accuracy >= 0.45) grade = 'D';

  return (
<div className={`fixed inset-0 ${darkMode ? 'bg-black' : 'bg-white'} overflow-hidden`}>
      {/* ── Top Bar ── */}
    <div className="absolute top-0 left-0 w-full flex items-center justify-between px-6 py-4 bg-black bg-opacity-50 backdrop-blur-sm z-50">
	
	{/* ── Feedback Overlay ── */}
	{feedback && (
	<div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
		<div className="px-6 py-4 bg-black bg-opacity-70 rounded-xl text-4xl text-yellow-300 font-bold drop-shadow-lg">
		{feedback}
		</div>
	</div>
	)}
	{/* Timer & Progress */}
        <div className="flex items-center space-x-4">
          <span className="font-mono text-lg text-green-400">{timerText}</span>
          <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-pink-500 rounded-full transition-all duration-200"
              style={{ width: `${Math.min(progress,1) * 100}%` }}
            />
          </div>
        </div>
        {/* Score & Controls */}
        <div className="flex items-center space-x-3">
          <span className="text-white">
			Hits: <span className="font-semibold text-pink-400">{hits}</span>/
					<span className="font-semibold text-pink-400">{beatTimes.length}</span>
			</span>
			<span className="text-white ml-4">
			Score: <span className="font-semibold text-green-400">{score}</span>
			</span>
			<span className="text-white ml-4">
				Grade: <span className="font-semibold text-yellow-400">{grade}</span>
			</span>
          <button
            onClick={toggleFS}
            className="p-2 bg-gray-800 bg-opacity-60 rounded hover:bg-opacity-80 transition"
            aria-label="Toggle Fullscreen"
          >
            {/* Simple Fullscreen Icon */}
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              { document.fullscreenElement 
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M4 4h6v6H4V4zM14 14h6v6h-6v-6zM4 14h6v6H4v-6zM14 4h6v6h-6V4z" /> 
              }
            </svg>
          </button>
          <button
            onClick={() => {
              setCurrentMedia(i => {
                const ni = (i+1) % mediaList.length;
                showPrompt(ni);
                return ni;
              });
            }}
            className="p-2 bg-pink-600 rounded-full hover:bg-pink-500 transition"
            aria-label="Next Media"
          >
            {/* Next Icon */}
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 5v10l7-5-7-5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Media Display ── */}
      <AnimatePresence mode="wait">
        {mediaList[currentMedia]?.type === 'image' ? (
          <motion.img
            key={mediaList[currentMedia].file_url}
            src={mediaList[currentMedia].file_url}
            className="absolute inset-0 object-contain w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            onError={() => setCurrentMedia(i => (i+1)%mediaList.length)}
          />
        ) : (
          <motion.video
            key={mediaList[currentMedia].file_url}
            src={mediaList[currentMedia].file_url}
            className="absolute inset-0 object-contain w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            autoPlay muted playsInline
            onEnded={() => setCurrentMedia(i => {
              const ni = (i+1)%mediaList.length;
              showPrompt(ni);
              return ni;
            })}
            onError={() => setCurrentMedia(i => (i+1)%mediaList.length)}
          />
        )}
      </AnimatePresence>

      {/* ── Prompt Overlay ── */}
      {overlayVisible && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          className="absolute inset-x-0 top-1/3 flex justify-center z-40 pointer-events-none"
        >
          <div className="bg-white bg-opacity-80 dark:bg-black dark:bg-opacity-70 px-6 py-4 rounded-xl shadow-lg backdrop-blur-sm max-w-xl">
            <p className="text-xl text-gray-900 dark:text-gray-100 text-center leading-snug">
              {overlayText}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Beat Highway ── */}
    <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black to-transparent z-30 flex items-end justify-center">
      <canvas ref={canvasRef} className="w-11/12 h-3/4 bg-gray-800 bg-opacity-50 rounded-2xl drop-shadow-lg"/>
      </div>
    </div>
  );
}
