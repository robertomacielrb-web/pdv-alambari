/**
 * Utility to copy text to clipboard safely with fallback for older browsers or restricted iframe contexts.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Modern Clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed, trying fallback textarea execCommand:", err);
    }
  }

  // Fallback using temporary textarea
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    textArea.setAttribute("readonly", "");
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (fallbackErr) {
    console.error("Fallback clipboard copy failed:", fallbackErr);
    return false;
  }
}
