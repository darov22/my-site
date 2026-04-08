import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, orderBy, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDBmazPKil5xsLBYteYftz_nmKnUdQojS0",
    authDomain: "egfdgdfg-3504c.firebaseapp.com",
    projectId: "egfdgdfg-3504c",
    storageBucket: "egfdgdfg-3504c.firebasestorage.app",
    messagingSenderId: "764542974854",
    appId: "1:764542974854:web:1f2621cfa613e85e4f4a07",
    measurementId: "G-8PTHXNW4C5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

let tracks = [];

// Инициализация плеера
window.musicPlayer.init();

async function loadAllTracksWithSplash() {
    const splashLoader = document.getElementById("splashLoader");
    const splashProgressFill = document.getElementById("splashProgressFill");
    
    try {
        splashProgressFill.style.width = "10%";
        const q = query(collection(db, "tracks"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        splashProgressFill.style.width = "60%";
        tracks = [];
        querySnapshot.forEach((doc) => { tracks.push({ id: doc.id, ...doc.data() }); });
        splashProgressFill.style.width = "100%";
        
        await new Promise(r => setTimeout(r, 300));
        splashLoader.classList.add("hide");
        setTimeout(() => { if(splashLoader) splashLoader.style.display = "none"; }, 500);
        
        window.musicPlayer.setTracks(tracks);
        renderPlaylist();
    } catch (error) { 
        console.error(error); 
        splashLoader.classList.add("hide"); 
        setTimeout(() => splashLoader.style.display = "none", 400); 
        renderPlaylist(); 
    }
}

function renderPlaylist() {
    const container = document.getElementById("playlist"); 
    container.innerHTML = "";
    
    if (tracks.length === 0) { 
        container.innerHTML = '<div class="empty-msg">🎧 Нет треков. Нажми + и загрузи MP3 (до 50 МБ)</div>'; 
        return; 
    }
    
    for (let idx = 0; idx < tracks.length; idx++) {
        const track = tracks[idx];
        const div = document.createElement("div"); 
        div.className = "song";
        const coverSrc = track.coverUrl || window.musicPlayer.getDefaultCover();
        
        div.innerHTML = `<img class="song-cover" src="${coverSrc}" alt="cover" onerror="this.src='${window.musicPlayer.getDefaultCover()}'">
            <div class="song-info">
                <div class="song-title">${escapeHtml(track.title)}</div>
                <div class="song-artist">🎤 ${escapeHtml(track.artist || "Неизвестен")}</div>
                <div class="song-size">📀 ${formatFileSize(track.size)}</div>
            </div>
            <button class="delete-song" data-id="${track.id}" data-title="${escapeHtml(track.title)}">🗑️</button>`;
        
        const playZone = div;
        playZone.addEventListener('click', (e) => { 
            if(e.target.classList && e.target.classList.contains('delete-song')) return; 
            window.musicPlayer.loadTrack(idx);
            window.musicPlayer.audio.play().catch(e=>console.log(e));
        });
        
        const deleteBtn = div.querySelector('.delete-song');
        if(deleteBtn) deleteBtn.addEventListener('click', async (e) => { 
            e.stopPropagation(); 
            if(confirm(`Удалить трек "${track.title}"?`)) 
                await deleteTrackFromFirebase(track); 
        });
        container.appendChild(div);
    }
}

async function deleteTrackFromFirebase(track) {
    try {
        const mp3Ref = ref(storage, track.mp3Path); 
        await deleteObject(mp3Ref);
        if(track.coverPath) { 
            const coverRef = ref(storage, track.coverPath); 
            await deleteObject(coverRef); 
        }
        await deleteDoc(doc(db, "tracks", track.id)); 
        await loadAllTracksFresh();
        
        if(window.musicPlayer.getCurrentTrackId() === track.id) { 
            window.musicPlayer.closePlayer(); 
        }
        showNotification(`🗑️ "${track.title}" удалён`, "#ff6666");
    } catch(e) { 
        showNotification("❌ Ошибка удаления", "#ff6666"); 
    }
}

async function loadAllTracksFresh() { 
    try { 
        const q = query(collection(db, "tracks"), orderBy("date", "desc")); 
        const querySnapshot = await getDocs(q); 
        tracks = []; 
        querySnapshot.forEach((doc) => { tracks.push({ id: doc.id, ...doc.data() }); }); 
        window.musicPlayer.setTracks(tracks);
        renderPlaylist(); 
    } catch(e) { 
        console.error(e); 
    } 
}

// Вспомогательные функции
function formatFileSize(bytes) { 
    if (!bytes) return "0 Б"; 
    if (bytes < 1024) return bytes + ' Б'; 
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ'; 
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ'; 
}

function escapeHtml(str) { 
    if (!str) return ''; 
    return String(str).replace(/[&<>]/g, function(m){ 
        if(m==='&') return '&amp;'; 
        if(m==='<') return '&lt;'; 
        if(m==='>') return '&gt;'; 
        return m;
    }); 
}

function showNotification(message, color) { 
    let notif = document.createElement("div"); 
    notif.innerText = message; 
    notif.style.position = "fixed"; 
    notif.style.bottom = "180px"; 
    notif.style.left = "20px"; 
    notif.style.right = "20px"; 
    notif.style.backgroundColor = "#1a1a1a"; 
    notif.style.color = color; 
    notif.style.padding = "12px"; 
    notif.style.borderRadius = "40px"; 
    notif.style.textAlign = "center"; 
    notif.style.zIndex = "999"; 
    notif.style.border = `1px solid ${color}`; 
    notif.style.fontWeight = "bold"; 
    document.body.appendChild(notif); 
    setTimeout(() => notif.remove(), 3000); 
}

// Модальное окно и загрузка
let selectedMp3File = null, selectedCoverFile = null;

function updateLoadingProgress(percent, status) { 
    const progressBarFill = document.getElementById("progressBarFill"); 
    const loadingPercent = document.getElementById("loadingPercent"); 
    const loadingStatus = document.getElementById("loadingStatus"); 
    const clampedPercent = Math.min(100, Math.max(0, percent)); 
    if(progressBarFill) progressBarFill.style.width = clampedPercent + "%"; 
    if(loadingPercent) loadingPercent.textContent = Math.floor(clampedPercent) + "%"; 
    if(status && loadingStatus) loadingStatus.textContent = status; 
}

function showLoading() { 
    document.getElementById("loadingOverlay").classList.add("active"); 
    updateLoadingProgress(0, "Подготовка..."); 
}

function hideLoading() { 
    document.getElementById("loadingOverlay").classList.remove("active"); 
}

async function uploadTrackToFirebase() {
    if (!selectedMp3File) { alert("❌ Выберите MP3 файл"); return false; }
    let titleVal = document.getElementById("trackTitle").value.trim(); 
    if(!titleVal) { alert("Укажите название трека"); return false; }
    if(titleVal.length > 100) titleVal = titleVal.slice(0,100);
    let artistVal = document.getElementById("trackArtist").value.trim(); 
    if(artistVal.length > 50) artistVal = artistVal.slice(0,50); 
    if(!artistVal) artistVal = "Неизвестный исполнитель";
    if (selectedMp3File.size > 50 * 1024 * 1024) { alert("❌ Файл превышает 50 МБ!"); return false; }
    
    showLoading();
    try {
        const trackId = Date.now().toString() + "_" + Math.random().toString(36).substr(2, 6);
        updateLoadingProgress(5, "Загрузка MP3...");
        const mp3Path = `mp3/${trackId}.mp3`; 
        const mp3Ref = ref(storage, mp3Path);
        const mp3UploadTask = uploadBytesResumable(mp3Ref, selectedMp3File);
        const mp3Url = await new Promise((resolve, reject) => { 
            mp3UploadTask.on('state_changed', (snapshot) => { 
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 70; 
                updateLoadingProgress(5 + progress, `MP3: ${Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)}%`); 
            }, reject, async () => resolve(await getDownloadURL(mp3UploadTask.snapshot.ref)); 
        });
        
        let coverUrl = null, coverPath = null;
        if (selectedCoverFile) { 
            updateLoadingProgress(78, "Загрузка обложки..."); 
            coverPath = `covers/${trackId}.jpg`; 
            const coverRef = ref(storage, coverPath); 
            const coverUploadTask = uploadBytesResumable(coverRef, selectedCoverFile); 
            coverUrl = await new Promise((resolve, reject) => { 
                coverUploadTask.on('state_changed', (snapshot) => { 
                    const progress = 78 + (snapshot.bytesTransferred / snapshot.totalBytes) * 12; 
                    updateLoadingProgress(progress, `Обложка: ${Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)}%`); 
                }, reject, async () => resolve(await getDownloadURL(coverUploadTask.snapshot.ref)); 
            }); 
        }
        
        updateLoadingProgress(92, "Сохранение...");
        await addDoc(collection(db, "tracks"), { 
            title: titleVal, 
            artist: artistVal, 
            mp3Url, 
            mp3Path, 
            coverUrl, 
            coverPath, 
            size: selectedMp3File.size, 
            date: new Date().toISOString() 
        });
        
        updateLoadingProgress(100, "Готово!"); 
        await new Promise(r => setTimeout(r, 400)); 
        hideLoading(); 
        await loadAllTracksFresh();
        
        document.getElementById("trackTitle").value = ""; 
        document.getElementById("trackArtist").value = ""; 
        selectedMp3File = null; 
        selectedCoverFile = null; 
        document.getElementById("mp3FileName").innerText = "Файл не выбран"; 
        document.getElementById("coverPreviewArea").style.display = "none"; 
        document.getElementById("mp3File").value = ""; 
        document.getElementById("coverFile").value = ""; 
        showNotification(`✅ "${titleVal}" добавлен!`, "#aaffaa"); 
        closeModal(); 
        return true;
    } catch (error) { 
        hideLoading(); 
        alert("Ошибка: " + error.message); 
        return false; 
    }
}

const overlay = document.getElementById("overlayForm"); 
const openBtn = document.getElementById("openModalBtn"); 
const cancelBtn = document.getElementById("cancelModalBtn"); 
const submitBtn = document.getElementById("submitTrackBtn"); 
const titleInput = document.getElementById("trackTitle"); 
const artistInput = document.getElementById("trackArtist"); 
const mp3FileInput = document.getElementById("mp3File"); 
const coverFileInput = document.getElementById("coverFile");

function resetModal() { 
    titleInput.value = ""; 
    artistInput.value = ""; 
    document.getElementById("titleCount").innerText = "0"; 
    document.getElementById("artistCount").innerText = "0"; 
    mp3FileInput.value = ""; 
    coverFileInput.value = ""; 
    selectedMp3File = null; 
    selectedCoverFile = null; 
    document.getElementById("mp3FileName").innerText = "Файл не выбран"; 
    document.getElementById("coverPreviewArea").style.display = "none"; 
}

titleInput.addEventListener("input", () => { 
    document.getElementById("titleCount").innerText = titleInput.value.length; 
});
artistInput.addEventListener("input", () => { 
    document.getElementById("artistCount").innerText = artistInput.value.length; 
});

document.getElementById("mp3Label").onclick = () => mp3FileInput.click(); 
document.getElementById("coverLabel").onclick = () => coverFileInput.click();

mp3FileInput.addEventListener("change", (e) => { 
    const file = e.target.files[0]; 
    if(file && file.size <= 50*1024*1024 && (file.type.includes("mp3")||file.name.endsWith(".mp3"))) { 
        selectedMp3File = file; 
        document.getElementById("mp3FileName").innerText = `${file.name} (${(file.size/1024/1024).toFixed(2)} МБ)`; 
    } else { 
        alert("Файл не MP3 или >50МБ"); 
        mp3FileInput.value=""; 
    } 
});

coverFileInput.addEventListener("change", (e) => { 
    const file = e.target.files[0]; 
    if(file && file.type.startsWith("image/")) { 
        selectedCoverFile = file; 
        const reader = new FileReader(); 
        reader.onload = ev => { 
            document.getElementById("coverPreviewImg").src = ev.target.result; 
            document.getElementById("coverPreviewArea").style.display = "flex"; 
            document.getElementById("coverName").innerText = file.name; 
        }; 
        reader.readAsDataURL(file); 
    } else { 
        alert("Только изображения"); 
        coverFileInput.value=""; 
    } 
});

submitBtn.onclick = async () => { 
    submitBtn.disabled=true; 
    submitBtn.style.opacity="0.6"; 
    await uploadTrackToFirebase(); 
    submitBtn.disabled=false; 
    submitBtn.style.opacity="1"; 
};

function openModal() { resetModal(); overlay.classList.add("active"); }
function closeModal() { overlay.classList.remove("active"); }
openBtn.onclick = openModal; 
cancelBtn.onclick = closeModal; 
overlay.onclick = (e) => { if(e.target === overlay) closeModal(); };

loadAllTracksWithSplash();
