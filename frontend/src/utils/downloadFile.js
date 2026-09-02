const downloadFile = (fileUrl, filename) => {
  if (!fileUrl) return;
  const link = document.createElement('a');
  link.href = fileUrl;
  link.setAttribute('download', filename || 'download');
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default downloadFile;
