const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function sanitizeName(str) {
  return str
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// KULLANICI DOSTU SAKİN EKRAN PERDESİ (OVERLAY)
// ============================================================================
function showProgressOverlay(initialText) {
  let overlay = document.getElementById('gr-archive-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'gr-archive-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(11, 20, 26, 0.88)',
      backdropFilter: 'blur(6px)',
      zIndex: '999999',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      fontFamily: '"Segoe UI", Tahoma, sans-serif',
      textAlign: 'center',
      padding: '20px'
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      backgroundColor: '#1f2c34',
      border: '1px solid #25d366',
      borderRadius: '12px',
      padding: '28px 36px',
      maxWidth: '460px',
      width: '90%',
      boxShadow: '0 12px 32px rgba(0,0,0,0.45)'
    });

    const title = document.createElement('div');
    title.innerText = 'Şantiye Rapor Arşivleme İşlemi Sürüyor';
    Object.assign(title.style, {
      fontSize: '17px',
      fontWeight: 'bold',
      color: '#25d366',
      marginBottom: '12px'
    });

    const msgBox = document.createElement('div');
    msgBox.id = 'gr-archive-overlay-text';
    msgBox.innerText = initialText;
    Object.assign(msgBox.style, {
      fontSize: '13.5px',
      lineHeight: '1.5',
      color: '#e9edef',
      whiteSpace: 'pre-line',
      marginBottom: '16px'
    });

    const subNote = document.createElement('div');
    subNote.innerText = 'Arka planda yüksek çözünürlüklü indirme ve raporlama yapılmaktadır.\nLütfen işlem tamamlanana kadar bu sekmeyi kapatmayın.';
    Object.assign(subNote.style, {
      fontSize: '11.5px',
      color: '#8696a0'
    });

    card.appendChild(title);
    card.appendChild(msgBox);
    card.appendChild(subNote);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  } else {
    const msgBox = document.getElementById('gr-archive-overlay-text');
    if (msgBox) msgBox.innerText = initialText;
  }
}

function updateProgressOverlay(text) {
  const msgBox = document.getElementById('gr-archive-overlay-text');
  if (msgBox) msgBox.innerText = text;
}

function hideProgressOverlay() {
  const overlay = document.getElementById('gr-archive-overlay');
  if (overlay) overlay.remove();
}

function sendStatus(text, done = false, type = 'info') {
  chrome.runtime.sendMessage({ action: 'UPDATE_STATUS', text, done, type });
  if (done) {
    hideProgressOverlay();
  } else {
    updateProgressOverlay(text);
  }
}

// ============================================================================
// TARİH VE GÖNDEREN ÇÖZÜMLEME FONKSİYONLARI
// ============================================================================
function parseFlexibleDate(text) {
  if (!text) return null;
  const clean = text.trim().toUpperCase();
  const now = new Date();

  const formatIso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (/\bBUGÜN\b|\bTODAY\b/.test(clean)) return formatIso(now);
  if (/\bDÜN\b|\bYESTERDAY\b/.test(clean)) {
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    return formatIso(yest);
  }

  const daysTr = { 'PAZAR': 0, 'PAZARTESİ': 1, 'SALI': 2, 'ÇARŞAMBA': 3, 'PERŞEMBE': 4, 'CUMA': 5, 'CUMARTESİ': 6 };
  for (const [dayName, dayIdx] of Object.entries(daysTr)) {
    if (new RegExp(`\\b${dayName}\\b`).test(clean)) {
      const diff = (now.getDay() - dayIdx + 7) % 7;
      const target = new Date(now);
      target.setDate(now.getDate() - (diff === 0 ? 7 : diff));
      return formatIso(target);
    }
  }

  const numMatch = clean.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (numMatch) {
    let day = numMatch[1].padStart(2, '0');
    let month = numMatch[2].padStart(2, '0');
    const year = numMatch[3];
    if (parseInt(month, 10) > 12) {
      const tmp = day;
      day = month;
      month = tmp;
    }
    return `${year}-${month}-${day}`;
  }

  const monthsTr = {
    'OCAK': '01', 'OCA': '01', 'ŞUBAT': '02', 'ŞUB': '02', 'MART': '03', 'MAR': '03',
    'NİSAN': '04', 'NİS': '04', 'MAYIS': '05', 'MAY': '05', 'HAZİRAN': '06', 'HAZ': '06',
    'TEMMUZ': '07', 'TEM': '07', 'AĞUSTOS': '08', 'AĞU': '08', 'EYLÜL': '09', 'EYL': '09',
    'EKİM': '10', 'EKİ': '10', 'KASIM': '11', 'KAS': '11', 'ARALIK': '12', 'ARA': '12'
  };
  const textMatch = clean.match(/(\d{1,2})\s+([A-ZÇĞİÖŞÜ]+)\s+(\d{4})/);
  if (textMatch && monthsTr[textMatch[2]]) {
    return `${textMatch[3]}-${monthsTr[textMatch[2]]}-${textMatch[1].padStart(2, '0')}`;
  }

  return null;
}

