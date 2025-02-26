const Logger = {
    log: (...args) => console.log('[Log]', ...args),
    error: (...args) => console.error('[Error]', ...args)
  };
  
  export default Logger;