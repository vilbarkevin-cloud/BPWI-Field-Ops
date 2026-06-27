export const haptics = {
  // Light tap, e.g., for normal buttons or toggles
  tap: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  },
  
  // Medium tap, e.g., for important buttons or menu opening
  medium: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  },

  // Success, e.g., completing a task, saving a form
  success: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([10, 50, 20]);
    }
  },

  // Error/Warning, e.g., form validation failed, network error
  error: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 40, 30, 40, 30]);
    }
  }
};
