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

function ehVozBrasileira(v) {
  const nome = (v.name || '').toLowerCase();
  const labels = v.labels || {};
  const accent = (labels.accent || '').toLowerCase();
  const language = (labels.language || '').toLowerCase();
  const description = (labels.description || '').toLowerCase();

  return (
    accent.includes('brazilian') ||
    accent.includes('brasil') ||
    accent.includes('portuguese') ||
    language.includes('portuguese') ||
    language.includes('pt-br') ||
    language.includes('pt_br') ||
    description.includes('brazilian') ||
    description.includes('português') ||
    description.includes('portuguese') ||
    nome.includes('brasil') ||
    nome.includes('portuguese') ||
    nome.includes('luciana') ||
    nome.includes('vitoria') ||
    nome.includes('vitória') ||
    nome.includes('camila') ||
    nome.includes('fernanda') ||
    nome.includes('ricardo') ||
    nome.includes('antonio') ||
    nome.includes('antônio')
  );
}

async function carregarVozes(key) {
  setStatus('Carregando vozes em português brasileiro...');
  const sel = document.getElementById('voice');
  sel.innerHTML = '<option value="">Carregando...</option>';
  document.getElementById('cors-aviso').style.display = 'none';

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
      setKeyStatus('✗ API Key inválida. Verifique no site da ElevenLabs.', false);
      setStatus('API Key incorreta.');
      return;
    }

    if (!res.ok) {
      sel.innerHTML = '<option value="">Erro HTTP ' + res.status + '</option>';
      setStatus('Erro ' + res.status + ' ao buscar vozes.');
      return;
    }

    const data = await res.json();

    // Filtra vozes brasileiras
    const vozesБР = data.voices.filter(ehVozBrasileira);

    // Se não achar nenhuma com o filtro, mostra todas com aviso
    const vozes = vozesБР.length > 0 ? vozesБР : data.voices;
    const aviso = vozesБР.length === 0;

    sel.innerHTML = '';

    if (aviso) {
      const og = document.createElement('optgroup');
      og.label = '⚠️ Nenhuma voz pt-BR encontrada — mostrando todas';
      vozes.forEach(v => {
        const o = document.createElement('option');
        o.value = v.voice_id;
        const gender = v.labels && v.labels.gender ? v.labels.gender : '';
        o.textContent = v.name + (gender ? ' — ' + gender : '');
        og.appendChild(o);
      });
      sel.appendChild(og);
      setStatus('Nenhuma voz pt-BR encontrada. Mostrando todas as ' + vozes.length + ' vozes disponíveis.');
    } else {
      const og = document.createElement('optgroup');
      og.label = '🇧🇷 Vozes em Português Brasileiro';
      vozes.forEach(v => {
        const o = document.createElement('option');
        o.value = v.voice_id;
        const gender = v.labels && v.labels.gender ? v.labels.gender : '';
        const accent = v.labels && v.labels.accent ? v.labels.accent : '';
        const desc = [gender, accent].filter(Boolean).join(', ');
        o.textContent = v.name + (desc ? ' — ' + desc : '');
        og.appendChild(o);
      });
      sel.appendChild(og);
      setKeyStatus('✓ API Key válida!', true);
      setStatus(vozes.length + ' voz(es) em português brasileiro encontrada(s)!');
    }

  } catch (e) {
    sel.innerHTML = '<option value="">Erro de conexão</option>';
    setStatus('Erro de rede: ' + e.message);
    setKeyStatus('✗ Não foi possível conectar.', false);
    document.getElementById('cors-aviso').style.display = 'block';
  }
}

async function gerarVoz() {
  const key = savedKey || localStorage.getItem('el_api_key') || document.getElementById('apikey').value.trim();
  const txt = document.getElementById('txt').value.trim();
  const voiceId = document.getElementById('voice').value;

  if (!key) { setStatus('Cole sua API Key primeiro!'); return; }
  if (!txt) { setStatus('Digite algum texto primeiro!'); return; }
  if (!voiceId) { setStatus('Salve a API Key para carregar as vozes!'); return; }

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

    player.onplay = function () { setStatus('Reproduzindo...'); setProgress(100); };
    player.onended = function () { setStatus('Concluído!'); };

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

window.addEventListener('DOMContentLoaded', function () {
  var saved = localStorage.getItem('el_api_key');
  if (saved) {
    savedKey = saved;
    document.getElementById('apikey').value = saved;
    setKeyStatus('✓ API Key carregada automaticamente.', true);
    carregarVozes(saved);
  }
});
