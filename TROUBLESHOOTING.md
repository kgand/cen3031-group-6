# FaciliGator Troubleshooting Guide

This guide provides solutions for common issues you might encounter when setting up and using the FaciliGator project.

## Backend Issues

### Dependency Conflicts

**Issue**: Dependency conflicts between packages (e.g., httpx and supabase).

**Solution**:
1. Use the exact versions specified in `requirements.txt`:
   ```
   pip install -r requirements.txt
   ```
2. If conflicts persist, try installing dependencies one by one:
   ```
   pip install fastapi==0.104.1 uvicorn==0.24.0
   pip install pydantic==2.4.2 python-dotenv==1.0.0
   pip install httpx>=0.24.0,<0.25.0
   pip install gotrue>=1.0.3,<2.0.0
   pip install supabase==1.0.4
   pip install pyjwt==2.8.0 python-multipart==0.0.6
   ```

### Missing Module: gotrue.types

**Issue**: `ModuleNotFoundError: No module named 'gotrue.types'`

**Solution**:
1. Ensure you have the correct version of gotrue installed:
   ```
   pip uninstall gotrue
   pip install gotrue>=1.0.3,<2.0.0
   ```
2. If the issue persists, try installing the specific version that works with your supabase version:
   ```
   pip install gotrue==1.3.1
   ```

### Environment Variables Not Found

**Issue**: Environment variables like `SUPABASE_URL` not found.

**Solution**:
1. Make sure you have a `.env` file in the backend directory
2. Verify the file contains all required variables:
   ```
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_KEY=your_supabase_key_here
   JWT_SECRET=your_jwt_secret_here
   ```
3. Ensure the `python-dotenv` package is installed and loaded in your code:
   ```python
   from dotenv import load_dotenv
   load_dotenv()
   ```

### Supabase Connection Issues

**Issue**: Cannot connect to Supabase.

**Solution**:
1. Verify your Supabase URL and key are correct
2. Run the test script to check the connection:
   ```
   python test_supabase.py
   ```
3. Check if your IP is allowed in Supabase's security settings
4. Ensure your Supabase project is active and not in maintenance mode

## Extension Issues

### Cannot Connect to Backend

**Issue**: Extension shows "Cannot connect to the server" error.

**Solution**:
1. Ensure the backend server is running on the correct port
2. Check the `CONFIG.API_BASE_URL` in `extension/scripts/config.js` matches your backend URL
3. Verify there are no CORS issues by checking the browser console
4. Make sure your backend has CORS configured correctly:
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["*"],  # In production, replace with specific origins
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```

### Authentication Issues

**Issue**: Cannot log in or sign up.

**Solution**:
1. Check the browser console for specific error messages
2. Verify your Supabase credentials are correct
3. Ensure the backend is properly configured for authentication
4. Try clearing browser storage and cache:
   ```javascript
   // In browser console
   chrome.storage.local.clear();
   ```

### Content Scripts Not Working

**Issue**: Extension doesn't interact with Canvas pages.

**Solution**:
1. Verify you're on a supported Canvas page
2. Check if the content script is being injected by looking for console logs
3. Ensure the extension has the necessary permissions in `manifest.json`
4. Try reloading the extension from Chrome's extension management page

## General Troubleshooting Steps

1. **Check Logs**: Look at browser console logs and backend server logs for error messages
2. **Restart Services**: Restart the backend server and reload the extension
3. **Clear Cache**: Clear browser cache and extension storage
4. **Update Dependencies**: Ensure all dependencies are up to date
5. **Check Permissions**: Verify the extension has the necessary permissions
6. **Verify Configuration**: Double-check all configuration files for errors

## Getting Help

If you continue to experience issues after trying these solutions, please:

1. Open an issue on the GitHub repository with detailed information about the problem
2. Include error messages, steps to reproduce, and your environment details
3. Contact the development team at kovidhgandreti@gmail.com 