// player.js - независимый модуль плеера

class MusicPlayer {
    constructor() {
        this.audio = null;
        this.tracks = [];
        this.currentTrackIdx = 0;
        this.currentAudioUrl = null;
        this.playerDiv = null;
        this.fsPlayer = null;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        
        this.createPlayerHTML();
        this.initElements();
        this.bindEvents();
        this.isInitialized = true;
    }

    createPlayerHTML() {
        // Добавляем HTML плеера в DOM
        const playerHTML = `
            <!-- мини-плеер -->
            <div class="player" id="player">
                <button class="close-btn" id="closePlayerBtn">✖</button>
                <button class="fullscreen-expand-btn" id="expandFullscreenBtn">⤢</button>
                <audio id="audio"></audio>
                <div class="controls">
                    <button id="prevBtn">⏮</button>
                    <button id="playPauseBtn">▶</button>
                    <button id="nextBtn">⏭</button>
                </div>
                <div class="progress-container">
                    <div class="progress" id="progress"><div class="progress-bar" id="progressBar"></div></div>
                    <div class="time"><span id="currentTime">0:00</span><span id="duration">0:00</span></div>
                </div>
                <div class="bottom-info">
                    <img id="playerCover" class="player-cover" src="" alt="cover">
                    <div id="title">Трек</div>
                </div>
            </div>

            <!-- полноэкранный плеер -->
            <div id="fullscreenPlayer" class="fullscreen-player">
                <button class="fs-back-btn" id="fsBackBtn">⬇</button>
                <div class="vinyl-container">
                    <div class="vinyl-disc" id="vinylDisc">
                        <div class="vinyl-center">
                            <img id="fsCenterImg" class="vinyl-center-img" src="" alt="cover">
                        </div>
                    </div>
                </div>
                <div class="fs-track-info">
                    <div class="fs-track-title" id="fsTrackTitle">Название</div>
                    <div class="fs-track-artist" id="fsTrackArtist">Исполнитель</div>
                </div>
                <div class="fs-controls">
                    <button id="fsPrevBtn">⏮</button>
                    <button id="fsPlayPauseBtn">▶</button>
                    <button id="fsNextBtn">⏭</button>
                </div>
                <div class="fs-progress">
                    <div class="progress" id="fsProgress"><div class="progress-bar" id="fsProgressBar"></div></div>
                    <div class="fs-time"><span id="fsCurrentTime">0:00</span><span id="fsDuration">0:00</span></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', playerHTML);
    }

    initElements() {
        this.audio = document.getElementById("audio");
        this.playerDiv = document.getElementById("player");
        this.fsPlayer = document.getElementById("fullscreenPlayer");
        
        this.playPauseBtn = document.getElementById("playPauseBtn");
        this.progressBar = document.getElementById("progressBar");
        this.progress = document.getElementById("progress");
        this.currentTimeSpan = document.getElementById("currentTime");
        this.durationSpan = document.getElementById("duration");
        this.playerCoverImg = document.getElementById("playerCover");
        this.titleSpan = document.getElementById("title");
        
        // Fullscreen элементы
        this.fsBackBtn = document.getElementById("fsBackBtn");
        this.fsPlayPauseBtn = document.getElementById("fsPlayPauseBtn");
        this.fsPrevBtn = document.getElementById("fsPrevBtn");
        this.fsNextBtn = document.getElementById("fsNextBtn");
        this.fsProgressBar = document.getElementById("fsProgressBar");
        this.fsProgress = document.getElementById("fsProgress");
        this.fsCurrentTimeSpan = document.getElementById("fsCurrentTime");
        this.fsDurationSpan = document.getElementById("fsDuration");
        this.fsTrackTitleSpan = document.getElementById("fsTrackTitle");
        this.fsTrackArtistSpan = document.getElementById("fsTrackArtist");
        this.fsCenterImg = document.getElementById("fsCenterImg");
        this.vinylDisc = document.getElementById("vinylDisc");
    }

    bindEvents() {
        // Кнопки управления
        const prevBtn = document.getElementById("prevBtn");
        const nextBtn = document.getElementById("nextBtn");
        const closePlayerBtn = document.getElementById("closePlayerBtn");
        const expandFullscreenBtn = document.getElementById("expandFullscreenBtn");

        if (prevBtn) prevBtn.onclick = () => this.prevTrack();
        if (nextBtn) nextBtn.onclick = () => this.nextTrack();
        if (closePlayerBtn) closePlayerBtn.onclick = () => this.closePlayer();
        if (expandFullscreenBtn) expandFullscreenBtn.onclick = () => this.showFullscreen();
        if (this.fsBackBtn) this.fsBackBtn.onclick = () => this.hideFullscreen();
        
        this.playPauseBtn.onclick = () => this.togglePlay();
        this.fsPlayPauseBtn.onclick = () => this.togglePlay();
        this.fsPrevBtn.onclick = () => this.prevTrack();
        this.fsNextBtn.onclick = () => this.nextTrack();
        
        // Прогресс бар
        if (this.progress) {
            this.progress.addEventListener("click", (e) => this.seek(e, this.progress, this.audio));
        }
        if (this.fsProgress) {
            this.fsProgress.addEventListener("click", (e) => this.seek(e, this.fsProgress, this.audio));
        }
        
        // События аудио
        this.audio.addEventListener("timeupdate", () => this.updateProgress());
        this.audio.addEventListener("loadedmetadata", () => this.onLoadedMetadata());
        this.audio.addEventListener("play", () => this.onPlay());
        this.audio.addEventListener("pause", () => this.onPause());
        this.audio.addEventListener("ended", () => this.onEnded());
    }

    setTracks(tracksArray) {
        this.tracks = tracksArray;
    }

    loadTrack(index) {
        if (this.tracks.length === 0) return;
        if (index < 0) index = 0;
        if (index >= this.tracks.length) index = this.tracks.length - 1;
        
        this.currentTrackIdx = index;
        const track = this.tracks[this.currentTrackIdx];
        
        this.audio.pause();
        this.revokeCurrentUrl();
        
        if (this.titleSpan) {
            this.titleSpan.innerText = `${track.title || "Трек"} · ${track.artist || "?"}`;
        }
        if (this.playerCoverImg) {
            this.playerCoverImg.src = track.coverUrl || this.getDefaultCover();
        }
        
        this.audio.src = track.mp3Url;
        this.showPlayer();
        this.syncFullscreenUI();
        this.audio.load();
    }

    togglePlay() {
        if (this.audio.paused) {
            this.audio.play().catch(e => console.warn(e));
        } else {
            this.audio.pause();
        }
    }

    prevTrack() {
        if (this.tracks.length) {
            this.currentTrackIdx = (this.currentTrackIdx - 1 + this.tracks.length) % this.tracks.length;
            this.loadTrack(this.currentTrackIdx);
            this.audio.play().catch(e => {});
        }
    }

    nextTrack() {
        if (this.tracks.length) {
            this.currentTrackIdx = (this.currentTrackIdx + 1) % this.tracks.length;
            this.loadTrack(this.currentTrackIdx);
            this.audio.play().catch(e => {});
        }
    }

    closePlayer() {
        if (this.playerDiv) this.playerDiv.classList.remove("show");
        this.audio.pause();
        this.audio.currentTime = 0;
        this.revokeCurrentUrl();
        this.hideFullscreen();
    }

    showPlayer() {
        if (this.playerDiv) this.playerDiv.classList.add("show");
    }

    showFullscreen() {
        if (this.fsPlayer) {
            this.fsPlayer.classList.add("active");
            this.syncFullscreenUI();
            this.updateFsProgress();
        }
    }

    hideFullscreen() {
        if (this.fsPlayer) this.fsPlayer.classList.remove("active");
    }

    updateProgress() {
        if (this.audio.duration && !isNaN(this.audio.duration)) {
            let percent = (this.audio.currentTime / this.audio.duration) * 100;
            if (this.progressBar) this.progressBar.style.width = percent + "%";
            if (this.currentTimeSpan) this.currentTimeSpan.innerText = this.formatTime(this.audio.currentTime);
            if (this.durationSpan) this.durationSpan.innerText = this.formatTime(this.audio.duration);
            this.updateFsProgress();
        }
    }

    updateFsProgress() {
        if (this.audio.duration && !isNaN(this.audio.duration) && this.fsProgressBar && this.fsCurrentTimeSpan) {
            let percent = (this.audio.currentTime / this.audio.duration) * 100;
            this.fsProgressBar.style.width = percent + "%";
            this.fsCurrentTimeSpan.innerText = this.formatTime(this.audio.currentTime);
            this.fsDurationSpan.innerText = this.formatTime(this.audio.duration);
        }
    }

    onLoadedMetadata() {
        if (this.audio.duration && this.durationSpan) {
            this.durationSpan.innerText = this.formatTime(this.audio.duration);
            if (this.fsDurationSpan) this.fsDurationSpan.innerText = this.formatTime(this.audio.duration);
        }
    }

    onPlay() {
        if (this.playPauseBtn) this.playPauseBtn.innerText = "⏸";
        if (this.fsPlayPauseBtn) this.fsPlayPauseBtn.innerText = "⏸";
        if (this.fsPlayer) this.fsPlayer.classList.add("playing");
        if (this.vinylDisc) this.vinylDisc.style.animationPlayState = "running";
    }

    onPause() {
        if (this.playPauseBtn) this.playPauseBtn.innerText = "▶";
        if (this.fsPlayPauseBtn) this.fsPlayPauseBtn.innerText = "▶";
        if (this.fsPlayer) this.fsPlayer.classList.remove("playing");
        if (this.vinylDisc) this.vinylDisc.style.animationPlayState = "paused";
    }

    onEnded() {
        if (this.tracks.length) {
            this.currentTrackIdx = (this.currentTrackIdx + 1) % this.tracks.length;
            this.loadTrack(this.currentTrackIdx);
            this.audio.play().catch(e => {});
        }
    }

    seek(e, progressElement, audio) {
        const rect = progressElement.getBoundingClientRect();
        let perc = (e.clientX - rect.left) / rect.width;
        if (audio.duration) audio.currentTime = perc * audio.duration;
    }

    syncFullscreenUI() {
        if (!this.tracks.length) return;
        const track = this.tracks[this.currentTrackIdx];
        if (this.fsTrackTitleSpan) this.fsTrackTitleSpan.innerText = track.title || "Без названия";
        if (this.fsTrackArtistSpan) this.fsTrackArtistSpan.innerText = track.artist || "Неизвестен";
        if (this.fsCenterImg) {
            const cover = track.coverUrl || this.getDefaultCover();
            this.fsCenterImg.src = cover;
        }
        if (this.playerCoverImg && track.coverUrl) {
            this.playerCoverImg.src = track.coverUrl;
        }
    }

    revokeCurrentUrl() {
        if (this.currentAudioUrl) {
            URL.revokeObjectURL(this.currentAudioUrl);
            this.currentAudioUrl = null;
        }
    }

    formatTime(sec) {
        if (isNaN(sec) || sec === Infinity) return "0:00";
        let m = Math.floor(sec / 60);
        let s = Math.floor(sec % 60);
        if (s < 10) s = "0" + s;
        return m + ":" + s;
    }

    getDefaultCover() {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ff7a00'/%3E%3Ctext x='50' y='67' font-size='45' text-anchor='middle' fill='white'%3E🎵%3C/text%3E%3C/svg%3E";
    }

    getCurrentTrackId() {
        return this.tracks[this.currentTrackIdx]?.id;
    }
}

// Создаем глобальный экземпляр
window.musicPlayer = new MusicPlayer();
