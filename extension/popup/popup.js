// Import the authentication utilities
import { redirectIfNotAuthenticated } from '../scripts/auth-check.js';
import { ApiUtils, AuthUtils, CONFIG } from '../scripts/config.js';

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated
    checkAuth();
    
    // Initialize UI elements
    const assignmentsButton = document.getElementById('assignmentsButton');
    const inboxButton = document.getElementById('inboxButton');
    const stopButton = document.getElementById('stopButton');
    const logoutButton = document.getElementById('logoutButton');
    const resultsContainer = document.getElementById('results-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const assignmentsList = document.getElementById('assignments-list');
    const errorMessage = document.getElementById('error-message');
    const progressContainer = document.querySelector('.progress-container');
    const progressText = document.querySelector('.progress-text');
    const progressMessage = document.querySelector('.progress-message');
    const progressDetail = document.querySelector('.progress-detail');
    const progressNumbers = document.querySelector('.progress-numbers');
    const progressBarFill = document.querySelector('.progress-bar-fill');
    const goToAssignmentsBtn = document.getElementById('go-to-assignments');
    const goToInboxBtn = document.getElementById('go-to-inbox');
    const statusContainer = document.getElementById('status-container');
    const statusMessage = document.getElementById('status-message');
    const successIcon = document.getElementById('success-icon');
    const errorIcon = document.getElementById('error-icon');
    const loadingIcon = document.getElementById('loading-icon');

    // Debug UI elements
    console.log('UI Elements:', {
        assignmentsButton: !!assignmentsButton,
        inboxButton: !!inboxButton,
        goToInboxBtn: !!goToInboxBtn
    });

    let isScrapingActive = false;
    let currentScrapingType = null; // 'assignments' or 'recordings'

    // Function to check authentication
    async function checkAuth() {
        try {
            const isAuthenticated = await redirectIfNotAuthenticated();
            if (isAuthenticated) {
                // User is authenticated, initialize the app
                initializeApp();
            }
        } catch (error) {
            console.error('Authentication check error:', error);
        }
    }
    
    // Function to initialize the app after authentication check
    function initializeApp() {
        // Get user info and update UI
        updateUserInfo();
        
        // Reset scraping state on popup open
        chrome.storage.local.get(['scrapingState'], function(result) {
            // Check if there's an active scraping state
            if (result.scrapingState && result.scrapingState.isActive) {
                // Verify scraping is actually ongoing by checking with content script
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'checkScrapingStatus' }, response => {
                            if (response && response.isActive) {
                                // Scraping is actually ongoing, restore state
                                isScrapingActive = true;
                                currentScrapingType = result.scrapingState.type;
                                updateButtonStates(true);
                                setLoading(true, result.scrapingState.type);
                                if (result.scrapingState.current !== undefined && result.scrapingState.total !== undefined) {
                                    updateProgressUI(
                                        result.scrapingState.current,
                                        result.scrapingState.total,
                                        result.scrapingState.currentTitle
                                    );
                                }
                                // Ensure stop button is visible and enabled
                                if (stopButton) {
                                    stopButton.style.display = 'block';
                                    stopButton.disabled = false;
                                }
                                // Disable action buttons
                                if (assignmentsButton) assignmentsButton.disabled = true;
                                if (inboxButton) inboxButton.disabled = true;
                                if (goToAssignmentsBtn) goToAssignmentsBtn.disabled = true;
                                if (goToInboxBtn) goToInboxBtn.disabled = true;
                            } else {
                                // Scraping is not actually active, reset state
                                resetScrapingState();
                            }
                        });
                    } else {
                        // No active tab, reset state
                        resetScrapingState();
                    }
                });
            } else {
                // No scraping state, ensure UI is reset
                resetScrapingState();
            }
        });

        // Check current page to enable/disable appropriate buttons
        checkCurrentPage();

        // Add event listeners
        if (assignmentsButton) {
            assignmentsButton.addEventListener('click', handleAssignmentsClick);
        }

        if (inboxButton) {
            inboxButton.addEventListener('click', handleInboxClick);
        }

        if (stopButton) {
            stopButton.addEventListener('click', handleStopClick);
        }
        
        // Add logout button event listener
        if (logoutButton) {
            console.log('Adding logout button event listener');
            logoutButton.addEventListener('click', handleLogout);
        }

        // Add URL hash change listener to detect course selection in inbox
        window.addEventListener('hashchange', checkCurrentPage);

        // Add message listeners for scraping events
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'scrapingComplete' || 
                message.action === 'scrapingCancelled' ||
                message.status === 'scraping_complete' || 
                message.status === 'scraping_cancelled') {
                
                handleScrapingComplete(message);
            }
            else if (message.action === 'updateProgress' && message.data) {
                const { current, total, currentTitle } = message.data;
                
                // Skip "null of null" progress updates
                if (current === null || total === null) {
                    return;
                }
                
                // Update progress UI
                updateProgressUI(current, total, currentTitle);
            }
        });
    }

    // Function to reset all scraping state and UI
    function resetScrapingState() {
        isScrapingActive = false;
        currentScrapingType = null;
        chrome.storage.local.remove('scrapingState');
        setLoading(false, null);
        updateButtonStates(false);
        hideProgress();
        if (stopButton) {
            stopButton.style.display = 'none';
            stopButton.disabled = true;
        }
        checkCurrentPage(); // Re-enable buttons based on current page
    }

    // Function to show status message
    function showMessage(message, type = 'info') {
        if (statusMessage) statusMessage.textContent = message;
        if (statusContainer) statusContainer.style.display = 'block';
        
        // Hide all icons first
        if (successIcon) successIcon.style.display = 'none';
        if (errorIcon) errorIcon.style.display = 'none';
        if (loadingIcon) loadingIcon.style.display = 'none';
        
        // Show appropriate icon
        switch (type) {
            case 'success':
                if (successIcon) successIcon.style.display = 'block';
                break;
            case 'error':
                if (errorIcon) errorIcon.style.display = 'block';
                break;
            case 'loading':
                if (loadingIcon) loadingIcon.style.display = 'block';
                break;
        }
    }

    // Function to extract course ID from URL
    function extractCourseId(url) {
        console.log('Trying to extract course ID from URL:', url);
        
        if (!url) {
            console.warn('No URL provided to extractCourseId');
            return null;
        }
        
        // Handle various URL patterns
        
        // 1. Check URL hash for course filter pattern (for conversations/inbox)
        if (url.includes('#')) {
            const hashPart = url.split('#')[1];
            // Look for course=course_123 pattern in hash
            const courseHashMatch = hashPart.match(/course=course_(\d+)/);
            if (courseHashMatch && courseHashMatch[1]) {
                console.log('Found course ID in hash:', courseHashMatch[1]);
                return courseHashMatch[1];
            }
            
            // Look for context_id=course_123 pattern in hash
            const contextHashMatch = hashPart.match(/context_id=course_(\d+)/);
            if (contextHashMatch && contextHashMatch[1]) {
                console.log('Found course ID in context_id hash:', contextHashMatch[1]);
                return contextHashMatch[1];
            }
        }
        
        // 2. Check URL path for /courses/123 pattern
        const coursesPathMatch = url.match(/\/courses\/(\d+)/);
        if (coursesPathMatch && coursesPathMatch[1]) {
            console.log('Found course ID in URL path:', coursesPathMatch[1]);
            return coursesPathMatch[1];
        }
        
        // 3. Check for filter=course_123 in query params
        const queryMatch = url.match(/[?&]filter=course_(\d+)/);
        if (queryMatch && queryMatch[1]) {
            console.log('Found course ID in query param:', queryMatch[1]);
            return queryMatch[1];
        }
        
        // 4. Check for context_id=course_123 in query params
        const contextMatch = url.match(/[?&]context_id=course_(\d+)/);
        if (contextMatch && contextMatch[1]) {
            console.log('Found course ID in context_id param:', contextMatch[1]);
            return contextMatch[1];
        }
        
        // If we couldn't find a course ID, ask the user to provide one
        console.warn('No course ID found in URL:', url);
        
        // For debugging - dump more URL information
        console.log('URL parts:', {
            pathname: new URL(url).pathname,
            search: new URL(url).search,
            hash: new URL(url).hash
        });
        
        return null;
    }

    // Function to get assignments URL for a course
    function getAssignmentsUrl(courseId) {
        return `https://ufl.instructure.com/courses/${courseId}/assignments`;
    }

    // Function to check if we're on the assignments page
    function isOnAssignmentsPage(url) {
        return url.match(/\/courses\/\d+\/assignments\/?$/);
    }

    // Function to navigate to assignments
    function navigateToAssignments(courseId) {
        if (courseId) {
            const assignmentsUrl = getAssignmentsUrl(courseId);
            showError('Redirecting to assignments page...');
            chrome.tabs.update({ url: assignmentsUrl }, (tab) => {
                // Add listener for tab updates
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === tab.id && info.status === 'complete') {
                        // Remove the listener once we're done
                        chrome.tabs.onUpdated.removeListener(listener);
                        // Clear the error message
                        clearError();
                        // Update button text and state
                        if (assignmentsButton) {
                            assignmentsButton.innerHTML = '<i class="fas fa-download"></i> Scrape Assignments';
                            assignmentsButton.disabled = false;
                        }
                        // Inject the content script after navigation
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['scripts/content_canvas.js']
                        }).then(() => {
                            console.log('Content script injected successfully');
                        }).catch(error => {
                            console.error('Error injecting content script:', error);
                        });
                    }
                });
            });
        }
    }

    // Function to update button text and icons based on current page
    function updateButtonsBasedOnPage(url) {
        const isInboxPage = url.includes('/conversations');
        const isAssignmentsPage = url.includes('/assignments');

        if (goToAssignmentsBtn) {
            goToAssignmentsBtn.innerHTML = isAssignmentsPage ? 
                '<i class="fas fa-download"></i> Scrape Assignments' : 
                '<i class="fas fa-arrow-right"></i> Go to Assignments';
            // Only disable assignments button if in inbox
            goToAssignmentsBtn.disabled = isInboxPage;
        }
        
        if (goToInboxBtn) {
            goToInboxBtn.innerHTML = isInboxPage ? 
                '<i class="fas fa-download"></i> Scrape Recordings' : 
                '<i class="fas fa-arrow-right"></i> Go to Inbox';
            // Never disable the inbox button when on Canvas
            goToInboxBtn.disabled = !url.includes('ufl.instructure.com');
        }
        
        // Update main buttons
        if (assignmentsButton) {
            assignmentsButton.innerHTML = isAssignmentsPage ? 
                '<i class="fas fa-download"></i> Scrape Assignments' : 
                '<i class="fas fa-arrow-right"></i> Go to Assignments';
            // Only disable if scraping is active or on inbox page
            assignmentsButton.disabled = isScrapingActive || isInboxPage;
        }
        
        if (inboxButton) {
            // Check for course selection in inbox
            const hasCourseSelected = isInboxPage && url.includes('course=course_');
            
            if (isInboxPage) {
                if (hasCourseSelected) {
                    inboxButton.innerHTML = '<i class="fas fa-download"></i> Scrape Recordings';
                    inboxButton.disabled = isScrapingActive;
                } else {
                    inboxButton.innerHTML = '<i class="fas fa-info-circle"></i> Select a Course First';
                    inboxButton.disabled = true;
                }
            } else {
                inboxButton.innerHTML = '<i class="fas fa-arrow-right"></i> Go to Inbox';
                inboxButton.disabled = isScrapingActive;
            }
        }
    }

    // Function to check current page and update UI
    function checkCurrentPage() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentUrl = tabs[0].url;
            
            // Not on Canvas at all
            if (!currentUrl.includes('ufl.instructure.com')) {
                showError('Please navigate to Canvas first');
                disableButtons();
                return;
            }

            // Clear any existing error messages
            clearError();

            const courseId = extractCourseId(currentUrl);
            
            // Update buttons based on current page
            updateButtonsBasedOnPage(currentUrl);

            // Show course-specific error only if not in inbox and not in a course
            if (!courseId && !currentUrl.includes('/conversations')) {
                showError('Please navigate to a Canvas course to view assignments');
            }
        });
    }

    function disableButtons() {
        if (assignmentsButton) assignmentsButton.disabled = true;
        if (goToAssignmentsBtn) goToAssignmentsBtn.disabled = true;
        if (inboxButton) inboxButton.disabled = true;
        if (goToInboxBtn) goToInboxBtn.disabled = true;
    }

    function updateButtonStates(isScrapingActive) {
        if (assignmentsButton) assignmentsButton.disabled = isScrapingActive;
        if (inboxButton) inboxButton.disabled = isScrapingActive;
        if (goToAssignmentsBtn) goToAssignmentsBtn.disabled = isScrapingActive;
        if (goToInboxBtn) goToInboxBtn.disabled = isScrapingActive;

        // Show/hide stop button based on scraping state
        if (stopButton) {
            stopButton.style.display = isScrapingActive ? 'block' : 'none';
            stopButton.disabled = !isScrapingActive; // Enable stop button only during scraping
        }

        // Store the current state
            if (isScrapingActive) {
            chrome.storage.local.set({
                scrapingState: {
                    isActive: true,
                    type: currentScrapingType
                }
            });
        }
    }

    function resetScrapingTask() {
        // Send cancellation message first
        chrome.runtime.sendMessage({ action: 'cancelScraping' }, () => {
            // Then clear the local state
            chrome.storage.local.remove('scrapingState', function() {
                // Reset UI
                if (progressContainer) progressContainer.style.display = 'none';
                if (loadingSpinner) loadingSpinner.style.display = 'none';
                if (assignmentsList) assignmentsList.innerHTML = '';
                
                // Update button states
                updateButtonStates(false);
                
                // Show feedback message
                showError('Scraping stopped');
            });
        });
    }

    // Function to show error message
    function showError(message) {
        const errorContainer = document.getElementById('error-container');
        const errorText = document.getElementById('error-text');
        
        if (errorContainer && errorText) {
            errorText.textContent = message;
            errorContainer.style.display = 'block';
            errorContainer.classList.add('show');
        }
    }

    // Function to clear error message
    function clearError() {
        const errorContainer = document.getElementById('error-container');
        if (errorContainer) {
            errorContainer.style.display = 'none';
            errorContainer.classList.remove('show');
        }
    }

    function setLoading(isLoading, type) {
        isScrapingActive = isLoading;
        currentScrapingType = isLoading ? type : null;

        if (isLoading) {
            if (loadingSpinner) loadingSpinner.style.display = 'block';
            if (progressContainer) progressContainer.style.display = 'block';
            if (assignmentsList) assignmentsList.innerHTML = '';
            if (stopButton) {
                stopButton.style.display = 'block';
                stopButton.disabled = false;
            }
            updateButtonStates(true);
            
            // Store the state
            chrome.storage.local.set({
                scrapingState: {
                    isActive: true,
                    type: type,
                    timestamp: Date.now() // Add timestamp for potential timeout checks
                }
            });
        } else {
            if (loadingSpinner) loadingSpinner.style.display = 'none';
            if (progressContainer) progressContainer.style.display = 'none';
            if (stopButton) {
                stopButton.style.display = 'none';
                stopButton.disabled = true;
            }
            updateButtonStates(false);
            chrome.storage.local.remove('scrapingState');
        }
    }

    function updateProgressUI(current, total, currentTitle) {
        if (progressContainer && progressMessage && progressBarFill) {
            const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
            
            progressContainer.style.display = 'block';
            progressMessage.textContent = `Collecting ${currentScrapingType || 'items'}... ${percentage > 0 ? `(${percentage}%)` : ''}`;
            progressDetail.textContent = currentTitle ? `Currently processing: ${currentTitle}` : '';
            progressNumbers.textContent = `${current} of ${total} ${currentScrapingType || 'items'} processed`;
            progressBarFill.style.width = `${percentage}%`;

            // Ensure stop button is visible and enabled during progress
            if (stopButton) {
                stopButton.style.display = 'block';
                stopButton.disabled = false;
            }

            // Ensure buttons remain disabled
            updateButtonStates(true);

            // Store complete progress state
            chrome.storage.local.set({
                scrapingState: {
                    isActive: true,
                    type: currentScrapingType,
                    current,
                    total,
                    currentTitle,
                    percentage,
                    timestamp: Date.now()
                }
            });
        }
    }

    function showProgress(message, detail = '', current = 0, total = 0) {
        if (!progressContainer) return;

        const progressMessage = progressContainer.querySelector('.progress-message');
        const progressDetail = progressContainer.querySelector('.progress-detail');
        const progressNumbers = progressContainer.querySelector('.progress-numbers');
        const progressBarFill = progressContainer.querySelector('.progress-bar-fill');

        progressContainer.style.display = 'block';
        if (progressMessage) progressMessage.textContent = message;
        if (progressDetail) progressDetail.textContent = detail;
        
        if (total > 0 && progressNumbers && progressBarFill) {
            progressNumbers.textContent = `${current} of ${total}`;
            progressBarFill.style.width = `${(current / total) * 100}%`;
        }
    }

    function hideProgress() {
        const progressContainer = document.querySelector('.progress-container');
        progressContainer.style.display = 'none';
    }

    // Function to update scraping UI
    function updateScrapingUI(type, isActive) {
        try {
            // Get the correct button based on type
            let button = type === 'assignments' ? assignmentsButton : inboxButton;
            
            // Safely update the button if found
            if (button) {
                if (isActive) {
                    button.classList.add('scraping');
                    button.textContent = type === 'assignments' ? 'Scraping Assignments...' : 'Scraping Recordings...';
                    button.disabled = true;
                } else {
                    button.classList.remove('scraping');
                    // Update text based on current page
                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                        const currentUrl = tabs[0].url;
                        const isInboxPage = currentUrl.includes('/conversations');
                        const isAssignmentsPage = currentUrl.includes('/assignments');
                        
                        if (type === 'assignments') {
                            button.innerHTML = isAssignmentsPage ? 
                                '<i class="fas fa-download"></i> Scrape Assignments' : 
                                '<i class="fas fa-arrow-right"></i> Go to Assignments';
                        } else {
                            button.innerHTML = isInboxPage ? 
                                '<i class="fas fa-download"></i> Scrape Recordings' : 
                                '<i class="fas fa-arrow-right"></i> Go to Inbox';
                        }
                        button.disabled = false;
                    });
                }
            } else {
                console.warn(`Button for ${type} not found`);
            }
        } catch (error) {
            console.error(`Error updating ${type} UI:`, error);
        }
    }

    async function scrapeAssignments() {
        try {
            isScrapingActive = true;
            currentScrapingType = 'assignments';
            updateButtonStates(true);
            setLoading(true, 'assignments');
            hideResults();
            clearError();
            showProgress('Starting to scrape assignments...', 'Please wait...');
            
            // Notify background script that scraping has started
            chrome.runtime.sendMessage({
                action: 'startScraping',
                type: 'assignments'
            });

            // Update state
            chrome.storage.local.set({
                scrapingState: {
                    isActive: true,
                    type: 'assignments',
                    timestamp: Date.now()
                }
            });

            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error('No active tab found');

            // Check if we're on Canvas
            if (!tab.url.includes('ufl.instructure.com')) {
                throw new Error('Please navigate to Canvas first');
            }

            // Extract course ID from URL
            const courseId = extractCourseId(tab.url);
            if (!courseId) {
                console.error('Failed to extract course ID from URL:', tab.url);
                throw new Error('Please navigate to a Canvas course page');
            }

            // Inject content script
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['scripts/content_canvas.js']
                });
                console.log('Content script injected successfully');
            } catch (injectionError) {
                console.error('Error injecting content script:', injectionError);
                // Try to continue anyway - the script might already be injected
            }

            // Send message to start scraping
            chrome.tabs.sendMessage(tab.id, { 
                action: 'scrape',
                data: { type: 'assignments', courseId: courseId }
            }, response => {
                if (chrome.runtime.lastError) {
                    const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
                    console.error('Error:', errorMessage);
                    resetScrapingState();
                    showError('Error communicating with the page: ' + errorMessage + '. Please refresh and try again.');
                    return;
                }

                // Process will continue via content script messages
            });
        } catch (error) {
            console.error('Error starting assignment scraping:', error);
            showError(error.message || 'Failed to start scraping');
            
            // Reset scraping state and notify background script
            isScrapingActive = false;
            currentScrapingType = null;
            updateButtonStates(false);
            setLoading(false);
            hideProgress();
            
            // Notify background script that scraping has ended
            chrome.runtime.sendMessage({
                action: 'stopScraping',
                type: 'assignments'
            });
            
            // Clear storage state
            chrome.storage.local.remove('scrapingState');
        }
    }

    async function scrapeRecordings() {
        try {
            // Initialize scraping state
            isScrapingActive = true;
            currentScrapingType = 'recordings';
            updateButtonStates(true);
            setLoading(true, 'recordings');
            hideResults();
            clearError();
            showProgress('Starting to scrape recordings...', 'Please wait...');
            
            // Notify background script that scraping has started
            chrome.runtime.sendMessage({
                action: 'startScraping',
                type: 'recordings'
            });
            
            // Update state
            chrome.storage.local.set({
                scrapingState: {
                    isActive: true,
                    type: 'recordings',
                    timestamp: Date.now()
                }
            });

            // Get the active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            
            // Validate we're on the correct page
            const url = tab.url;
            if (!url.includes('instructure.com/conversations')) {
                throw new Error('Please navigate to Canvas Inbox to scrape recordings');
            }

            // Get the course ID from the URL if possible
            const courseId = extractCourseId(url);
            
            showProgress('Scraping recordings...', 'Initializing...');
            
            // First, try to inject the recording-scraper script if it doesn't exist
            try {
                // Attempt to ping the content script to see if it's loaded
                await new Promise((resolve, reject) => {
                    chrome.tabs.sendMessage(tab.id, { action: 'ping' }, response => {
                        if (chrome.runtime.lastError || !response) {
                            // Content script isn't loaded, attempt to inject it
                            console.log("Content script not detected. Attempting to inject recording-scraper.js...");
                            
                            chrome.runtime.sendMessage({ 
                                action: 'injectRecordingScraper', 
                                tabId: tab.id 
                            }, injectionResponse => {
                                if (chrome.runtime.lastError || !injectionResponse || !injectionResponse.success) {
                                    reject(new Error('Failed to inject recording scraper script. Please refresh the page and try again.'));
                                } else {
                                    console.log("Recording scraper script injected successfully.");
                                    // Wait a bit for the script to initialize
                                    setTimeout(resolve, 1000);
                                }
                            });
                        } else {
                            // Content script is already loaded
                            console.log("Content script already loaded.");
                            resolve();
                        }
                    });
                });
            } catch (error) {
                console.error("Failed to inject content script:", error);
                showError("Unable to start scraping: " + error.message);
                hideProgress();
                
                // Reset scraping state and UI
                isScrapingActive = false;
                currentScrapingType = null;
                updateButtonStates(false);
                setLoading(false);
                
                // Notify background script that scraping has ended
                chrome.runtime.sendMessage({
                    action: 'stopScraping',
                    type: 'recordings'
                });
                
                // Clear storage state
                chrome.storage.local.remove('scrapingState');
                return;
            }
            
            // Send message to content script to start scraping recordings (with retry)
            let retryCount = 0;
            const maxRetries = 2;
            
            while (retryCount <= maxRetries) {
                try {
                    const response = await new Promise((resolve, reject) => {
                        chrome.tabs.sendMessage(tab.id, { 
                            action: 'scrapeRecordings',
                            courseId: courseId
                        }, response => {
                            if (chrome.runtime.lastError) {
                                reject(new Error('Failed to communicate with content script: ' + 
                                               chrome.runtime.lastError.message));
                            } else if (!response) {
                                reject(new Error('No response from content script'));
                            } else {
                                resolve(response);
                            }
                        });
                        
                        // Set a timeout in case the message callback never fires
                        setTimeout(() => {
                            reject(new Error('Communication timeout - content script did not respond'));
                        }, 5000);
                    });
                    
                    // If we get here, communication was successful
                    if (response.status === 'success') {
                        const recordings = response.recordings || [];
                        const stats = response.stats || {};
                        
                        // Build success message with transcript statistics
                        const transcriptMessage = stats.transcriptSuccess 
                            ? `<span class="text-success">${stats.transcriptSuccess} transcripts extracted</span>` 
                            : "";
                        
                        const transcriptFailMessage = stats.transcriptFailed 
                            ? `<span class="text-warning">${stats.transcriptFailed} transcripts failed</span>` 
                            : "";
                        
                        let summaryMessage = `Found ${stats.successful} recordings`;
                        if (transcriptMessage) summaryMessage += `. ${transcriptMessage}`;
                        if (transcriptFailMessage) summaryMessage += `. ${transcriptFailMessage}`;
                        
                        showMessage(summaryMessage, 'success');
                        
                        // Display the recordings on the page
                        displayRecordings(recordings, courseId, stats);
                        
                        // Complete the process successfully
                        updateScrapingUI('recordings', false);
                        
                        // Notify that scraping has completed
                        chrome.runtime.sendMessage({ action: 'scrapingCompleted' });
                        
                        // Exit the retry loop
                        break;
                    } else {
                        // Handle error in response
                        showError(response.error || "Failed to scrape recordings");
                        
                        // Complete the process
                        updateScrapingUI('recordings', false);
                        
                        // Notify that scraping has completed (with error)
                        chrome.runtime.sendMessage({ action: 'scrapingCompleted' });
                        
                        // Exit the retry loop
                        break;
                    }
                } catch (error) {
                    console.error(`Error in scrapeRecordings (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
                    
                    // Retry if not the last attempt
                    if (retryCount < maxRetries) {
                        console.log(`Retrying scrapeRecordings... (${retryCount + 1}/${maxRetries + 1}`);
                        retryCount++;
                        // Show retry message
                        showProgress('Retrying...', `Attempt ${retryCount + 1} of ${maxRetries + 1}`);
                        // Wait a bit before retrying
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        console.log('Max retries reached. Giving up.');
                        
                        // Show error to user
                        showError(error.message || 'Failed to scrape recordings');
                        
                        // Reset scraping state
                        isScrapingActive = false;
                        currentScrapingType = null;
                        updateButtonStates(false);
                        setLoading(false);
                        hideProgress();
                        
                        // Notify background script that scraping has ended
                        chrome.runtime.sendMessage({
                            action: 'stopScraping',
                            type: 'recordings'
                        });
                        
                        // Clear storage state
                        chrome.storage.local.remove('scrapingState');
                        break;
                    }
                }
            }
        } catch (error) {
            console.error("Error in scrapeRecordings:", error);
            showError(error.message || "An unexpected error occurred");
            
            // Reset scraping state
            isScrapingActive = false;
            currentScrapingType = null;
            updateButtonStates(false);
            setLoading(false);
            hideProgress();
            
            // Notify background script that scraping has ended
            chrome.runtime.sendMessage({
                action: 'stopScraping',
                type: 'recordings'
            });
            
            // Clear storage state
            chrome.storage.local.remove('scrapingState');
        }
    }

    function displayResults(items, type, stats, wasCancelled = false) {
        // Check if the results container exists
        if (!resultsContainer) return;

        // Clear results container
        resultsContainer.innerHTML = '';
        
        // Ensure stats is always defined with default values
        stats = stats || { totalCount: 0, courseCount: 0 };
        if (typeof stats.totalCount === 'undefined') stats.totalCount = items.length;
        if (typeof stats.courseCount === 'undefined') stats.courseCount = 0;
        
        // Create summary bar
        const summaryBar = document.createElement('div');
        summaryBar.className = 'summary-bar';
        
        // Show appropriate icon and message based on type and cancellation status
        let iconClass, message;
        if (wasCancelled) {
            iconClass = 'fa-exclamation-triangle';
            message = 'Scraping was cancelled. Partial results shown below.';
        } else if (type === 'assignments') {
            iconClass = 'fa-tasks';
            message = `Found ${items.length} assignments`;
        } else if (type === 'recordings') {
            iconClass = 'fa-video';
            message = `Found ${items.length} Zoom recordings`;
        }
        
        summaryBar.innerHTML = `
            <div class="summary-icon"><i class="fas ${iconClass}"></i></div>
            <div class="summary-text">${message}</div>
        `;
        resultsContainer.appendChild(summaryBar);
        
        // If no items found, show a message
        if (items.length === 0) {
            const noResultsMessage = document.createElement('div');
            noResultsMessage.className = 'no-results-message';
            noResultsMessage.innerHTML = `<p>No ${type} found.</p>`;
            resultsContainer.appendChild(noResultsMessage);
            return;
        }

        // Extract course name from the URL or use courseInfo if available
        function getCourseName(item, type = 'assignments') {
            // For recordings, use the courseId stored in the result
            if (type === 'recordings' && item.courseId) {
                return `Course ${item.courseId}`;
            }
            
            if (item.course && item.course !== 'Unknown Course') {
                return item.course;
            }
            
            // Try to extract course name from URL path parts
            if (item.url) {
                try {
                const urlObj = new URL(item.url);
                const pathParts = urlObj.pathname.split('/');
                const courseIdx = pathParts.indexOf('courses');
                if (courseIdx !== -1 && courseIdx + 1 < pathParts.length) {
                    return `Course ${pathParts[courseIdx + 1]}`;
                    }
                } catch (error) {
                    console.warn('Error parsing URL for course name:', error);
                }
            }
            
            return 'Unknown Course';
        }
        
        // Group items by course
        const groupedItems = {};
        items.forEach(item => {
            // Ensure course name is always defined
            const courseName = getCourseName(item, type);
            
            if (!groupedItems[courseName]) {
                groupedItems[courseName] = [];
            }
            groupedItems[courseName].push({...item, course: courseName, selected: true});
        });
        
        // Update course count
        stats.courseCount = Object.keys(groupedItems).length;
        
        // Store all items for submission
        const allItems = [];
        
        // Create select all checkbox
        const selectAllContainer = document.createElement('div');
        selectAllContainer.className = 'select-all-container';
        selectAllContainer.innerHTML = `
            <label class="select-all-label">
                <input type="checkbox" id="selectAll" checked>
                <span>Select All</span>
            </label>
        `;
        resultsContainer.appendChild(selectAllContainer);
        
        // Add select all functionality
        const selectAllCheckbox = selectAllContainer.querySelector('#selectAll');
        selectAllCheckbox.addEventListener('change', function() {
            const isChecked = this.checked;
            const itemCheckboxes = document.querySelectorAll('.item-checkbox');
            itemCheckboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
                
                // Update the item's selected property
                const itemId = checkbox.getAttribute('data-item-id');
                const courseId = checkbox.getAttribute('data-course-id');
                
                // Find the item and update it
                const courseItems = groupedItems[courseId];
                if (courseItems) {
                    const item = courseItems.find(i => i.id === itemId);
                    if (item) {
                        item.selected = isChecked;
                    }
                }
            });
        });
        
        // Create and display each course section
        let itemIndex = 0;
        Object.keys(groupedItems).forEach(courseName => {
            const courseItems = groupedItems[courseName];
            const courseId = extractCourseId(courseItems[0].url) || 'unknown';
            
            // Add course section
            const courseSection = document.createElement('div');
            courseSection.className = 'course-section';
            
            // Course header
            const courseHeader = document.createElement('div');
            courseHeader.className = 'course-header';
            courseHeader.innerHTML = `
                <h3>${courseName}</h3>
                <span class="count-badge">${courseItems.length} ${courseItems.length === 1 ? type.slice(0, -1) : type}</span>
            `;
            courseSection.appendChild(courseHeader);
            
            // Course items
            const itemsList = document.createElement('div');
            itemsList.className = 'items-list';
            
            courseItems.forEach(item => {
                // Generate unique ID for the item
                item.id = `item-${itemIndex++}`;
                allItems.push(item);
                
                const itemElement = document.createElement('div');
                itemElement.className = `item-card ${type}-item`;
                
                // Content depends on item type
                if (type === 'assignments') {
                    itemElement.innerHTML = `
                        <div class="item-container">
                        <div class="item-checkbox-container">
                            <input type="checkbox" class="item-checkbox" 
                                    data-item-id="${item.id || ''}" 
                                   data-course-id="${courseName}"
                                    id="item-${itemIndex}" 
                                    checked>
                        </div>
                        <div class="item-content">
                            <div class="item-header">
                                    <h4 class="item-title">${item.title || 'Untitled Assignment'}</h4>
                                    <span class="item-date">${item.dueDate || ''}</span>
                    </div>
                                <div class="item-details">
                                    <div class="item-points">${formatPoints(item.points)}</div>
                                    <div class="item-status">${item.status || 'Not Started'}</div>
                    </div>
                            </div>
                        </div>
                    `;
                } else if (type === 'recordings') {
                    itemElement.innerHTML = `
                        <div class="item-container">
                            <div class="item-checkbox-container">
                                <input type="checkbox" class="item-checkbox" 
                                    data-item-id="${item.id || ''}" 
                                    data-course-id="${courseName}"
                                    id="item-${itemIndex}" 
                                    checked>
                            </div>
                            <div class="item-content">
                                <div class="item-header">
                                    <h4 class="item-title">${item.title || 'Untitled Recording'}</h4>
                                    <span class="item-date">${item.date || ''}</span>
                                </div>
                                <div class="item-details">
                                    <div class="item-host">${item.host || 'Unknown Host'}</div>
                                    <div class="item-type">${item.type === 'zoom' ? 'Zoom Recording' : 'Recording'}</div>
                                </div>
                                <div class="item-url-container">
                                    <a href="${item.url}" target="_blank" class="item-url" title="${item.url}">
                                        <i class="fas fa-external-link-alt"></i> ${shortenUrl(item.url)}
                                    </a>
                                </div>
                            </div>
                    </div>
                `;
                }

                itemsList.appendChild(itemElement);
                
                // Add event listener for checkbox
                    const checkbox = itemElement.querySelector('.item-checkbox');
                if (checkbox) {
                    checkbox.addEventListener('change', function() {
                        const isChecked = this.checked;
                        const itemId = this.getAttribute('data-item-id');
                        const courseId = this.getAttribute('data-course-id');
                        
                        // Find and update the item in groupedItems
                        const courseItems = groupedItems[courseId];
                        if (courseItems) {
                            const item = courseItems.find(i => i.id === itemId);
                            if (item) {
                                item.selected = isChecked;
                            }
                        }
                        
                        // Update "Select All" checkbox if needed
                        updateSelectAllCheckbox();
                    });
                }
            });
            
            courseSection.appendChild(itemsList);
            resultsContainer.appendChild(courseSection);
        });
        
        // Add submit button for assignments OR recordings
        if ((type === 'assignments' || type === 'recordings') && items.length > 0) {
            const submitButtonContainer = document.createElement('div');
            submitButtonContainer.className = 'submit-container';
            
            const submitButton = document.createElement('button');
            submitButton.className = 'action-button submit-button';
            
            if (type === 'assignments') {
            submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Selected Assignments';
            submitButton.addEventListener('click', async () => {
                try {
                    submitButton.disabled = true;
                    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
                    
                    // Get all selected items
                    const selectedItems = [];
                    Object.keys(groupedItems).forEach(courseName => {
                        groupedItems[courseName].forEach(item => {
                            if (item.selected) {
                                selectedItems.push(item);
                            }
                        });
                    });
                    
                    if (selectedItems.length === 0) {
                        showError('Please select at least one assignment to submit');
                        submitButton.disabled = false;
                        submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Selected Assignments';
                        return;
                    }
                    
                    // Get the course ID from the first item
                    const firstItem = selectedItems[0];
                        let courseId = extractCourseId(firstItem.url);
                    
                    // If courseId is still not found, extract it from the URL
                    if (!courseId && firstItem.url) {
                        try {
                            const urlObj = new URL(firstItem.url);
                            const pathParts = urlObj.pathname.split('/');
                            const courseIdx = pathParts.indexOf('courses');
                            if (courseIdx !== -1 && courseIdx + 1 < pathParts.length) {
                                courseId = pathParts[courseIdx + 1];
                            }
                        } catch (e) {
                            console.error('Error parsing URL:', e);
                        }
                    }
                    
                    if (!courseId) {
                        throw new Error('Could not determine course ID');
                    }
                    
                    console.log('Using course ID for submission:', courseId);
                    
                    // Get authentication token using AuthUtils
                    const tokenResult = await AuthUtils.getAuthToken();
                    
                    if (!tokenResult) {
                        console.error('Authentication token not found');
                        throw new Error('Not authenticated. Please log in.');
                    }
                    
                    // Generate a unique batch ID for this upload session
                    const upload_batch_id = self.crypto.randomUUID ? self.crypto.randomUUID() : 
                        'batch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
                    console.log('Generated upload batch ID:', upload_batch_id);
                    
                        // Prepare the data for API submission
                        const submissionData = {
                            courseId: courseId,
                            assignments: selectedItems.map(item => ({
                                title: item.title,
                                url: item.url,
                                dueDate: item.dueDate,
                                description: item.description,
                                rubric: item.rubric,
                                assignmentGroup: item.assignmentGroup || 'Uncategorized',
                                points: item.points || 0,
                                status: item.status || 'Not Started',
                                courseId: courseId  // Add courseId to each assignment
                            })),
                            upload_batch_id: upload_batch_id
                        };
                        
                        // Call the API to store the assignments
                        const response = await ApiUtils.storeAssignments(submissionData);
                        
                        if (response && response.status === 'success') {
                            // Show success message
                            showMessage(`Successfully submitted ${response.count} assignments`, 'success');
                            
                            // Store the batch ID for future reference
                            const batch = {
                                id: upload_batch_id,
                                timestamp: Date.now(),
                        courseId: courseId,
                                count: response.count,
                                type: 'assignments'
                            };
                            
                            chrome.storage.local.get(['uploadBatches'], function(result) {
                                const batches = result.uploadBatches || [];
                                batches.push(batch);
                                chrome.storage.local.set({ uploadBatches: batches });
                            });
                            
                            // Update button to show success
                            submitButton.innerHTML = '<i class="fas fa-check"></i> Assignments Submitted!';
                            setTimeout(() => {
                                submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Selected Assignments';
                                submitButton.disabled = false;
                            }, 3000);
                        } else {
                            throw new Error(response?.error || 'Failed to submit assignments');
                        }
                    } catch (error) {
                        console.error('Error submitting assignments:', error);
                        
                        // Improved error handling for validation errors
                        let errorMessage;
                        if (error && typeof error === 'object') {
                            // If error is an actual Error object
                            if (error instanceof Error) {
                                errorMessage = error.message;
                            } else {
                                // Handle validation errors that might be objects
                                try {
                                    errorMessage = JSON.stringify(error);
                                } catch (e) {
                                    errorMessage = 'Unprocessable validation error';
                                }
                            }
                        } else {
                            errorMessage = error?.toString() || 'An unknown error occurred during submission';
                        }
                        
                        showError(errorMessage);
                        submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Selected Assignments';
                        submitButton.disabled = false;
                    }
                });
            } else if (type === 'recordings') {
                // Submit button for recordings
                submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Selected Recordings';
                submitButton.addEventListener('click', async () => {
                    try {
                        submitButton.disabled = true;
                        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
                        
                        // Get all selected recordings
                        const selectedRecordings = [];
                        Object.keys(groupedItems).forEach(courseName => {
                            groupedItems[courseName].forEach(item => {
                                if (item.selected) {
                                    selectedRecordings.push(item);
                                }
                            });
                        });
                        
                        if (selectedRecordings.length === 0) {
                            showError('Please select at least one recording to submit');
                            submitButton.disabled = false;
                            submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Selected Recordings';
                            return;
                        }
                        
                        // Get the course ID from the first item (either from courseId property or from URL)
                        const firstItem = selectedRecordings[0];
                        let courseId = firstItem.courseId || extractCourseId(firstItem.url);
                        
                        if (!courseId || courseId === 'unknown') {
                            throw new Error('Could not determine course ID for recordings');
                        }
                        
                        console.log('Using course ID for recording submission:', courseId);
                        
                        // Get authentication token using AuthUtils
                        const tokenResult = await AuthUtils.getAuthToken();
                        
                        if (!tokenResult) {
                            console.error('Authentication token not found');
                            throw new Error('Not authenticated. Please log in.');
                        }
                        
                        // Generate a unique batch ID for this upload session
                        const upload_batch_id = self.crypto.randomUUID ? self.crypto.randomUUID() : 
                            'batch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
                        console.log('Generated upload batch ID for recordings:', upload_batch_id);
                        
                        // Call the function to upload recordings to the database
                        await uploadZoomRecordings(selectedRecordings, upload_batch_id);
                    } catch (error) {
                        console.error('Error submitting recordings:', error);
                        showError(error.message || 'Failed to submit recordings');
                        submitButton.disabled = false;
                        submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Selected Recordings';
                    }
                    
                    setTimeout(() => {
                        submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Selected Recordings';
                        submitButton.disabled = false;
                    }, 3000);
                });
            }
            
            submitButtonContainer.appendChild(submitButton);
            resultsContainer.appendChild(submitButtonContainer);
        }
        
        // Show results container
        resultsContainer.style.display = 'block';
        
        // Hide loading indicators
        setLoading(false);
    }

    // Add message listener for progress updates
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Popup received message:', request);
        
        if (request.action === 'updateProgress' && request.data) {
            showProgress(
                request.data.currentTitle || 'Processing...',
                '',
                request.data.current,
                request.data.total
            );
        }
        
        if (request.status === 'scraping_start_success' || request.status === 'scraping_ongoing') {
            setLoading(true, request.data.type);
            return true;
        }
        
        if (request.status === 'scraping_done' && request.data && request.data.assignments) {
            const totalAssignments = request.data.assignments.length;
            
            // Show completion message in progress bar
            showProgress(
                'Scraping complete!',
                `Successfully extracted ${totalAssignments} assignments`,
                totalAssignments,
                totalAssignments
            );

            // Display results with stats and hide loading UI
            displayResults(request.data.assignments, 'assignments', {
                total: totalAssignments,
                successful: totalAssignments
            }, false);
            
            setLoading(false, request.data.type);
            
            // Re-enable buttons
            updateButtonStates(false);
            return true;
        }

        if (request.status === 'scraping_cancelled' || request.status === 'cancelled') {
            setLoading(false, null);
            showError('Scraping cancelled successfully');
            
            // Clear results without showing completion status
            if (resultsContainer) {
                resultsContainer.innerHTML = '';
            }
            return true;
        }
        
        return false;
    });

    // Define the missing handler functions
    function handleAssignmentsClick() {
        // Get active tab URL instead of popup window URL
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || !tabs[0]) {
                showError('Unable to determine current page');
                return;
            }
            
            const url = tabs[0].url;
            if (isOnAssignmentsPage(url)) {
                scrapeAssignments();
            } else {
                const courseId = extractCourseId(url);
                if (courseId) {
                    navigateToAssignments(courseId);
                } else {
                    showError('Please navigate to a Canvas course first');
                }
            }
        });
    }

    function handleInboxClick() {
        // Get active tab URL instead of popup window URL
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || !tabs[0]) {
                showError('Unable to determine current page');
                return;
            }
            
            const url = tabs[0].url;
            if (url.includes('/conversations')) {
                scrapeRecordings();
            } else {
                chrome.tabs.update(tabs[0].id, { url: 'https://ufl.instructure.com/conversations' });
            }
        });
    }

    function handleStopClick() {
        if (isScrapingActive) {
            // Send message to content script to cancel scraping
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'cancelScraping' });
                }
            });
            
            // Notify background script that scraping has stopped
            chrome.runtime.sendMessage({
                action: 'stopScraping',
                type: currentScrapingType
            });
            
            // Reset UI state
            isScrapingActive = false;
            const tempType = currentScrapingType; // Store type before resetting
            currentScrapingType = null;
            updateButtonStates(false);
            setLoading(false);
            hideProgress();
            
            // Clear storage state
            chrome.storage.local.remove('scrapingState');
            
            showMessage('Scraping cancelled', 'info');
        }
    }

    // Function to handle logout
    async function handleLogout() {
        const logoutButton = document.getElementById('logoutButton');
        
        try {
            // Show loading state
            logoutButton.disabled = true;
            logoutButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
            
            console.log('Logging out...');
            
            // Call the logout API
            const result = await ApiUtils.logout();
            console.log('Logout result:', result);
            
            // Redirect to auth page
            window.location.href = 'auth.html';
        } catch (error) {
            console.error('Logout error:', error);
            
            // Show error message if available
            if (document.getElementById('error-text')) {
                document.getElementById('error-container').style.display = 'block';
                document.getElementById('error-text').textContent = 'Failed to logout. Please try again.';
            } else {
                alert('Failed to logout. Please try again.');
            }
            
            // Reset button state
            logoutButton.disabled = false;
            logoutButton.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
        }
    }

    // Add a new function to update user info in the UI
    async function updateUserInfo() {
        try {
            // Get user info from storage
            const userInfo = await ApiUtils.getUserInfo();
            
            // Update logout button with user name if available
            const logoutButton = document.getElementById('logoutButton');
            if (logoutButton && userInfo && userInfo.email) {
                // Get the first part of the email (before @) as fallback
                let displayName = userInfo.email.split('@')[0];
                
                // If we have a full name, format it properly
                if (userInfo.fullName) {
                    // Format name as "First Last" with proper capitalization
                    displayName = userInfo.fullName.split(' ')
                        .map(name => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase())
                        .join(' ');
                }
                
                logoutButton.innerHTML = `
                    <span class="user-name">${displayName}</span>
                    <i class="fas fa-sign-out-alt"></i>
                `;
            }
        } catch (error) {
            console.error('Error updating user info:', error);
        }
    }

    // Add new function to view batches (can be called from developer tools)
    window.viewAssignmentBatches = function() {
        chrome.storage.local.get(['uploadBatches'], (result) => {
            const batches = result.uploadBatches || [];
            if (batches.length === 0) {
                console.log('No assignment batches found in storage');
                return;
            }
            
            console.log(`Found ${batches.length} assignment batches:`);
            batches.forEach((batch, index) => {
                const date = new Date(batch.timestamp);
                console.log(`Batch ${index + 1}: ID=${batch.id}, Type=${batch.type}, Count=${batch.count}, Course=${batch.courseId}, Date=${date.toLocaleString()}`);
            });
        });
    };

    // Helper function to shorten URLs for display
    function shortenUrl(url) {
        try {
            if (!url) return 'No URL';
            
            // Parse the URL
            const urlObj = new URL(url);
            
            // Get hostname without www.
            let hostname = urlObj.hostname.replace(/^www\./, '');
            
            // Get path and truncate if too long
            let path = urlObj.pathname;
            if (path.length > 20) {
                path = path.substring(0, 17) + '...';
            }
            
            // Return shortened version
            return `${hostname}${path}`;
        } catch (error) {
            console.warn('Error shortening URL:', error);
            
            // Fallback for invalid URLs
            if (typeof url === 'string') {
                if (url.length > 30) {
                    return url.substring(0, 27) + '...';
                }
                return url;
            }
            
            return 'Invalid URL';
        }
    }

    // Format points display
    function formatPoints(points) {
        if (points === undefined || points === null) return '';
        return `${Number(points)} pts`;
    }

    // Update select all checkbox state
    function updateSelectAllCheckbox() {
        const allCheckboxes = document.querySelectorAll('.item-checkbox');
        const selectAllCb = document.getElementById('selectAll');
        if (selectAllCb && allCheckboxes.length > 0) {
            const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
            selectAllCb.checked = allChecked;
        }
    }

    // Function to hide results and clear containers
    function hideResults() {
        // Hide all result containers
        const resultContainers = document.querySelectorAll('.results-container');
        resultContainers.forEach(container => {
            container.style.display = 'none';
            // Clear content
            container.innerHTML = '';
        });
        
        // Hide status container
        const statusContainer = document.getElementById('status-container');
        if (statusContainer) {
            statusContainer.style.display = 'none';
        }
        
        // Hide progress container
        hideProgress();
        
        console.log('Results containers hidden and cleared');
    }

    // Function to display recordings with checkboxes and submit button
    function displayRecordings(recordings, courseId, stats = {}) {
        try {
            // Get the results container
            const resultsContainer = document.getElementById('results-container') || 
                                    document.querySelector('.results-container');
            
            if (!resultsContainer) {
                console.error('Results container not found');
                return;
            }
            
            // Make sure the container is visible
            resultsContainer.style.display = 'block';
            
            // Clear existing content
            resultsContainer.innerHTML = '';
            
            // Create a summary bar
            const summaryBar = document.createElement('div');
            summaryBar.className = 'summary-bar';
            
            // Default stats values if not provided
            const totalCount = stats?.totalCount || (recordings ? recordings.length : 0);
            const processedCount = stats?.processedCount || totalCount;
            const transcriptStats = stats?.transcripts || { success: 0, failed: 0, skipped: 0 };
            
            // Build summary text
            let summaryText = `Found ${totalCount} recordings`;
            if (courseId) {
                summaryText += ` in ${getCourseName(courseId)}`;
            }
            
            if (transcriptStats && (transcriptStats.success > 0 || transcriptStats.failed > 0)) {
                summaryText += ` | Transcripts: ${transcriptStats.success} extracted`;
                if (transcriptStats.failed > 0) {
                    summaryText += `, ${transcriptStats.failed} failed`;
                }
                if (transcriptStats.skipped > 0) {
                    summaryText += `, ${transcriptStats.skipped} skipped`;
                }
            }
            
            summaryBar.textContent = summaryText;
            resultsContainer.appendChild(summaryBar);
            
            // Check if we have recordings
            if (!recordings || !Array.isArray(recordings) || recordings.length === 0) {
                const noResultsMsg = document.createElement('div');
                noResultsMsg.className = 'no-results';
                noResultsMsg.textContent = 'No recordings found. Make sure you have selected a course with Zoom recordings in the inbox.';
                resultsContainer.appendChild(noResultsMsg);
                return;
            }
            
            // Create container for recordings
            const recordingsContainer = document.createElement('div');
            recordingsContainer.className = 'recordings-container';
            
            // Create select all checkbox
            const selectAllContainer = document.createElement('div');
            selectAllContainer.className = 'select-all-container';
            
            const selectAllCheckbox = document.createElement('input');
            selectAllCheckbox.type = 'checkbox';
            selectAllCheckbox.id = 'select-all-recordings';
            selectAllCheckbox.className = 'select-all';
            
            const selectAllLabel = document.createElement('label');
            selectAllLabel.htmlFor = 'select-all-recordings';
            selectAllLabel.textContent = 'Select All';
            
            selectAllContainer.appendChild(selectAllCheckbox);
            selectAllContainer.appendChild(selectAllLabel);
            recordingsContainer.appendChild(selectAllContainer);
            
            // Add event listener to select all checkbox
            selectAllCheckbox.addEventListener('change', function() {
                const checkboxes = recordingsContainer.querySelectorAll('.recording-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = selectAllCheckbox.checked;
                });
            });
            
            // Add each recording to the container
            recordings.forEach((recording, index) => {
                // Create recording item
                const recordingItem = document.createElement('div');
                recordingItem.className = 'recording-item';
                if (recording.transcript && recording.transcript.status === 'success') {
                    recordingItem.classList.add('has-transcript');
                }
                
                // Create checkbox for selection
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'recording-checkbox';
                checkbox.dataset.index = index;
                checkbox.id = `recording-${index}`;
                
                // Create item container
                const itemContainer = document.createElement('div');
                itemContainer.className = 'item-container';
                
                // Create header with title and date
                const itemHeader = document.createElement('div');
                itemHeader.className = 'item-header';
                
                // Add title
                const title = document.createElement('div');
                title.className = 'item-title';
                title.textContent = recording.title || 'Untitled Recording';
                itemHeader.appendChild(title);
                
                // Add date and host info
                const info = document.createElement('div');
                info.className = 'item-info';
                info.innerHTML = `
                    <span class="item-date">${recording.date || 'Unknown date'}</span>
                    <span class="item-host">Host: ${recording.host || 'Unknown'}</span>
                `;
                itemHeader.appendChild(info);
                
                // Add URL container with clickable link
                const urlContainer = document.createElement('div');
                urlContainer.className = 'item-url-container';
                
                // Create URL element with shortened display
                if (recording.url) {
                    const urlElement = document.createElement('a');
                    urlElement.className = 'item-url';
                    urlElement.href = recording.url;
                    urlElement.target = '_blank';
                    urlElement.title = recording.url;
                    urlElement.textContent = shortenUrl(recording.url);
                    
                    // Add external link icon
                    const linkIcon = document.createElement('i');
                    linkIcon.className = 'fas fa-external-link-alt';
                    urlElement.appendChild(linkIcon);
                    
                    urlContainer.appendChild(urlElement);
                } else {
                    urlContainer.textContent = 'No URL available';
                }
                
                // Add transcript status if available
                if (recording.transcript) {
                    const transcriptStatus = document.createElement('div');
                    transcriptStatus.className = 'transcript-status';
                    
                    if (recording.transcript.status === 'success') {
                        transcriptStatus.innerHTML = `
                            <i class="fas fa-check-circle"></i>
                            <span>Transcript extracted (${recording.transcript.segments || 0} segments)</span>
                        `;
                        transcriptStatus.classList.add('success');
                    } else if (recording.transcript.status === 'error') {
                        transcriptStatus.innerHTML = `
                            <i class="fas fa-exclamation-circle"></i>
                            <span>Transcript error: ${recording.transcript.error || 'Unknown error'}</span>
                        `;
                        transcriptStatus.classList.add('error');
                    } else if (recording.transcript.status === 'pending') {
                        transcriptStatus.innerHTML = `
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Extracting transcript...</span>
                        `;
                        transcriptStatus.classList.add('pending');
                    }
                    
                    urlContainer.appendChild(transcriptStatus);
                }
                
                // Assemble the item
                itemContainer.appendChild(itemHeader);
                itemContainer.appendChild(urlContainer);
                
                recordingItem.appendChild(checkbox);
                recordingItem.appendChild(itemContainer);
                recordingsContainer.appendChild(recordingItem);
            });
            
            // Add the recordings container to the results
            resultsContainer.appendChild(recordingsContainer);
            
            // Add submit button container
            const submitButtonContainer = document.createElement('div');
            submitButtonContainer.className = 'submit-button-container';
            
            // Create submit button
            const submitButton = document.createElement('button');
            submitButton.className = 'action-button submit-button';
            submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Selected Recordings';
            
            // Add event listener to submit button
            submitButton.addEventListener('click', async () => {
                try {
                    // Get selected recordings
                    const selectedCheckboxes = recordingsContainer.querySelectorAll('.recording-checkbox:checked');
                    if (selectedCheckboxes.length === 0) {
                        showError('Please select at least one recording to submit');
                        return;
                    }
                    
                    // Disable button during submission
                    submitButton.disabled = true;
                    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
                    
                    // Get selected recordings
                    const selectedRecordings = Array.from(selectedCheckboxes).map(checkbox => {
                        const index = parseInt(checkbox.dataset.index);
                        return recordings[index];
                    });
                    
                    // Generate a unique batch ID for this upload
                    const upload_batch_id = `recordings_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
                    console.log('Generated upload batch ID for recordings:', upload_batch_id);
                    
                    // Call the function to upload recordings to the database
                    await uploadZoomRecordings(selectedRecordings, upload_batch_id);
                    
                    setTimeout(() => {
                        submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Selected Recordings';
                        submitButton.disabled = false;
                    }, 3000);
                } catch (error) {
                    console.error('Error submitting recordings:', error);
                    showError('Failed to submit recordings: ' + error.message);
                    submitButton.disabled = false;
                    submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Selected Recordings';
                }
            });
            
            submitButtonContainer.appendChild(submitButton);
            
            // Add extract transcripts button if there are recordings without transcripts
            const needsTranscripts = recordings.some(recording => 
                !recording.transcript || recording.transcript.status !== 'success'
            );
            
            if (needsTranscripts) {
                const extractButton = document.createElement('button');
                extractButton.className = 'action-button extract-button';
                extractButton.innerHTML = '<i class="fas fa-file-alt"></i> Extract Missing Transcripts';
                
                // Add event listener to extract button
                extractButton.addEventListener('click', () => {
                    // Get recordings that need transcripts
                    const recordingsNeedingTranscripts = recordings.filter(recording => 
                        !recording.transcript || recording.transcript.status !== 'success'
                    );
                    
                    // Call the extract function
                    extractZoomTranscripts(recordingsNeedingTranscripts);
                });
                
                submitButtonContainer.appendChild(extractButton);
            }
            
            // Add the submit button container to the results
            resultsContainer.appendChild(submitButtonContainer);
            
        } catch (error) {
            console.error('Error displaying recordings:', error);
            showError('Failed to display recordings: ' + error.message);
        }
    }

    // Alias for clearError - used in scrapeRecordings
    function resetError() {
        clearError();
    }

    // Function to process scraping complete message
    function handleScrapingComplete(message) {
        if (isScrapingActive) {
            // Reset UI
            isScrapingActive = false;
            const tempType = currentScrapingType; // Store type before resetting
            currentScrapingType = null;
            updateButtonStates(false);
            setLoading(false);
            hideProgress();
            
            // Notify background script that scraping has stopped
            chrome.runtime.sendMessage({
                action: 'stopScraping',
                type: tempType
            });
            
            // Clear storage state
            chrome.storage.local.remove('scrapingState');
            
            // Process results if available
            if (message && message.results) {
                displayResults(message.results, message.type, message.stats);
            }
        }
    }
}); 