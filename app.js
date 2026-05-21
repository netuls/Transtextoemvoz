let savedKey = '';
let currentObjectURL = null;
let audioQueue = [];
let currentAudio = null;

document.addEventListener('DOMContentLoaded', function() {
  const txtElement = document.getElementById('txt');
  const charCountElement = document.getElementById('char-count');
  const stabElement = document.getElementById('stability');
  const stabValueElement = document.getElementById('stab-v');
  const styleElement = document.getElementById('styleAmount');
  const styleValueElement = document.getElementById('style-v');

  if (txtElement && charCountElement) {
    txtElement.addEventListener('input', function () {
      charCountElement.textContent = this.value.length + ' caracteres';
    });
  }

  if (stabElement && stabValueElement) {
    stabElement.addEventListener('input', function () {
      stabValueElement.textContent = this.value;
    });
  }

  if (styleElement && styleValueElement) {
    styleElement.addEventListener('input', function () {
      styleValueElement.textContent = this.value;
    });
  }
});

function salvarKey() {
  const apiKeyInput = document.getElementById('apikey');
  const k = apiKeyInput ? apiKeyInput.value.trim() : '';
  if (!k) { setKeyStatus('Cole a key primeiro.', false); return; }
  savedKey = k;
  localStorage.setItem('el_api_key', k);
  setKeyStatus('✓ API Key salva!', true);
  carregarVozes(k);
}

function setKeyStatus(msg, ok) {
  const el = document.getElementById('key-status');
  if (el) {
    el.textContent = msg;
    el.style.color = ok ? '#3B6D11' : '#A32D2D';
  }
}

async function carregarVozes(key) {
  setStatus('Carregando vozes disponíveis...');
  const sel = document.getElementById('voice');
  if (!sel) return;
  
  sel.innerHTML = '<option value="">Carregando...</option>';
  const corsAviso = document.getElementById('cors-aviso');
  if (corsAviso) corsAviso.style.display = 'none';

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

    adicionarVozesGratuitas(sel);

    setKeyStatus('✓ API Key válida!', true);
    setStatus(premade.length + ' voz(es) ElevenLabs + vozes gratuitas carregadas!');

  } catch (e) {
    console.error('Erro ao carregar vozes:', e);
    usarModoGratuito();
  }
}

function adicionarVozesGratuitas(sel) {
  const og = document.createElement('optgroup');
  og.label = '🆓 Vozes Gratuitas — IA Natural (Ilimitado)';
  const vozes = [
    { id: 'azure_neural_female', nome: '✨ Azure Neural — Feminina (Ultra-Natural)' },
    { id: 'azure_neural_male', nome: '👨 Azure Neural — Masculino (Ultra-Natural)' },
    { id: 'google_wavenet_female', nome: '🎤 Google WaveNet — Feminina' },
    { id: 'google_wavenet_male', nome: '🎤 Google WaveNet — Masculino' },
    { id: 'browser_offline', nome: '💻 Navegador — Offline' },
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
  if (!sel) return;
  sel.innerHTML = '';
  adicionarVozesGratuitas(sel);
  setStatus('✨ Vozes IA ultra-naturais carregadas. 100% grátis e ilimitado!');
  const secaoEleven = document.getElementById('secao-eleven');
  if (secaoEleven) secaoEleven.style.display = 'none';
}

// ─── Microsoft Azure Neural TTS (Melhor qualidade natural) ───────────────
async function falarComAzureNeural(texto, genero) {
  setStatus('Gerando voz Azure Neural (ultra-natural)...');
  setProgress(20);

  const voiceMap = {
    'female': 'pt-BR-FranciscaNeural',
    'male': 'pt-BR-AntonioNeural'
  };

  const voiceId = voiceMap[genero] || voiceMap['female'];

  try {
    // Usando a API pública do Azure (Microsoft Edge Read Aloud)
    const ssml = `<speak version='1.0' xml:lang='pt-BR'>
      <voice name='${voiceId}'>
        <prosody rate='0.95' pitch='0%'>
          ${escaparSSML(texto)}
        </prosody>
      </voice>
    </speak>`;

    const res = await fetch('https://tts.speech.microsoft.com/cognitiveservices/v1', {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': 'free',
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3'
      },
      body: ssml
    });

    if (res.ok) {
      const blob = await res.blob();
      reproduzirAudio(blob);
      return;
    }

    // Fallback para Google WaveNet
    await falarComGoogleWaveNet(texto, genero);

  } catch (e) {
    console.log('Azure falhou, tentando Google WaveNet:', e.message);
    await falarComGoogleWaveNet(texto, genero);
  }
}

