# FaciliGator Email Templates

This directory contains custom email templates for FaciliGator's authentication flows. These templates are designed to provide a professional and branded experience for users.

## How to Update Supabase Email Templates

To update the email templates in your Supabase project:

1. **Log in to your Supabase Dashboard**:
   - Go to [https://app.supabase.com/](https://app.supabase.com/)
   - Select your FaciliGator project

2. **Navigate to Email Templates**:
   - Go to **Authentication** in the left sidebar
   - Click on **Email Templates**

3. **Select the Template to Edit**:
   - **Confirm Signup**: Use `confirmation.html` from this directory
   - **Invite User**: Use `invite_user.html` for inviting team members
   - **Magic Link**: Use `magic_link.html` for passwordless login
   - **Change Email Address**: Use `change_email.html` for email change confirmation
   - **Reset Password**: Use `password_reset.html` for password reset requests

4. **Copy and Paste the HTML**:
   - Open the corresponding HTML file from this directory
   - Copy the entire HTML content
   - Paste it into the template editor in Supabase
   - Make sure to keep the template variables (e.g., `{{ .ConfirmationURL }}`)

5. **Update the Subject Line**:
   - Set a clear, professional subject line for each email type
   - For confirmation emails: "Confirm Your FaciliGator Account"
   - For password reset: "Reset Your FaciliGator Password"

6. **Save the Changes**:
   - Click the "Save" button to update the template

## Template Variables

Supabase provides several variables you can use in your templates:

- `{{ .ConfirmationURL }}`: The URL for confirming signup or actions
- `{{ .Token }}`: The raw token (avoid using this directly in emails)
- `{{ .TokenHash }}`: A hashed version of the token
- `{{ .SiteURL }}`: Your application's site URL

## Testing Email Templates

To test your email templates:

1. Create a test user account
2. Check the received email for proper formatting and functionality
3. Verify that all links work correctly
4. Test on different email clients (Gmail, Outlook, etc.)

## Custom SMTP Configuration (Recommended for Production)

For production use, it's recommended to set up custom SMTP:

1. Go to **Project Settings** > **Authentication** > **SMTP**
2. Configure your SMTP provider (SendGrid, AWS SES, etc.)
3. This will improve deliverability and remove Supabase's email sending limits

## Troubleshooting

If users report not receiving emails:

1. Check spam/junk folders
2. Verify the email address is correct
3. Check Supabase logs for any sending errors
4. Ensure your custom SMTP is properly configured (if using)

For any issues, contact the development team at kovidhgandreti@gmail.com

## Available Templates

This directory includes the following email templates:

### confirmation.html
- **Purpose**: Sent when a new user signs up to confirm their email address
- **Key Features**: Professional UF branding, clear call-to-action button, security notes
- **Suggested Subject**: "Confirm Your FaciliGator Account"

### password_reset.html
- **Purpose**: Sent when a user requests a password reset
- **Key Features**: Security tips for creating strong passwords, time-limited link warning
- **Suggested Subject**: "Reset Your FaciliGator Password"

### magic_link.html
- **Purpose**: Sent for passwordless authentication
- **Key Features**: One-time use warning, short expiration time (10 minutes)
- **Suggested Subject**: "Your FaciliGator Login Link"

### change_email.html
- **Purpose**: Sent when a user requests to change their email address
- **Key Features**: Security warning if not requested by user, clear confirmation process
- **Suggested Subject**: "Confirm Your Email Change - FaciliGator"

### invite_user.html
- **Purpose**: Sent when inviting new users to join FaciliGator
- **Key Features**: Product benefits overview, welcoming tone, clear next steps
- **Suggested Subject**: "You're Invited to Join FaciliGator" 