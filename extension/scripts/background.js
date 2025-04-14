// Background script for FaciliGator

console.log('FaciliGator background script loaded');

// Store data and ongoing status
let data = {};
let ongoing = {};

// Track scraping status
let isScrapingAssignments = false;
let isScrapingRecordings = false;

// At the top of the file, add a global cancellation flag
let scrapingCancelled = false;
let transcriptExtractionInProgress = false;

// Track extraction requests
let transcriptExtractionRequests = {};
let transcriptExtractionCallbacks = {};

// Control popup visibility
function updatePopupVisibility(forceShow = false) {
    if (isScrapingAssignments || isScrapingRecordings || forceShow) {
        // Make sure popup is visible when scraping is active
        chrome.action.setPopup({ popup: "" });
    } else {
        // Set normal popup behavior (only shows when clicked)
        chrome.action.setPopup({ popup: "popup/auth.html" });
    }
}

// Initialize extension configuration
function initializeExtension() {
    console.log('Initializing extension configuration');
    
    // Default setting: popup only shows when clicked (NEVER shows automatically)
    chrome.action.setPopup({ popup: "popup/auth.html" });
    
    // Check if there's an ongoing scraping operation from storage
    chrome.storage.local.get(['scrapingState'], function(result) {
        if (result.scrapingState && result.scrapingState.isActive) {
            console.log('Restoring active scraping state:', result.scrapingState);
            if (result.scrapingState.type === 'assignments') {
                isScrapingAssignments = true;
            } else if (result.scrapingState.type === 'recordings') {
                isScrapingRecordings = true;
            }
            updatePopupVisibility();
        }
    });
}

// Run initialization on startup
initializeExtension();

// Add a cleanup utility for transcript extraction requests
function cleanupTranscriptRequests() {
    console.log('Running transcript extraction request cleanup');
    
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours ago
    const twoHoursAgo = now - (2 * 60 * 60 * 1000); // 2 hours ago
    
    // Clean up memory object
    Object.keys(transcriptExtractionRequests).forEach(key => {
        const request = transcriptExtractionRequests[key];
        
        // Remove completed requests older than 2 hours or any requests older than a day
        if ((request.status === 'completed' && request.timestamp < twoHoursAgo) || 
            request.timestamp < oneDayAgo) {
            console.log(`Cleaning up transcript request: ${key}`);
            delete transcriptExtractionRequests[key];
            delete transcriptExtractionCallbacks[key];
        }
    });
    
    // Clean up storage
    chrome.storage.local.get(null, (items) => {
        const keysToRemove = [];
        
        Object.keys(items).forEach(key => {
            // Find transcript extraction related keys
            if (key.startsWith('transcript_extraction_') || 
                key.startsWith('transcript_result_')) {
                
                const item = items[key];
                
                // Remove old extraction records
                if (item.timestamp && item.timestamp < oneDayAgo) {
                    keysToRemove.push(key);
                }
                // Remove completed extractions older than 2 hours
                else if (item.status === 'completed' && 
                         item.endTime && 
                         item.endTime < twoHoursAgo) {
                    keysToRemove.push(key);
                }
            }
        });
        
        if (keysToRemove.length > 0) {
            console.log(`Removing ${keysToRemove.length} old transcript records from storage`);
            chrome.storage.local.remove(keysToRemove);
        }
    });
}