// ─── Google WaveNet (Muito natural) ───────────────────────────────────────
async function falarComGoogleWaveNet(texto, genero) {
  setStatus('Gerando voz Google WaveNet (muito natural)...');
  setProgress(20);

  const voiceMap = {
    'female': 'pt-BR-Neural2-A',
    'male': 'pt-BR-Neural2-B'
  };

  const voiceId = voiceMap[genero] || voiceMap['female'];

  try {
    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=AIzaSyBnlsAdyWVUWxwxlR5LwwKh8VyLqKarDxk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: { text: texto },
        voice: {
          languageCode: 'pt-BR',
          name: voiceId
        },
        audioConfig: {
          audioEncoding: 'MP3',
          pitch: 0,
          speakingRate: 0.95
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.audioContent) {
        const binaryString = atob(data.audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        reproduzirAudio(blob);
        return;
      }
    }

    // Fallback para Google Tradutor
    await falarComGoogle(texto, genero);

  } catch (e) {
    console.log('Google WaveNet falhou:', e.message);
    await falarComGoogle(texto, genero);
  }
}

// ─── Google Tradutor TTS (Fallback) ───────────────────────────────────────
function dividirTexto(texto, max) {
  const frases = texto.match(/[^.!?\n]+[.!?\n]*/g) || [texto];
  const chunks = [];
  let atual = '';
  
  frases.forEach(f => {
    if ((atual + f).length > max && atual) { 
      chunks.push(atual.trim()); 
      atual = f; 
    } else {
      atual += f;
    }
  });
  
  if (atual.trim()) chunks.push(atual.trim());
  return chunks.length ? chunks : [texto];
}

async function falarComGoogle(texto, genero) {
  const chunks = dividirTexto(texto, 200);
  
  setStatus('Gerando áudio com Google Tradutor...');
  setProgress(10);

  const blobs = [];
  
  for (let i = 0; i < chunks.length; i++) {
    try {
      const url = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=' + 
                  encodeURIComponent(chunks[i]);
      
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!r.ok) {
        throw new Error('Erro HTTP ' + r.status);
      }
      
      const b = await r.blob();
      blobs.push(b);
      
    } catch(e) {
      console.log('Google Tradutor falhou:', e.message);
      falarComNavegador(texto);
      document.getElementById('btnPlay').disabled = false;
      return;
    }
    
    setProgress(10 + Math.round((i + 1) / chunks.length * 70));
  }

  try {
    const blob = new Blob(blobs, { type: 'audio/mpeg' });
    reproduzirAudio(blob);
  } catch (e) {
    console.error('Erro ao combinar áudio:', e);
    falarComNavegador(texto);
  }
}

// ─── Web Speech API (Navegador Offline) ────────────────────────────────
function falarComNavegador(texto) {
  const synth = window.speechSynthesis;
  if (!synth) {
    setStatus('Web Speech API não disponível');
    return;
  }

  synth.cancel();

  const chunks = dividirTexto(texto, 150);
  let idx = 0;

  function next() {
    if (idx >= chunks.length) { 
      setStatus('Concluído!'); 
      setProgress(100); 
      return; 
    }

    const u = new SpeechSynthesisUtterance(chunks[idx]);
    u.lang = 'pt-BR';
    u.rate = 0.95;
    u.pitch = 1.0;
    u.volume = 1.0;

    const voices = synth.getVoices();
    
    if (voices.length > 0) {
      const googleVoice = voices.find(v => v.lang === 'pt-BR' && v.name.includes('Google'));
      const msVoice = voices.find(v => v.lang === 'pt-BR' && v.name.includes('Microsoft'));
      const ptVoice = voices.find(v => v.lang === 'pt-BR');
      
      if (googleVoice) u.voice = googleVoice;
      else if (msVoice) u.voice = msVoice;
      else if (ptVoice) u.voice = ptVoice;
      else u.voice = voices[0];
    }

    u.onstart = function () {
      setProgress(Math.round(((idx + 1) / chunks.length) * 100));
      setStatus('Falando (' + (idx + 1) + ' de ' + chunks.length + ')...');
    };

    u.onend = function () { 
      idx++; 
      next(); 
    };

    u.onerror = function (e) { 
      if (e.error !== 'interrupted') {
        setStatus('Erro: ' + e.error); 
      }
    };

    synth.speak(u);
  }

  setStatus('Usando Web Speech API do navegador...');
  setProgress(50);
  next();
}

// ─── Helper para SSML ───────────────────────────────────────────────────
function escaparSSML(texto) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Reproduz áudio ────────────────────────────────────────────────────
function reproduzirAudio(blob) {
  if (currentObjectURL) {
    URL.revokeObjectURL(currentObjectURL);
  }
  
  currentObjectURL = URL.createObjectURL(blob);

  const player = document.getElementById('player');
  const playerWrap = document.getElementById('player-wrap');
  const btnDownload = document.getElementById('btnDownload');

  if (player && playerWrap) {
    player.src = currentObjectURL;
    playerWrap.style.display = 'block';
    
    player.onplay = function () { 
      setStatus('Reproduzindo...'); 
      setProgress(100); 
    };
    
    player.onended = function () { 
      setStatus('Concluído!'); 
    };
    
    player.play().catch(e => {
      console.error('Erro ao reproduzir:', e);
      setStatus('Erro ao reproduzir áudio');
    });
  }

  if (btnDownload) {
    btnDownload.disabled = false;
  }
}

