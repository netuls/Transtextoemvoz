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
      mostrarModoGratuito();
      return;
    }

    if (!res.ok) {
      mostrarModoGratuito();
      return;
    }

    const data = await res.json();
    const premade = data.voices.filter(v => v.category === 'premade');

    if (premade.length === 0) {
      mostrarModoGratuito();
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

    setKeyStatus('✓ API Key válida!', true);
    setStatus('✨ Vozes ElevenLabs carregadas! Clique em "Gerar voz" para começar.');

  } catch (e) {
    console.error('Erro ao carregar vozes:', e);
    mostrarModoGratuito();
  }
}

function mostrarModoGratuito() {
  const sel = document.getElementById('voice');
  if (!sel) return;
  sel.innerHTML = '<option value="">Salve sua API Key para usar ElevenLabs</option>';
  setStatus('⚠️ Cole sua API Key da ElevenLabs para usar vozes premium humaníssimas!');
  const secaoEleven = document.getElementById('secao-eleven');
  if (secaoEleven) secaoEleven.style.display = 'block';
}

// ─── ElevenLabs TTS (Voz HUMANÍSSIMA) ─────────────────────────────────────
async function gerarVozElevenLabs(key, texto, voiceId, model, stability, styleAmount) {
  setStatus('Gerando voz ElevenLabs (humana e natural)...');
  setProgress(20);

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: texto,
        model_id: model,
        voice_settings: {
          stability: stability,
          similarity_boost: 0.75,
          style: styleAmount,
          use_speaker_boost: true
        }
      })
    });

    setProgress(70);

    if (!res.ok) {
      let err = {};
      try { err = await res.json(); } catch (e) {}
      
      if (res.status === 429) {
        setStatus('❌ Limite de caracteres atingido! Aguarde até amanhã ou upgrade de plano.');
        setProgress(0);
        return false;
      }
      
      const msg = (err && err.detail && err.detail.message) ? err.detail.message : ('Erro HTTP ' + res.status);
      setStatus('❌ Erro: ' + msg);
      setProgress(0);
      return false;
    }

    const blob = await res.blob();
    reproduzirAudio(blob);
    setStatus('✅ Voz gerada com sucesso!');
    setProgress(100);
    return true;

  } catch (e) {
    setStatus('❌ Erro: ' + e.message);
    setProgress(0);
    return false;
  }
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
      setStatus('▶️ Reproduzindo...'); 
      setProgress(100); 
    };
    
    player.onended = function () { 
      setStatus('✅ Concluído!'); 
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
    setStatus('📝 Digite algum texto primeiro!'); 
    return; 
  }

  if (!key) {
    setStatus('🔑 Cole sua API Key da ElevenLabs no campo acima!');
    return;
  }

  if (!voiceId) { 
    setStatus('🎤 Escolha uma voz!'); 
    return; 
  }

  if (btnPlay) btnPlay.disabled = true;
  if (btnDownload) btnDownload.disabled = true;
  if (playerWrap) playerWrap.style.display = 'none';
  setProgress(0);

  const modelSelect = document.getElementById('model');
  const stabilityInput = document.getElementById('stability');
  const styleInput = document.getElementById('styleAmount');

  const model = modelSelect ? modelSelect.value : 'eleven_multilingual_v2';
  const stability = stabilityInput ? (parseInt(stabilityInput.value) / 100) : 0.5;
  const styleAmount = styleInput ? (parseInt(styleInput.value) / 100) : 0.5;

  const realVoiceId = voiceId.replace('eleven_', '');
  const sucesso = await gerarVozElevenLabs(key, txt, realVoiceId, model, stability, styleAmount);

  if (btnPlay) btnPlay.disabled = false;
}

function pararAudio() {
  window.speechSynthesis.cancel();
  const player = document.getElementById('player');
  if (player) {
    player.pause(); 
    player.currentTime = 0;
  }
  setStatus('⏹️ Parado.'); 
  setProgress(0);
}

function baixarAudio() {
  if (!currentObjectURL) {
    setStatus('Nenhum áudio para baixar. Gere um primeiro!');
    return;
  }
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
    sel.innerHTML = '<option value="">👇 Salve sua API Key para carregar as vozes</option>';
  }
  
  setStatus('🎙️ Cole sua API Key da ElevenLabs para começar com vozes HUMANÍSSIMAS!');

  const saved = localStorage.getItem('el_api_key');
  if (saved) {
    const apiKeyInput = document.getElementById('apikey');
    if (apiKeyInput) apiKeyInput.value = saved;
    savedKey = saved;
    setKeyStatus('✓ API Key carregada.', true);
    carregarVozes(saved);
  }
});
