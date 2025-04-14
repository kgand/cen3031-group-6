// Make sure we can't load twice
if (typeof window.transcriptScraperLoaded === 'undefined') {
    window.transcriptScraperLoaded = true;
    
    console.log('Transcript scraper initializing...');

    // Immediately check if we're on a Zoom page and report back
    function checkAndReportZoomPage() {
        console.log('Checking if this is a Zoom recording page...');
        const url = window.location.href;
        const title = document.title;
        
        const isZoomPage = url.includes('zoom.us/rec/') || 
                        url.includes('zoom.us/recording/') ||
                        (title && (title.includes('Zoom') || title.includes('Cloud Recording')));
        
        console.log(`Is Zoom page: ${isZoomPage}, URL: ${url}, Title: ${title}`);
        
        // If we're on a Zoom page, also check for password form
        if (isZoomPage) {
            const hasPasswordField = !!document.querySelector('input[type="password"]');
            console.log(`Has password field: ${hasPasswordField}`);
            
            if (hasPasswordField) {
                // Immediately report back that this recording requires a password
                reportExtractionError('This recording requires a password. Please ensure it is set to not require a password.');
                return;
            }
            
            // Also check if we have a "Meeting not found" message
            const pageText = document.body.textContent || '';
            if (pageText.includes('meeting has not been found') || 
                pageText.includes('meeting is unavailable') ||
                pageText.includes('invalid meeting')) {
                reportExtractionError('This recording link appears to be invalid or expired.');
                return;
            }
        }
        
        return isZoomPage;
    }
    
    // Report an extraction error immediately
    function reportExtractionError(errorMessage) {
        console.error('Extraction error:', errorMessage);
        const extractionId = getUrlParam('extractionId') || 'error_report';
        
        chrome.runtime.sendMessage({
            action: 'transcriptExtractionComplete',
            extractionId: extractionId,
            url: window.location.href,
            result: {
                success: false,
                error: errorMessage,
                errorDetails: {
                    url: window.location.href,
                    pageTitle: document.title,
                    timestamp: new Date().toISOString(),
                    htmlStructure: summarizePageStructure()
                }
            }
        });
    }
    
    // Function to get URL parameters
    function getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }
    
    // Immediate check on page load
    const isZoomPage = checkAndReportZoomPage();
    
    // Auto-extract transcripts immediately on page load
    if (isZoomPage) {
        console.log('This is a Zoom recording page - starting immediate transcript extraction');
        
        // Wait for the page to be fully loaded
        if (document.readyState === 'complete') {
            startAutoExtraction();
        } else {
            window.addEventListener('load', function() {
                startAutoExtraction();
            });
        }
    }
    
    // Function to start the auto extraction process
    function startAutoExtraction() {
        console.log('Starting automatic transcript extraction');
        
        // Extract transcript with retry mechanism
        extractTranscriptWithRetry(5)
            .then(result => {
                console.log('Auto-extraction successful:', result);
                
                // Store the result for the recording scraper to collect
                chrome.storage.local.set({
                    'last_transcript_result': {
                        url: window.location.href,
                        result: result,
                        timestamp: Date.now()
                    }
                });
            })
            .catch(error => {
                console.error('Auto-extraction failed:', error);
            });
    }
    
    // Check if this is a Zoom recording page and attempt auto-extraction if needed
    (function() {
        // Only proceed if it's a Zoom page
        if (!isZoomPage) {
            console.log('Not a Zoom recording page, transcript scraper will not run');
            return;
        }
        
        // Auto-extract if URL contains the parameter
        const shouldAutoExtract = getUrlParam('autoExtract') === 'true';
        const extractionId = getUrlParam('extractionId');
        
        if (shouldAutoExtract && extractionId) {
            console.log(`Auto-extraction enabled for extraction ID: ${extractionId}`);
            
            // Send an immediate status update
            chrome.runtime.sendMessage({
                action: 'transcriptExtractionStatus',
                extractionId: extractionId,
                url: window.location.href,
                status: 'initializing',
                timestamp: Date.now()
            });
            
            // Wait for page to load completely before attempting extraction
            let retryCount = 0;
            const maxRetries = 5;
            
            function attemptExtraction() {
                retryCount++;
                console.log(`Attempt ${retryCount} to extract transcript`);
                
                // Report status update
                chrome.runtime.sendMessage({
                    action: 'transcriptExtractionStatus',
                    extractionId: extractionId,
                    url: window.location.href,
                    status: 'extracting',
                    attemptNumber: retryCount,
                    timestamp: Date.now()
                });
                
                extractTranscriptWithRetry(3).then(result => {
                    console.log('Extraction completed with result:', result);
                    
                    // Send result back to background script
                    chrome.runtime.sendMessage({
                        action: 'transcriptExtractionComplete',
                        extractionId: extractionId,
                        url: window.location.href,
                        result: result
                    });
                    
                }).catch(error => {
                    console.error('Error during auto-extraction:', error);
                    
                    // Format error message
                    let errorMessage = error.message || 'Unknown error during transcript extraction';
                    let errorDetails = {
                        url: window.location.href,
                        pageTitle: document.title,
                        timestamp: new Date().toISOString(),
                        retryAttempt: retryCount,
                        htmlStructure: summarizePageStructure()
                    };
                    
                    // If we haven't exceeded max retries, try again
                    if (retryCount < maxRetries) {
                        console.log(`Retrying extraction (${retryCount}/${maxRetries})...`);
                        setTimeout(attemptExtraction, 2000 * retryCount); // Increasing wait time with each retry
                        return;
                    }
                    
                    // Send error back to background script
                    chrome.runtime.sendMessage({
                        action: 'transcriptExtractionComplete',
                        extractionId: extractionId,
                        url: window.location.href,
                        result: {
                            success: false,
                            error: errorMessage,
                            errorDetails: errorDetails
                        }
                    });
                });
            }
            
            // Function to summarize page structure for debugging
            function summarizePageStructure() {
                try {
                    // Get basic page structure
                    const bodyChildren = document.body.children.length;
                    const hasTranscriptButton = !!document.querySelector('button[aria-label*="transcript" i], [role="button"][aria-label*="transcript" i]');
                    const possibleTranscriptButtons = Array.from(document.querySelectorAll('button, [role="button"]'))
                        .filter(btn => btn.textContent.toLowerCase().includes('transcript'))
                        .length;
                    
                    // Check for common Zoom UI elements
                    const hasVideoPlayer = !!document.querySelector('video');
                    const hasZoomBranding = !!document.querySelector('[class*="zoom"]');
                    const hasPasswordField = !!document.querySelector('input[type="password"]');
                    
                    return {
                        bodyChildCount: bodyChildren,
                        hasTranscriptButton,
                        possibleTranscriptButtons,
                        hasVideoPlayer,
                        hasZoomBranding,
                        hasPasswordField,
                        pageLoadComplete: document.readyState === 'complete',
                        visibleButtons: Array.from(document.querySelectorAll('button:not([style*="display: none"])')).length,
                        potentialTranscriptContainers: document.querySelectorAll('[role="list"], ul, .transcript').length
                    };
                } catch (e) {
                    return {error: e.message};
                }
            }
            
            // Start extraction after a longer delay to ensure page is fully loaded
            console.log('Starting extraction after a delay to ensure page loads...');
            setTimeout(attemptExtraction, 3000);
        }
    })();

    // Message handler for transcript extraction
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // Immediately console log all messages for debugging
        console.log('Transcript scraper received message:', request);
        
        if (request.action === "extractTranscript") {
            console.log('Received extract transcript message:', request);
            
            // Immediately send an acknowledgment to keep the channel open
            sendResponse({status: 'acknowledged', message: 'Transcript extraction started'});
            
            extractTranscriptWithRetry(5).then(result => {
                // Send the result back via a new message
                chrome.runtime.sendMessage({
                    action: 'transcriptExtractionComplete',
                    extractionId: request.extractionId || 'manual_extract',
                    url: window.location.href,
                    result: result
                });
            }).catch(error => {
                // Send the error back via a new message
                chrome.runtime.sendMessage({
                    action: 'transcriptExtractionComplete',
                    extractionId: request.extractionId || 'manual_extract',
                    url: window.location.href,
                    result: {
                        success: false,
                        error: error.message || 'Unknown error during transcript extraction',
                        errorDetails: {
                            url: window.location.href,
                            pageTitle: document.title,
                            timestamp: new Date().toISOString()
                        }
                    }
                });
            });
                    
            return true; // Keep the message channel open
        }
        
        if (request.action === "getTranscriptStatus") {
            console.log('Received get transcript status message');
            
            // Try to extract transcript immediately
            extractTranscriptWithRetry(3).then(result => {
                console.log('Successfully extracted transcript for status check', result);
                sendResponse(result);
            }).catch(error => {
                console.error('Failed to extract transcript for status check:', error);
                sendResponse({ 
                    success: false, 
                    error: error.message || 'Failed to extract transcript'
                });
            });
            
            return true; // Keep the message channel open
        }
    });

    // Function to find and click the transcript button if it exists
    function clickTranscriptButton() {
        console.log('Looking for transcript button to click...');
        
        // Common selectors for transcript buttons in Zoom interface
        const transcriptButtonSelectors = [
                    'button[aria-label*="transcript" i]', 
                    '[role="button"][aria-label*="transcript" i]', 
                    'button:contains("Transcript")',
            'button:contains("transcript")',
                    '[role="button"]:contains("Transcript")',
            'button.transcript-btn',
            'button[data-tab="transcript"]'
                ];
                
                // Try each selector
        for (const selector of transcriptButtonSelectors) {
                    try {
                // For jQuery-style :contains selector, we need a different approach
                if (selector.includes(':contains')) {
                    const buttonText = selector.match(/:contains\("(.+?)"\)/)[1].toLowerCase();
                    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
                    const button = buttons.find(btn => 
                        btn.textContent.toLowerCase().includes(buttonText) &&
                        btn.offsetParent !== null // Ensure it's visible
                    );
                    
                    if (button) {
                        console.log(`Found transcript button with text containing "${buttonText}"`, button);
                        button.click();
                        return true;
                    }
                            } else {
                    const button = document.querySelector(selector);
                    if (button && button.offsetParent !== null) {
                        console.log(`Found transcript button with selector: ${selector}`, button);
                        button.click();
                        return true;
                            }
                        }
                    } catch (e) {
                console.warn(`Error trying selector ${selector}:`, e);
                    }
                }
                
        // Try a more general approach with buttons containing "transcript" text
        const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const transcriptButton = allButtons.find(btn => 
            btn.textContent.toLowerCase().includes('transcript') && 
            btn.offsetParent !== null
        );
        
        if (transcriptButton) {
            console.log('Found transcript button via text content:', transcriptButton);
            transcriptButton.click();
            return true;
        }
        
        console.log('No transcript button found to click');
        return false;
    }

    // Function to find transcript items
    async function findTranscriptItems() {
        console.log('Finding transcript items...');
        
        // Try clicking the transcript button first
        const buttonClicked = clickTranscriptButton();
        if (buttonClicked) {
            // Wait for transcript panel to appear after clicking button
            console.log('Transcript button clicked, waiting for panel to load...');
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        // First try the direct approach - looking for transcript items
        const directItems = findTranscriptItemsInPage();
        if (directItems && directItems.length > 0) {
            console.log(`Found ${directItems.length} transcript items directly`);
            return directItems;
        }
        
        // If no direct items, try to find elements that match common transcript list patterns
        console.log('No direct transcript items found, searching for transcript containers...');
        
        // First, look for elements with transcript in the class or attribute
        const transcriptContainers = document.querySelectorAll('[class*="transcript" i], [id*="transcript" i], [role="list"], .transcript-container');
        
        if (transcriptContainers && transcriptContainers.length > 0) {
            console.log(`Found ${transcriptContainers.length} potential transcript containers`);
            
            // Check each container for potential transcript items
            for (const container of transcriptContainers) {
                const items = container.querySelectorAll('li, [role="listitem"], .transcript-item, [class*="transcript-item"], div');
                if (items && items.length > 10) {
                    console.log(`Found ${items.length} potential transcript items in container`, container);
                    return Array.from(items);
                }
            }
        }
        
        // Look for any divs that might contain time and text paragraph patterns
        const divs = document.querySelectorAll('div');
        const potentialTranscriptDivs = Array.from(divs).filter(div => {
            // Check if div has multiple child elements with similar structure
            const children = div.children;
            if (children.length < 10) return false;
            
            // Check if children have consistent structure that might indicate transcript items
            const firstFew = Array.from(children).slice(0, 5);
            const allHaveSimilarStructure = firstFew.every(child => {
                // Look for time/timestamp pattern in text
                const text = child.textContent;
                return text && (
                    text.match(/\d+:\d+/) || // HH:MM or MM:SS format
                    text.split(' ').length > 3 // Has multiple words (likely a sentence)
                );
            });
            
            return allHaveSimilarStructure;
        });
        
        if (potentialTranscriptDivs.length > 0) {
            console.log(`Found ${potentialTranscriptDivs.length} potential transcript containing divs`);
            
            // Take the div with the most children as it's likely the transcript container
            potentialTranscriptDivs.sort((a, b) => b.children.length - a.children.length);
            const mostLikelyDiv = potentialTranscriptDivs[0];
            console.log(`Most likely transcript div has ${mostLikelyDiv.children.length} items`);
            
            return Array.from(mostLikelyDiv.children);
        }
        
        // Try looking for any lists in the document
        const listLikeElements = document.querySelectorAll('[role="list"], ul, ol, [class*="list"]');
        if (listLikeElements && listLikeElements.length > 0) {
            console.log(`Found ${listLikeElements.length} list-like elements - checking for possible transcript items`);
            
            // Log what we found
            Array.from(listLikeElements).forEach((list, i) => {
                console.log(`List-like element ${i+1}:`, {
                    tagName: list.tagName,
                    className: list.className,
                    childCount: list.children.length,
                    firstChildText: list.children[0]?.textContent.trim().substring(0, 50)
                });
            });
            
            // Scan these elements for potential transcript items
            for (const listElement of listLikeElements) {
                const childItems = listElement.children;
                if (childItems && childItems.length > 10) {  // Assume a transcript would have many items
                    console.log(`Found list with ${childItems.length} items - might be transcript`);
                    return Array.from(childItems);
                }
            }
        }
        
        // Last resort: get all the HTML from the page and analyze
        console.log('Attempting to parse all page HTML as a last resort...');
        const allHtml = document.documentElement.outerHTML;
        
        // See if the page contains transcript items in an iframe
        const hasIframe = document.querySelector('iframe');
        if (hasIframe) {
            try {
                console.log('Found iframe, attempting to access...');
                const iframes = document.querySelectorAll('iframe');
                
                for (const iframe of iframes) {
                    try {
                        // Try to access iframe content
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        console.log('Successfully accessed iframe document');
                        
                        // Look for transcript items in the iframe
                        const iframeItems = iframeDoc.querySelectorAll('.transcript-list-item, [aria-label*="transcript" i], [role="listitem"]');
                        if (iframeItems && iframeItems.length > 0) {
                            console.log(`Found ${iframeItems.length} transcript items in iframe`);
                            return Array.from(iframeItems);
                }
                        
                        // Try to find a transcript container in the iframe
                        const iframeContainers = iframeDoc.querySelectorAll('[class*="transcript" i], [role="list"]');
                        if (iframeContainers && iframeContainers.length > 0) {
                            for (const container of iframeContainers) {
                                const items = container.querySelectorAll('li, [role="listitem"], div');
                                if (items && items.length > 10) {
                                    console.log(`Found ${items.length} potential transcript items in iframe container`);
                                    return Array.from(items);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('Error accessing iframe content:', e);
                    }
                }
            } catch (iframeError) {
                console.warn('Error accessing iframe:', iframeError);
            }
        }
        
        // Log more page details for debugging
        console.log('HTML structure analysis for debugging:');
        console.log('Body content preview:', document.body.textContent.substring(0, 200));
        console.log('All list elements:', document.querySelectorAll('ul, ol').length);
        console.log('All div elements with >10 children:', 
            Array.from(document.querySelectorAll('div')).filter(d => d.children.length > 10).length);
        console.log('=== END TRANSCRIPT ITEMS SEARCH DEBUGGING ===');
        
        throw new Error('No transcript items found on page. This recording may not have a transcript available.');
    }
    
    // This function is for direct transcript item finding in the page
    function findTranscriptItemsInPage() {
        try {
            console.log('Searching for transcript items in page directly');
            
            // Define common selector patterns for transcript items
            const selectors = [
                '.transcript-list-item', 
                '[aria-label*="transcript" i]',
                '[class*="transcript-list-item"]',
                '[role="listitem"]',
                '.transcript_sentence',
                'li.item',
                '[class*="transcript-item"]',
                '[data-kind="caption"]'
            ];
            
            for (const selector of selectors) {
                const items = document.querySelectorAll(selector);
                if (items && items.length > 0) {
                    console.log(`Found ${items.length} transcript items using direct selector: ${selector}`);
                    return Array.from(items);
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error in findTranscriptItemsInPage:', error);
            return null;
        }
    }
    
    // Function to extract transcript with retry
    async function extractTranscriptWithRetry(maxAttempts = 5) {
        console.log(`Starting transcript extraction with max ${maxAttempts} attempts`);
        
        // Log the HTML content of the page for debugging
        console.log('=== BEGIN PAGE HTML LOGGING ===');
        console.log('Page URL:', window.location.href);
        console.log('Page Title:', document.title);
        console.log('Document Ready State:', document.readyState);
        
        // Log key page structure details
        const pageStructure = {
            bodyChildren: document.body.children.length,
            hasVideo: !!document.querySelector('video'),
            hasTranscriptButton: !!document.querySelector('button[aria-label*="transcript" i], [role="button"][aria-label*="transcript" i]'),
            hasPasswordField: !!document.querySelector('input[type="password"]'),
            visibleButtons: Array.from(document.querySelectorAll('button:not([style*="display: none"])')).length
        };
        console.log('Page Structure:', pageStructure);
        
        // Log all main elements in the document to help diagnose structure
        console.log('Document structure:');
        Array.from(document.body.children).forEach(el => {
                console.log(`- ${el.tagName}${el.id ? '#'+el.id : ''}.${el.className}`, 
                          `(children: ${el.children.length})`);
        });
        
        // Wait a moment to ensure page is loaded
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        let lastError = null;
        let attempt = 0;
        
        while (attempt < maxAttempts) {
            attempt++;
            console.log(`Extraction attempt ${attempt}/${maxAttempts}`);
            
            try {
                // Wait between attempts (longer wait for later attempts)
                if (attempt > 1) {
                    const waitTime = 1000 * attempt;
                    console.log(`Waiting ${waitTime}ms before attempt ${attempt}...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                
                // First look for transcript items
                console.log('Searching for transcript items...');
                const items = await findTranscriptItems();
                
                if (!items || items.length === 0) {
                    throw new Error('No transcript items found');
                }
                
                console.log(`Found ${items.length} potential transcript items`);
                
                // Process the items into a clean transcript
                console.log('Processing transcript items...');
                const transcript_data = cleanAndFormatTranscript(items);
                
                if (!transcript_data || transcript_data.length === 0) {
                    throw new Error('Found items but could not extract valid transcript data');
                }
                
                console.log(`Successfully processed ${transcript_data.length} transcript segments`);
                
                // Format the transcript text for readability
                const formatted_text = formatTranscriptForReading(transcript_data);
                
                return {
                    success: true,
                    transcript_data,
                    segment_count: transcript_data.length,
                    formatted_text,
                    attempt
                };
            } catch (error) {
                console.error(`Attempt ${attempt} failed:`, error);
                lastError = error;
            }
        }
        
        // If we got here, all attempts failed
        console.error(`All ${maxAttempts} extraction attempts failed`);
        throw lastError || new Error('Failed to extract transcript after multiple attempts');
    }
    
    // Format transcript for readability
    function formatTranscriptForReading(transcriptData) {
        if (!transcriptData || transcriptData.length === 0) {
            return "No transcript data available.";
        }
    
        let formatted = "";
        let currentMinute = -1;
        
        for (const entry of transcriptData) {
            const minute = Math.floor(entry.timestamp_seconds / 60);
            
            if (minute !== currentMinute) {
                currentMinute = minute;
                formatted += `\n\n[Minute ${minute}]\n\n`;
            }
            
            formatted += `[${entry.timestamp}] ${entry.text}\n`;
        }
        
        return formatted.trim();
    }
    
    // Clean and format transcript data
    function cleanAndFormatTranscript(items) {
        console.log(`Cleaning and formatting ${items.length} transcript items`);
        
        try {
            const transcriptData = [];
            
            for (const item of items) {
                try {
                    // Get text content and aria label for timestamp
                    const ariaLabel = item.getAttribute('aria-label') || '';
                    const itemText = item.textContent.trim();
                    
                    if (!itemText || itemText.length < 3) {
                        continue; // Skip empty or very short items
                    }
                    
                    // Skip UI elements
                    if (itemText.toLowerCase().includes('transcript')
                        || itemText.toLowerCase().includes('loading')
                        || itemText.toLowerCase().includes('starting')
                        || itemText.toLowerCase().includes('view all')
                        || itemText.toLowerCase().includes('menu')) {
                        continue;
                    }
                    
                    // Extract timestamp from aria-label
                    let timestamp_seconds = 0;
                    
                    if (ariaLabel) {
                        // Try different timestamp formats
                        let timeMatch = ariaLabel.match(/(\d+):(\d+):(\d+)/); // HH:MM:SS
                        if (timeMatch) {
                            const hours = parseInt(timeMatch[1], 10);
                            const minutes = parseInt(timeMatch[2], 10);
                            const seconds = parseInt(timeMatch[3], 10);
                            timestamp_seconds = (hours * 3600) + (minutes * 60) + seconds;
                        } else {
                            timeMatch = ariaLabel.match(/(\d+):(\d+)/); // MM:SS
                        if (timeMatch) {
                            const minutes = parseInt(timeMatch[1], 10);
                            const seconds = parseInt(timeMatch[2], 10);
                            timestamp_seconds = (minutes * 60) + seconds;
                        } else {
                                // Try to extract time mentions like "X hour, Y minute, Z second"
                                const hourMatch = ariaLabel.match(/(\d+)\s*hour/);
                                const minuteMatch = ariaLabel.match(/(\d+)\s*minute/);
                                const secondMatch = ariaLabel.match(/(\d+)\s*second/);
                                
                                if (hourMatch || minuteMatch || secondMatch) {
                                    const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
                                    const minutes = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;
                                    const seconds = secondMatch ? parseInt(secondMatch[1], 10) : 0;
                                    timestamp_seconds = (hours * 3600) + (minutes * 60) + seconds;
                                }
                            }
                        }
                    }
                    
                    // If we couldn't get timestamp from aria-label, try from the text content
                    if (timestamp_seconds === 0) {
                            // Try to extract time from text content if it contains timestamps
                        let textTimeMatch = itemText.match(/^(\d+):(\d+):(\d+)/); // HH:MM:SS
                        if (textTimeMatch) {
                            const hours = parseInt(textTimeMatch[1], 10);
                            const minutes = parseInt(textTimeMatch[2], 10);
                            const seconds = parseInt(textTimeMatch[3], 10);
                            timestamp_seconds = (hours * 3600) + (minutes * 60) + seconds;
                        } else {
                            textTimeMatch = itemText.match(/^(\d+):(\d+)/); // MM:SS
                            if (textTimeMatch) {
                                const minutes = parseInt(textTimeMatch[1], 10);
                                const seconds = parseInt(textTimeMatch[2], 10);
                                timestamp_seconds = (minutes * 60) + seconds;
                            }
                        }
                    }
                    
                    // Format the timestamp
                    const minutes = Math.floor(timestamp_seconds / 60);
                    const seconds = timestamp_seconds % 60;
                    const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    
                    // Clean up text
                    let text = itemText;
                    
                    // If the text contains a timestamp prefix, remove it
                    const timestampRegex = /^\d+:\d+(?::\d+)?\s*/;
                    text = text.replace(timestampRegex, '');
                    
                    // Remove speaker indicators like "Speaker 1: "
                    text = text.replace(/^(?:Speaker\s+\d+|[A-Z][a-z]+):\s+/, '');
                    
                    // Remove extra whitespace
                    text = text.replace(/\s+/g, ' ').trim();
                    
                    // Only add if we have meaningful text
                    if (text && text.length > 2) {
                        transcriptData.push({
                            timestamp_seconds,
                            timestamp,
                            text
                        });
                        
                        // For debugging
                        if (transcriptData.length <= 3) {
                            console.log('Sample transcript item:', {
                                ariaLabel,
                                originalText: itemText,
                                parsedText: text,
                                timestamp_seconds,
                                timestamp
                            });
                        }
                    }
                } catch (itemError) {
                    console.warn('Error processing transcript item:', itemError);
                    continue;
                }
            }
            
            // Sort by timestamp
            transcriptData.sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
            
            // Fill in missing timestamps if needed
            let lastTimeStamp = 0;
            for (let i = 0; i < transcriptData.length; i++) {
                if (transcriptData[i].timestamp_seconds === 0) {
                    // Fill in timestamp based on item position
                    transcriptData[i].timestamp_seconds = lastTimeStamp + 1;
                    
                    // Update formatted timestamp
                    const minutes = Math.floor(transcriptData[i].timestamp_seconds / 60);
                    const seconds = transcriptData[i].timestamp_seconds % 60;
                    transcriptData[i].timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
                
                lastTimeStamp = transcriptData[i].timestamp_seconds;
            }
            
            console.log(`Processed ${transcriptData.length} valid transcript segments`);
            return transcriptData;
        } catch (error) {
            console.error('Error in cleanAndFormatTranscript:', error);
            throw new Error('Failed to process transcript data: ' + error.message);
        }
    }
} 