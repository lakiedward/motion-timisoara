// Ensure Node-style globals exist in the browser before any library loads
(function(){
  if (typeof window !== 'undefined') {
    // SockJS and some libs expect `global`
    if (!('global' in window)) {
      // @ts-ignore
      window.global = window;
    }
    // Some libs inspect process.env
    if (!('process' in window)) {
      // @ts-ignore
      window.process = { env: {} };
    } else {
      // @ts-ignore
      window.process.env = window.process.env || {};
    }
  }
})();
