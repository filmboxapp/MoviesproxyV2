/**
 * MOVIEPROXY - Aplicación Principal
 */

let player = null;

const elements = {
  streamUrl: document.getElementById('streamUrl'),
  loadBtn: document.getElementById('loadBtn'),
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  errorText: document.getElementById('errorText'),
  playerSection: document.getElementById('playerSection'),
  inputSection: document.getElementById('inputSection'),
  features: document.getElementById('features'),
  videoTitle: document.getElementById('videoTitle'),
  video: document.getElementById('video'),
};

elements.loadBtn.addEventListener('click', loadStream);
elements.streamUrl.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loadStream();
});

async function loadStream() {
  const url = elements.streamUrl.value.trim();
  
  if (!url) {
    showError('Ingresa una URL válida');
    return;
  }
  
  elements.inputSection.hidden = true;
  elements.features.hidden = true;
  elements.loading.hidden = false;
  elements.error.hidden = true;
  
  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error desconocido');
    }
    
    initPlayer(data.stream);
    
  } catch (error) {
    console.error('Error:', error);
    showError(error.message || 'No se pudo cargar el stream. Intenta con otra URL.');
  } finally {
    elements.loading.hidden = true;
  }
}

function initPlayer(streamData) {
  elements.playerSection.hidden = false;
  elements.videoTitle.textContent = streamData.title || 'Stream';
  
  if (player) {
    player.destroy();
  }
  
  player = new CleanPlayer(elements.video);
  
  player.loadSource(streamData.url);
  
  elements.video.play().catch(() => {
    console.log('Auto-play bloqueado por el navegador');
  });
}

function showError(message) {
  elements.error.hidden = false;
  elements.errorText.textContent = message;
  elements.loading.hidden = true;
  elements.playerSection.hidden = true;
  elements.inputSection.hidden = false;
  elements.features.hidden = false;
}

function resetPlayer() {
  if (player) {
    player.destroy();
    player = null;
  }
  
  elements.video.src = '';
  elements.streamUrl.value = '';
  elements.playerSection.hidden = true;
  elements.error.hidden = true;
  elements.inputSection.hidden = false;
  elements.features.hidden = false;
}

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('url');
  
  if (url) {
    elements.streamUrl.value = url;
    loadStream();
  }
});
