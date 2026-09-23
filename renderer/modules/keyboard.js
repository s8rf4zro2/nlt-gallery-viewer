export function isTextInput(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function handleGridKeyDown(event, {
  isFoldersModalOpen,
  closeFoldersModal,
  isModalOpen,
  closeModal,
  modalVideo,
  query,
  clearQuery,
  searchEl,
  cols,
  rowH,
  viewportH,
  totalScenes,
  cursor,
  setCursor,
  openModal,
  renderNow,
  scrollCursorIntoView,
}) {
  const key = event.key;

  if (key === 'Escape') {
    if (isFoldersModalOpen?.()) {
      event.preventDefault();
      closeFoldersModal?.();
      return;
    }
    if (isModalOpen()) {
      event.preventDefault();
      closeModal();
    } else if (query) {
      event.preventDefault();
      clearQuery();
      searchEl.blur();
    }
    return;
  }

  if (isTextInput(event.target)) return;

  if (isModalOpen()) {
    if (key === 'm') {
      event.preventDefault();
      if (modalVideo) modalVideo.muted = !modalVideo.muted;
    }
    return;
  }

  const move = (delta) => {
    if (!totalScenes) return;
    const next = Math.min(totalScenes - 1, Math.max(0, cursor + delta));
    if (next === cursor) return;
    setCursor(next);
    scrollCursorIntoView();
    renderNow();
  };

  switch (key) {
    case 'ArrowRight':
      event.preventDefault();
      move(1);
      break;
    case 'ArrowLeft':
      event.preventDefault();
      move(-1);
      break;
    case 'ArrowDown':
      event.preventDefault();
      move(cols);
      break;
    case 'ArrowUp':
      event.preventDefault();
      move(-cols);
      break;
    case 'PageDown':
      event.preventDefault();
      move(cols * Math.max(1, Math.floor(viewportH / rowH)));
      break;
    case 'PageUp':
      event.preventDefault();
      move(-cols * Math.max(1, Math.floor(viewportH / rowH)));
      break;
    case 'Home':
      event.preventDefault();
      setCursor(0);
      scrollCursorIntoView();
      renderNow();
      break;
    case 'End':
      event.preventDefault();
      setCursor(totalScenes - 1);
      scrollCursorIntoView();
      renderNow();
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      openModal(cursor);
      break;
    case '/':
      event.preventDefault();
      searchEl.focus();
      searchEl.select();
      break;
    default:
      break;
  }
}
