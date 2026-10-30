// Badge de compteur dessiné sur le favicon (pastille rouge, style Facebook).

let renderedValue = -1;

export function updateFaviconBadge(count: number): void {
  if (count === renderedValue) return;
  renderedValue = count;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fillStyle = '#111827';
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f59e0b';
  ctx.stroke();

  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.fillStyle = '#f59e0b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', 32, 32);

  if (count > 0) {
    ctx.beginPath();
    ctx.arc(47, 18, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.font = count > 9 ? 'bold 16px Arial, sans-serif' : 'bold 19px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(count > 9 ? '9+' : String(count), 47, 19);
  }

  const url = canvas.toDataURL('image/png');
  let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = url;
}
