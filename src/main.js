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
let sedangTerblokir = false;
let timerHukuman = null;

// Track status penekanan tombol Shift + S
let shiftSPressed = false;
let shiftSTimeout = null;

// 1. Dapatkan Link Ujian Terbaru dari Database (Dinamis dari PHP)
async function ambilLinkTerbaru() {
  sedangMemuatLink = true;
  try {
    // Tambahkan timestamp untuk menghindari caching browser
    const response = await fetch(`${URL_GET_LINK}?_=` + Date.now());
    const data = await response.json();
    
    if (data && data.link_sat && data.link_sat.trim() !== "") {
      linkUjianDariDatabase = data.link_sat.trim();
      console.log("Link ujian berhasil dimuat dinamis:", linkUjianDariDatabase);
    } else {
      console.warn("Link ujian di database kosong/belum diatur.");
      linkUjianDariDatabase = "";
    }
  } catch (err) {
    console.error("Gagal mengambil link ujian dari server:", err);
    linkUjianDariDatabase = "";
  } finally {
    sedangMemuatLink = false;
  }
}

// 2. Hubungi Server Ujian (Cek Status / Tambah Hukuman / Registrasi)
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
    const sisaHukuman = parseInt(part[1] || "0", 10);

    if (sisaHukuman > 0) {
      sedangTerblokir = true;
      layoutPeringatan.classList.add('hidden');
      layoutRegistrasi.classList.add('hidden');
      mulaiLayarBlokir(sisaHukuman);
    } else {
      if (sedangTerblokir) {
        sedangTerblokir = false;
        layoutBlokir.classList.add('hidden');
        if (timerHukuman) clearInterval(timerHukuman);
        if (sudahMulaiUjian && linkUjianDariDatabase) window.location.href = linkUjianDariDatabase;
      }

      if (!sudahMulaiUjian) {
        if (part[0] === "BELUM_REGIS") {
          layoutRegistrasi.classList.remove('hidden');
          layoutPeringatan.classList.add('hidden');
        } else {
          layoutRegistrasi.classList.add('hidden');
          layoutPeringatan.classList.remove('hidden');
        }
      }
    }
  } catch (err) {
    console.error("Gagal terhubung ke API:", err);
    if (aksi === "registrasi") {
      layoutRegistrasi.classList.add('hidden');
      layoutPeringatan.classList.remove('hidden');
    }
  }
}

// 3. Layar Blokir (Timer Hukuman)
function mulaiLayarBlokir(durasiMs) {
  layoutBlokir.classList.remove('hidden');
  let sisaDetik = Math.floor(durasiMs / 1000);

  if (timerHukuman) clearInterval(timerHukuman);
  
  teksTimer.innerText = `AKSES DIKUNCI\n\n${sisaDetik} detik`;

  timerHukuman = setInterval(() => {
    sisaDetik--;
    teksTimer.innerText = `AKSES DIKUNCI\n\n${sisaDetik} detik`;
    if (sisaDetik <= 0) {
      clearInterval(timerHukuman);
      hubungiServer("cek");
    }
  }, 1000);
}

// 4. Deteksi Kehilangan Fokus
window.addEventListener('blur', () => {
  if (sudahMulaiUjian && !sedangTerblokir) {
    hubungiServer("tambah");
  }
});

// 5. PROTEKSI KEYBOARD & TOMBOL KELUAR (SHIFT + S + X)
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  const key = e.key.toUpperCase();

  if (e.shiftKey && key === 'S') {
    shiftSPressed = true;
    clearTimeout(shiftSTimeout);
    shiftSTimeout = setTimeout(() => {
      shiftSPressed = false;
    }, 2000);
    return;
  }

  if (shiftSPressed && key === 'X') {
    shiftSPressed = false;
    clearTimeout(shiftSTimeout);
    
    if (confirm("Apakah Anda yakin ingin keluar dari Exambrowser?")) {
      if (window.__TAURI__ && window.__TAURI__.window) {
        window.__TAURI__.window.getCurrentWindow().close();
      } else if (window.__TAURI_INTERNALS__) {
        window.__TAURI_INTERNALS__.invoke('plugin:window|close');
      } else {
        window.close();
      }
    }
    e.preventDefault();
    return;
  }

  const isTargetInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
  if (isTargetInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
    return;
  }

  if (e.ctrlKey || e.metaKey || e.altKey || key.startsWith('F')) {
    e.preventDefault();
  }
});

// 6. Event Button Handlers
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

  // Jika sedang memuat link dari server, tunggu sejenak
  if (sedangMemuatLink) {
    alert("Sedang mengambil link ujian dari server, harap tunggu sejenak...");
    return;
  }

  // Jika link belum ada, coba panggil lagi
  if (!linkUjianDariDatabase) {
    btnMengerti.innerText = "MEMUAT LINK...";
    await ambilLinkTerbaru();
    btnMengerti.innerText = "SAYA MENGERTI DAN SIAP";
  }

  // Jika link di database masih kosong
  if (!linkUjianDariDatabase) {
    alert("Link ujian belum diatur di server (Database). Silakan hubungi proktor!");
    return;
  }

  sudahMulaiUjian = true;
  // Buka URL dinamis yang didapatkan dari database
  window.location.href = linkUjianDariDatabase;
});

// Inisialisasi awal
ambilLinkTerbaru();
hubungiServer("cek");