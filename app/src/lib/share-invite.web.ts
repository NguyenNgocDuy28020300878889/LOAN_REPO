export async function shareInviteLink(url: string, title: string, instructions = '') {
  const text = instructions ? `${instructions}\n\n${url}` : url;
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // Awaiting the server may consume browser user activation. Retain a manual
      // way to copy the saved invitation if the share sheet cannot be opened.
    }
  }
  // Keep the link selectable even when Web Share/clipboard permission is absent.
  window.prompt(title, text);
}