function normalizeSenderString(raw) {
  if (!raw) return null;
  let cleaned = raw.replace(/^~/, '').trim();
  const digits = cleaned.replace(/[\s+()-]/g, '');
  if (/^\d{10,15}$/.test(digits)) {
    return digits;
  }
  const sanitized = sanitizeName(cleaned);
  return sanitized.length > 0 ? sanitized : null;
}

function parsePrePlainText(prePlainText) {
  if (!prePlainText) return null;
  const match = prePlainText.match(/\[(\d{1,2}:\d{2}(?:\s?[AP]M)?),\s*(\d{1,2})[./](\d{1,2})[./](\d{4})\]\s*(.*?):/);
  if (!match) return null;

  const isoDate = parseFlexibleDate(`${match[2]}.${match[3]}.${match[4]}`);
  const senderClean = normalizeSenderString(match[5]);

  return { isoDate, sender: senderClean };
}

function computeVisualHash(imgBitmap) {
  const hashCanvas = document.createElement('canvas');
  hashCanvas.width = 32;
  hashCanvas.height = 32;
  const hCtx = hashCanvas.getContext('2d');
  hCtx.drawImage(imgBitmap, 0, 0, 32, 32);
  const data = hCtx.getImageData(0, 0, 32, 32).data;

  let hash = '';
  for (let i = 0; i < data.length; i += 4) {
    const r = Math.floor(data[i] / 8).toString(32);
    const g = Math.floor(data[i + 1] / 8).toString(32);
    const b = Math.floor(data[i + 2] / 8).toString(32);
    hash += r + g + b;
  }
  return hash;
}

async function processImageWithWatermark(blobUrl, useWatermark, watermarkInfo, globalSeenVisualHashes) {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  const imgBitmap = await createImageBitmap(blob);

  const visualHash = computeVisualHash(imgBitmap);
  if (globalSeenVisualHashes.has(visualHash)) {
    return null;
  }
  globalSeenVisualHashes.add(visualHash);

  if (!useWatermark) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = imgBitmap.width;
  canvas.height = imgBitmap.height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(imgBitmap, 0, 0);

  const fontSize = Math.max(16, Math.round(canvas.width * 0.022));
  const padding = Math.round(fontSize * 0.7);
  const lineHeight = Math.round(fontSize * 1.35);

  const line1 = `${watermarkInfo.chatName}  |  ${watermarkInfo.date}  |  Gönderen: ${watermarkInfo.sender}`;
  const rawCaption = watermarkInfo.caption !== 'yok' ? watermarkInfo.caption : '';
  const line2 = rawCaption.length > 85 ? rawCaption.substring(0, 82) + '...' : rawCaption;

  const boxHeight = line2 ? (lineHeight * 2 + padding * 1.5) : (lineHeight + padding * 1.5);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.fillText(line1, padding, canvas.height - boxHeight + lineHeight);

  if (line2) {
    ctx.fillStyle = '#e0e0e0';
    ctx.font = `${Math.round(fontSize * 0.9)}px "Segoe UI", Arial, sans-serif`;
    ctx.fillText(line2, padding, canvas.height - boxHeight + lineHeight * 2 + 2);
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

// Lightbox açıldığında hem tam çözünürlüklü resmi hem de üst çubuktaki GERÇEK TARİH ve GERÇEK GÖNDEREN bilgisini okur
async function waitForLightboxImageAndMeta(mainEl, excludeSrcs, maxWaitMs = 3200) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const allBlobs = Array.from(document.querySelectorAll('img[src^="blob:"]'));
    const fullImg = allBlobs.find(img =>
      !mainEl.contains(img) &&
      img.complete &&
      img.naturalWidth > 350 &&
      !excludeSrcs.has(img.src)
    );

    if (fullImg) {
      await sleep(250);
      const refreshedBlobs = Array.from(document.querySelectorAll('img[src^="blob:"]'));
      const targetImg = refreshedBlobs.find(img =>
        !mainEl.contains(img) &&
        img.complete &&
        img.naturalWidth >= fullImg.naturalWidth &&
        !excludeSrcs.has(img.src)
      ) || fullImg;

      const meta = extractMetaFromLightbox(mainEl);
      return { img: targetImg, lightboxDate: meta.date, lightboxSender: meta.sender };
    }
    await sleep(120);
  }
  return null;
}

