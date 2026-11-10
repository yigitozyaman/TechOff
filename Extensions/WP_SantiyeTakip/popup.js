document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  const lastWeek = new Date();
  lastWeek.setDate(today.getDate() - 7);

  document.getElementById('endDate').value = today.toISOString().split('T')[0];
  document.getElementById('startDate').value = lastWeek.toISOString().split('T')[0];

  const openWaBtn = document.getElementById('openWaBtn');
  const batchBtn = document.getElementById('startBatchBtn');
  const filterInput = document.getElementById('filterKeyword');
  const chatLimitSelect = document.getElementById('chatLimit');
  const saveDefaultBtn = document.getElementById('saveDefaultBtn');
  const defaultHint = document.getElementById('defaultHint');
  const watermarkChk = document.getElementById('useWatermark');
  const statusDiv = document.getElementById('status');

  // Sağ üstteki WhatsApp logosuna tıklanınca açık sekmeye odaklan veya yeni sekmede aç
  openWaBtn.addEventListener('click', async () => {
    const waTabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    if (waTabs && waTabs.length > 0) {
      const targetTab = waTabs[0];
      await chrome.tabs.update(targetTab.id, { active: true });
      await chrome.windows.update(targetTab.windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url: 'https://web.whatsapp.com/' });
    }
  });

  // Tarayıcı yerel hafızasından kayıtlı varsayılan filtreyi yükle
  chrome.storage.local.get(['defaultFilterKeyword'], (result) => {
    if (result.defaultFilterKeyword) {
      filterInput.value = result.defaultFilterKeyword;
    }
  });

  // Seçilen sohbet limiti değiştiğinde alt bilgi notunu güncelle
  chatLimitSelect.addEventListener('change', () => {
    const val = chatLimitSelect.value;
    defaultHint.style.color = '#666';
    defaultHint.innerText = val === 'ALL'
      ? 'Listedeki tüm sohbetler taranacaktır.'
      : `En güncel ilk ${val} sohbet içinde filtreleme yapılır.`;
  });

  // "Varsayılan" butonuna tıklandığında kalıcı olarak kaydet
  saveDefaultBtn.addEventListener('click', () => {
    const newDefault = filterInput.value.trim();
    if (!newDefault) {
      alert('Varsayılan olarak kaydetmek için boş olmayan bir metin girin.');
      return;
    }
    chrome.storage.local.set({ defaultFilterKeyword: newDefault }, () => {
      const originalText = saveDefaultBtn.innerText;
      saveDefaultBtn.innerText = 'Kaydedildi ✓';
      saveDefaultBtn.style.background = '#25d366';
      defaultHint.innerText = `Kalıcı varsayılan güncellendi: "${newDefault}"`;
      defaultHint.style.color = '#075e54';

      setTimeout(() => {
        saveDefaultBtn.innerText = originalText;
        saveDefaultBtn.style.background = '#34495e';
      }, 2000);
    });
  });

  batchBtn.addEventListener('click', async () => {
    const filterKeyword = filterInput.value.trim();
    const chatLimit = chatLimitSelect.value; // '10', '25', '50', '100' veya 'ALL'
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const useWatermark = watermarkChk.checked;

    if (!filterKeyword) {
      alert('Lütfen taranacak sohbet veya grup adını içeren bir kelime girin.');
      filterInput.focus();
      return;
    }

    if (!startDate || !endDate || startDate > endDate) {
      alert('Lütfen geçerli bir tarih aralığı seçin.');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url.includes('web.whatsapp.com')) {
      statusDiv.style.display = 'block';
      statusDiv.style.background = '#ffebee';
      statusDiv.style.color = '#c62828';
      statusDiv.innerText = 'Hata: Lütfen önce sağ üstteki WhatsApp ikonuna tıklayarak WhatsApp Web sekmesini açın.';
      return;
    }

    batchBtn.disabled = true;
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#e8f5e9';
    statusDiv.style.color = '#2c3e50';
    statusDiv.innerText = 'WhatsApp Web ile bağlantı kuruluyor...';

    chrome.tabs.sendMessage(tab.id, {
      action: 'START_SCRAPE',
      filterKeyword: filterKeyword,
      chatLimit: chatLimit,
      startDate: startDate,
      endDate: endDate,
      useWatermark: useWatermark
    }, (response) => {
      if (chrome.runtime.lastError) {
        statusDiv.style.background = '#ffebee';
        statusDiv.style.color = '#c62828';
        statusDiv.innerText = 'Bağlantı Hatası: Lütfen WhatsApp Web sayfasını yenileyip (F5) tekrar deneyin.';
        batchBtn.disabled = false;
      }
    });
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'UPDATE_STATUS') {
      statusDiv.style.display = 'block';
      if (msg.type === 'error') {
        statusDiv.style.background = '#ffebee';
        statusDiv.style.color = '#c62828';
      } else if (msg.type === 'warning') {
        statusDiv.style.background = '#fff8e1';
        statusDiv.style.color = '#ef6c00';
      } else {
        statusDiv.style.background = '#e8f5e9';
        statusDiv.style.color = '#2c3e50';
      }
      statusDiv.innerText = msg.text;
      if (msg.done) {
        batchBtn.disabled = false;
      }
    }
  });
});