// Handle transcript extraction
function extractZoomTranscript(url, extractionId, callback) {
    console.log(`Background script received request to extract transcript from URL: ${url}`);
    
    // Immediately respond to prevent message port from closing
    if (callback && typeof callback === 'function') {
        callback({
            status: 'processing', 
            message: 'Transcript extraction has started in a background tab'
        });
    }
    
    // Store request information in local storage for reliability
    chrome.storage.local.set({
        [`transcript_extraction_${extractionId}`]: {
            url: url,
            status: 'pending',
            timestamp: Date.now()
        }
    });
    
    // Store request in memory
    transcriptExtractionRequests[extractionId] = {
        url: url,
        status: 'pending',
        timestamp: Date.now()
    };
    
    // Add auto-extraction parameters to the URL
    const urlObj = new URL(url);
    urlObj.searchParams.append('autoExtract', 'true');
    urlObj.searchParams.append('extractionId', extractionId);
    const enhancedUrl = urlObj.toString();
    
    console.log(`Creating tab for transcript extraction with URL: ${enhancedUrl}`);
    
    // Create a new tab for transcript extraction
    chrome.tabs.create({ 
        url: enhancedUrl, 
        active: false 
    }, (newTab) => {
        console.log(`Created tab ${newTab.id} for transcript extraction with auto-extract URL: ${enhancedUrl}`);
        
        // Update the request status
        transcriptExtractionRequests[extractionId] = {
            ...transcriptExtractionRequests[extractionId],
            tabId: newTab.id,
            enhancedUrl: enhancedUrl,
            status: 'tab_created'
        };
        
        // Update storage status
        chrome.storage.local.set({
            [`transcript_extraction_${extractionId}`]: {
                url: url,
                enhancedUrl: enhancedUrl,
                status: 'tab_created',
                tabId: newTab.id,
                timestamp: Date.now()
            }
        });
        
        // Forward the result to the original requester when complete
        const resultForwarder = (message) => {
            if (message.action === 'transcriptExtractionComplete' && 
                message.extractionId === extractionId) {
                
                console.log(`Received transcript extraction completion for ID: ${extractionId}`);
                
                // Store the result
                const result = message.result;
                chrome.storage.local.set({
                    [`transcript_result_${extractionId}`]: {
                        url: url,
                        result: result,
                        timestamp: Date.now(),
                        endTime: Date.now()
                    },
                    [`transcript_extraction_${extractionId}`]: {
                        status: 'completed',
                        endTime: Date.now()
                    }
                });
                
                // Forward result to original requester
                chrome.runtime.sendMessage({
                    action: 'transcriptExtractionResult',
                    extractionId: extractionId,
                    url: url,
                    success: result.success,
                    error: result.error,
                    errorDetails: result.errorDetails,
                    transcript_data: result.transcript_data,
                    segment_count: result.segment_count,
                    formatted_text: result.formatted_text,
                    recoverable: result.recoverable
                });
                
                // Update extraction status
                transcriptExtractionRequests[extractionId].status = 'completed';
                transcriptExtractionRequests[extractionId].result = result;
                
                // Remove our listener
                chrome.runtime.onMessage.removeListener(resultForwarder);
                
                // Try to close the tab if it still exists
                try {
                    chrome.tabs.remove(newTab.id);
                } catch (e) {
                    console.warn(`Failed to close tab ${newTab.id}, it may already be closed`, e);
                }
            }
        };
        
        // Add listener for completion message
        chrome.runtime.onMessage.addListener(resultForwarder);
        
        // Set a timeout to close the tab if it takes too long
        setTimeout(() => {
            try {
                // Check if the tab still exists
                chrome.tabs.get(newTab.id, (tab) => {
                    if (chrome.runtime.lastError) {
                        console.log(`Tab ${newTab.id} no longer exists`);
                        return;
                    }
                    
                    console.log(`Closing transcript extraction tab ${newTab.id} after timeout`);
                    chrome.tabs.remove(newTab.id);
                    
                    // Send a timeout message if we haven't already received a completion message
                    if (transcriptExtractionRequests[extractionId]?.status !== 'completed') {
                        // Update storage status
                        chrome.storage.local.set({
                            [`transcript_extraction_${extractionId}`]: {
                                url: url,
                                status: 'tab_timeout',
                                timestamp: Date.now()
                            }
                        });
                        
                        // Send timeout message to requester
                        chrome.runtime.sendMessage({
                            action: 'transcriptExtractionResult',
                            extractionId: extractionId,
                            url: url,
                            success: false,
                            error: 'Transcript extraction timed out after 3 minutes. The process might still be running in the background.',
                            recoverable: true
                        });
                    }
                    
                    // Remove the listener
                    chrome.runtime.onMessage.removeListener(resultForwarder);
                });
            } catch (error) {
                console.error('Error checking/closing timed out tab:', error);
            }
        }, 180000); // 3 minute timeout for tab
    });
}

// Run cleanup every hour
setInterval(cleanupTranscriptRequests, 60 * 60 * 1000);

// At the top of the file, add authentication check
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background script received message:', message);

    // Handle messages from content scripts
    if (message.action === 'transcriptExtractionComplete') {
        console.log('Received transcript extraction result for', message.extractionId);
        
        // Store result in memory
        if (transcriptExtractionRequests[message.extractionId]) {
            transcriptExtractionRequests[message.extractionId].status = 'completed';
            transcriptExtractionRequests[message.extractionId].result = message.result;
        }
        
        // Store result in local storage
        chrome.storage.local.set({
            [`transcript_result_${message.extractionId}`]: {
                url: message.url,
                result: message.result,
                timestamp: Date.now(),
                endTime: Date.now()
            },
            [`transcript_extraction_${message.extractionId}`]: {
                status: 'completed',
                endTime: Date.now()
            }
        });
        
        // If we have a callback for this extraction, call it
        if (transcriptExtractionCallbacks[message.extractionId]) {
            try {
                transcriptExtractionCallbacks[message.extractionId](message.result);
                delete transcriptExtractionCallbacks[message.extractionId];
            } catch (e) {
                console.error('Error calling transcript extraction callback:', e);
            }
        }
    } 
    // Handle scraping status updates
    else if (message.action === 'startScraping') {
        if (message.type === 'assignments') {
            isScrapingAssignments = true;
        } else if (message.type === 'recordings') {
            isScrapingRecordings = true;
        }
        updatePopupVisibility();
        sendResponse({ status: 'ok' });
    }
    else if (message.action === 'stopScraping') {
        if (message.type === 'assignments') {
            isScrapingAssignments = false;
        } else if (message.type === 'recordings') {
            isScrapingRecordings = false;
        }
        updatePopupVisibility();
        sendResponse({ status: 'ok' });
    }
    else if (message.action === 'forcePinPopup') {
        updatePopupVisibility(true);
        sendResponse({ status: 'ok' });
    }
    else if (message.action === 'resetPopupVisibility') {
        updatePopupVisibility(false);
        sendResponse({ status: 'ok' });
    }
    else if (message.action === 'extractZoomTranscript') {
        console.log('Background script received extractZoomTranscript request');
        extractZoomTranscript(message.url, message.extractionId, sendResponse);
        return true; // Keep message channel open
    }
    
    if (message.action === 'checkAuth') {
        chrome.storage.local.get(['facilitator_auth_token'], function(result) {
            sendResponse({ isAuthenticated: !!result.facilitator_auth_token });
        });
        return true; // Required for async response
    }

    // Handle content script injection request
    if (message.action === 'injectRecordingScraper') {
        const tabId = message.tabId;
        if (!tabId) {
            sendResponse({ success: false, error: 'No tab ID provided' });
            return false;
        }
        
        // Use our existing function to inject the recording scraper
        injectRecordingScraper(tabId)
            .then(() => {
                console.log('Successfully injected recording scraper via message request');
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error('Failed to inject recording scraper via message request:', error);
                sendResponse({ success: false, error: error.message });
            });
            
        return true; // Keep the message channel open for async response
    }

    // Process Zoom transcript
    if (message.action === 'processZoomTranscript') {
        return processZoomTranscript(message.url, sendResponse);
    }

    // Handle Zoom transcript processing for multiple recordings
    if (message.action === 'processZoomTranscripts') {
        console.log('Processing Zoom transcripts request:', message.recordings?.length);
        
        // Store the recordings temporarily
        chrome.storage.local.set({
            'zoom_recordings_processing': message.recordings,
            'zoom_processing_status': 'pending'
        }, function() {
            sendResponse({status: 'queued', count: message.recordings?.length || 0});
        });
        
        return true; // Keep the message channel open
    }

    // Add our new message handler
    if (message.action === 'processZoomTranscript') {
        return processZoomTranscript(message.url, sendResponse);
    }

    // ... existing message handlers ...
});

