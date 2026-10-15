let activePrints = 0;
let escapeGuardUntil = 0;

// Native print dialogs can send Escape back to the page as they close.
export const isPdfPrintActive = () => activePrints > 0 || Date.now() < escapeGuardUntil;

export const beginPdfPrint = () => {
  activePrints += 1;
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    activePrints -= 1;
    escapeGuardUntil = Date.now() + 750;
  };
};
