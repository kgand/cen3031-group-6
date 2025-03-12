// Background script for FaciliGator

console.log('FaciliGator background script loaded');

// Store data and ongoing status
let data = {};
let ongoing = {};

// At the top of the file, add a global cancellation flag
let scrapingCancelled = false;

// At the top of the file, add authentication check
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'checkAuth') {
        chrome.storage.local.get(['facilitator_auth_token'], function(result) {
            sendResponse({ isAuthenticated: !!result.facilitator_auth_token });
        });
        return true; // Required for async response
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