import { ref } from 'vue';

export const globalLoading = ref({
  show: false,
  message: 'Loading...',
  progress: 0,
  total: 0
});

export function useGlobalLoading() {
  const showLoading = (message: string = 'Loading...', total: number = 0) => {
    globalLoading.value = { show: true, message, progress: 0, total };
  };

  const hideLoading = () => {
    globalLoading.value.show = false;
  };

  const updateProgress = (progress: number) => {
    globalLoading.value.progress = progress;
  };

  const simulateLoading = () => {
    showLoading('Simulating background task...', 100);
    let p = 0;
    const inv = setInterval(() => {
      p += 5;
      updateProgress(p);
      if (p >= 100) {
        clearInterval(inv);
        setTimeout(hideLoading, 500);
      }
    }, 100);
  };

  return {
    globalLoading,
    showLoading,
    hideLoading,
    updateProgress,
    simulateLoading
  };
}