// Helper function to inject content script
async function injectContentScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['scripts/content_canvas.js']
        });
        console.log('Content script injected successfully');
        return true;
    } catch (error) {
        console.error('Failed to inject content script:', error);
        return false;
    }
}

// Helper function to check if content script is loaded
async function isContentScriptLoaded(tabId) {
    try {
        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        return true;
    } catch (error) {
        return false;
    }
}

// Helper function to execute content scraping in a tab
async function scrapeContentFromTab(tabId) {
    console.log('Executing content script in tab:', tabId);
    
    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            function: () => {
                // Get assignment description and full HTML
                let description = '';
                const fullHtml = document.documentElement.outerHTML;
                
                // Try multiple selectors for assignment content in order of preference
                const detailsContainer = document.querySelector('.a2-toggle-details-container');
                if (detailsContainer) {
                    description = detailsContainer.textContent.trim();
                    console.log('Found description in a2-toggle-details-container');
                } else {
                    // Fallback to other selectors if the new one isn't found
                    const contentSelectors = [
                        '#assignment_show .description.user_content',
                        '#assignment_show .description',
                        '.description.user_content',
                        '.description'
                    ];

                    for (const selector of contentSelectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            description = element.textContent.trim();
                            console.log('Found description using fallback selector:', selector);
                            break;
                        }
                    }
                }

                // Try all possible rubric selectors
                let rubric = [];
                const rubricSelectors = [
                    // React-based rubric selectors
                    '[data-testid="rubric-criterion"]',
                    // New Canvas UI selectors
                    '[data-testid="rubric-tab"]',
                    '.rubric',
                    // Classic Canvas UI selectors
                    '#rubrics .rubric_container',
                    '.rubric_container'
                ];

                for (const selector of rubricSelectors) {
                    const rubricElements = document.querySelectorAll(selector);
                    if (rubricElements.length > 0) {
                        console.log('Found rubric using selector:', selector);
                        
                        // For React-based rubrics
                        if (selector === '[data-testid="rubric-criterion"]') {
                            rubric = Array.from(rubricElements).map(row => {
                                const criterionElement = row.querySelector('.description .css-1ugbsk7-text');
                                const pointsElement = row.querySelector('[data-testid="criterion-points"] .graded-points');
                                const ratingsContainer = row.querySelector('.css-10d73cs-view--flex-flex');
                                
                                let criterion = '';
                                let points = '0';
                                let ratings = [];

                                if (criterionElement) {
                                    criterion = criterionElement.textContent.trim();
                                }

                                if (pointsElement) {
                                    const pointsMatch = pointsElement.textContent.match(/\/\s*(\d+(?:\.\d+)?)/);
                                    points = pointsMatch ? pointsMatch[1] : '0';
                                }

                                // Get all rating tiers
                                if (ratingsContainer) {
                                    const ratingTiers = ratingsContainer.querySelectorAll('.rating-tier');
                                    ratings = Array.from(ratingTiers).map(tier => {
                                        const pointsText = tier.querySelector('[data-testid="rating-points"]')?.textContent.trim() || '';
                                        const description = tier.querySelector('.rating-description')?.textContent.trim() || '';
                                        const details = tier.querySelector('.css-17r2l9k-text')?.textContent.trim() || '';
                                        
                                        return {
                                            points: pointsText,
                                            title: description,
                                            description: details
                                        };
                                    });
                                }

                                return {
                                    criterion,
                                    points,
                                    ratings
                                };
                            });

                            if (rubric.length > 0) {
                                break;
                            }
                        } else {
                            // Fallback to old rubric format
                            // Try different criteria selectors
                            const criteriaSelectors = [
                                // New Canvas UI
                                '[data-testid="rubric-criteria"]',
                                '.rubric-criteria',
                                // Classic Canvas UI
                                '.criterion',
                                '.rubric_criterion'
                            ];

                            for (const criteriaSelector of criteriaSelectors) {
                                const criteria = rubricElements.querySelectorAll(criteriaSelector);
                                if (criteria.length > 0) {
                                    console.log('Found criteria using selector:', criteriaSelector);
                                    rubric = Array.from(criteria).map(row => {
                                        // Try different description selectors
                                        const descriptionSelectors = [
                                            '[data-testid="criterion-description"]',
                                            '.description_title',
                                            '.criterion_description',
                                            '.description',
                                            '.rating-description'
                                        ];
                                        
                                        // Try different points selectors
                                        const pointsSelectors = [
                                            '[data-testid="criterion-points"]',
                                            '.points',
                                            '.criterion_points',
                                            '.points_possible'
                                        ];

                                        let criterion = '';
                                        let points = '0';

                                        for (const descSelector of descriptionSelectors) {
                                            const descElement = row.querySelector(descSelector);
                                            if (descElement) {
                                                criterion = descElement.textContent.trim();
                                                break;
                                            }
                                        }

                                        for (const pointsSelector of pointsSelectors) {
                                            const pointsElement = row.querySelector(pointsSelector);
                                            if (pointsElement) {
                                                const pointsText = pointsElement.textContent.trim();
                                                const match = pointsText.match(/(\d+(?:\.\d+)?)/);
                                                points = match ? match[1] : '0';
                                                break;
                                            }
                                        }

                                        return { criterion, points };
                                    }).filter(item => item.criterion);

                                    if (rubric.length > 0) {
                                        break;
                                    }
                                }
                            }

                            if (rubric.length > 0) {
                                break;
                            }
                        }
                    }
                }

                console.log('Content scraped:', {
                    descriptionLength: description.length,
                    rubricItems: rubric.length,
                    hasHtml: !!fullHtml
                });

                return {
                    description,
                    rubric: rubric.length > 0 ? rubric : null,
                    fullHtml
                };
            }
        });

        console.log('Content script execution result:', result);
        return result.result;
    } catch (error) {
        console.error('Error executing content script:', error);
        throw error;
    }
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background script received message:', request);

    // Handle Zoom transcript processing
    if (request.action === 'processZoomTranscripts') {
        console.log('Processing Zoom transcripts request:', request.recordings?.length);
        
        // Store the recordings temporarily
        chrome.storage.local.set({
            'zoom_recordings_processing': request.recordings,
            'zoom_processing_status': 'pending'
        }, function() {
            sendResponse({status: 'queued', count: request.recordings?.length || 0});
        });
        
        return true; // Keep the message channel open
    }
    
    // Check Zoom processing status
    if (request.action === 'checkZoomProcessingStatus') {
        chrome.storage.local.get(['zoom_processing_status', 'zoom_processing_results'], function(result) {
            sendResponse({
                status: result.zoom_processing_status || 'unknown',
                results: result.zoom_processing_results || []
            });
        });
        
        return true; // Keep the message channel open
    }

    if (request.action === "scrapeAssignmentContent") {
        console.log('Processing scrapeAssignmentContent request:', request.url);
        
        // Keep track of the original tab
        chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
            const originalTabId = tabs[0].id;
            
            try {
                // Create a new tab to load the assignment
                const newTab = await chrome.tabs.create({ 
                    url: request.url, 
                    active: false 
                });
                
                // Wait for the tab to load
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === newTab.id && info.status === 'complete') {
                        // Remove the listener once we're done
                        chrome.tabs.onUpdated.removeListener(listener);
                        
                        // Extract content from the page
                        setTimeout(async () => {
                            try {
                                const content = await scrapeContentFromTab(newTab.id);
                                
                                // Close the tab after scraping
                                chrome.tabs.remove(newTab.id);
                                
                                // Send the content back to the original tab
                                sendResponse({
                                    content: content
                                });
                            } catch (error) {
                                console.error('Error during content scraping:', error);
                                // Close the tab on error
                                chrome.tabs.remove(newTab.id);
                                
                                // Send error response
                                sendResponse({
                                    error: 'Failed to scrape content: ' + (error.message || 'Unknown error')
                                });
                            }
                        }, 1000); // Wait a bit for dynamic content to load
                    }
                });
                
                return true; // Keep the message channel open
                
            } catch (error) {
                console.error('Error creating tab for content scraping:', error);
                sendResponse({
                    error: 'Failed to create tab for content scraping: ' + (error.message || 'Unknown error')
                });
                return false; // No need to keep the channel open
            }
        });
        
        return true; // Keep the message channel open for async response
    }

    if (request.receiver === "background") {
        if (request.sender === "popup") {
            // Request to start scraping the webpage
            if (request.destination.startsWith('content')) {
                console.log("Initiating content scraping");
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: request.action,
                        data: request
                    }).then(() => {
                        ongoing[tabs[0].id] = 1;
                        chrome.runtime.sendMessage({
                            status: "scraping_start_success",
                            receiver: "popup"
                        });
                    }).catch(error => {
                        console.error('Error sending message to content script:', error);
                        chrome.runtime.sendMessage({
                            status: "scraping_start_fail",
                            receiver: "popup"
                        });
                    });
                });
                return false; // We don't need to keep the message channel open
            } else {
                // Checking scraping status
                if (request.action === "reload") {
                    if (String(request.tab.id) in data) {
                        delete data[request.tab.id];
                    }
                    sendResponse({received_by: "background_cleaner"});
                }
                if (String(request.tab.id) in data) {
                    console.log("Scraping complete. Sending results.");
                    chrome.runtime.sendMessage({
                        status: "scraping_done",
                        receiver: "popup",
                        data: data
                    });
                } else if (ongoing[request.tab.id] === 1) {
                    console.log("Scraping in progress.");
                    chrome.runtime.sendMessage({
                        status: "scraping_ongoing",
                        receiver: "popup",
                        data: data
                    });
                } else {
                    console.log("No scraping activity detected.");
                    chrome.runtime.sendMessage({
                        status: "unknown",
                        receiver: "popup"
                    });
                }
            }
        } else if (request.destination === "popup") {
            // Content script has finished scraping
            console.log("Content script finished scraping");
            data[sender.tab.id] = {
                tab: sender.tab.id,
                type: request.type,
                assignments: request.assignments || []
            };
            
            ongoing[sender.tab.id] = 0;
            chrome.runtime.sendMessage({
                status: "scraping_done",
                receiver: "popup",
                data: data[sender.tab.id]
            });
            return false;
        }
    }

    if (request.action === 'cancelScraping') {
        scrapingCancelled = true;
        console.log('Scraping task cancelled via reset button');
        // Send cancellation message to content script if available
        if (sender.tab && sender.tab.id) {
            chrome.tabs.sendMessage(sender.tab.id, { action: 'cancelScraping' });
        } else {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'cancelScraping' });
                }
            });
        }
        sendResponse({ status: 'cancelled' });
        return false;
    }

    if (request.action === "scrapeAssignments") {
        console.log('Processing scrapeAssignments request');
        
        // Reset cancellation flag before starting
        scrapingCancelled = false;

        chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
            const activeTab = tabs[0];
            
            // Verify we're on a Canvas page first
            if (!activeTab.url.includes('instructure.com')) {
                sendResponse({ 
                    status: 'error', 
                    error: 'Please navigate to a Canvas page first'
                });
                return;
            }

            // Verify we're on an assignments page
            if (!activeTab.url.includes('/assignments')) {
                sendResponse({ 
                    status: 'error', 
                    error: 'Please navigate to the Assignments page in Canvas'
                });
                return;
            }

            try {
                // Check if content script is loaded, if not, inject it
                const isLoaded = await isContentScriptLoaded(activeTab.id);
                if (!isLoaded) {
                    console.log('Content script not loaded, injecting...');
                    const injected = await injectContentScript(activeTab.id);
                    if (!injected) {
                        sendResponse({
                            status: 'error',
                            error: 'Failed to inject content script. Please refresh the page and try again.'
                        });
                        return;
                    }
                    // Wait a bit for the script to initialize
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Before sending message to content script, check if cancellation was requested
                if (scrapingCancelled) {
                    sendResponse({ status: 'cancelled', error: 'Scraping was cancelled.' });
                    return;
                }

                // Send message to content script
                chrome.tabs.sendMessage(activeTab.id, { action: "getAssignments" }, response => {
                    if (chrome.runtime.lastError) {
                        console.error('Content script communication error:', chrome.runtime.lastError);
                        sendResponse({ 
                            status: 'error', 
                            error: 'Could not communicate with content script. Please refresh the page and try again.'
                        });
                        return;
                    }
                    
                    if (!response) {
                        sendResponse({
                            status: 'error',
                            error: 'No response from content script. Please refresh the page and try again.'
                        });
                        return;
                    }
                    
                    // Process the response
                    if (response.status === 'error') {
                        sendResponse({
                            status: 'error',
                            error: response.error || 'Unknown error occurred'
                        });
                    } else {
                        sendResponse({
                            status: 'success',
                            assignments: response.assignments || []
                        });
                    }
                });
                
            } catch (error) {
                console.error('Error in scrapeAssignments:', error);
                sendResponse({
                    status: 'error',
                    error: error.message || 'An unexpected error occurred'
                });
            }
        });
        
        return true; // Important: Keep the message channel open for async response
    }

    return false; // Default response for messages we don't handle
});