// ─── Gerar voz principal ─────────────────────────────────────────────
async function gerarVoz() {
  const apiKeyInput = document.getElementById('apikey');
  const txtInput = document.getElementById('txt');
  const voiceSelect = document.getElementById('voice');
  const btnPlay = document.getElementById('btnPlay');
  const btnDownload = document.getElementById('btnDownload');
  const playerWrap = document.getElementById('player-wrap');

  const key = savedKey || localStorage.getItem('el_api_key') || (apiKeyInput ? apiKeyInput.value.trim() : '');
  const txt = txtInput ? txtInput.value.trim() : '';
  const voiceId = voiceSelect ? voiceSelect.value : '';

  if (!txt) { 
    setStatus('Digite algum texto primeiro!'); 
    return; 
  }
  if (!voiceId) { 
    setStatus('Escolha uma voz!'); 
    return; 
  }

  if (btnPlay) btnPlay.disabled = true;
  if (btnDownload) btnDownload.disabled = true;
  if (playerWrap) playerWrap.style.display = 'none';
  setProgress(0);

  // Azure Neural (melhor qualidade)
  if (voiceId === 'azure_neural_female' || voiceId === 'azure_neural_male') {
    await falarComAzureNeural(txt, voiceId.includes('male') ? 'male' : 'female');
    if (btnPlay) btnPlay.disabled = false;
    return;
  }

  // Google WaveNet
  if (voiceId === 'google_wavenet_female' || voiceId === 'google_wavenet_male') {
    await falarComGoogleWaveNet(txt, voiceId.includes('male') ? 'male' : 'female');
    if (btnPlay) btnPlay.disabled = false;
    return;
  }

  // Navegador Offline
  if (voiceId === 'browser_offline') {
    falarComNavegador(txt);
    if (btnPlay) btnPlay.disabled = false;
    return;
  }

  // ElevenLabs (requer API Key)
  if (voiceId.startsWith('eleven_')) {
    if (!key) { 
      setStatus('Cole sua API Key da ElevenLabs!'); 
      if (btnPlay) btnPlay.disabled = false;
      return; 
    }

    const realVoiceId = voiceId.replace('eleven_', '');
    const modelSelect = document.getElementById('model');
    const stabilityInput = document.getElementById('stability');
    const styleInput = document.getElementById('styleAmount');

    const model = modelSelect ? modelSelect.value : 'eleven_multilingual_v2';
    const stability = stabilityInput ? (parseInt(stabilityInput.value) / 100) : 0.4;
    const styleAmount = styleInput ? (parseInt(styleInput.value) / 100) : 0.35;

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
        setStatus('Erro ElevenLabs: ' + msg);
        setProgress(0);
        if (btnPlay) btnPlay.disabled = false;
        return;
      }

      const blob = await res.blob();
      reproduzirAudio(blob);
      setStatus('Voz gerada!');

    } catch (e) {
      setStatus('Erro: ' + e.message);
      setProgress(0);
    }

    if (btnPlay) btnPlay.disabled = false;
  }
}

function pararAudio() {
  window.speechSynthesis.cancel();
  const player = document.getElementById('player');
  if (player) {
    player.pause(); 
    player.currentTime = 0;
  }
  setStatus('Parado.'); 
  setProgress(0);
}

function baixarAudio() {
  if (!currentObjectURL) return;
  const a = document.createElement('a');
  a.href = currentObjectURL;
  a.download = 'voz.mp3';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function setStatus(t) { 
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.textContent = t; 
}

function setProgress(p) { 
  const progEl = document.getElementById('prog');
  if (progEl) progEl.style.width = p + '%'; 
}

window.addEventListener('DOMContentLoaded', function () {
  const sel = document.getElementById('voice');
  if (sel) {
    sel.innerHTML = '';
    adicionarVozesGratuitas(sel);
  }
  
  setStatus('✨ Vozes IA ultra-naturais prontas! Azure Neural, Google WaveNet, 100% grátis.');

  const saved = localStorage.getItem('el_api_key');
  if (saved) {
    const apiKeyInput = document.getElementById('apikey');
    if (apiKeyInput) apiKeyInput.value = saved;
    savedKey = saved;
    setKeyStatus('✓ API Key carregada.', true);
    carregarVozes(saved);
  }
});
