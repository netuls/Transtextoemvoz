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
  setStatus('Carregando vozes da sua conta...');
  const sel = document.getElementById('voice');
  sel.innerHTML = '<option value="">Carregando...</option>';

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': key,
        'Accept': 'application/json'
      }
    });

    if (res.status === 401) {
      sel.innerHTML = '<option value="">API Key inválida</option>';
      setKeyStatus('✗ API Key inválida ou expirada.', false);
      setStatus('Verifique sua API Key no site da ElevenLabs.');
      return;
    }

    if (!res.ok) {
      sel.innerHTML = '<option value="">Erro HTTP ' + res.status + '</option>';
      setStatus('Erro ' + res.status + ' ao buscar vozes.');
      return;
    }

    const data = await res.json();

    if (!data.voices || data.voices.length === 0) {
      sel.innerHTML = '<option value="">Nenhuma voz encontrada</option>';
      setStatus('Nenhuma voz na sua conta.');
      return;
    }

    sel.innerHTML = '';

    // Agrupa por categoria
    const grupos = {};
    data.voices.forEach(v => {
      const cat = v.category || 'other';
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(v);
    });

    const nomes = {
      premade:      '✅ Vozes do plano gratuito',
      cloned:       '⭐ Minhas vozes clonadas',
      generated:    '🎨 Vozes geradas',
      professional: '🏆 Vozes profissionais',
      other:        '🔊 Outras vozes'
    };

    // Premade primeiro
    const ordem = ['premade', 'cloned', 'generated', 'professional', 'other'];
    let total = 0;

    ordem.forEach(cat => {
      if (!grupos[cat] || !grupos[cat].length) return;
      const og = document.createElement('optgroup');
      og.label = nomes[cat] || cat;
      grupos[cat].forEach(v => {
        const o = document.createElement('option');
        o.value = v.voice_id;
        const gender = v.labels && v.labels.gender ? v.labels.gender : '';
        const accent = v.labels && v.labels.accent ? v.labels.accent : '';
        const desc = [gender, accent].filter(Boolean).join(', ');
        o.textContent = v.name + (desc ? ' — ' + desc : '');
        og.appendChild(o);
        total++;
      });
      sel.appendChild(og);
    });

    setKeyStatus('✓ API Key válida!', true);
    setStatus(total + ' voz(es) carregada(s)! Escolha uma e clique em Gerar voz.');

  } catch (e) {
    // Erro de rede / CORS
    sel.innerHTML = '<option value="">Erro de conexão</option>';
    setStatus('Erro de rede: ' + e.message);
    setKeyStatus('✗ Não foi possível conectar.', false);

    // Mostra aviso de CORS
    document.getElementById('cors-aviso').style.display = 'block';
  }
}

async function gerarVoz() {
  const key = savedKey || localStorage.getItem('el_api_key') || document.getElementById('apikey').value.trim();
  const txt = document.getElementById('txt').value.trim();
  const voiceId = document.getElementById('voice').value;

  if (!key) { setStatus('Cole sua API Key primeiro!'); return; }
  if (!txt) { setStatus('Digite algum texto primeiro!'); return; }
  if (!voiceId) { setStatus('Carregue as vozes salvando a API Key!'); return; }

  const model = document.getElementById('model').value;
  const stability = parseInt(document.getElementById('stability').value) / 100;
  const styleAmount = parseInt(document.getElementById('styleAmount').value) / 100;

  setStatus('Gerando voz...');
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
      const msg = (err && err.detail && err.detail.message) ? err.detail.message : ('Erro HTTP ' + res.status);
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

    player.onplay = function() { setStatus('Reproduzindo...'); setProgress(100); };
    player.onended = function() { setStatus('Concluído!'); };

    document.getElementById('btnDownload').disabled = false;
    document.getElementById('cors-aviso').style.display = 'none';
    setStatus('Voz gerada com sucesso!');

  } catch (e) {
    setStatus('Erro de conexão: ' + e.message);
    document.getElementById('cors-aviso').style.display = 'block';
    setProgress(0);
  }

  document.getElementById('btnPlay').disabled = false;
}

function pararAudio() {
  var p = document.getElementById('player');
  p.pause(); p.currentTime = 0;
  setStatus('Parado.'); setProgress(0);
}

function baixarAudio() {
  if (!currentObjectURL) return;
  var a = document.createElement('a');
  a.href = currentObjectURL;
  a.download = 'voz-elevenlabs.mp3';
  a.click();
}

function setStatus(t) { document.getElementById('status').textContent = t; }
function setProgress(p) { document.getElementById('prog').style.width = p + '%'; }

window.addEventListener('DOMContentLoaded', function() {
  var saved = localStorage.getItem('el_api_key');
  if (saved) {
    savedKey = saved;
    document.getElementById('apikey').value = saved;
    setKeyStatus('✓ API Key carregada automaticamente.', true);
    carregarVozes(saved);
  }
});