// Add function to more carefully inject the recording scraper
function injectRecordingScraper(tabId) {
    return new Promise((resolve, reject) => {
        // First check if the script is already loaded
        chrome.tabs.sendMessage(tabId, {action: 'ping'}, function(response) {
            // If we get a response, the script is already loaded
            if (response && !chrome.runtime.lastError) {
                console.log('Recording scraper already loaded in tab', tabId);
                resolve(true);
                return;
            }
            
            // If it's not loaded, inject it
            console.log('Injecting recording scraper into tab', tabId);
            chrome.scripting.executeScript({
                target: {tabId: tabId},
                files: ['scripts/recording-scraper.js']
            }).then(() => {
                console.log('Recording scraper script injected successfully');
                
                // Short delay to let the script initialize
                setTimeout(() => {
                    // Verify it loaded correctly
                    chrome.tabs.sendMessage(tabId, {action: 'ping'}, function(pingResponse) {
                        if (pingResponse && !chrome.runtime.lastError) {
                            console.log('Recording scraper confirmed loaded');
                            resolve(true);
                        } else {
                            console.error('Recording scraper failed to initialize after injection');
                            reject(new Error('Failed to initialize recording scraper'));
                        }
                    });
                }, 500);
            }).catch(err => {
                console.error('Failed to inject recording scraper script:', err);
                reject(err);
            });
        });
    });
}

