# FaciliGator Backend API

This is the backend API for the FaciliGator Chrome Extension, providing authentication and data services.

## Setup

1. Clone the repository
2. Create a virtual environment:
   ```
   python -m venv venv
   ```
3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`
4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
5. Create a `.env` file based on `.env.example` and fill in your Supabase credentials
6. Run the server:
   ```
   python main.py
   ```

## API Endpoints

### Authentication

- `POST /auth/signup` - Register a new user
- `POST /auth/login` - Login an existing user
- `GET /auth/me` - Get current user information
- `POST /auth/logout` - Logout user

## Supabase Setup

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Enable Email Auth in Authentication settings
4. Create a "profiles" table with the following columns:
   - id (uuid, primary key)
   - full_name (text)
   - email (text)
   - created_at (timestamp with timezone, default: now())
5. Get your Supabase URL and API Key from the project settings and add them to your `.env` file 