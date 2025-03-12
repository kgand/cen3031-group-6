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
        console.log('Extracting course ID from URL:', url);
        
        // More specific regex to extract course ID from Canvas URLs
        // This handles URLs like:
        // - https://ufl.instructure.com/courses/12345
        // - https://ufl.instructure.com/courses/12345/assignments
        // - https://ufl.instructure.com/courses/12345/modules
        // - https://ufl.instructure.com/courses/12345/assignments/67890
        const match = url.match(/\/courses\/(\d+)(?:\/|$)/);
        
        if (match && match[1]) {
            console.log('Found course ID:', match[1]);
            return match[1];
        }
        
        console.log('No course ID found in URL');
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
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error('No active tab found');

            // Check if we're on Canvas
            if (!tab.url.includes('ufl.instructure.com')) {
                throw new Error('Please navigate to Canvas first');
            }

            // Extract course ID from URL
            const courseId = getCourseId(tab.url);
            if (!courseId) {
                console.error('Failed to extract course ID from URL:', tab.url);
                throw new Error('Please navigate to a Canvas course page');
            }

            // Now we can proceed with scraping
            isScrapingActive = true;
            currentScrapingType = 'assignments';
            updateButtonStates(true);
            setLoading(true, 'assignments');
            showProgress('Scraping assignments...', 'Initializing...');

            // Save scraping state
            chrome.storage.local.set({
                scrapingState: {
                    isActive: true,
                    type: 'assignments',
                    courseId: courseId
                }
            });

            // Inject content script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['scripts/content_canvas.js']
            });

            // Send message to start scraping
            chrome.tabs.sendMessage(tab.id, { 
                action: 'scrape',
                data: { type: 'assignments', courseId: courseId }
            }, response => {
                if (chrome.runtime.lastError) {
                    console.error('Error:', chrome.runtime.lastError);
                    resetScrapingState();
                    showError('Error communicating with the page. Please refresh and try again.');
                    return;
                }

                // Process will continue via content script messages
            });
        } catch (error) {
            console.error('Scraping error:', error);
            resetScrapingState();
            showError(error.message || 'An unknown error occurred');
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
        function getCourseName(item) {
            if (item.course && item.course !== 'Unknown Course') {
                return item.course;
            }
            
            // Try to extract course name from URL path parts
            if (item.url) {
                const urlObj = new URL(item.url);
                const pathParts = urlObj.pathname.split('/');
                const courseIdx = pathParts.indexOf('courses');
                if (courseIdx !== -1 && courseIdx + 1 < pathParts.length) {
                    return `Course ${pathParts[courseIdx + 1]}`;
                }
            }
            
            return 'Unknown Course';
        }
        
        // Group items by course
        const groupedItems = {};
        items.forEach(item => {
            // Ensure course name is always defined
            const courseName = getCourseName(item);
            
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
            const courseId = getCourseIdFromUrl(courseItems[0].url) || 'unknown';
            
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
                        <div class="item-checkbox-container">
                            <input type="checkbox" class="item-checkbox" 
                                   data-item-id="${item.id}"
                                   data-course-id="${courseName}"
                                   id="checkbox-${item.id}" checked>
                            <label for="checkbox-${item.id}" class="checkbox-label"></label>
                        </div>
                        <div class="item-content">
                            <div class="item-header">
                                <h4 class="item-title">
                                    <a href="${item.url}" target="_blank">${item.title}</a>
                                </h4>
                                <span class="due-date">${item.dueDate || 'No due date'}</span>
                    </div>
                    <div class="item-description">
                                ${item.description ? `<p>${item.description.substring(0, 150)}${item.description.length > 150 ? '...' : ''}</p>` : ''}
                    </div>
                    ${item.rubric && item.rubric.length > 0 ? `
                                <div class="rubric-preview">
                                    <div class="rubric-toggle">
                                        <i class="fas fa-list"></i> Rubric (${item.rubric.length} criteria)
                            </div>
                        </div>
                    ` : ''}
                    </div>
                `;

                    // Add event listener to checkbox
                    const checkbox = itemElement.querySelector('.item-checkbox');
                    checkbox.addEventListener('change', function() {
                        const itemId = this.getAttribute('data-item-id');
                        const courseId = this.getAttribute('data-course-id');
                        
                        // Find the item and update it
                        const courseItems = groupedItems[courseId];
                        if (courseItems) {
                            const item = courseItems.find(i => i.id === itemId);
                            if (item) {
                                item.selected = this.checked;
                            }
                        }
                        
                        // Check if all items are selected or not
                        const allCheckboxes = document.querySelectorAll('.item-checkbox');
                        const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
                        const selectAllCb = document.getElementById('selectAll');
                        if (selectAllCb) {
                            selectAllCb.checked = allChecked;
                        }
                    });
                } else if (type === 'recordings') {
                    // Existing recording item display code
                    // ... (keep existing code for recordings)
                }
                
                itemsList.appendChild(itemElement);
            });
            
            courseSection.appendChild(itemsList);
            resultsContainer.appendChild(courseSection);
        });
        
        // Add submit button for assignments
        if (type === 'assignments' && items.length > 0) {
            const submitButtonContainer = document.createElement('div');
            submitButtonContainer.className = 'submit-container';
            
            const submitButton = document.createElement('button');
            submitButton.className = 'action-button submit-button';
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
                    let courseId = getCourseIdFromUrl(firstItem.url);
                    
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
                    
                    // Prepare data for submission
                    const assignmentsData = selectedItems.map(item => ({
                        title: item.title,
                        url: item.url,
                        dueDate: item.dueDate || null,
                        description: item.description || null,
                        rubric: item.rubric || null,
                        assignmentGroup: item.assignmentGroup || "Uncategorized",
                        points: item.points || 0,  // Ensure points is never null
                        status: item.status || "Not Started",  // Ensure status is never null
                        courseId: courseId
                    }));
                    
                    // Send to backend
                    console.log('ApiUtils:', Object.keys(ApiUtils));
                    console.log('CONFIG:', CONFIG);
                    
                    const apiUrl = CONFIG.API_BASE_URL;
                    console.log('Using API URL:', apiUrl);
                    
                    // Prepare the submission endpoint
                    const endpoint = `/assignments/store`;
                    const fullUrl = `${apiUrl}${endpoint}`;
                    
                    // Prepare the submission payload with batch ID
                    const payload = {
                        courseId: courseId,
                        assignments: assignmentsData,
                        upload_batch_id: upload_batch_id
                    };
                    
                    console.log('Submitting to endpoint:', fullUrl);
                    console.log('Payload:', {
                        courseId: courseId,
                        assignments: assignmentsData.length,
                        upload_batch_id: upload_batch_id
                    });
                    
                    const response = await fetch(fullUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${tokenResult}`
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    console.log('Response status:', response.status);
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || 'Failed to submit assignments');
                    }
                    
                    const result = await response.json();
                    
                    // Show success message with batch ID for reference
                    submitButton.innerHTML = '<i class="fas fa-check"></i> Submitted Successfully';
                    submitButton.classList.add('submit-success');
                    
                    // Add success message with batch info
                    const successMessage = document.createElement('div');
                    successMessage.className = 'success-message';
                    successMessage.innerHTML = `
                        <i class="fas fa-check-circle"></i>
                        ${result.message || 'Assignments submitted successfully'}
                        <span class="batch-id" title="Click to copy batch ID">(Batch ID: ${result.upload_batch_id || upload_batch_id})</span>
                    `;
                    submitButtonContainer.appendChild(successMessage);
                    
                    // Add click handler to copy batch ID when clicked
                    const batchIdElement = successMessage.querySelector('.batch-id');
                    if (batchIdElement) {
                        batchIdElement.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const batchId = result.upload_batch_id || upload_batch_id;
                            try {
                                await navigator.clipboard.writeText(batchId);
                                const originalText = batchIdElement.innerHTML;
                                batchIdElement.innerHTML = '(Copied!)';
                                
                                // Store batch information in local storage
                                chrome.storage.local.get(['uploadBatches'], (result) => {
                                    const batches = result.uploadBatches || [];
                                    // Check if batch already exists
                                    const existingBatchIndex = batches.findIndex(b => b.id === batchId);
                                    if (existingBatchIndex === -1) {
                                        batches.push({
                                            id: batchId,
                                            type: 'assignments',
                                            count: assignmentsData.length,
                                            timestamp: Date.now(),
                                            courseId: courseId
                                        });
                                        chrome.storage.local.set({ uploadBatches: batches });
                                    }
                                });
                                
                                setTimeout(() => {
                                    batchIdElement.innerHTML = originalText;
                                }, 1500);
                            } catch (error) {
                                console.error('Failed to copy batch ID:', error);
                            }
                        });
                    }
                    
                    // Schedule removal of success message
                    setTimeout(() => {
                        successMessage.style.opacity = '0';
                        setTimeout(() => {
                            successMessage.remove();
                            submitButton.disabled = false;
                            submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Selected Assignments';
                            submitButton.classList.remove('submit-success');
                        }, 500);
                    }, 3000);
                    
                } catch (error) {
                    console.error('Submission error:', error);
                    showError(error.message || 'Failed to submit assignments');
                    submitButton.disabled = false;
                    submitButton.innerHTML = '<i class="fas fa-upload"></i> Submit Selected Assignments';
                }
            });
            
            submitButtonContainer.appendChild(submitButton);
            resultsContainer.appendChild(submitButtonContainer);
        }
        
        // Show results container
        resultsContainer.style.display = 'block';
        
        // Hide loading indicators
        setLoading(false);
    }

    // Helper function to extract course ID from URL
    function getCourseIdFromUrl(url) {
        if (!url) return null;
        const match = url.match(/\/courses\/(\d+)/);
        return match ? match[1] : null;
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
                const courseId = getCourseId(url);
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
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'cancelScraping' });
                    resetScrapingState();
                    showMessage('Scraping cancelled', 'info');
                }
            });
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
}); 