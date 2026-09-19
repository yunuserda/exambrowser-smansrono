// URL Konfigurasi
const URL_API = "https://smansrono.sch.id/link_ujian/proses_hukuman.php";
const URL_GET_LINK = "https://smansrono.sch.id/link_ujian/get_sat.php";
const API_KEY = "SMANSRONO_SECRET_2026";

// Elemen DOM
const layoutRegistrasi = document.getElementById('layout-registrasi');
const layoutPeringatan = document.getElementById('layout-peringatan');
const layoutBlokir = document.getElementById('layout-blokir');
const teksTimer = document.getElementById('teks-timer');
const inputNama = document.getElementById('input-nama');
const inputNIS = document.getElementById('input-nis');
const btnSimpan = document.getElementById('btn-simpan');
const btnMengerti = document.getElementById('btn-mengerti');

// State Aplikasi
let deviceID = localStorage.getItem("device_id") || "WIN-" + Math.random().toString(36).substring(2, 12);
localStorage.setItem("device_id", deviceID);

let linkUjianDariDatabase = "";
let sedangMemuatLink = false;
let sudahMulaiUjian = false;

// Track status penekanan tombol
let shiftPressed = false;
let sPressed = false;

// 1. Dapatkan Link Ujian Terbaru dari Database
async function ambilLinkTerbaru() {
  sedangMemuatLink = true;
  try {
    const response = await fetch(`${URL_GET_LINK}?_=` + Date.now());
    const data = await response.json();
    
    if (data && data.link_sat && data.link_sat.trim() !== "") {
      linkUjianDariDatabase = data.link_sat.trim();
      console.log("Link ujian dimuat:", linkUjianDariDatabase);
    }
  } catch (err) {
    console.error("Gagal mengambil link ujian:", err);
  } finally {
    sedangMemuatLink = false;
  }
}

// 2. Hubungi Server Ujian
async function hubungiServer(aksi, extraData = {}) {
  const formData = new FormData();
  formData.append("device_id", deviceID);
  formData.append("aksi", aksi);
  formData.append("api_key", API_KEY);
  
  for (const key in extraData) {
    formData.append(key, extraData[key]);
  }

  try {
    const res = await fetch(URL_API, { method: "POST", body: formData });
    const textRes = (await res.text()).trim();

    if (textRes === "berhasil" || aksi === "registrasi") {
      layoutRegistrasi.classList.add('hidden');
      layoutPeringatan.classList.remove('hidden');
      return;
    }

    const part = textRes.split("|");
    if (part[0] === "BELUM_REGIS") {
      layoutRegistrasi.classList.remove('hidden');
      layoutPeringatan.classList.add('hidden');
    } else {
      layoutRegistrasi.classList.add('hidden');
      layoutPeringatan.classList.remove('hidden');
    }
  } catch (err) {
    console.error("Gagal terhubung ke API:", err);
    layoutRegistrasi.classList.add('hidden');
    layoutPeringatan.classList.remove('hidden');
  }
}

// Impor fungsi window dari Tauri v2 jika tersedia
const getTauriWindow = () => {
  if (window.__TAURI__ && window.__TAURI__.window) {
    return window.__TAURI__.window.getCurrentWindow();
  }
  return null;
};

// 3. DETEKSI KEHILANGAN FOKUS & PAKSA FOKUS KEMBALI (ANTI ALT/CMD+TAB)
window.addEventListener('blur', async () => {
  if (sudahMulaiUjian) {
    // Catat pelanggaran ke server
    hubungiServer("tambah");
  }

  // Paksa jendela aplikasi kembali ke depan secara instan
  try {
    const appWindow = getTauriWindow();
    if (appWindow) {
      await appWindow.setFocus();
      await appWindow.setAlwaysOnTop(true);
    }
  } catch (err) {
    console.error("Gagal merebut fokus kembali:", err);
  }
});

// 4. PROTEKSI KEYBOARD & SHORTCUT KELUAR (SHIFT + S + X)
const pressedCodes = new Set();

// Matikan Context Menu (Klik Kanan)
window.addEventListener('contextmenu', (e) => e.preventDefault(), true);

// Blokir semua tombol dan shortcut kecuali Shift + S
window.addEventListener('keydown', (e) => {
  pressedCodes.add(e.code);

  const isShiftPressed = e.shiftKey || pressedCodes.has('ShiftLeft') || pressedCodes.has('ShiftRight');
  const isSPressed = pressedCodes.has('KeyS');

  // 1. CEK SHORTCUT KELUAR: Shift + S
  if (isShiftPressed && isSPressed) {
    // Jika hanya Shift + S, izinkan keluar
    if (pressedCodes.size <= 2) {
      e.preventDefault();
      e.stopPropagation();
      pressedCodes.clear();
      tutupAplikasiInstan();
      return;
    }
  }

  // 2. IZINKAN TOMBOL MENGETIK BIASA HANYA SAAT BERADA DI INPUT / TEXTAREA
  const activeEl = document.activeElement;
  const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

  // Daftar tombol yang diizinkan saat mengetik
  const isAllowedCharacter = 
    e.key.length === 1 || // Huruf, angka, simbol biasa
    e.code === 'Backspace' ||
    e.code === 'Delete' ||
    e.code === 'ArrowLeft' ||
    e.code === 'ArrowRight' ||
    e.code === 'ArrowUp' ||
    e.code === 'ArrowDown' ||
    e.code === 'Tab' ||
    e.code === 'Space' ||
    e.code === 'Enter';

  // Jika sedang mengetik di form input (misal NIS/Nama atau soal isian), izinkan tombol ketik biasa TANPA Modifier (Ctrl/Alt/Meta)
  if (isInputActive && isAllowedCharacter && !e.ctrlKey && !e.altKey && !e.metaKey) {
    return; // Biarkan input bekerja
  }

  // 3. BLOKIR SEMUA TOMBOL & SHORTCUT LAINNYA
  // (Termasuk F1-F12, Ctrl+C, Ctrl+V, Alt+Tab, Escape, Ctrl+R, dll.)
  e.preventDefault();
  e.stopPropagation();
}, true); // UseCapture = true agar mencegat event sebelum elemen lain

window.addEventListener('keyup', (e) => {
  pressedCodes.delete(e.code);
}, true);

// Bersihkan state jika kehilangan fokus
window.addEventListener('blur', () => {
  pressedCodes.clear();
  if (sudahMulaiUjian) {
    hubungiServer("tambah");
  }
});

// 5. Handling Tombol UI
btnSimpan.addEventListener('click', (e) => {
  e.preventDefault();
  const nama = inputNama.value.trim();
  const nis = inputNIS.value.trim();
  
  if (nama !== "" && nis !== "") {
    hubungiServer("registrasi", { nama, nis });
  } else {
    alert("Isi Nama dan NIS terlebih dahulu!");
  }
});

btnMengerti.addEventListener('click', async (e) => {
  e.preventDefault();

  if (!linkUjianDariDatabase) {
    btnMengerti.innerText = "MEMUAT LINK...";
    await ambilLinkTerbaru();
    btnMengerti.innerText = "SAYA MENGERTI DAN SIAP";
  }

  if (!linkUjianDariDatabase) {
    alert("Link ujian belum diatur di server. Silakan hubungi proktor!");
    return;
  }

  sudahMulaiUjian = true;
  
  // Lakukan redirect halaman secara langsung (Menghindari masalah blank hitam Iframe)
  window.location.href = linkUjianDariDatabase;
});

// Inisialisasi
ambilLinkTerbaru();
hubungiServer("cek");