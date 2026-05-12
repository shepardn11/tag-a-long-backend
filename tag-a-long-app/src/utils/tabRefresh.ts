let refreshFn: (() => void) | null = null;
let bellRefreshFn: (() => void) | null = null;

export const registerTabRefresh = (fn: () => void) => {
  refreshFn = fn;
};

export const registerBellRefresh = (fn: () => void) => {
  bellRefreshFn = fn;
};

export const refreshTabCounts = () => {
  refreshFn?.();
  bellRefreshFn?.();
};