// Tam ekran medya görüntüleyicinin (Lightbox) üst çubuğundaki tarih ve gönderen adını okur
function extractMetaFromLightbox(mainEl) {
  const overlayEl = document.getElementById('gr-archive-overlay');
  const els = Array.from(document.querySelectorAll('span, div'));
  const topTexts = [];

  for (const el of els) {
    if (mainEl.contains(el)) continue;
    if (overlayEl && overlayEl.contains(el)) continue;
    if (el.children.length > 0) continue;

    const rect = el.getBoundingClientRect();
    // Lightbox üst barı (sol üstte gönderen adı, hemen altında tarih/saat bulunur)
    if (rect.top >= 0 && rect.top <= 115 && rect.left < 500 && rect.height > 0) {
      const txt = (el.innerText || '').trim();
      if (txt && txt.length < 50) {
        topTexts.push({ text: txt, top: rect.top });
      }
    }
  }

  // Yukarıdan aşağıya sırala (Üstteki gönderen adı, alttaki tarih/saat)
  topTexts.sort((a, b) => a.top - b.top);

  let foundDate = null;
  let foundSender = null;

  for (const item of topTexts) {
    const parsedD = parseFlexibleDate(item.text);
    if (parsedD) {
      if (!foundDate) foundDate = parsedD;
      continue;
    }
    // Tarih veya saat değilse ve buton/ikon metni değilse gönderen adıdır
    if (!/^\d{1,2}:\d{2}/.test(item.text) && !/^(Kapat|Close|İndir|Download|İlet|Forward)$/i.test(item.text)) {
      if (!foundSender) {
        foundSender = normalizeSenderString(item.text);
      }
    }
  }

  return { date: foundDate, sender: foundSender };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_SCRAPE') {
    sendResponse({ received: true });
    runBatchProcess(request.filterKeyword, request.startDate, request.endDate, request.useWatermark);
  }
  return true;
});

function findScrollableContainer() {
  const mainEl = document.querySelector('#main');
  if (!mainEl) return null;

  const divs = mainEl.querySelectorAll('div');
  for (const div of divs) {
    const style = window.getComputedStyle(div);
    if ((style.overflowY === 'scroll' || style.overflowY === 'auto') && div.scrollHeight > div.clientHeight) {
      return div;
    }
  }
  return null;
}

function extractChatTitle(headerEl) {
  if (!headerEl) return null;
  const spans = Array.from(headerEl.querySelectorAll('span[dir="auto"], span[title]'));
  const candidates = spans
    .map(s => (s.getAttribute('title') || s.innerText || '').trim())
    .filter(t => t.length > 0 && !t.includes('kişi bilgisi') && !t.includes('grup bilgisi') && !t.includes('çevrimiçi') && !t.includes('yazıyor'));

  if (candidates.length > 0) return candidates[0];

  const lines = headerEl.innerText.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length <= 2 && /^[A-ZÇĞİÖŞÜ]+$/.test(line)) continue;
    return line;
  }
  return lines[0] || 'Bilinmeyen Sohbet';
}

