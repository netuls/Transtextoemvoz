let savedKey = '';
let currentObjectURL = null;
let audioQueue = [];
let currentAudio = null;

document.getElementById('txt').addEventListener('input', function () {
  document.getElementById('char-count').textContent = this.value.length + ' caracteres';
});
document.getElementById('stability').addEventListener('input', function () {
  document.getElementById('stab-v').textContent = this.value;
});
document.getElementById('styleAmount').addEventListener('input', function () {
  document.getElementById('style-v').textContent = this.value;
});

function salvarKey() {
  const k = document.getElementById('apikey').value.trim();
  if (!k) { setKeyStatus('Cole a key primeiro.', false); return; }
  savedKey = k;
  localStorage.setItem('el_api_key', k);
  setKeyStatus('✓ API Key salva!', true);
  carregarVozes(k);
}

function setKeyStatus(msg, ok) {
  const el = document.getElementById('key-status');
  el.textContent = msg;
  el.style.color = ok ? '#3B6D11' : '#A32D2D';
}

async function carregarVozes(key) {
  setStatus('Carregando vozes disponíveis...');
  const sel = document.getElementById('voice');
  sel.innerHTML = '<option value="">Carregando...</option>';
  document.getElementById('cors-aviso').style.display = 'none';

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: { 'xi-api-key': key, 'Accept': 'application/json' }
    });

    if (res.status === 401) {
      sel.innerHTML = '<option value="">API Key inválida</option>';
      setKeyStatus('✗ API Key inválida.', false);
      usarModoGratuito();
      return;
    }

    if (!res.ok) {
      usarModoGratuito();
      return;
    }

    const data = await res.json();
    const premade = data.voices.filter(v => v.category === 'premade');

    if (premade.length === 0) {
      usarModoGratuito();
      return;
    }

    sel.innerHTML = '';
    const femininas = premade.filter(v => v.labels && v.labels.gender === 'female');
    const masculinas = premade.filter(v => v.labels && v.labels.gender === 'male');
    const outras = premade.filter(v => !v.labels || !v.labels.gender);

    function addGroup(label, lista) {
      if (!lista.length) return;
      const og = document.createElement('optgroup');
      og.label = label;
      lista.forEach(v => {
        const o = document.createElement('option');
        o.value = 'eleven_' + v.voice_id;
        const desc = v.labels && v.labels.description ? ' — ' + v.labels.description : '';
        o.textContent = v.name + desc;
        og.appendChild(o);
      });
      sel.appendChild(og);
    }

    addGroup('👩 Femininas — ElevenLabs', femininas);
    addGroup('👨 Masculinas — ElevenLabs', masculinas);
    addGroup('🔊 Outras — ElevenLabs', outras);

    // Adiciona Google TTS como opção gratuita
    adicionarVozesGratuitas(sel);

    setKeyStatus('✓ API Key válida!', true);
    setStatus(premade.length + ' voz(es) ElevenLabs + vozes Google gratuitas carregadas!');

  } catch (e) {
    usarModoGratuito();
  }
}

function adicionarVozesGratuitas(sel) {
  const og = document.createElement('optgroup');
  og.label = '🆓 Google TTS — Gratuito e ilimitado';
  const vozes = [
    { id: 'google_pt-BR_female', nome: 'Google Feminina — Português Brasil' },
    { id: 'google_pt-BR_male',   nome: 'Google Masculina — Português Brasil' },
    { id: 'browser_ptbr',        nome: 'Navegador — Português Brasil (offline)' },
  ];
  vozes.forEach(v => {
    const o = document.createElement('option');
    o.value = v.id;
    o.textContent = v.nome;
    og.appendChild(o);
  });
  sel.appendChild(og);
}

function usarModoGratuito() {
  const sel = document.getElementById('voice');
  sel.innerHTML = '';
  adicionarVozesGratuitas(sel);
  setStatus('Usando vozes gratuitas do Google TTS. Ilimitado!');
  document.getElementById('secao-eleven').style.display = 'none';
}

// ─── Google TTS (mesma voz do Google Tradutor) ───────────────────────────────
function dividirTexto(texto, max) {
  const frases = texto.match(/[^.!?\n]+[.!?\n]*/g) || [texto];
  const chunks = [];
  let atual = '';
  frases.forEach(f => {
    if ((atual + f).length > max && atual) { chunks.push(atual.trim()); atual = f; }
    else atual += f;
  });
  if (atual.trim()) chunks.push(atual.trim());
  return chunks.length ? chunks : [texto];
}

async function falarComGoogle(texto, genero) {
  const chunks = dividirTexto(texto, 180);
  const tl = genero === 'male' ? 'pt-BR' : 'pt-BR';

  setStatus('Gerando voz Google TTS...');
  setProgress(10);

  const blobs = [];
  for (let i = 0; i < chunks.length; i++) {
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=' + tl +
                '&client=tw-ob&q=' + encodeURIComponent(chunks[i]);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('Erro ' + r.status);
      const b = await r.blob();
      blobs.push(b);
    } catch(e) {
      // fallback para Web Speech API
      falarComNavegador(texto);
      return;
    }
    setProgress(10 + Math.round((i + 1) / chunks.length * 70));
  }

  const blob = new Blob(blobs, { type: 'audio/mpeg' });
  if (currentObjectURL) URL.revokeObjectURL(currentObjectURL);
  currentObjectURL = URL.createObjectURL(blob);

  const player = document.getElementById('player');
  player.src = currentObjectURL;
  document.getElementById('player-wrap').style.display = 'block';
  player.play();
  player.onplay = function () { setStatus('Reproduzindo...'); setProgress(100); };
  player.onended = function () { setStatus('Concluído!'); };
  document.getElementById('btnDownload').disabled = false;
}

