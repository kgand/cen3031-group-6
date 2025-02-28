# FaciliGator

A UF Canvas extension that helps students manage their learning by collecting assignment information and providing access to Zoom recordings.

## Project Structure

- **backend/**: FastAPI backend with Supabase authentication
- **extension/**: Chrome extension with user authentication
- **client/**: Web client (if applicable)

## Security and Git Configuration

This project uses multiple `.gitignore` files to ensure sensitive information is not tracked by Git:

- Root `.gitignore`: General patterns for the entire project
- `backend/.gitignore`: Specific patterns for the Python backend
- `extension/.gitignore`: Specific patterns for the Chrome extension

### Important Security Notes

1. **Environment Variables**: Never commit `.env` files containing sensitive information like API keys or secrets.
   - Use `.env.example` files as templates instead.

2. **Supabase Credentials**: Keep your Supabase URL and API keys in `.env` files and never commit them.

3. **JWT Secrets**: JWT secrets should be stored in environment variables and never committed to the repository.

## Setup Instructions

### Backend Setup

1. Navigate to the `backend` directory
2. Create a virtual environment: `python -m venv venv`
3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Create a `.env` file based on `.env.example` and fill in your Supabase credentials
6. Run the server: `python main.py`

### Extension Setup

1. Navigate to the `extension` directory
2. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable Developer Mode
   - Click "Load unpacked" and select the `extension` directory

## Contributing

When contributing to this project, please ensure you follow these guidelines:

1. Never commit sensitive information like API keys, passwords, or tokens
2. Use environment variables for all sensitive configuration
3. Follow the existing code style and patterns
4. Write tests for new functionality
5. Update documentation as needed

## License

[Add your license information here] 