function detectIsGroupChat(mainEl, headerEl) {
  const headerText = headerEl ? headerEl.innerText : '';
  if (/grup bilgisi|group info/i.test(headerText)) return true;
  if (/kişi bilgisi|contact info/i.test(headerText)) return false;

  const lines = headerText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const subLine = lines[lines.length - 1];
    if (subLine.includes(',') || /\bSiz\b|\bYou\b/i.test(subLine)) return true;
  }

  const coloredSenders = mainEl.querySelectorAll('span[dir="auto"][style*="color"]');
  if (coloredSenders.length > 0) return true;

  if (headerEl && headerEl.querySelector('[data-icon*="group"]')) return true;

  return false;
}

function isContentPhoto(imgEl) {
  const src = imgEl.getAttribute('src') || '';
  if (!src.startsWith('blob:') && !src.startsWith('data:image/')) {
    return false;
  }
  if (imgEl.classList.contains('emoji') || imgEl.alt?.length === 1) {
    return false;
  }
  const rect = imgEl.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return rect.width >= 75 && rect.height >= 75;
  }
  return (imgEl.naturalWidth >= 80 || imgEl.width >= 75);
}

// Mesaj satırından gönderen adını/numarasını 4 farklı yöntemle okur
function extractSenderFromRow(rowEl, isGroupChat, chatNameClean) {
  // 1. Kendi gönderdiğimiz mesaj ise
  if (rowEl.querySelector('.message-out')) {
    return 'Ben';
  }

  // 2. data-pre-plain-text varsa
  const preNode = rowEl.querySelector('[data-pre-plain-text]');
  if (preNode) {
    const parsed = parsePrePlainText(preNode.getAttribute('data-pre-plain-text'));
    if (parsed && parsed.sender) return parsed.sender;
  }

  // 3. Mesaj balonunun solundaki küçük gönderen profil avatarının alt/aria-label niteliği
  const allImgs = Array.from(rowEl.querySelectorAll('img'));
  for (const img of allImgs) {
    if (!isContentPhoto(img)) {
      const label = img.getAttribute('alt') || img.getAttribute('aria-label') || '';
      if (label && label.length > 1 && label.length < 40) {
        const norm = normalizeSenderString(label);
        if (norm) return norm;
      }
    }
  }

  // 4. Mesaj balonunun üzerindeki gönderen etiketi (renkli başlık veya telefon numarası)
  const senderSpans = Array.from(rowEl.querySelectorAll('span[dir="auto"], span[aria-label]'));
  for (const span of senderSpans) {
    if (span.closest('span.selectable-text')) continue; // Açıklama metnini atla
    const txt = (span.innerText || span.getAttribute('aria-label') || '').trim();
    if (!txt || txt.length > 35 || /^\d{1,2}:\d{2}/.test(txt) || /^\+\d+$/.test(txt)) continue;

    const digits = txt.replace(/[\s+()-]/g, '');
    if (/^\d{10,15}$/.test(digits)) return digits;

    // Satırın en üst kısmında yer alan kısa gönderen başlığı
    if (span.style && span.style.color) {
      const norm = normalizeSenderString(txt);
      if (norm) return norm;
    }
  }

  // 5. Özel sohbette karşı taraftan geliyorsa
  if (!isGroupChat && rowEl.querySelector('.message-in')) {
    return chatNameClean;
  }

  return null;
}

function getPersistentRowId(rowEl, sender, rowText, imgCount) {
  const dataIdEl = rowEl.hasAttribute('data-id') ? rowEl : (rowEl.closest('[data-id]') || rowEl.querySelector('[data-id]'));
  if (dataIdEl && dataIdEl.getAttribute('data-id')) {
    return dataIdEl.getAttribute('data-id');
  }
  const timeMatch = rowText.match(/\b\d{1,2}:\d{2}\b/);
  const timeStr = timeMatch ? timeMatch[0] : '';
  return `${sender}_${timeStr}_${imgCount}_${rowText.slice(0, 40)}`;
}

