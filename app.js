let savedKey = '';
let currentObjectURL = null;

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
  setStatus('Carregando vozes disponíveis na sua conta...');
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': key }
    });
    if (!res.ok) { setStatus('Pronto! Use as vozes padrão da lista.'); return; }

    const data = await res.json();
    const sel = document.getElementById('voice');
    sel.innerHTML = '';

    const minhas = data.voices.filter(v => v.category === 'cloned' || v.category === 'generated' || v.category === 'professional');
    const premade = data.voices.filter(v => v.category === 'premade');

    function addGroup(label, list) {
      if (!list.length) return;
      const og = document.createElement('optgroup');
      og.label = label;
      list.forEach(v => {
        const o = document.createElement('option');
        o.value = v.voice_id;
        const gender = v.labels?.gender || '';
        const accent = v.labels?.accent || '';
        const desc = [gender, accent].filter(Boolean).join(', ');
        o.textContent = v.name + (desc ? ' — ' + desc : '');
        og.appendChild(o);
      });
      sel.appendChild(og);
    }

    addGroup('⭐ Minhas vozes', minhas);
    addGroup('✅ Disponíveis no seu plano', premade);

    const total = minhas.length + premade.length;
    if (!total) {
      sel.innerHTML = '<option>Nenhuma voz encontrada</option>';
      setStatus('Verifique sua API Key.');
    } else {
      setStatus(total + ' voz(es) carregada(s)! Escolha uma e clique em Gerar voz.');
    }
  } catch (e) {
    setStatus('Pronto! Use as vozes padrão da lista.');
  }
}

async function gerarVoz() {
  const key = savedKey || localStorage.getItem('el_api_key') || document.getElementById('apikey').value.trim();
  const txt = document.getElementById('txt').value.trim();

  if (!key) { setStatus('Cole sua API Key primeiro!'); return; }
  if (!txt) { setStatus('Digite algum texto primeiro!'); return; }

  const voiceId = document.getElementById('voice').value;
  const model = document.getElementById('model').value;
  const stability = parseInt(document.getElementById('stability').value) / 100;
  const styleAmount = parseInt(document.getElementById('styleAmount').value) / 100;

  setStatus('Conectando à ElevenLabs...');
  setProgress(15);
  document.getElementById('btnPlay').disabled = true;
  document.getElementById('btnDownload').disabled = true;
  document.getElementById('player-wrap').style.display = 'none';

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
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
      const msg = (err?.detail?.message) || ('Erro HTTP ' + res.status);
      setStatus('Erro: ' + msg);
      setProgress(0);
      document.getElementById('btnPlay').disabled = false;
      return;
    }

    const blob = await res.blob();
    setProgress(95);

    if (currentObjectURL) URL.revokeObjectURL(currentObjectURL);
    currentObjectURL = URL.createObjectURL(blob);

    const player = document.getElementById('player');
    player.src = currentObjectURL;
    document.getElementById('player-wrap').style.display = 'block';
    player.play();

    player.onplay = () => { setStatus('Reproduzindo...'); setProgress(100); };
    player.onended = () => setStatus('Concluído!');

    document.getElementById('btnDownload').disabled = false;
    setStatus('Voz gerada com sucesso!');

  } catch (e) {
    setStatus('Erro de conexão: ' + e.message);
    setProgress(0);
  }

  document.getElementById('btnPlay').disabled = false;
}

function pararAudio() {
  const p = document.getElementById('player');
  p.pause(); p.currentTime = 0;
  setStatus('Parado.'); setProgress(0);
}

function baixarAudio() {
  if (!currentObjectURL) return;
  const a = document.createElement('a');
  a.href = currentObjectURL;
  a.download = 'voz-elevenlabs.mp3';
  a.click();
}

function setStatus(t) { document.getElementById('status').textContent = t; }
function setProgress(p) { document.getElementById('prog').style.width = p + '%'; }

window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('el_api_key');
  if (saved) {
    savedKey = saved;
    document.getElementById('apikey').value = saved;
    setKeyStatus('✓ API Key carregada automaticamente.', true);
    carregarVozes(saved);
  }
});
