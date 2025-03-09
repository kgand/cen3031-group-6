# FaciliGator

A Chrome extension for UF Canvas that helps students manage assignments and recordings.

## Features

- Scrape and organize Canvas assignments
- Scrape and organize Zoom recordings from Canvas inbox
- User authentication with email confirmation
- Secure API backend

## Deployment

### Deploying to Render.com

This project includes a `render.yaml` file for easy deployment to Render.com.

1. Fork or clone this repository to your GitHub account
2. Create a Render.com account and connect it to your GitHub account
3. Create a new "Blueprint" on Render and select your repository
4. Configure the required environment variables:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_KEY`: Your Supabase service role key
   - `JWT_SECRET`: Will be auto-generated
   - `SITE_URL`: Will be auto-configured to your Render service URL

### Local Development

1. Clone the repository
2. Set up the backend:
   ```bash
   cd backend
   cp .env.example .env  # Update with your Supabase credentials
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```
3. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `extension` folder

## Authentication Flow

1. Users sign up with email and password
2. Email confirmation is required before login
3. After confirming email, users are redirected back to the extension
4. JWT tokens are used for API authentication

## Security Notes

- Each email can only be registered once
- Email confirmation is required for all accounts
- User passwords are securely handled by Supabase
- JWT tokens are used for API authentication

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

## Email Templates

FaciliGator uses custom email templates for authentication flows to provide a professional and branded experience. These templates are located in the `backend/email_templates` directory.

To update the email templates in Supabase:

1. Log in to your [Supabase Dashboard](https://app.supabase.com/)
2. Navigate to **Authentication** > **Email Templates**
3. Select the template you want to update (e.g., Confirm Signup)
4. Copy the HTML from the corresponding file in `backend/email_templates`
5. Paste it into the template editor in Supabase
6. Update the subject line to match the template purpose
7. Save the changes

For more detailed instructions, see the [Email Templates README](backend/email_templates/README.md). 