function collectNonStickyDateDividers(mainEl) {
  const dividers = [];
  const candidates = Array.from(mainEl.querySelectorAll('div, span'));

  for (const el of candidates) {
    if (el.children.length > 1) continue;
    const txt = (el.innerText || '').trim();
    if (!txt || txt.length > 22) continue;
    if (el.closest('.message-in') || el.closest('.message-out')) continue;

    let curr = el;
    let isSticky = false;
    while (curr && curr !== mainEl) {
      const pos = window.getComputedStyle(curr).position;
      if (pos === 'sticky' || pos === 'fixed') {
        isSticky = true;
        break;
      }
      curr = curr.parentElement;
    }
    if (isSticky) continue;

    const parsedDate = parseFlexibleDate(txt);
    if (parsedDate) {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        dividers.push({ date: parsedDate, top: rect.top });
      }
    }
  }

  dividers.sort((a, b) => a.top - b.top);
  return dividers;
}

function resolveRowDateFromDom(rowEl, nonStickyDividers) {
  const preNode = rowEl.querySelector('[data-pre-plain-text]');
  if (preNode) {
    const parsed = parsePrePlainText(preNode.getAttribute('data-pre-plain-text'));
    if (parsed && parsed.isoDate) return parsed.isoDate;
  }

  const ariaEls = Array.from(rowEl.querySelectorAll('[aria-label]'));
  for (const el of ariaEls) {
    const d = parseFlexibleDate(el.getAttribute('aria-label'));
    if (d) return d;
  }

  const rowTop = rowEl.getBoundingClientRect().top;
  let matchedDate = null;
  for (const div of nonStickyDividers) {
    if (div.top <= rowTop + 5) {
      matchedDate = div.date;
    } else {
      break;
    }
  }
  return matchedDate;
}

function getVisibleChatItems(paneSide) {
  const items = [];
  let rows = Array.from(paneSide.querySelectorAll('div[role="listitem"], div[role="row"]'));

  if (rows.length > 0) {
    for (const row of rows) {
      const titleSpans = Array.from(row.querySelectorAll('span[title]'))
        .filter(sp => (sp.getAttribute('title') || '').trim().length > 0)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

      if (titleSpans.length > 0) {
        const primarySpan = titleSpans[0];
        const primaryTitle = (primarySpan.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
        if (primaryTitle) {
          items.push({ title: primaryTitle, titleSpan: primarySpan, rowElement: row });
        }
      }
    }
  } else {
    const allSpans = Array.from(paneSide.querySelectorAll('span[title]'));
    for (const sp of allSpans) {
      const fontSize = parseFloat(window.getComputedStyle(sp).fontSize || '14');
      if (fontSize >= 15) {
        const title = (sp.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
        if (title) {
          items.push({ title, titleSpan: sp, rowElement: sp });
        }
      }
    }
  }
  return items;
}

async function openChatReliable(chatItem, expectedTitle) {
  const targets = [
    chatItem.titleSpan,
    chatItem.titleSpan.parentElement,
    chatItem.rowElement.querySelector('div[tabindex]'),
    chatItem.rowElement
  ].filter(Boolean);

  for (const el of targets) {
    const rect = el.getBoundingClientRect();
    const clientX = rect.left + Math.min(20, rect.width / 2);
    const clientY = rect.top + Math.min(10, rect.height / 2);

    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX, clientY }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, clientX, clientY }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0, clientX, clientY }));
    el.click();

    await sleep(350);

    const mainHeader = document.querySelector('#main header');
    const currentHeaderTitle = extractChatTitle(mainHeader);
    if (currentHeaderTitle && currentHeaderTitle.toLowerCase().includes(expectedTitle.toLowerCase().slice(0, 15))) {
      await sleep(800);
      return true;
    }
  }
  return false;
}

