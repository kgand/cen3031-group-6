const Logger = {
    log: (...args) => console.log('[LOG]', ...args),
    error: (...args) => console.error('[ERROR]', ...args)
  };
  
  export default Logger;