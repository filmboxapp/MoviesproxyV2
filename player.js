/**
 * MOVIEPROXY - Reproductor HLS Personalizado
 */

class CleanPlayer {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.options = options;
    this.hls = null;
    this.isPlaying = false;
    this.isDragging = false;
    
    this.elements = {
      playPauseBtn: document.getElementById('playPauseBtn'),
      playIcon: document.getElementById('playIcon'),
      pauseIcon: document.getElementById('pauseIcon'),
      muteBtn: document.getElementById('muteBtn'),
      volumeHigh: document.getElementById('volumeHigh'),
      volumeMute: document.getElementById('volumeMute'),
      volumeMute2: document.getElementById('volumeMute2'),
      volumeSlider: document.getElementById('volumeSlider'),
      progressBar: document.getElementById('progressBar'),
      progressFill: document.getElementById('progressFill'),
      progressHandle: document.getElementById('progressHandle'),
      timeDisplay: document.getElementById('timeDisplay'),
      fullscreenBtn: document.getElementById('fullscreenBtn'),
      bigPlay: document.getElementById('bigPlay'),
      qualitySelector: document.getElementById('qualitySelector'),
      playerContainer: document.querySelector('.player-container'),
    };
    
    this.init();
  }
  
  init() {
    this.bindEvents();
    this.setupHLS();
  }
  
  bindEvents() {
    const { video, elements } = this;
    
    elements.playPauseBtn.addEventListener('click', () => this.togglePlay());
    elements.bigPlay.addEventListener('click', () => this.togglePlay());
    video.addEventListener('click', () => this.togglePlay());
    
    video.addEventListener('play', () => this.onPlay());
    video.addEventListener('pause', () => this.onPause());
    video.addEventListener('timeupdate', () => this.onTimeUpdate());
    video.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
    video.addEventListener('waiting', () => this.onBuffering());
    video.addEventListener('playing', () => this.onPlaying());
    
    elements.muteBtn.addEventListener('click', () => this.toggleMute());
    elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
    
    elements.progressBar.addEventListener('click', (e) => this.seek(e));
    elements.progressBar.addEventListener('mousedown', () => this.isDragging = true);
    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) this.seek(e);
    });
    document.addEventListener('mouseup', () => this.isDragging = false);
    
    elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
  }
  
  setupHLS() {
    if (Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
      });
      
      this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        this.onManifestParsed(data);
      });
      
      this.hls.on(Hls.Events.ERROR, (event, data) => {
        this.onHLSError(data);
      });
    }
  }
  
  loadSource(url) {
    if (this.hls) {
      this.hls.loadSource(url);
      this.hls.attachMedia(this.video);
    } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      this.video.src = url;
    } else {
      alert('Tu navegador no soporta HLS');
    }
  }
  
  togglePlay() {
    if (this.video.paused) {
      this.video.play();
    } else {
      this.video.pause();
    }
  }
  
  onPlay() {
    this.isPlaying = true;
    this.elements.playIcon.style.display = 'none';
    this.elements.pauseIcon.style.display = 'block';
    this.elements.playerContainer.classList.remove('paused');
  }
  
  onPause() {
    this.isPlaying = false;
    this.elements.playIcon.style.display = 'block';
    this.elements.pauseIcon.style.display = 'none';
    this.elements.playerContainer.classList.add('paused');
  }
  
  onTimeUpdate() {
    if (!this.video.duration || this.isDragging) return;
    
    const percent = (this.video.currentTime / this.video.duration) * 100;
    this.elements.progressFill.style.width = `${percent}%`;
    this.elements.progressHandle.style.left = `${percent}%`;
    
    this.updateTimeDisplay();
  }
  
  onLoadedMetadata() {
    this.updateTimeDisplay();
  }
  
  updateTimeDisplay() {
    const current = this.formatTime(this.video.currentTime);
    const duration = this.formatTime(this.video.duration || 0);
    this.elements.timeDisplay.textContent = `${current} / ${duration}`;
  }
  
  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  seek(e) {
    if (!this.video.duration) return;
    
    const rect = this.elements.progressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = percent * this.video.duration;
    
    this.video.currentTime = time;
    this.elements.progressFill.style.width = `${percent * 100}%`;
    this.elements.progressHandle.style.left = `${percent * 100}%`;
  }
  
  toggleMute() {
    this.video.muted = !this.video.muted;
    this.updateVolumeIcon();
  }
  
  setVolume(value) {
    this.video.volume = value / 100;
    this.video.muted = value === 0;
    this.updateVolumeIcon();
  }
  
  updateVolumeIcon() {
    const { video, elements } = this;
    const isMuted = video.muted || video.volume === 0;
    
    if (isMuted) {
      elements.volumeHigh.style.display = 'none';
      elements.volumeMute.style.display = 'block';
      elements.volumeMute2.style.display = 'block';
    } else {
      elements.volumeHigh.style.display = 'block';
      elements.volumeMute.style.display = 'none';
      elements.volumeMute2.style.display = 'none';
    }
    
    elements.volumeSlider.value = isMuted ? 0 : video.volume * 100;
  }
  
  toggleFullscreen() {
    const container = this.elements.playerContainer;
    
    if (!document.fullscreenElement) {
      container.requestFullscreen?.() || 
      container.webkitRequestFullscreen?.() ||
      container.msRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() ||
      document.webkitExitFullscreen?.() ||
      document.msExitFullscreen?.();
    }
  }
  
  onManifestParsed(data) {
    const levels = data.levels;
    if (levels.length > 1) {
      this.elements.qualitySelector.innerHTML = '<option value="-1">Auto</option>';
      levels.forEach((level, i) => {
        const height = level.height || 'Desconocido';
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${height}p`;
        this.elements.qualitySelector.appendChild(option);
      });
      this.elements.qualitySelector.hidden = false;
      
      this.elements.qualitySelector.addEventListener('change', (e) => {
        this.hls.currentLevel = parseInt(e.target.value);
      });
    }
  }
  
  onHLSError(data) {
    if (data.fatal) {
      console.error('HLS Error:', data);
      switch(data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          this.hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          this.hls.recoverMediaError();
          break;
        default:
          this.destroy();
          break;
      }
    }
  }
  
  onBuffering() {
    this.elements.playerContainer.style.cursor = 'wait';
  }
  
  onPlaying() {
    this.elements.playerContainer.style.cursor = 'pointer';
  }
  
  onKeyDown(e) {
    if (!this.video.offsetParent) return;
    
    switch(e.code) {
      case 'Space':
        e.preventDefault();
        this.togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.video.currentTime = Math.max(0, this.video.currentTime - 10);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 10);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.setVolume(Math.min(100, (this.video.volume * 100) + 10));
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.setVolume(Math.max(0, (this.video.volume * 100) - 10));
        break;
      case 'KeyF':
        e.preventDefault();
        this.toggleFullscreen();
        break;
      case 'KeyM':
        e.preventDefault();
        this.toggleMute();
        break;
    }
  }
  
  destroy() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.video.src = '';
  }
      }
