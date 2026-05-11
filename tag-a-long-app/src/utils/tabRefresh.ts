let refreshFn: (() => void) | null = null;

export const registerTabRefresh = (fn: () => void) => {
  refreshFn = fn;
};

export const refreshTabCounts = () => {
  refreshFn?.();
};
