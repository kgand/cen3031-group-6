# RAG System for Course Materials

This is a Retrieval Augmented Generation (RAG) system built with FastAPI, Supabase, and OpenRouter to summarize and retrieve information from lecture transcripts and assignments.

## Overview

The RAG system processes course materials and allows users to query them using natural language. It works by:

1. Processing documents into searchable chunks
2. Converting text into vector embeddings
3. Finding relevant information for user queries
4. Generating comprehensive responses using LLMs

## Features

- **Natural Language Queries**: Ask questions about course content in plain English
- **Document Filtering**: Select specific materials to query or exclude
- **Local Embeddings**: Fast document processing with Sentence Transformers
- **LLM Integration**: High-quality responses via OpenRouter
- **JWT Authentication**: Secure API access with token-based authentication
- **Supabase Integration**: Cloud-based database storage with Row Level Security
- **Command Line Interface**: Easy-to-use CLI for common operations
- **Comprehensive Logging**: Detailed logs for monitoring and debugging
- **Diagnostic Tools**: Built-in troubleshooting and testing utilities

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- Supabase account and project
- OpenRouter API key
- (Optional) OpenAI API key for fallback embeddings

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd rag-system
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Create a `.env` file in the project root:
   ```
   # Supabase Configuration
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_KEY=your-supabase-service-role-key

   # OpenAI/OpenRouter Configuration
   OPENAI_API_KEY=your-openai-key
   OPENROUTER_API_KEY=your-openrouter-key

   # JWT Secret for authentication
   JWT_SECRET=your-jwt-secret

   # Server Configuration
   PORT=8000
   HOST=0.0.0.0
   ```

### Supabase Setup

1. Create a Supabase account at supabase.com
2. Create a new project
3. Set up the following tables:

#### assignments Table
```sql
CREATE TABLE assignments (
    id UUID PRIMARY KEY,
    user_id UUID,
    course_id TEXT,
    assignment_group TEXT,
    title TEXT,
    description TEXT,
    points NUMERIC,
    due_date TEXT,
    status TEXT,
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### zoom_transcripts Table
```sql
CREATE TABLE zoom_transcripts (
    id UUID PRIMARY KEY,
    recording_id UUID,
    user_id UUID,
    transcript_data JSONB,
    formatted_text TEXT,
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

4. Set up Row Level Security (RLS) policies for each table:

```sql
-- Enable RLS
ALTER TABLE zoom_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own documents
CREATE POLICY "Users can view their own documents"
ON zoom_transcripts FOR SELECT
USING (auth.uid()::text = user_id);

-- Allow users to insert their own documents
CREATE POLICY "Users can insert their own documents"
ON zoom_transcripts FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

-- Similar policies for assignments table
```

## Running the Server

Start the server using:
```bash
python run-fastapi.py
```

- The API will be available at `http://localhost:8000`
- API documentation will be available at `http://localhost:8000/docs`

## Command Line Interface (CLI)

The system includes a CLI for easy interaction with the API:

```bash
# Upload a document
python rag_cli.py upload path/to/file.txt --title="My Document" --type=transcript

# List all documents
python rag_cli.py list-docs

# Query documents
python rag_cli.py query "What is the main topic?" --doc-id=12345678-90ab-cdef-1234-567890abcdef

# Delete a document
python rag_cli.py delete-doc 12345678-90ab-cdef-1234-567890abcdef

# Authentication commands
python rag_cli.py auth login
python rag_cli.py auth token
```

## API Endpoints

### Authentication

- **GET /auth/test**: Test if authentication is working
  ```bash
  curl -X GET "http://localhost:8000/auth/test" -H "Authorization: Bearer YOUR_TOKEN"
  ```

- **GET /auth/debug-token/{token}**: Debug a JWT token
  ```bash
  curl -X GET "http://localhost:8000/auth/debug-token/YOUR_TOKEN"
  ```

- **GET /auth/supabase-status**: Check Supabase connection status
  ```bash
  curl -X GET "http://localhost:8000/auth/supabase-status"
  ```

### Documents

- **GET /documents**: List all documents
  ```bash
  curl -X GET "http://localhost:8000/documents" -H "Authorization: Bearer YOUR_TOKEN"
  ```

- **POST /documents/upload**: Upload a document
  ```bash
  curl -X POST "http://localhost:8000/documents/upload" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: multipart/form-data" \
    -F "file=@document.txt" \
    -F "title=My Document" \
    -F "document_type=transcript"
  ```

- **GET /documents/{document_id}**: Get a document by ID
  ```bash
  curl -X GET "http://localhost:8000/documents/DOCUMENT_ID" -H "Authorization: Bearer YOUR_TOKEN"
  ```

- **DELETE /documents/{document_id}**: Delete a document
  ```bash
  curl -X DELETE "http://localhost:8000/documents/DOCUMENT_ID" -H "Authorization: Bearer YOUR_TOKEN"
  ```

### Queries

- **POST /query**: Query documents
  ```bash
  curl -X POST "http://localhost:8000/query" \
    -H "Content-Type: application/json" \
    -d '{
      "query": "What is the main topic?",
      "document_ids": ["DOCUMENT_ID_1", "DOCUMENT_ID_2"],
      "top_k": 5,
      "model": "meta-llama/llama-3-8b-instruct"
    }'
  ```

### Diagnostics

- **GET /test**: Check if the server is running
  ```bash
  curl -X GET "http://localhost:8000/test"
  ```

- **POST /test/generate**: Test LLM response generation
  ```bash
  curl -X POST "http://localhost:8000/test/generate" \
    -H "Content-Type: application/json" \
    -d '{
      "query": "Summarize this text",
      "context": "This is a test context for generation.",
      "model": "meta-llama/llama-3-8b-instruct"
    }'
  ```

- **POST /diagnostic/full-pipeline/{document_id}**: Test the complete RAG pipeline
  ```bash
  curl -X POST "http://localhost:8000/diagnostic/full-pipeline/DOCUMENT_ID" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d "query=What is the main point?"
  ```

## Diagnostic Tools

The system includes several diagnostic tools to help troubleshoot issues:

### System Diagnostic

Run a full system diagnostic:
```bash
python rag_diagnostic.py --doc-id=DOCUMENT_ID --token=YOUR_TOKEN
```

This will:
1. Test server connectivity
2. Check authentication status
3. Verify Supabase connection
4. List all available documents
5. Check document content
6. Test the query pipeline

### Database Connection Test

Test Supabase connectivity:
```bash
python test_db_connection.py
```

## Testing Query Generation

You can test the RAG system's query generation independently:

```python
from rag_system import RAGSystem

# Initialize the RAG system
rag = RAGSystem()

# Create a test document
document = """
Retrieval-Augmented Generation (RAG) is a technique that enhances large language models 
by providing them with external knowledge. It helps overcome the limitation of outdated 
training data and reduces hallucinations.
"""

# Process a query
result = rag.process_document(
    document=document,
    query="What is RAG and what are its benefits?",
    chunks_to_retrieve=3
)

# Display the response
if result["success"]:
    print(result["response"])
else:
    print(f"Error: {result['error']}")
```

## For Frontend Developers

For frontend integration, here's a quick reference to the key helper functions you can use to interact with the RAG API:

### Core Helper Functions

```javascript
// Initialize the API client
const ragApi = new RagAPI('http://localhost:8000', 'your-auth-token');

// Document Operations
ragApi.listDocuments(documentType, courseId)     // List all documents, optionally filtered
ragApi.getDocument(documentId)                   // Get a specific document
ragApi.uploadDocument(file, title, docType)      // Upload a new document
ragApi.deleteDocument(documentId)                // Delete a document

// Query Operations
ragApi.queryDocuments(query, documentIds, topK)  // Run a query against documents

// Authentication
ragApi.setAuthToken(token)                       // Update the auth token
ragApi.testAuth()                                // Test if authentication works

// Diagnostics
ragApi.getSupabaseStatus()                       // Check Supabase connection
ragApi.testGeneration(query, context, model)     // Test just the LLM generation
ragApi.testFullPipeline(documentId, query)       // Test the complete RAG pipeline
```

### Implementation Example

Create a `rag-api.js` file with a class that handles all API interactions. A minimal example:

```javascript
class RagAPI {
  constructor(baseUrl, authToken) {
    this.baseUrl = baseUrl || 'http://localhost:8000';
    this.authToken = authToken;
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Document operations
  async listDocuments() {
    const response = await fetch(`${this.baseUrl}/documents`, {
      headers: this.getHeaders()
    });
    return await response.json();
  }

  async uploadDocument(file, title, documentType = 'transcript') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('document_type', documentType);

    const response = await fetch(`${this.baseUrl}/documents/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.authToken}` },
      body: formData
    });
    return await response.json();
  }

  // Query operations
  async queryDocuments(query, documentIds = []) {
    const response = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ query, document_ids: documentIds })
    });
    return await response.json();
  }
}
```