// ============================================================================
// DİNAMİK FİLTRELİ TOPLU TARAMA MOTORU
// ============================================================================
async function runBatchProcess(filterKeyword, startDate, endDate, useWatermark) {
  showProgressOverlay(`"${filterKeyword}" içeren sohbet/gruplar aranıyor...`);

  try {
    sendStatus(`Sol listede "${filterKeyword}" içeren sohbet/gruplar aranıyor...`);

    const paneSide = document.querySelector('#pane-side');
    if (!paneSide) {
      sendStatus('Hata: Sol sohbet listesi bulunamadı.', true, 'error');
      return;
    }

    const filterRegex = new RegExp(escapeRegex(filterKeyword), 'i');
    const uniqueChatsMap = new Map();
    let lastScroll = -1;
    let stuck = 0;

    paneSide.scrollTop = 0;
    await sleep(500);

    while (stuck < 3) {
      const visibleChats = getVisibleChatItems(paneSide);
      for (const chat of visibleChats) {
        if (filterRegex.test(chat.title)) {
          const normalizedKey = chat.title.toLowerCase();
          if (!uniqueChatsMap.has(normalizedKey)) {
            uniqueChatsMap.set(normalizedKey, chat.title);
          }
        }
      }

      paneSide.scrollTop += 500;
      await sleep(600);
      if (paneSide.scrollTop === lastScroll) stuck++;
      else { stuck = 0; lastScroll = paneSide.scrollTop; }
    }

    const chatList = Array.from(uniqueChatsMap.values());
    if (chatList.length === 0) {
      sendStatus(`Uyarı: Sol sohbet listesinde "${filterKeyword}" içeren hiçbir sohbet veya grup bulunamadı.`, true, 'warning');
      return;
    }

    const listPreview = chatList.map((name, idx) => `${idx + 1}. ${name}`).join('\n');
    sendStatus(`${chatList.length} eşleşen sohbet bulundu:\n${listPreview}\n\nArşivleme başlıyor...`);
    await sleep(1200);

    const groupMasterCsvRows = ['Grup_Adi;Tarih;Fotograf_Adi;Gonderen;Aciklama'];
    const privateMasterCsvRows = ['Sohbet_Adi;Tarih;Fotograf_Adi;Aciklama'];

    const processedChatTitles = new Set();
    const globalSeenVisualHashes = new Set();
    let totalPhotosDownloaded = 0;

    for (let gIdx = 0; gIdx < chatList.length; gIdx++) {
      const chatTitle = chatList[gIdx];
      const normalizedTitle = chatTitle.toLowerCase();

      if (processedChatTitles.has(normalizedTitle)) {
        continue;
      }
      processedChatTitles.add(normalizedTitle);

      sendStatus(`[${gIdx + 1}/${chatList.length}] Açılıyor: ${chatTitle}`);

      paneSide.scrollTop = 0;
      await sleep(400);
      let matchedItem = null;

      for (let s = 0; s < 25; s++) {
        const visibleChats = getVisibleChatItems(paneSide);
        const match = visibleChats.find(c => c.title.toLowerCase() === normalizedTitle);
        if (match) {
          matchedItem = match;
          break;
        }
        paneSide.scrollTop += 450;
        await sleep(300);
      }

      if (!matchedItem) continue;

      const opened = await openChatReliable(matchedItem, chatTitle);
      if (!opened) {
        sendStatus(`[${gIdx + 1}/${chatList.length}] Uyarı: "${chatTitle}" sohbeti açılamadı, atlanıyor...`, false, 'warning');
        await sleep(800);
        continue;
      }

      const result = await runSingleChatProcess(startDate, endDate, useWatermark, globalSeenVisualHashes, `[${gIdx + 1}/${chatList.length}] `);
      if (result && result.records && result.records.length > 0) {
        totalPhotosDownloaded += result.records.length;

        if (result.isGroupChat) {
          for (const rec of result.records) {
            groupMasterCsvRows.push(`${rec.chatName};${rec.date};${rec.fileName};${rec.sender};${rec.caption.replace(/;/g, ',')}`);
          }
        } else {
          for (const rec of result.records) {
            privateMasterCsvRows.push(`${rec.chatName};${rec.date};${rec.fileName};${rec.caption.replace(/;/g, ',')}`);
          }
        }
      }
    }

    const safeKeyword = sanitizeName(filterKeyword);

    if (groupMasterCsvRows.length > 1) {
      const groupCsvName = `GR_GRUPLAR_KONSOLIDE_${safeKeyword}_${startDate}_${endDate}_Rapor.csv`;
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'DOWNLOAD_CSV',
          folderName: 'GR_Konsolide_Raporlar',
          csvFileName: groupCsvName,
          csvText: groupMasterCsvRows.join('\n')
        }, resolve);
      });
    }

    if (privateMasterCsvRows.length > 1) {
      const privateCsvName = `GR_OZEL_SOHBETLER_${safeKeyword}_${startDate}_${endDate}_Rapor.csv`;
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'DOWNLOAD_CSV',
          folderName: 'GR_Konsolide_Raporlar',
          csvFileName: privateCsvName,
          csvText: privateMasterCsvRows.join('\n')
        }, resolve);
      });
    }

    sendStatus(`Tamamlandı! ${chatList.length} gruptan/sohbetten toplam ${totalPhotosDownloaded} benzersiz fotoğraf indirildi.`, true, 'info');

  } catch (err) {
    console.error(err);
    sendStatus(`Tarama Hatası: ${err.message}`, true, 'error');
  } finally {
    hideProgressOverlay();
  }
}