// Add a debug log function that helps track script execution
function debugLog(context, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        context,
        message
    };
    
    if (data) {
        logEntry.data = data;
    }
    
    console.log(`[${timestamp}] [${context}] ${message}`, data || '');
    
    // Optionally store logs for debugging
    chrome.storage.local.get(['debug_logs'], function(result) {
        const logs = result.debug_logs || [];
        logs.push(logEntry);
        
        // Keep only the last 100 logs to avoid storage bloat
        if (logs.length > 100) {
            logs.splice(0, logs.length - 100);
        }
        
        chrome.storage.local.set({debug_logs: logs});
    });
}

// Modify the webNavigation listener to use the improved injection
chrome.webNavigation.onCompleted.addListener(
    function(details) {
        // Ensure this is a top-level frame
        if (details.frameId === 0) {
            // Check if it's a Canvas inbox page with a course filter
            chrome.tabs.get(details.tabId, function(tab) {
                if (chrome.runtime.lastError) {
                    debugLog('navigation', 'Error getting tab info', chrome.runtime.lastError);
                    return;
                }
                
                if (tab && tab.url && tab.url.includes('/conversations') && tab.url.includes('filter=course_')) {
                    debugLog('navigation', 'Canvas inbox with course filter detected', {url: tab.url, tabId: tab.id});
                    
                    // Use our improved injection function
                    injectRecordingScraper(tab.id)
                        .then(() => {
                            debugLog('navigation', 'Recording scraper successfully injected');
                        })
                        .catch(err => {
                            debugLog('navigation', 'Failed to inject recording scraper', err);
                        });
                }
            });
        }
    },
    {url: [{urlContains: 'conversations'}]}
);

