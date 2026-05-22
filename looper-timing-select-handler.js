import {
  LoopTimingMode,
  setLoopTimingMode,
  installTransportTiming
} from './looper.js';

let transportTimingInstalled = false;

export function installLoopTimingModeControls() {
  const radios = document.querySelectorAll('input[name="rbLoopTimingMode"]');
  if (!radios.length) {
    return;
  }

  function applyLoopTimingMode(mode) {
    if (mode === 'transport') {
      if (!transportTimingInstalled) {
        installTransportTiming();
        transportTimingInstalled = true;
      } else {
        setLoopTimingMode(LoopTimingMode.TRANSPORT);
      }
      return;
    }

    setLoopTimingMode(LoopTimingMode.VISUAL);
  }

  radios.forEach((radio) => {
    radio.addEventListener('click', function onClick() {
      applyLoopTimingMode(radio.value);
    });
  });
}