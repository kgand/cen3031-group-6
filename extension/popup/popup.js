// Import the authentication utilities
import { redirectIfNotAuthenticated } from '../scripts/auth-check.js';
import { ApiUtils } from '../scripts/config.js';

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
    function getCourseId(url) {
        const match = url.match(/\/courses\/(\d+)/);
        return match ? match[1] : null;
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

            const courseId = getCourseId(currentUrl);
            const isInboxPage = currentUrl.includes('/conversations');
            const isAssignmentsPage = currentUrl.includes('/assignments');

            // Check for course selection in inbox
            const hasCourseSelected = isInboxPage && currentUrl.includes('course=course_');
            const courseFromHash = hasCourseSelected ? currentUrl.match(/course=course_(\d+)/)?.[1] : null;

            // Enable/disable and update buttons based on current page
            if (assignmentsButton) {
                if (isAssignmentsPage) {
                    assignmentsButton.innerHTML = '<i class="fas fa-download"></i> Scrape Assignments';
                    assignmentsButton.disabled = false;
                } else {
                    assignmentsButton.innerHTML = '<i class="fas fa-arrow-right"></i> Go to Assignments';
                    assignmentsButton.disabled = isInboxPage;
                }
            }

            if (inboxButton) {
                if (isInboxPage) {
                    if (hasCourseSelected) {
                        inboxButton.innerHTML = '<i class="fas fa-download"></i> Scrape Recordings';
                        inboxButton.disabled = false;
                } else {
                        inboxButton.innerHTML = '<i class="fas fa-info-circle"></i> Select a Course First';
                        inboxButton.disabled = true;
                    }
                } else {
                    inboxButton.innerHTML = '<i class="fas fa-arrow-right"></i> Go to Inbox';
                    inboxButton.disabled = false;
                }
            }

            // Show course-specific error only if not in inbox and not in a course
            if (!courseId && !isInboxPage) {
                showError('Please navigate to a Canvas course to view assignments');
            }

            // Update other UI elements
            updateButtonsBasedOnPage(currentUrl);
        });
    }

    function disableButtons() {
        if (assignmentsButton) assignmentsButton.disabled = true;
        if (goToAssignmentsBtn) goToAssignmentsBtn.disabled = true;
        if (inboxButton) inboxButton.disabled = true;
        if (goToInboxBtn) goToInboxBtn.disabled = true;
    }

    function updateButtonStates(isScrapingActive) {
        // Disable all action buttons during scraping
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

    function updateScrapingUI(type, isActive) {
        const button = document.querySelector(type === 'assignments' ? '#scrape-assignments' : '#scrape-recordings');
        if (isActive) {
            button.classList.add('scraping');
            button.textContent = type === 'assignments' ? 'Scraping Assignments...' : 'Scraping Recordings...';
            button.disabled = true;
        } else {
            button.classList.remove('scraping');
            button.textContent = type === 'assignments' ? 'Scrape Assignments' : 'Scrape Recordings';
            button.disabled = false;
        }
    }

    async function scrapeAssignments() {
        if (isScrapingActive) return;
        
        try {
            isScrapingActive = true;
            updateScrapingUI('assignments', true);
            showProgress('Scraping assignments...', 'Initializing...');

            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error('No active tab found');

            // Extract course ID from URL
            const courseId = extractCourseId(tab.url);
            if (!courseId) throw new Error('Please navigate to a Canvas course first');

            // Inject content script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['scripts/content_canvas.js']
            });

            // Send message to start scraping
            const response = await chrome.tabs.sendMessage(tab.id, { 
                action: 'scrapeAssignments',
                courseId: courseId
            });

            if (response.success) {
                showProgress('Scraping complete!', `Found ${response.assignments.length} assignments`, response.assignments.length, response.assignments.length);
                displayResults(response.assignments, 'assignments');
            } else {
                throw new Error(response.error || 'Failed to scrape assignments');
            }
        } catch (error) {
            showError(error.message);
        } finally {
            isScrapingActive = false;
            updateScrapingUI('assignments', false);
        }
    }

    async function scrapeRecordings() {
        if (isScrapingActive) return;
        
        try {
            isScrapingActive = true;
            updateScrapingUI('recordings', true);
            showProgress('Scraping recordings...', 'Initializing...');

            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error('No active tab found');

            // Extract course ID from URL
            const courseId = extractCourseId(tab.url);
            if (!courseId) throw new Error('Please navigate to a Canvas course first');

            // Inject content script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['scripts/content_canvas.js']
            });

            // Send message to start scraping
            const response = await chrome.tabs.sendMessage(tab.id, { 
                action: 'scrapeRecordings',
                courseId: courseId
            });

            if (response.success) {
                showProgress('Scraping complete!', `Found ${response.recordings.length} recordings`, response.recordings.length, response.recordings.length);
                displayResults(response.recordings, 'recordings');
            } else {
                throw new Error(response.error || 'Failed to scrape recordings');
            }
        } catch (error) {
            showError(error.message);
        } finally {
            isScrapingActive = false;
            updateScrapingUI('recordings', false);
        }
    }

    function displayResults(items, type, stats, wasCancelled = false) {
        if (!resultsContainer) return;

        // Hide stop button and loading spinner since scraping is complete
        if (stopButton) {
            stopButton.style.display = 'none';
            stopButton.disabled = true;
        }
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }

        resultsContainer.innerHTML = '';
        
        // Only show completion status if scraping wasn't cancelled
        if (!wasCancelled) {
            const statusDiv = document.createElement('div');
            statusDiv.className = 'completion-status';
            statusDiv.innerHTML = `
                <div class="status-header">
                    <i class="fas fa-check-circle"></i> Scraping Complete
                </div>
                <div class="status-details">
                    <p>Successfully extracted ${stats ? stats.successful : items.length} ${type}</p>
                </div>
            `;
            resultsContainer.appendChild(statusDiv);
        }
        
        if (items.length === 0) {
            resultsContainer.innerHTML += `<p class="no-results">No ${type} found</p>`;
            return;
        }

        items.forEach(item => {
            const element = document.createElement('div');
            element.className = type === 'assignments' ? 'assignment-item' : 'recording-item';
            
            if (type === 'assignments') {
                // Create a truncated description that can be expanded
                const truncatedDescription = item.description ? 
                    item.description.substring(0, 150) + (item.description.length > 150 ? '...' : '') : 
                    'No description available';

                element.innerHTML = `
                    <div class="item-title">${item.title}</div>
                    <div class="item-details">
                        <span>Due: ${item.dueDate || 'No due date'}</span>
                    </div>
                    <div class="item-description">
                        <p class="description-preview">${truncatedDescription}</p>
                        ${item.description && item.description.length > 150 ? 
                            `<button class="toggle-description">Show More</button>` : ''}
                        <div class="full-description" style="display: none;">
                            ${item.description || 'No description available'}
                        </div>
                    </div>
                    ${item.rubric && item.rubric.length > 0 ? `
                        <div class="rubric-section">
                            <button class="toggle-rubric">Show Rubric</button>
                            <div class="rubric-details" style="display: none;">
                                ${item.rubric.map(criterion => `
                                    <div class="rubric-criterion">
                                        <h4>${criterion.title || 'Untitled Criterion'}</h4>
                                        <p>${criterion.description || 'No description'}</p>
                                        ${criterion.points ? `<p>Points: ${criterion.points}</p>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    <div class="action-buttons">
                        <button class="primary-button" onclick="window.open('${item.url}', '_blank')">
                            <i class="fas fa-external-link-alt"></i> Open Assignment
                        </button>
                    </div>
                `;

                // Add event listeners for description toggle
                const toggleDescBtn = element.querySelector('.toggle-description');
                if (toggleDescBtn) {
                    toggleDescBtn.addEventListener('click', function() {
                        const preview = element.querySelector('.description-preview');
                        const full = element.querySelector('.full-description');
                        const isExpanded = full.style.display === 'block';
                        
                        preview.style.display = isExpanded ? 'block' : 'none';
                        full.style.display = isExpanded ? 'none' : 'block';
                        this.textContent = isExpanded ? 'Show More' : 'Show Less';
                    });
                }

                // Add event listeners for rubric toggle
                const toggleRubricBtn = element.querySelector('.toggle-rubric');
                if (toggleRubricBtn) {
                    toggleRubricBtn.addEventListener('click', function() {
                        const rubricDetails = element.querySelector('.rubric-details');
                        const isExpanded = rubricDetails.style.display === 'block';
                        
                        rubricDetails.style.display = isExpanded ? 'none' : 'block';
                        this.textContent = isExpanded ? 'Show Rubric' : 'Hide Rubric';
                    });
                }
            } else {
                element.innerHTML = `
                    <div class="item-title">${item.title}</div>
                    <div class="item-details">
                        <span><i class="fas fa-calendar"></i> ${item.date}</span>
                        <span><i class="fas fa-user"></i> ${item.host}</span>
                    </div>
                    <div class="action-buttons">
                        <button class="primary-button" onclick="window.open('${item.url}', '_blank')">
                            <i class="fas fa-play"></i> Watch Recording
                        </button>
                    </div>
                `;
            }
            
            resultsContainer.appendChild(element);
        });
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

    // Assignments button click handler
    if (assignmentsButton) {
        assignmentsButton.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
                const currentUrl = tab.url;
                
                if (!currentUrl.includes('instructure.com')) {
                    showError('Please navigate to Canvas first');
                    return;
                }

                const courseId = currentUrl.match(/\/courses\/(\d+)/)?.[1];
                if (!courseId) {
                    showError('Please navigate to a Canvas course first');
                    return;
                }
                
                if (currentUrl.includes('/assignments')) {
                    // On assignments page - start scraping
                    clearError();
                    setLoading(true, 'assignments');
                    showProgress('Scraping assignments...', 'Initializing...', 0, 0);

                    // Send message to background script to start scraping
                    try {
                        chrome.runtime.sendMessage({
                            sender: "popup",
                            receiver: "background",
                            destination: "content_canvas",
                            action: "scrape",
                            tab: tab,
                            webpage: "canvas"
                        });
                    } catch (error) {
                        setLoading(false, null);
                        showError('Error communicating with the page. Please refresh and try again.');
                        console.error('Message send error:', error);
                    }
                } else {
                    // Navigate to assignments page
                    navigateToAssignments(courseId);
                }
            } catch (error) {
                setLoading(false, null);
                showError(error.message);
            }
        });
    }

    // Inbox button click handler
    if (inboxButton) {
        inboxButton.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
                const currentUrl = tab.url;
                
                if (!currentUrl.includes('instructure.com')) {
                    showError('Please navigate to Canvas first');
                    return;
                }
                
                if (currentUrl.includes('/conversations')) {
                    // On inbox page - start scraping
                    clearError();
                    setLoading(true, 'recordings');
                    showProgress('Scraping recordings...', 'Initializing...', 0, 0);

                    // First inject the content script
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['scripts/recording-scraper.js']
                        });

                        // Then send the message to start scraping
                        chrome.tabs.sendMessage(tab.id, { 
                            action: 'scrapeRecordings'
                        }, response => {
                            if (chrome.runtime.lastError) {
                                console.error('Error:', chrome.runtime.lastError);
                                setLoading(false, null);
                                showError('Error communicating with the page. Please refresh and try again.');
                                return;
                            }

                            if (!response || !response.success) {
                                setLoading(false, null);
                                showError(response?.error || 'Failed to scrape recordings');
                                return;
                            }

                            // Show completion message in progress bar
                            showProgress(
                                'Scraping complete!',
                                `Successfully extracted ${response.stats.successful} of ${response.stats.total} recordings`,
                                response.stats.successful,
                                response.stats.total
                            );

                            // Display results with stats and hide loading UI
                            displayResults(response.recordings, 'recordings', response.stats, false);
                            setLoading(false, null);
                            
                            // Re-enable buttons
                            updateButtonStates(false);
                        });
                    } catch (error) {
                        console.error('Script injection error:', error);
                        setLoading(false, null);
                        showError('Failed to initialize recording scraper. Please refresh and try again.');
                    }
                } else {
                    // Navigate to inbox
                    chrome.tabs.update(tab.id, {
                        url: 'https://ufl.instructure.com/conversations'
                    });
                    window.close();
                }
            } catch (error) {
                setLoading(false, null);
                showError(error.message);
            }
        });
    }

    // Stop button click handler
    if (stopButton) {
        stopButton.addEventListener('click', async () => {
            if (!isScrapingActive) return;

            try {
                const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
                
                // Send cancel message to content script
                chrome.tabs.sendMessage(tab.id, { action: 'cancelScraping' });
                
                // Send cancel message to background script
                chrome.runtime.sendMessage({ action: 'cancelScraping' });
                
                // Reset UI state
                setLoading(false, null);
                showError('Scraping cancelled');
                
                // Clear results container without showing completion status
                if (resultsContainer) {
                    resultsContainer.innerHTML = '';
                }
                
                // Clear any stored scraping state
                chrome.storage.local.remove('scrapingState');
            } catch (error) {
                console.error('Error cancelling scraping:', error);
            }
        });
    }

    // Add a general tab update listener to keep UI in sync
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0].id === tabId && changeInfo.status === 'complete') {
                checkCurrentPage();
            }
        });
    });

    // Check current page when popup opens
    checkCurrentPage();

    // Add URL hash change listener to detect course selection in inbox
    window.addEventListener('hashchange', checkCurrentPage);

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
}); 