#logging_config.py
import os
import logging
from datetime import datetime

def setup_logging(logger_name="rag_system", log_to_console=True):
    """
    Set up logging configuration for all RAG system components
    
    Args:
        logger_name: Name of the logger
        log_to_console: Whether to log to console as well
    
    Returns:
        Configured logger instance
    """
    # Create logs directory if it doesn't exist
    if not os.path.exists("logs"):
        os.makedirs("logs")
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    
    # Format for all logs
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Create handlers
    handlers = []
    
    # Component-specific log file
    component_handler = logging.FileHandler(f"logs/{logger_name}.log")
    component_handler.setFormatter(formatter)
    component_handler.setLevel(logging.DEBUG)
    handlers.append(component_handler)
    
    # Main consolidated log file
    main_handler = logging.FileHandler("logs/rag_system_all.log")
    main_handler.setFormatter(formatter)
    main_handler.setLevel(logging.DEBUG)
    handlers.append(main_handler)
    
    # Console handler (optional)
    if log_to_console:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        console_handler.setLevel(logging.INFO)  # INFO level for console to reduce verbosity
        handlers.append(console_handler)
    
    # Get the specific logger
    logger = logging.getLogger(logger_name)
    logger.setLevel(logging.DEBUG)
    
    # Remove existing handlers to avoid duplicates
    logger.handlers = []
    
    # Add all handlers to logger
    for handler in handlers:
        logger.addHandler(handler)
    
    return logger

def get_logger(name):
    """
    Get a configured logger for a specific component
    
    Args:
        name: Name of the component/module
    
    Returns:
        Configured logger instance
    """
    return setup_logging(logger_name=name)