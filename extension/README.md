# FaciliGator Chrome Extension

A UF Canvas extension that helps students manage their learning by collecting assignment information and accessing Zoom recordings.

## Installation

1. Clone the repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `extension` folder from this repository

## Configuration

The extension requires a backend server to be running for authentication and data processing. By default, it connects to `http://localhost:8000`.

If you need to change the backend URL, edit the `CONFIG.API_BASE_URL` value in `extension/scripts/config.js`.

## Troubleshooting

### Authentication Issues

If you encounter issues with login or signup:

1. **Backend Connection**: Make sure the backend server is running and accessible at the URL specified in `config.js`.
2. **Network Errors**: Check the browser console for network errors. The extension needs to be able to reach the backend server.
3. **CORS Issues**: If you see CORS errors, make sure the backend server is configured to allow requests from the extension.

### Extension Not Working

If the extension is not working properly:

1. **Check Permissions**: Make sure the extension has the necessary permissions to access Canvas pages.
2. **Reload Extension**: Try reloading the extension from the Chrome extensions page.
3. **Clear Cache**: Clear your browser cache and cookies for Canvas sites.
4. **Check Console**: Open the browser console (F12) and check for any error messages.

### Content Script Issues

If the content scripts are not working:

1. **Page Compatibility**: Make sure you're on a supported Canvas page.
2. **Script Injection**: Check if the content scripts are being injected properly by looking for console logs.
3. **DOM Structure**: Canvas may have updated its DOM structure. Check if the selectors in the content scripts still match the page elements.

## Development

To make changes to the extension:

1. Edit the files in the `extension` folder
2. Reload the extension from the Chrome extensions page
3. Test your changes

## Contact

If you encounter any issues or have questions, please contact the development team at kovidhgandreti@gmail.com. 