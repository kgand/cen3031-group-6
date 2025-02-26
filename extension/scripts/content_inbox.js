// Canvas Inbox Content Script for FaciliGator

console.log('FaciliGator inbox content script loaded');

// Add cancellation flag at the top of the file
let isScraping = false;
let shouldCancel = false;

// Helper functions
function sanitizeString(str) {
    return str.replace(/[/\\?%*:|"<>]/g, "-").trim();
}

function getCourseIdFromUrl(url) {
    const match = url.match(/course=course_(\d+)/);
    return match ? match[1] : null;
}

async function waitForElement(selector, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Element not found: ${selector}`);
}

// Function to check if we're on the inbox page
function isInboxPage() {
    return window.location.href.includes('/conversations');
}

// Function to extract Zoom recording URL from message content
function extractZoomUrl(content) {
    const urlMatch = content.match(/Recording URL: (https:\/\/ufl\.zoom\.us\/rec\/share\/[^\s<]+)/);
    return urlMatch ? urlMatch[1] : null;
}

// Function to scrape recordings from the current inbox view
async function scrapeCurrentInboxView() {
    const recordings = [];
    
    // Get all conversation items
    const conversations = document.querySelectorAll('[data-testid="conversation"]');
    
    for (const conversation of conversations) {
        if (shouldCancel) {
            return { status: 'cancelled', recordings };
        }

        try {
            // Click to open the conversation
            const clickableElement = conversation.querySelector('[data-testid^="open-conversation-for"]');
            if (clickableElement) {
                clickableElement.click();
                
                // Wait for message content to load
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Look for recording message
                const messageContent = document.querySelector('.css-2dlkjw-text');
                if (messageContent && messageContent.textContent.includes('[Recording Available]')) {
                    const zoomUrl = extractZoomUrl(messageContent.textContent);
                    if (zoomUrl) {
                        // Get message date
                        const dateElement = conversation.querySelector('.css-ezzj2-text');
                        const date = dateElement ? dateElement.textContent : 'Unknown Date';
                        
                        recordings.push({
                            date,
                            url: zoomUrl,
                            courseId: getCourseIdFromUrl(window.location.href)
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error processing conversation:', error);
        }
    }
    
    return { status: 'complete', recordings };
}

// Main function to scrape recordings
async function scrapeRecordings() {
    console.log('Starting recording scraping');
    shouldCancel = false;
    isScraping = true;
    
    try {
        if (!isInboxPage()) {
            throw new Error("Please navigate to Canvas inbox first");
        }

        const courseId = getCourseIdFromUrl(window.location.href);
        if (!courseId) {
            throw new Error("Please select a course filter first");
        }

        console.log('Scraping recordings for course:', courseId);
        
        // Scrape the current view
        const result = await scrapeCurrentInboxView();
        
        console.log('Finished scraping recordings:', result.recordings.length);
        isScraping = false;
        return {
            status: result.status,
            courseId: courseId,
            recordings: result.recordings
        };

    } catch (error) {
        console.error('Error during recording scraping:', error);
        isScraping = false;
        return {
            status: 'error',
            error: error.message || "An unexpected error occurred"
        };
    } finally {
        isScraping = false;
    }
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Inbox content script received message:', request);
    
    if (request.action === 'cancelScraping') {
        console.log('Received cancel request');
        shouldCancel = true;
        if (!isScraping) {
            chrome.runtime.sendMessage({
                status: 'scraping_cancelled'
            });
        }
        sendResponse({ status: 'cancelling' });
        return true;
    }

    if (request.action === 'ping') {
        sendResponse({ status: 'ok' });
        return true;
    }
    
    if (request.action === "getRecordings") {
        console.log('Processing getRecordings request');
        
        scrapeRecordings()
            .then(response => {
                console.log('Scraping completed:', response);
                sendResponse(response);
            })
            .catch(error => {
                console.error('Error in message handler:', error);
                sendResponse({ 
                    status: 'error', 
                    error: error.message || "An unexpected error occurred"
                });
            });
        return true;
    }
}); 