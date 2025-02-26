// Recording scraper content script

console.log('Recording scraper loaded');

// Global variables - using let instead of const to allow modification
let isScraping = false;
let shouldCancel = false;

// Function to get selected course ID from URL
function getSelectedCourseId() {
    const match = window.location.hash.match(/course=course_(\d+)/);
    return match ? match[1] : null;
}

// Function to wait for element with timeout
async function waitForElement(selector, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) {
            return element;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
}

// Function to extract recording information from a message
async function extractRecordingInfo(messageElement) {
    try {
        // First check if this message has a recording
        const previewContent = messageElement.querySelector('span[data-testid="last-message-content"]');
        if (!previewContent || !previewContent.textContent.includes('[Recording Available]')) {
            return null;
        }

        // Click on the conversation to load full content
        const conversationLink = messageElement.querySelector('[data-testid^="open-conversation-for-"]');
        if (!conversationLink) {
            return null;
        }

        console.log('Loading recording details...');
        conversationLink.click();

        // Wait for the message content to load and expand
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Find all text content spans
        const allSpans = document.querySelectorAll('span');
        
        // Find the recording message
        let recordingText = '';
        for (const span of allSpans) {
            if (span.textContent.includes('[Recording Available]') && span.textContent.includes('Recording URL:')) {
                recordingText = span.textContent;
                break;
            }
        }

        if (!recordingText) {
            return null;
        }

        const recording = {};

        // Extract Zoom recording URL
        const urlMatch = recordingText.match(/Recording URL:\s*(https:\/\/[^\s\n]+)/);
        if (!urlMatch) {
            return null;
        }
        recording.url = urlMatch[1];

        // Extract title (Topic)
        const titleMatch = recordingText.match(/Topic:\s*([^\n]+)/);
        recording.title = titleMatch ? titleMatch[1].trim() : 'Untitled Recording';

        // Extract host
        const hostMatch = recordingText.match(/Host:\s*([^\n]+)/);
        recording.host = hostMatch ? hostMatch[1].trim() : '';

        // Extract date from the conversation date
        const dateElement = messageElement.querySelector('span[color="brand"]');
        recording.date = dateElement ? dateElement.textContent.trim() : '';

        console.log('Found recording:', {
            title: recording.title,
            date: recording.date,
            host: recording.host
        });
        return recording;
    } catch (error) {
        console.error('Error extracting recording info:', error);
        return null;
    }
}

// Function to scrape recordings from inbox messages
async function scrapeRecordings() {
    try {
        console.log('Starting recording scrape');
        isScraping = true;
        
        const selectedCourseId = getSelectedCourseId();
        if (!selectedCourseId) {
            return { success: false, error: 'Please select a course first' };
        }

        // Find all conversations with recording available
        const conversations = Array.from(document.querySelectorAll('[data-testid="conversation"]')).filter(conv => {
            const messageContent = conv.querySelector('span[data-testid="last-message-content"]');
            return messageContent && messageContent.textContent.includes('[Recording Available]');
        });

        console.log(`Found ${conversations.length} messages with recordings`);

        if (conversations.length === 0) {
            return { success: false, error: 'No messages found with recordings' };
        }

        const recordings = [];
        let processedCount = 0;
        let successfulCount = 0;
        const totalConversations = conversations.length;

        // Process each conversation
        for (const conversation of conversations) {
            if (shouldCancel) {
                return { success: false, error: 'Scraping cancelled' };
            }

            try {
                // Update progress
                processedCount++;
                chrome.runtime.sendMessage({
                    action: 'updateProgress',
                    data: {
                        current: processedCount,
                        total: totalConversations,
                        currentTitle: 'Processing conversations...'
                    }
                });

                const recording = await extractRecordingInfo(conversation);
                if (recording) {
                    recordings.push(recording);
                    successfulCount++;
                }

                // Wait a bit between conversations to avoid overwhelming the UI
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error('Error processing conversation:', error);
                continue;
            }
        }

        // Output final compilation for easy parsing
        console.log('RECORDINGS_DATA_START');
        console.log(JSON.stringify({
            courseId: selectedCourseId,
            totalFound: conversations.length,
            totalProcessed: processedCount,
            totalSuccessful: successfulCount,
            recordings: recordings.map(r => ({
                title: r.title,
                date: r.date,
                host: r.host,
                url: r.url
            }))
        }, null, 2));
        console.log('RECORDINGS_DATA_END');

        console.log(`Scraping complete. Successfully extracted ${successfulCount} of ${conversations.length} recordings`);
        isScraping = false;

        return { 
            success: true, 
            recordings,
            courseId: selectedCourseId,
            stats: {
                total: conversations.length,
                processed: processedCount,
                successful: successfulCount
            }
        };
    } catch (error) {
        console.error('Error scraping recordings:', error);
        isScraping = false;
        return { success: false, error: error.message };
    }
}

// Initialize message listeners
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrapeRecordings') {
        scrapeRecordings()
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep the message channel open
    }

    if (request.action === 'checkScrapingStatus') {
        sendResponse({ isActive: isScraping });
        return false;
    }

    if (request.action === 'cancelScraping') {
        shouldCancel = true;
        if (!isScraping) {
            chrome.runtime.sendMessage({
                status: 'scraping_cancelled'
            });
        }
        sendResponse({ status: 'cancelling' });
        return false;
    }

    return false;
});

// Log that the script has loaded
console.log('Recording scraper initialized'); 