// ============================================================================
// TEKİL SOHBET ARŞİVLEME MOTORU
// ============================================================================
async function runSingleChatProcess(startDate, endDate, useWatermark, globalSeenVisualHashes, prefixText = '') {
  try {
    const mainEl = document.querySelector('#main');
    if (!mainEl) return null;

    const headerEl = mainEl.querySelector('header');
    const rawChatTitle = extractChatTitle(headerEl);
    if (!rawChatTitle) return null;

    const chatNameRaw = rawChatTitle.replace(/^\[|\]$/g, '').trim();
    const chatNameClean = sanitizeName(chatNameRaw) || 'Genel Sohbet';
    const folderName = `GR_${chatNameClean}`;
    const isGroupChat = detectIsGroupChat(mainEl, headerEl);

    const scrollContainer = findScrollableContainer();
    if (!scrollContainer) return null;

    const processedRowIds = new Set();
    const sequenceTracker = {};
    const downloadedRecords = [];

    const csvHeader = 'Tarih;Fotograf_Adi;Aciklama';
    const csvRows = [];

    let reachedOlderDate = false;
    let stuckCounter = 0;
    let lastScrollTop = -1;

    while (!reachedOlderDate && stuckCounter < 5) {
      const nonStickyDividers = collectNonStickyDateDividers(mainEl);
      const rows = Array.from(mainEl.querySelectorAll('div[role="row"]'));
      let lastKnownSender = null;

      for (const row of rows) {
        if (row.querySelector('[data-testid="system-message"]')) continue;

        const rowText = (row.innerText || '').trim();
        const imgs = Array.from(row.querySelectorAll('img')).filter(isContentPhoto);

        const detectedSender = extractSenderFromRow(row, isGroupChat, chatNameClean);
        if (detectedSender) {
          lastKnownSender = detectedSender;
        }

        if (imgs.length === 0) continue;

        const domDate = resolveRowDateFromDom(row, nonStickyDividers);

        if (domDate !== null && domDate < startDate) {
          reachedOlderDate = true;
          continue;
        }

        if (domDate !== null && domDate > endDate) {
          continue;
        }

        const currentSenderForRow = detectedSender || lastKnownSender || 'Bilinmeyen';
        const rowId = getPersistentRowId(row, currentSenderForRow, rowText, imgs.length);
        if (processedRowIds.has(rowId)) continue;
        processedRowIds.add(rowId);

        const captionEl = row.querySelector('span.selectable-text');
        const captionText = (captionEl ? captionEl.innerText.replace(/[\r\n]+/g, ' ').trim() : '') || 'yok';

        const plusMatch = rowText.match(/\+(\d+)/);
        const expectedPhotoCount = plusMatch ? (imgs.length + parseInt(plusMatch[1], 10)) : imgs.length;

        imgs[0].click();

        const seenLightboxSrcs = new Set();

        for (let step = 0; step < expectedPhotoCount; step++) {
          const lbResult = await waitForLightboxImageAndMeta(mainEl, seenLightboxSrcs, 3200);

          if (!lbResult || !lbResult.img) {
            break;
          }

          const fullImg = lbResult.img;
          if (seenLightboxSrcs.has(fullImg.src)) {
            break;
          }
          seenLightboxSrcs.add(fullImg.src);

          const verifiedDate = lbResult.lightboxDate || domDate;
          // Gönderen önceliği: 1. Lightbox üst barı, 2. Satırdan okunan gönderen, 3. Önceki satırdan miras
          const verifiedSender = lbResult.lightboxSender || currentSenderForRow;

          if (!verifiedDate || verifiedDate < startDate || verifiedDate > endDate) {
            if (verifiedDate && verifiedDate < startDate) {
              reachedOlderDate = true;
            }
          } else {
            await saveSinglePhoto(fullImg.src, chatNameClean, folderName, verifiedDate, verifiedSender, captionText, useWatermark, globalSeenVisualHashes, sequenceTracker, downloadedRecords, csvRows, prefixText);
          }

          if (step + 1 < expectedPhotoCount) {
            const prevSrc = fullImg.src;
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }));
            await sleep(600);

            const nextCheck = Array.from(document.querySelectorAll('img[src^="blob:"]'))
              .find(img => !mainEl.contains(img) && img.naturalWidth > 300);
            if (!nextCheck || nextCheck.src === prevSrc) {
              break;
            }
          }
        }

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        await sleep(450);
      }

      if (reachedOlderDate) break;

      const stepScroll = Math.max(350, Math.floor(scrollContainer.clientHeight * 0.65));
      scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop - stepScroll);
      await sleep(1100);

      if (scrollContainer.scrollTop === lastScrollTop) {
        stuckCounter++;
      } else {
        stuckCounter = 0;
        lastScrollTop = scrollContainer.scrollTop;
      }
      sendStatus(`${prefixText}"${chatNameRaw}" taranıyor... İndirilen: ${downloadedRecords.length} fotoğraf`, false, 'info');
    }

    if (downloadedRecords.length > 0) {
      csvRows.sort((a, b) => a.localeCompare(b));
      const finalCsvContent = [csvHeader, ...csvRows].join('\n');

      const csvFileName = `GR_${chatNameClean}_${startDate}_${endDate}_Rapor.csv`;
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'DOWNLOAD_CSV',
          folderName: folderName,
          csvFileName: csvFileName,
          csvText: finalCsvContent
        }, resolve);
      });
    }

    return {
      chatName: chatNameClean,
      isGroupChat: isGroupChat,
      records: downloadedRecords
    };

  } catch (error) {
    console.error(error);
    return null;
  }
}

