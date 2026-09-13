const stamp = () => new Date().toISOString().slice(11, 19);

export const logInfo = (scope: string, message: string, extra?: Record<string, unknown>) => {
  if (extra) console.log(`[${stamp()}] [${scope}] ${message}`, extra);
  else console.log(`[${stamp()}] [${scope}] ${message}`);
};

export const logOk = (scope: string, message: string, extra?: Record<string, unknown>) => {
  if (extra) console.log(`[${stamp()}] [${scope}] ✓ ${message}`, extra);
  else console.log(`[${stamp()}] [${scope}] ✓ ${message}`);
};

export const logFail = (scope: string, message: string, extra?: Record<string, unknown>) => {
  if (extra) console.error(`[${stamp()}] [${scope}] ✗ ${message}`, extra);
  else console.error(`[${stamp()}] [${scope}] ✗ ${message}`);
};
