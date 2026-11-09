chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'DOWNLOAD_IMAGE') {
    chrome.downloads.download({
      url: request.dataUrl,
      filename: `${request.folderName}/${request.fileName}`,
      conflictAction: 'uniquify',
      saveAs: false
    }, (downloadId) => {
      sendResponse({ success: !!downloadId });
    });
    return true; // Asenkron yanıt için gerekli
  }

  if (request.action === 'DOWNLOAD_CSV') {
    // Excel'de Türkçe karakterlerin düzgün açılması için UTF-8 BOM (\uFEFF) ekliyoruz
    const csvContent = '\uFEFF' + request.csvText;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const reader = new FileReader();

    reader.onload = function () {
      chrome.downloads.download({
        url: reader.result,
        filename: `${request.folderName}/${request.csvFileName}`,
        conflictAction: 'overwrite',
        saveAs: false
      }, () => {
        sendResponse({ success: true });
      });
    };
    reader.readAsDataURL(blob);
    return true;
  }
});