async function saveSinglePhoto(blobUrl, chatNameClean, folderName, msgDate, sender, caption, useWatermark, globalSeenVisualHashes, sequenceTracker, downloadedRecords, csvRows, prefixText) {
  try {
    const finalDataUrl = await processImageWithWatermark(blobUrl, useWatermark, {
      chatName: chatNameClean,
      date: msgDate,
      sender: sender,
      caption: caption
    }, globalSeenVisualHashes);

    if (!finalDataUrl) {
      return;
    }

    const seqKey = `${chatNameClean}_${msgDate}_${sender}`;
    sequenceTracker[seqKey] = (sequenceTracker[seqKey] || 0) + 1;
    const seqNum = sequenceTracker[seqKey];

    const fileName = `GR_${chatNameClean}_${msgDate}_${sender}_${seqNum}.jpg`;
    sendStatus(`${prefixText}İndiriliyor (${downloadedRecords.length + 1}):\n${fileName}`, false, 'info');

    await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'DOWNLOAD_IMAGE',
        folderName: folderName,
        fileName: fileName,
        dataUrl: finalDataUrl
      }, resolve);
    });

    downloadedRecords.push({
      chatName: chatNameClean,
      fileName: fileName,
      date: msgDate,
      sender: sender,
      caption: caption
    });

    const safeCaption = caption.replace(/;/g, ',');
    csvRows.push(`${msgDate};${fileName};${safeCaption}`);
  } catch (err) {
    console.error('Fotoğraf işleme/indirme hatası:', err);
  }
}