#run-fastapi.py
import uvicorn
import logging
import os
import sys
from datetime import datetime
from dotenv import load_dotenv
from logging_config import setup_logging

def main():
    """Start the FastAPI server for the RAG system"""
    try:
        # Set up logging
        logger = setup_logging("rag_server")
        
        # Load environment variables
        dotenv_path = os.path.join(os.getcwd(), '.env')
        if os.path.exists(dotenv_path):
            logger.info(f"Loading environment variables from: {dotenv_path}")
            load_dotenv(dotenv_path)
        else:
            logger.warning(f"Warning: .env file not found at {dotenv_path}")
        
        logger.info("="*50)
        logger.info("Starting RAG API Server...")
        logger.info("="*50)
        
        # Check for Supabase environment variables
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_KEY")
        
        if not supabase_url or not supabase_key:
            logger.error("SUPABASE_URL or SUPABASE_KEY environment variables not set")
            logger.error("Supabase integration will not function properly")
            logger.error("Please set these variables in your .env file")
            sys.exit(1)
        else:
            logger.info("Supabase configuration detected")
        
        # Check for authentication secret
        jwt_secret = os.environ.get("JWT_SECRET")
        if not jwt_secret:
            logger.warning("JWT_SECRET not set - authentication will not be secure")
            logger.warning("Please set JWT_SECRET in your .env file")
        
        # Check for LLM API keys
        openai_key = os.environ.get("OPENAI_API_KEY")
        openrouter_key = os.environ.get("OPENROUTER_API_KEY")
        
        if not openai_key and not openrouter_key:
            logger.warning("Neither OPENAI_API_KEY nor OPENROUTER_API_KEY environment variables are set")
            logger.warning("The system will use random embeddings and may not function properly")
        
        logger.info("API documentation will be available at: http://localhost:8000/docs")
        
        # Start the server
        uvicorn.run(
            "app:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="debug"
        )
    except Exception as e:
        print(f"ERROR: Failed to start server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()