// Add this function to ensure the extension stays visible during tab switching
function keepExtensionActive() {
    console.log('Setting up extension to remain active during tab switching');
    
    // Listen for tab changes and ensure the extension popup stays visible
    chrome.tabs.onActivated.addListener(function(activeInfo) {
        // Check if we're in the middle of a scraping process
        chrome.storage.local.get(['is_scraping_active'], function(result) {
            if (result.is_scraping_active) {
                console.log('Scraping is active, keeping extension visible on tab switch');
                
                // Keep the extension popup open
                chrome.action.openPopup();
            }
        });
    });
    
    // Set up message listener for scraping status updates
    chrome.runtime.onMessage.addListener(function(message) {
        if (message.action === 'scrapingStarted') {
            console.log('Scraping started, marking active status');
            chrome.storage.local.set({ 'is_scraping_active': true });
        } else if (message.action === 'scrapingCompleted' || message.action === 'scrapingCancelled') {
            console.log('Scraping completed or cancelled, clearing active status');
            chrome.storage.local.remove('is_scraping_active');
        }
    });
}

// Call this function when the background script initializes
// keepExtensionActive(); // <-- Comment out this function to prevent unwanted popups

// Add this function for the new approach to transcript extraction
function processZoomTranscript(url, sendResponse) {
    console.log('Background script processing Zoom transcript for URL:', url);
    
    // Create a unique extraction ID
    const extractionId = `extract_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Store the current active tab so we can return to it
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (chrome.runtime.lastError) {
            sendResponse({ 
                success: false, 
                error: 'Failed to get current tab: ' + chrome.runtime.lastError.message 
            });
            return;
        }
        
        const currentTab = tabs[0];
        
        // Check if we're on a Canvas page
        if (!currentTab.url || !currentTab.url.includes('instructure.com')) {
            sendResponse({
                success: false,
                error: 'Please navigate to Canvas first'
            });
            return;
        }
        
        // Store the original tab ID and URL for later restoration
        const originalTabId = currentTab.id;
        const originalTabUrl = currentTab.url;
        
        try {
            // Create a new tab with the Zoom URL
            console.log('Opening Zoom URL in new tab:', url);
            
            // Add retry mechanism for tab creation
            const createTabWithRetry = async (retryCount = 0, maxRetries = 3) => {
                try {
                    const newTab = await chrome.tabs.create({ 
                        url: url,
                        active: true // Make the new tab active
                    });
                    return newTab;
                } catch (error) {
                    if (error.message.includes("Tabs cannot be edited right now") && retryCount < maxRetries) {
                        console.log(`Tab creation failed, retrying (${retryCount + 1}/${maxRetries})...`);
                        // Wait a bit before retrying
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        return createTabWithRetry(retryCount + 1, maxRetries);
                    }
                    throw error;
                }
            };
            
            const newTab = await createTabWithRetry();
            
            // Set a timeout to close the tab if it takes too long
            const tabTimeout = setTimeout(() => {
                try {
                    chrome.tabs.remove(newTab.id);
                    chrome.tabs.update(originalTabId, { active: true }); // Return to Canvas
                    sendResponse({ 
                        success: false, 
                        error: 'Transcript extraction timed out after 45 seconds' 
                    });
                } catch (e) {
                    console.error('Error closing timed-out tab:', e);
                }
            }, 45000); // 45 second timeout (increased from 15 seconds)
            
            // Function to check for transcript content
            const checkForTranscript = () => {
                chrome.tabs.sendMessage(newTab.id, { action: 'getTranscriptStatus' }, (result) => {
                    if (chrome.runtime.lastError) {
                        console.log('Waiting for transcript scraper to initialize...');
                        // Try again after a short delay
                        setTimeout(checkForTranscript, 2000); // Increased delay
                        return;
                    }
                    
                    // We got a result, clear the timeout
                    clearTimeout(tabTimeout);
                    
                    // Try to get transcript data
                    if (result && result.success) {
                        console.log('Successfully extracted transcript with ' + 
                                   (result.transcript_data?.length || 0) + ' segments');
                                   
                        // Store the result for future reference
                        chrome.storage.local.set({
                            [`transcript_result_${extractionId}`]: {
                                url: url,
                                result: result,
                                timestamp: Date.now(),
                                endTime: Date.now()
                            }
                        });
                        
                        // Always return to the original Canvas tab after success
                        setTimeout(() => {
                            try {
                                // Close the Zoom tab
                                chrome.tabs.remove(newTab.id);
                                
                                // Return to original Canvas tab with the original URL
                                chrome.tabs.update(originalTabId, { 
                                    active: true,
                                    url: originalTabUrl // Restore the original URL to maintain state
                                });
                            } catch (e) {
                                console.error('Error closing tab after successful extraction:', e);
                            }
                        }, 500);
                        
                        // Send the successful result back
                        sendResponse({
                            success: true,
                            transcript_data: result.transcript_data,
                            segment_count: result.segment_count || result.transcript_data?.length || 0,
                            formatted_text: result.formatted_text
                        });
                        
                    } else {
                        console.warn('Failed to extract transcript:', result?.error || 'Unknown error');
                        
                        // If result was not successful, try again up to 3 times
                        if (!window.transcriptRetryCount) {
                            window.transcriptRetryCount = 1;
                        } else {
                            window.transcriptRetryCount++;
                        }
                        
                        if (window.transcriptRetryCount <= 3) {
                            console.log(`Retrying transcript extraction (attempt ${window.transcriptRetryCount}/3)...`);
                            
                            // Wait a moment then try to trigger transcript button click again
                            setTimeout(() => {
                                chrome.tabs.sendMessage(newTab.id, { 
                                    action: 'extractTranscript',
                                    extractionId: extractionId 
                                }, () => {
                                    // Set a new timeout for this retry attempt
                                    const retryTimeout = setTimeout(() => {
                                        try {
                                            chrome.tabs.remove(newTab.id);
                                            sendResponse({ 
                                                success: false, 
                                                error: `Transcript extraction retry ${window.transcriptRetryCount} timed out after 30 seconds` 
                                            });
                                        } catch (e) {
                                            console.error('Error closing timed-out tab on retry:', e);
                                        }
                                    }, 30000);
                                    
                                    // Check again after a delay
                                    setTimeout(checkForTranscript, 5000);
                                });
                            }, 2000);
                            return;
                        }
                        
                        // Reset retry count
                        window.transcriptRetryCount = 0;
                        
                        // Ensure we return to Canvas tab even on failure
                        chrome.tabs.update(originalTabId, { 
                            active: true,
                            url: originalTabUrl
                        });
                    }
                });
            };
            
            // Wait for the page to load then start checking for transcript
            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                if (tabId === newTab.id && changeInfo.status === 'complete') {
                    // Remove the listener once we're done
                    chrome.tabs.onUpdated.removeListener(listener);
                    
                    console.log('Zoom page loaded, waiting before checking for transcript...');
                    
                    // Inject content script directly to ensure it's loaded
                    chrome.scripting.executeScript({
                        target: { tabId: newTab.id },
                        files: ['scripts/transcript-scraper.js']
                    }).then(() => {
                        console.log('Transcript scraper script injected successfully');
                        // Start checking for transcript after a delay to let scripts initialize
                        setTimeout(checkForTranscript, 3000);
                    }).catch(err => {
                        console.warn('Error injecting transcript-scraper script:', err);
                        // Try anyway after a delay
                        setTimeout(checkForTranscript, 5000);
                    });
                }
            });
            
        } catch (error) {
            console.error('Error creating tab for transcript extraction:', error);
            
            // Always return to Canvas tab on error
            try {
                chrome.tabs.update(originalTabId, { active: true });
            } catch (e) {
                console.error('Error returning to original tab:', e);
            }
            
            sendResponse({
                success: false,
                error: 'Error launching transcript extraction: ' + error.message
            });
        }
    });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
}

// Add a listener for recordingScrapingComplete message from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'recordingScrapingComplete') {
        console.log('Background script received recordingScrapingComplete message');
        
        // Forward the message to the popup if it's open
        chrome.runtime.sendMessage({
            action: 'recordingScrapingComplete',
            recordings: message.recordings,
            courseId: message.courseId,
            stats: message.stats || {}
        }, response => {
            if (chrome.runtime.lastError) {
                console.warn('Could not forward message to popup:', chrome.runtime.lastError.message);
                // The popup might not be open, which is fine
            } else {
                console.log('Successfully forwarded message to popup, response:', response);
            }
        });
        
        // Always send a response to the content script
        sendResponse({ status: 'received', message: 'Background script received the message' });
    }
    
    return true; // Keep message channel open for async response
});

// Add a listener for recordingsUploaded message from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'recordingsUploaded') {
        console.log('Background script received recordingsUploaded message');
        
        // Forward the message to the popup if it's open
        chrome.runtime.sendMessage({
            action: 'recordingsUploaded',
            success: message.success,
            count: message.count,
            batchId: message.batchId,
            error: message.error
        }, response => {
            if (chrome.runtime.lastError) {
                console.warn('Could not forward recordingsUploaded message to popup:', chrome.runtime.lastError.message);
                // The popup might not be open, which is fine
            } else {
                console.log('Successfully forwarded recordingsUploaded message to popup');
            }
        });
        
        // Always send a response to the content script
        sendResponse({ status: 'received', message: 'Background script received the recordingsUploaded message' });
        return true; // Keep message channel open for async response
    }
});

// Upload recordings directly from background script
function directUploadRecordings(recordings, token, courseId) {
    console.log('Background script: Directly uploading recordings:', recordings.length);
    
    return new Promise((resolve, reject) => {
        // Get API base URL from storage, with fallback to production URL
        chrome.storage.local.get(['apiBaseUrl'], async (result) => {
            let apiBaseUrl = result.apiBaseUrl;
            
            // If no API URL found or it's localhost, use production URL to avoid CORS issues
            if (!apiBaseUrl || apiBaseUrl.includes('localhost')) {
                // Try to ping localhost
                try {
                    const localhostUrl = 'http://localhost:8000';
                    console.log('Background script: Trying to ping localhost at:', localhostUrl);
                    
                    // Set up AbortController for timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
                    
                    const pingResponse = await fetch(`${localhostUrl}/ping`, {
                        method: 'GET',
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (pingResponse.ok) {
                        console.log('Background script: Localhost responded, using it for API calls');
                        apiBaseUrl = localhostUrl;
                    } else {
                        console.log('Background script: Localhost ping failed, using production URL');
                        apiBaseUrl = 'https://facilitator-backend.onrender.com';
                    }
                } catch (e) {
                    console.log('Background script: Error pinging localhost:', e);
                    apiBaseUrl = 'https://facilitator-backend.onrender.com';
                    console.log('Background script: Using production API URL:', apiBaseUrl);
                }
            } else {
                console.log('Background script: Using stored API URL:', apiBaseUrl);
            }
            
            try {
                const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                
                const uploadData = {
                    courseId: courseId,
                    recordings: recordings.map(r => ({
                        title: r.title || 'Untitled Recording',
                        url: r.url,
                        date: r.date || null,
                        host: r.host || null,
                        courseId: courseId
                    })),
                    upload_batch_id: batchId
                };
                
                console.log('Background script: Sending request to:', `${apiBaseUrl}/zoom/store`);
                console.log('Background script: Request payload size:', JSON.stringify(uploadData).length);
                
                // Create a request with credentials to ensure cookies are sent
                const response = await fetch(`${apiBaseUrl}/zoom/store`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(uploadData),
                    credentials: 'include'
                });
                
                const responseData = await response.json().catch(() => ({}));
                
                if (response.ok) {
                    console.log('Background script: Upload successful, response:', response.status);
                    
                    // Get the response data
                    const recordingData = responseData;
                    
                    // Try to submit transcripts if recordings were successfully uploaded
                    if (recordingData && recordingData.recordings && recordings.length > 0) {
                        try {
                            console.log('Background script: Trying to upload transcripts for recordings');
                            
                            // Process each recording to find matching transcripts
                            for (let i = 0; i < recordingData.recordings.length; i++) {
                                const recording = recordingData.recordings[i];
                                // Find matching recording by URL to get transcript
                                const matchingRecording = recordings.find(r => r.url === recording.url);
                                
                                if (matchingRecording && matchingRecording.transcript) {
                                    console.log(`Background script: Submitting transcript for recording ${i+1}/${recordingData.recordings.length}`);
                                    
                                    // Prepare transcript data
                                    const transcriptArray = Array.isArray(matchingRecording.transcript) 
                                        ? matchingRecording.transcript 
                                        : matchingRecording.transcript?.data || [];
                                    
                                    // Validate transcript data format
                                    if (!transcriptArray || transcriptArray.length === 0) {
                                        console.error('Background script: No valid transcript data found');
                                        continue;
                                    }
                                    
                                    // Log the transcript data structure to help debug
                                    console.log('Background script: Transcript data structure:', {
                                        isArray: Array.isArray(transcriptArray),
                                        length: transcriptArray.length,
                                        firstItem: transcriptArray[0],
                                        sample: transcriptArray.slice(0, 2)
                                    });
                                    
                                    const transcriptData = {
                                        recording_id: recording.id,
                                        transcript_data: transcriptArray,
                                        formatted_text: matchingRecording.transcriptText || '',
                                        segment_count: transcriptArray.length,
                                        url: recording.url
                                    };
                                    
                                    // Submit transcript
                                    const transcriptResponse = await fetch(`${apiBaseUrl}/zoom/store-transcript`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`
                                        },
                                        body: JSON.stringify(transcriptData)
                                    });
                                    
                                    if (transcriptResponse.ok) {
                                        console.log(`Background script: Successfully uploaded transcript for recording ${i+1}`);
                                    } else {
                                        console.error(`Background script: Failed to upload transcript for recording ${i+1}`);
                                    }
                                } else {
                                    console.log(`Background script: No transcript found for recording ${i+1}`);
                                }
                            }
                        } catch (transcriptError) {
                            console.error('Background script: Error uploading transcripts:', transcriptError);
                        }
                    }
                    
                    // Notify content script and popup
                    chrome.runtime.sendMessage({ 
                        action: 'recordings_upload_success',
                        count: recordings.length
                    });
                    
                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                        if (tabs[0]) {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                action: 'recordings_upload_success',
                                count: recordings.length
                            });
                        }
                    });
                    
                    resolve({ 
                        status: 'success', 
                        upload_batch_id: responseData.upload_batch_id,
                        count: recordings.length
                    });
                } else {
                    const errorMsg = `HTTP error: ${response.status} - ${responseData.message || response.statusText}`;
                    console.error('Background script: Upload failed:', errorMsg);
                    
                    // Notify content script and popup about failure
                    chrome.runtime.sendMessage({ 
                        action: 'recordings_upload_failed', 
                        error: errorMsg 
                    });
                    
                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                        if (tabs[0]) {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                action: 'recordings_upload_failed',
                                error: errorMsg
                            });
                        }
                    });
                    
                    resolve({ status: 'error', error: errorMsg });
                }
            } catch (error) {
                console.error('Background script: Upload error:', error.message);
                
                // Notify content script and popup about failure
                chrome.runtime.sendMessage({ 
                    action: 'recordings_upload_failed', 
                    error: error.message 
                });
                
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'recordings_upload_failed',
                            error: error.message
                        });
                    }
                });
                
                resolve({ status: 'error', error: error.message });
            }
        });
    });
}

// Add a listener for direct upload request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle both action names for compatibility
    if (message.action === 'direct_upload_recordings' || message.action === 'directUploadRecordings') {
        console.log('Background script received direct upload request with action:', message.action);
        
        // Handle the upload
        directUploadRecordings(message.recordings, message.token, message.courseId)
            .then(result => {
                console.log('Direct upload completed:', result);
                sendResponse(result);
                
                // Also notify any open popup
                chrome.runtime.sendMessage({
                    action: 'recordingsUploaded',
                    success: result && !result.error,
                    count: message.recordings.length,
                    error: result?.error
                });
            })
            .catch(error => {
                console.error('Direct upload error:', error);
                sendResponse({ status: 'error', error: error.message || 'Unknown error' });
            });
        
        return true; // Keep message channel open for async response
    }
}); 