# not integrated with the Supabase database yet

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
import uvicorn
import openai
import pgvector
import psycopg2-binary
import requests
import tiktoken #OpenAI API embeddings
import python-dotenv