Import and use this class in your components to interact with the RAG system without dealing directly with API endpoints.

## Logging System

All logs are stored in the `logs` directory:
- `rag_system_all.log`: Consolidated log with all messages
- `rag_api.log`: API server logs
- `rag_system.log`: Core RAG system logs
- `rag_server.log`: Server startup logs

Use the log manager to view logs:
```bash
# View last 100 lines of the consolidated log
python log_manager.py view

# Tail logs in real-time
python log_manager.py tail --component=rag_api
```

## Troubleshooting

### Authentication Issues
If you encounter authentication issues:
1. Check that your Supabase URL and key are correct in the `.env` file
2. Ensure your JWT_SECRET is set and consistent
3. Generate a new token using: `python rag_cli.py auth login`
4. Verify the token is valid with: `python rag_cli.py auth token`

### Database Connection Issues
If you have connection problems with Supabase:
1. Verify your project URL and API key
2. Check network connectivity and firewall settings
3. Run the connection test: `python test_db_connection.py`
4. Try using the service role key to bypass RLS policies

### Embedding Issues
If embedding generation fails:
1. Ensure Sentence Transformers is properly installed
2. Check that you have enough memory for local embeddings
3. Try setting USE_LOCAL_EMBEDDINGS=False in rag_system.py to use OpenAI embeddings
4. Verify your OpenAI API key is valid if using OpenAI embeddings

## Advanced Configuration

### Embedding Configuration
In `rag_system.py`, you can adjust RAG behavior:
```python
EMBEDDING_DIMENSION = 384      # Dimension size for embeddings
CHUNK_SIZE = 150               # Tokens per chunk
CHUNK_OVERLAP = 30             # Overlap between chunks
USE_LOCAL_EMBEDDINGS = True    # Prioritize local embeddings
```

### Model Selection
The default LLM is "meta-llama/llama-3-8b-instruct". Customize it in requests:
```json
{
  "query": "Summarize the main points",
  "document_ids": ["doc123"],
  "model": "meta-llama/llama-3-8b-instruct"
}
```