// ─── Web Speech API (fallback offline) ───────────────────────────────────────
function falarComNavegador(texto) {
  const synth = window.speechSynthesis;
  synth.cancel();

  const chunks = dividirTexto(texto, 150);
  let idx = 0;

  function next() {
    if (idx >= chunks.length) { setStatus('Concluído!'); setProgress(100); return; }
    const u = new SpeechSynthesisUtterance(chunks[idx]);
    u.lang = 'pt-BR';
    u.rate = 0.88;
    u.pitch = 1.05;

    // Pega melhor voz disponível
    const voices = synth.getVoices();
    const ptbr = voices.find(v => v.lang === 'pt-BR' && /google/i.test(v.name))
               || voices.find(v => v.lang === 'pt-BR')
               || voices.find(v => v.lang.startsWith('pt'));
    if (ptbr) u.voice = ptbr;

    u.onstart = function () {
      setProgress(Math.round(((idx + 1) / chunks.length) * 100));
      setStatus('Falando parte ' + (idx + 1) + ' de ' + chunks.length + '...');
    };
    u.onend = function () { idx++; next(); };
    u.onerror = function (e) { if (e.error !== 'interrupted') setStatus('Erro: ' + e.error); };
    synth.speak(u);
  }
  next();
}

// ─── Gerar voz principal ─────────────────────────────────────────────────────
async function gerarVoz() {
  const key = savedKey || localStorage.getItem('el_api_key') || document.getElementById('apikey').value.trim();
  const txt = document.getElementById('txt').value.trim();
  const voiceId = document.getElementById('voice').value;

  if (!txt) { setStatus('Digite algum texto primeiro!'); return; }
  if (!voiceId) { setStatus('Escolha uma voz!'); return; }

  document.getElementById('btnPlay').disabled = true;
  document.getElementById('btnDownload').disabled = true;
  document.getElementById('player-wrap').style.display = 'none';
  setProgress(0);

  // Google TTS gratuito
  if (voiceId === 'google_pt-BR_female' || voiceId === 'google_pt-BR_male') {
    await falarComGoogle(txt, voiceId.includes('male') ? 'male' : 'female');
    document.getElementById('btnPlay').disabled = false;
    return;
  }

  // Web Speech API (offline)
  if (voiceId === 'browser_ptbr') {
    falarComNavegador(txt);
    document.getElementById('btnPlay').disabled = false;
    return;
  }

  // ElevenLabs
  if (!key) { setStatus('Cole sua API Key da ElevenLabs!'); document.getElementById('btnPlay').disabled = false; return; }

  const realVoiceId = voiceId.replace('eleven_', '');
  const model = document.getElementById('model').value;
  const stability = parseInt(document.getElementById('stability').value) / 100;
  const styleAmount = parseInt(document.getElementById('styleAmount').value) / 100;

  setStatus('Gerando voz ElevenLabs...');
  setProgress(15);

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + realVoiceId, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: txt,
        model_id: model,
        voice_settings: {
          stability: stability,
          similarity_boost: 0.80,
          style: styleAmount,
          use_speaker_boost: true
        }
      })
    });

    setProgress(70);

    if (!res.ok) {
      let err = {};
      try { err = await res.json(); } catch (e) {}
      const msg = (err && err.detail && err.detail.message) ? err.detail.message : ('Erro HTTP ' + res.status);
      setStatus('Erro ElevenLabs: ' + msg + ' — Tente uma voz Google gratuita!');
      setProgress(0);
      document.getElementById('btnPlay').disabled = false;
      return;
    }

    const blob = await res.blob();
    if (currentObjectURL) URL.revokeObjectURL(currentObjectURL);
    currentObjectURL = URL.createObjectURL(blob);

    const player = document.getElementById('player');
    player.src = currentObjectURL;
    document.getElementById('player-wrap').style.display = 'block';
    player.play();
    player.onplay = function () { setStatus('Reproduzindo...'); setProgress(100); };
    player.onended = function () { setStatus('Concluído!'); };
    document.getElementById('btnDownload').disabled = false;
    setStatus('Voz gerada!');

  } catch (e) {
    setStatus('Erro: ' + e.message);
    setProgress(0);
  }

  document.getElementById('btnPlay').disabled = false;
}

function pararAudio() {
  window.speechSynthesis.cancel();
  const p = document.getElementById('player');
  p.pause(); p.currentTime = 0;
  setStatus('Parado.'); setProgress(0);
}

function baixarAudio() {
  if (!currentObjectURL) return;
  const a = document.createElement('a');
  a.href = currentObjectURL;
  a.download = 'voz.mp3';
  a.click();
}

function setStatus(t) { document.getElementById('status').textContent = t; }
function setProgress(p) { document.getElementById('prog').style.width = p + '%'; }

window.addEventListener('DOMContentLoaded', function () {
  // Carrega vozes gratuitas por padrão
  const sel = document.getElementById('voice');
  sel.innerHTML = '';
  adicionarVozesGratuitas(sel);
  setStatus('Vozes Google gratuitas prontas! Cole sua API Key da ElevenLabs para mais opções.');

  const saved = localStorage.getItem('el_api_key');
  if (saved) {
    savedKey = saved;
    document.getElementById('apikey').value = saved;
    setKeyStatus('✓ API Key carregada.', true);
    carregarVozes(saved);
  }
});
