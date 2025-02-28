# FaciliGator Backend

This is the backend API for the FaciliGator Chrome Extension, built with FastAPI and Supabase authentication.

## Setup Instructions

1. Create a virtual environment:
   ```
   python -m venv venv
   ```

2. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Create a `.env` file based on `.env.example` and fill in your Supabase credentials and JWT secret.

5. Run the server:
   ```
   uvicorn main:app --reload
   ```

## Troubleshooting

### Dependency Conflicts

If you encounter dependency conflicts with httpx and supabase, ensure you're using compatible versions:
- supabase 1.0.4 requires httpx>=0.24.0,<0.25.0
- Make sure gotrue is installed: `pip install gotrue`

### Authentication Issues

If you encounter authentication issues:
1. Check that your Supabase URL and key are correct in the `.env` file
2. Ensure your JWT_SECRET is set and consistent
3. Verify that the client is sending the correct Authorization header

## API Documentation

When the server is running, you can access the API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

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