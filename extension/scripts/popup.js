// Debug variables
console.log('Popup script starting...');

// Initialize UI state
const UIState = {
	INITIAL: 'initial',
	NOT_CANVAS: 'not_canvas',
	NOT_COURSE: 'not_course',
	NOT_ASSIGNMENTS: 'not_assignments',
	READY: 'ready',
	SCRAPING: 'scraping',
	COMPLETE: 'complete',
	ERROR: 'error'
};

// Store scraping state for courses
const courseState = {};

// Add safety check for recordingState at the beginning of the file
let recordingState = {};

// Ensure recordingState exists
if (typeof recordingState === 'undefined') {
    recordingState = {};
}

// Initialize elements when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
	initializeElements();
	setupEventListeners();
	
	console.log('Popup opened, initializing UI...');
	
	// Check if we're on the Canvas inbox page first
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		if (tabs && tabs.length > 0 && tabs[0].url.includes('/conversations')) {
			console.log('On Canvas Inbox page, initializing recordings UI');
			
			// First check if there's an active scraping process
			getCurrentCourseId().then(courseId => {
				if (courseId) {
					// Immediately check scraping status when popup opens
					// This will ensure we detect if scraping is still active when returning to tab
					checkScrapingStatus(courseId);
				}
				
				// Then initialize UI
				initializeRecordingsUI();
			});
		} else {
			// For other pages, just initialize the recordings UI
			initializeRecordingsUI();
		}
	});
});

function initializeElements() {
	elements = {
		goToAssignmentsBtn: document.getElementById('go-to-assignments'),
		goToInboxBtn: document.getElementById('go-to-inbox'),
		scrapeButton: document.getElementById('scrape-button'),
		scrapeRecordingsButton: document.getElementById('scrape-recordings-button'),
		statusContainer: document.getElementById('status-container'),
		statusMessage: document.getElementById('status-message'),
		successIcon: document.getElementById('success-icon'),
		errorIcon: document.getElementById('error-icon'),
		loadingIcon: document.getElementById('loading-icon'),
		progressContainer: document.getElementById('progress-container'),
		progressMessage: document.getElementById('progress-message'),
		progressDetail: document.getElementById('progress-detail'),
		progressBarFill: document.getElementById('progress-bar-fill'),
		resultsContainer: document.getElementById('results-container'),
		assignmentsList: document.getElementById('assignments-list'),
		recordingsList: document.getElementById('recordings-list')
	};
}

function setupEventListeners() {
	// Assignments button click handler
	if (elements.goToAssignmentsBtn) {
		elements.goToAssignmentsBtn.addEventListener('click', async () => {
			try {
				const tabs = await chrome.tabs.query({active: true, currentWindow: true});
				const currentUrl = tabs[0].url;
				const courseId = getCourseIdFromUrl(currentUrl);
				
				if (!courseId) {
					showMessage('Please navigate to a Canvas course first', 'error');
					return;
				}

				// Navigate to assignments page
				await chrome.tabs.update(tabs[0].id, {
					url: `https://ufl.instructure.com/courses/${courseId}/assignments`
				});

				// Wait for navigation to complete
				chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
					if (tabId === tabs[0].id && info.status === 'complete') {
						chrome.tabs.onUpdated.removeListener(listener);
						// Initialize assignment scraping
						chrome.tabs.sendMessage(tabs[0].id, { action: 'initAssignments' });
					}
				});

				window.close();
			} catch (error) {
				showMessage('Error navigating to assignments: ' + error.message, 'error');
			}
		});
	}

	// Inbox button click handler
	if (elements.goToInboxBtn) {
		elements.goToInboxBtn.addEventListener('click', async () => {
			try {
				const tabs = await chrome.tabs.query({active: true, currentWindow: true});
				
				// Navigate to inbox
				await chrome.tabs.update(tabs[0].id, {
					url: 'https://ufl.instructure.com/conversations#filter=type=inbox'
				});

				// Wait for navigation to complete
				chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
					if (tabId === tabs[0].id && info.status === 'complete') {
						chrome.tabs.onUpdated.removeListener(listener);
						// Initialize recordings functionality
						chrome.tabs.sendMessage(tabs[0].id, { action: 'initRecordings' });
					}
				});

				window.close();
			} catch (error) {
				showMessage('Error navigating to inbox: ' + error.message, 'error');
			}
		});
	}

	// Scrape assignments button click handler
	if (elements.scrapeButton) {
		elements.scrapeButton.addEventListener('click', async () => {
			try {
				const tabs = await chrome.tabs.query({active: true, currentWindow: true});
				const currentUrl = tabs[0].url;
				
				if (!currentUrl.includes('/assignments')) {
					showMessage('Please navigate to the assignments page first', 'error');
					return;
				}

				showMessage('Collecting assignments...', 'loading');
				chrome.tabs.sendMessage(tabs[0].id, { 
					action: 'scrapeAssignments',
					courseId: getCourseIdFromUrl(currentUrl)
				});
			} catch (error) {
				showMessage('Error collecting assignments: ' + error.message, 'error');
			}
		});
	}

	// Scrape recordings button click handler
	if (elements.scrapeRecordingsButton) {
		elements.scrapeRecordingsButton.addEventListener('click', async () => {
			try {
				const tabs = await chrome.tabs.query({active: true, currentWindow: true});
				const currentUrl = tabs[0].url;
				
				if (!currentUrl.includes('/conversations')) {
					showMessage('Please navigate to the inbox first', 'error');
					return;
				}

				showMessage('Collecting recordings...', 'loading');
				chrome.tabs.sendMessage(tabs[0].id, { 
					action: 'scrapeRecordings',
					courseId: getCourseIdFromUrl(currentUrl)
				});
			} catch (error) {
				showMessage('Error collecting recordings: ' + error.message, 'error');
			}
		});
	}

	// Add event listener for upload recordings button
	const uploadRecordingsButton = document.getElementById('upload-recordings-button');
	if (uploadRecordingsButton) {
		uploadRecordingsButton.addEventListener('click', uploadSelectedRecordings);
	}
}

// Helper function to show status messages
function showMessage(message, type = 'info') {
	if (!elements.statusContainer || !elements.statusMessage) return;

	// Hide all icons
	[elements.successIcon, elements.errorIcon, elements.loadingIcon].forEach(icon => {
		if (icon) icon.style.display = 'none';
	});

	elements.statusMessage.textContent = message;

	// Show appropriate icon
	switch (type) {
		case 'success':
			if (elements.successIcon) elements.successIcon.style.display = 'block';
			break;
		case 'error':
			if (elements.errorIcon) elements.errorIcon.style.display = 'block';
			break;
		case 'loading':
			if (elements.loadingIcon) elements.loadingIcon.style.display = 'block';
			break;
	}

	elements.statusContainer.style.display = 'block';
}

// Helper function to get course ID from URL
function getCourseIdFromUrl(url) {
	const courseMatch = url.match(/\/courses\/(\d+)/);
	if (courseMatch) return courseMatch[1];
	
	const inboxMatch = url.match(/course=course_(\d+)/);
	if (inboxMatch) return inboxMatch[1];
	
	return null;
}

// Message listener for updates from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log('Popup received message:', request);
	
	switch (request.action) {
		case 'updateProgress':
			const { current, total, currentTitle, groupName } = request.data;
			showProgress(current, total, currentTitle, groupName);
			break;
		
		case 'assignmentsComplete':
			if (request.data && request.data.assignments) {
				displayAssignments(request.data.assignments);
				showMessage('Successfully collected assignments', 'success');
			}
			break;
		
		case 'recordingsComplete':
			if (request.data && request.data.recordings) {
				displayRecordings(request.data.recordings);
				showMessage('Successfully collected recordings', 'success');
			}
			break;
		
		case 'error':
			showMessage(request.error, 'error');
			break;
	}
	
	return true;
});

// Helper function to show progress
function showProgress(current, total, currentTitle, groupName = '') {
	if (!elements.progressContainer) return;
	
	elements.progressContainer.style.display = 'block';
	
	if (elements.progressMessage) {
		elements.progressMessage.textContent = `Processing ${currentTitle}`;
	}
	
	if (elements.progressDetail && groupName) {
		elements.progressDetail.textContent = `Group: ${groupName}`;
	}
	
	if (elements.progressBarFill && total > 0) {
		const percent = Math.round((current / total) * 100);
		elements.progressBarFill.style.width = `${percent}%`;
	}
}

// Helper function to get course ID from URL
function getCourseIdFromUrl(url) {
	const courseMatch = url.match(/\/courses\/(\d+)/);
	if (courseMatch) return courseMatch[1];
	
	const inboxMatch = url.match(/course=course_(\d+)/);
	if (inboxMatch) return inboxMatch[1];
	
	return null;
}

// Helper function to show status messages
function showMessage(message, type = 'info') {
	const statusContainer = document.getElementById('status-container');
	const statusMessage = document.getElementById('status-message');
	const successIcon = document.getElementById('success-icon');
	const errorIcon = document.getElementById('error-icon');
	const loadingIcon = document.getElementById('loading-icon');

	if (!statusContainer || !statusMessage) return;

	// Hide all icons
	[successIcon, errorIcon, loadingIcon].forEach(icon => {
		if (icon) icon.style.display = 'none';
	});

	statusMessage.textContent = message;

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

	statusContainer.style.display = 'block';
}

// Helper function to get course ID from URL
function getCourseIdFromUrl(url) {
	const courseMatch = url.match(/\/courses\/(\d+)/);
	if (courseMatch) return courseMatch[1];
	
	const inboxMatch = url.match(/course=course_(\d+)/);
	if (inboxMatch) return inboxMatch[1];
	
	return null;
}

// Initialize elements as null
let elements = {
	statusContainer: null,
	statusMessage: null,
	successIcon: null,
	errorIcon: null,
	loadingIcon: null,
	navigationContainer: null,
	goToCanvas: null,
	goToAssignments: null,
	actionContainer: null,
	scrapeButton: null,
	progressContainer: null,
	progressMessage: null,
	progressDetail: null,
	progressNumbers: null,
	progressBarFill: null,
	resultsContainer: null,
	assignmentsList: null,
	helpLink: null,
	waiting: null,
	fileList: null,
	downloadContainer: null,
	footer: null,
	pText: null,
	p2Text: null,
	scrapeFiles: null,
	scrapeAssignments: null,
	selectAll: null,
	deselectAll: null,
	startProcess: null,
	fileItems: null,
	errorMessage: null
};

// Function to initialize elements
function initializeElements() {
	elements = {
		statusContainer: document.getElementById('status-container'),
		statusMessage: document.querySelector('.status-message'),
		successIcon: document.querySelector('.success-icon'),
		errorIcon: document.querySelector('.error-icon'),
		loadingIcon: document.querySelector('.loading-icon'),
		navigationContainer: document.getElementById('navigation-container'),
		goToCanvas: document.getElementById('goToCanvas'),
		goToAssignments: document.getElementById('goToAssignments'),
		actionContainer: document.getElementById('action-container'),
		scrapeButton: document.getElementById('scrapeButton'),
		progressContainer: document.getElementById('progress-container'),
		progressMessage: document.querySelector('.progress-message'),
		progressDetail: document.querySelector('.progress-detail'),
		progressNumbers: document.querySelector('.progress-numbers'),
		progressBarFill: document.querySelector('.progress-bar-fill'),
		resultsContainer: document.getElementById('results-container'),
		assignmentsList: document.getElementById('assignments-list'),
		helpLink: document.getElementById('help-link'),
		waiting: document.getElementById('waiting'),
		fileList: document.getElementById('file-list'),
		downloadContainer: document.getElementById('download-container'),
		footer: document.querySelector('.footer'),
		pText: document.getElementById('pText'),
		p2Text: document.getElementById('p2Text'),
		scrapeFiles: document.getElementById('scrapeFiles'),
		scrapeAssignments: document.getElementById('scrapeAssignments'),
		selectAll: document.getElementById('selectAll'),
		deselectAll: document.getElementById('deselectAll'),
		startProcess: document.getElementById('startProcess'),
		fileItems: document.querySelector('.file-items'),
		errorMessage: document.getElementById('error-message')
	};

	console.log('Elements initialized:', elements);
}

// Helper function to safely update element style
function setElementDisplay(element, display) {
	if (element && element.style) {
		element.style.display = display;
	}
}

// Helper function to safely update element text content
function setElementText(element, text) {
	if (element) {
		element.textContent = text;
	}
}

// Update UI state function with null checks
function updateUIState(state, message = '') {
	console.log('Updating UI state:', state, message);
	
	// Reset all states with null checks
	setElementDisplay(elements.successIcon, 'none');
	setElementDisplay(elements.errorIcon, 'none');
	setElementDisplay(elements.loadingIcon, 'none');
	setElementDisplay(elements.navigationContainer, 'none');
	setElementDisplay(elements.actionContainer, 'none');
	setElementDisplay(elements.progressContainer, 'none');
	setElementDisplay(elements.resultsContainer, 'none');

	// Hide initial messages
	if (elements.pText) {
		elements.pText.textContent = '';
	}
	if (elements.p2Text) {
		elements.p2Text.textContent = '';
	}

	setElementText(elements.statusMessage, message);

	switch (state) {
		case UIState.INITIAL:
			setElementDisplay(elements.loadingIcon, 'block');
			setElementText(elements.statusMessage, 'Checking page...');
			break;

		case UIState.NOT_CANVAS:
			setElementDisplay(elements.errorIcon, 'block');
			setElementDisplay(elements.navigationContainer, 'flex');
			setElementDisplay(elements.goToAssignments, 'none');
			break;

		case UIState.NOT_COURSE:
			setElementDisplay(elements.errorIcon, 'block');
			setElementDisplay(elements.navigationContainer, 'flex');
			setElementDisplay(elements.goToAssignments, 'none');
			break;

		case UIState.NOT_ASSIGNMENTS:
			setElementDisplay(elements.errorIcon, 'block');
			setElementDisplay(elements.navigationContainer, 'flex');
			setElementDisplay(elements.goToCanvas, 'none');
			break;

		case UIState.READY:
			setElementDisplay(elements.successIcon, 'block');
			setElementDisplay(elements.actionContainer, 'block');
			if (elements.pText) {
				elements.pText.textContent = 'What would you like to do?';
			}
			break;

		case UIState.SCRAPING:
			setElementDisplay(elements.loadingIcon, 'block');
			setElementDisplay(elements.progressContainer, 'block');
			break;

		case UIState.COMPLETE:
			setElementDisplay(elements.successIcon, 'block');
			setElementDisplay(elements.resultsContainer, 'block');
			break;

		case UIState.ERROR:
			setElementDisplay(elements.errorIcon, 'block');
			setElementDisplay(elements.actionContainer, 'block');
			if (elements.scrapeButton) {
				elements.scrapeButton.disabled = false;
			}
			break;
	}
}

var currentTab;
var global_button_links;
var webpage;
var singleLink;
var modules;
let files = [];
let assignments = [];

console.log('Variables initialized');

// Global helper functions
function clearError() {
	console.log('Clearing any existing errors');
	if (elements.errorIcon) {
		elements.errorIcon.style.display = 'none';
	}
}

function setLoading(isLoading) {
    try {
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingSpinner = document.getElementById('loading-spinner');
        
        // Safely set display style on elements if they exist
        if (loadingOverlay && loadingOverlay.style) {
            loadingOverlay.style.display = isLoading ? 'flex' : 'none';
        }
        
        if (loadingSpinner && loadingSpinner.style) {
            loadingSpinner.style.display = isLoading ? 'block' : 'none';
        }
        
        // Enable/disable buttons safely
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            if (button) {
                button.disabled = isLoading;
            }
        });
    } catch (error) {
        console.error('Error setting loading state:', error);
	}
}

function showError(title, message) {
	console.log('Showing error:', title, message);
	if (elements.waiting) elements.waiting.style.display = 'none';
	if (elements.progressContainer) elements.progressContainer.style.display = 'none';
	if (elements.pText) elements.pText.innerHTML = `<span class="error-title">${title}</span>`;
	if (elements.errorIcon) {
		elements.errorIcon.style.display = 'block';
	}
	if (elements.errorMessage) {
		elements.errorMessage.textContent = message;
		elements.errorMessage.style.display = 'block';
	}
	if (elements.p2Text) {
		elements.p2Text.innerHTML = `
			<div class="error-message">
				<span class="error-icon">⚠️</span> ${message}
				<div class="mt-2 small">
					<ul class="text-left pl-4 mb-0">
						<li>Check if you're on the Assignments page in Canvas</li>
						<li>Make sure you're logged into Canvas</li>
						<li>Try refreshing the page</li>
					</ul>
				</div>
			</div>`;
	}
	if (elements.startProcess) elements.startProcess.style.display = 'none';
	if (elements.notSupported) elements.notSupported.style.display = 'block';
	
	// Add retry button
	if (elements.downloadContainer) {
		elements.downloadContainer.innerHTML = `
			<div class="text-center mt-3">
				<button class="retry-button btn btn-outline-primary btn-sm">
					<i class="fas fa-sync-alt"></i> Try Again
				</button>
			</div>`;
		
		const retryButton = document.querySelector('.retry-button');
		if (retryButton) {
			retryButton.addEventListener('click', function() {
				location.reload();
			});
		}
	}
}

// TODO: Protect against load/reload
//https://stackoverflow.com/questions/23895377/sending-message-from-a-background-script-to-a-content-script-then-to-a-injected/23895822#23895822

function startProcess() {
	console.log('startProcess function called');
	console.log("Sending request to background");
	var msg = {
		sender: "popup",
		receiver: "background",
		destination: "content_".concat(webpage),
		action: "scrape",
		tab: currentTab
	};

	chrome.runtime.sendMessage(msg, function(response) {
		console.log("Response received:", response);
		if (response) {
			console.log(response.received_by.concat(" heard me."));
		}
	});
}

// Debug DOM loading
document.addEventListener('DOMContentLoaded', function() {
	console.log('DOM Content Loaded');
	
	// Get DOM elements
	const elements = {
		scrapeButton: document.getElementById('scrapeButton'),
		loadingIcon: document.querySelector('.loading-icon'),
		assignmentsList: document.getElementById('assignments-list'),
		errorMessage: document.getElementById('error-message'),
		progressContainer: document.getElementById('progress-container'),
		progressMessage: document.querySelector('.progress-message'),
		waiting: document.getElementById('waiting'),
		fileList: document.getElementById('file-list'),
		downloadContainer: document.getElementById('download-container'),
		footer: document.querySelector('.footer'),
		pText: document.getElementById('pText'),
		p2Text: document.getElementById('p2Text'),
		scrapeFiles: document.getElementById('scrapeFiles'),
		scrapeAssignments: document.getElementById('scrapeAssignments'),
		selectAll: document.getElementById('selectAll'),
		deselectAll: document.getElementById('deselectAll'),
		startProcess: document.getElementById('startProcess')
	};

	// Log all elements
	console.log('Found elements:', elements);

	// Initialize UI - hide elements
	if (elements.waiting) elements.waiting.style.display = 'none';
	if (elements.progressContainer) elements.progressContainer.style.display = 'none';
	if (elements.footer) elements.footer.style.display = 'none';
	if (elements.fileList) elements.fileList.style.display = 'none';
	if (elements.downloadContainer) elements.downloadContainer.style.display = 'none';

	// Show scraping options by default
	if (elements.scrapeButton) {
		elements.scrapeButton.style.display = 'block';
	}

	// Setup truncation
	String.prototype.trunc = String.prototype.trunc ||
		function(n){
			return (this.length > n) ? this.substr(0, n-1) + '&hellip;' : this;
		};

	// Check current tab
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		currentTab = tabs[0];
		const tab_url = currentTab.url;
		
		if (tab_url.includes('ufl.instructure.com')) {
			// Extract course ID
			const courseId = getCourseIdFromUrl(tab_url);
			if (courseId) {
				// Show scraping options
				if (elements.pText) elements.pText.innerHTML = "What would you like to do?";
				if (elements.p2Text) elements.p2Text.innerHTML = "";
				if (elements.scrapeButton) elements.scrapeButton.style.display = 'block';
			} else {
				showError("Not in a course", "Please navigate to a Canvas course first");
			}
		} else {
			showError("Invalid page", "Please navigate to UF Canvas first");
			if (elements.notSupported) elements.notSupported.style.display = 'block';
		}
	});

	// Show footer after a delay
	setTimeout(() => {
		if (elements.footer) elements.footer.style.display = 'block';
	}, 1000);

	// Add event listeners if elements exist
	if (elements.scrapeFiles) {
		elements.scrapeFiles.addEventListener('click', function() {
			if (elements.scrapeButton) elements.scrapeButton.style.display = 'none';
			if (elements.progressContainer) elements.progressContainer.style.display = 'block';
			showProgress("Navigating to Files page...", 0, 0, "Files");
			initiateFileScraping();
		});
	}

	if (elements.scrapeAssignments) {
		elements.scrapeAssignments.addEventListener('click', function() {
			if (elements.scrapeButton) elements.scrapeButton.style.display = 'none';
			if (elements.progressContainer) elements.progressContainer.style.display = 'block';
			showProgress("Navigating to Assignments page...", 0, 0, "Assignments");
			initiateAssignmentScraping();
		});
	}

	if (elements.selectAll) {
		elements.selectAll.addEventListener('click', function() {
			const checkboxes = document.querySelectorAll('.file-items input[type="checkbox"]');
			checkboxes.forEach(checkbox => checkbox.checked = true);
			updateDownloadButton();
		});
	}

	if (elements.deselectAll) {
		elements.deselectAll.addEventListener('click', function() {
			const checkboxes = document.querySelectorAll('.file-items input[type="checkbox"]');
			checkboxes.forEach(checkbox => checkbox.checked = false);
			updateDownloadButton();
		});
	}

	if (elements.startProcess) {
		elements.startProcess.addEventListener('click', function() {
			const selectedFiles = [];
			const checkboxes = document.querySelectorAll('.file-items input[type="checkbox"]:checked');
			checkboxes.forEach(checkbox => {
				const fileId = checkbox.value;
				const fileData = files.find(f => f.id === fileId);
				if (fileData) {
					selectedFiles.push(fileData);
				}
			});
			
			if (selectedFiles.length > 0) {
				showProgress("Downloading selected files...", 0, selectedFiles.length, "Download");
				chrome.tabs.sendMessage(currentTab.id, {
					action: "downloadFiles",
					files: selectedFiles,
					outputDir: "canvas_downloads"
				}, response => {
					if (response.status === 'complete') {
						const successCount = response.downloadedFiles.length;
						const failureCount = response.failedFiles.length;
						
						let message = `Successfully downloaded ${successCount} file${successCount !== 1 ? 's' : ''}`;
						if (failureCount > 0) {
							message += `. ${failureCount} file${failureCount !== 1 ? 's' : ''} failed to download.`;
						}
						
						if (elements.p2Text) {
							elements.p2Text.innerHTML = `
								<div class="success-message">
									<i class="fas fa-check-circle"></i> ${message}
								</div>
							`;
						}
					} else {
						showError("Download Error", response.error);
					}
					if (elements.progressContainer) {
						elements.progressContainer.style.display = 'none';
					}
				});
			}
		});
	}

	// Add click handler for scrape button
	if (elements.scrapeButton) {
		elements.scrapeButton.addEventListener('click', function() {
			clearError();
			setLoading(true);
			if (elements.progressMessage) {
				elements.progressMessage.textContent = 'Scanning assignments...';
			}

			// First check if we're on a Canvas page
			chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
				const currentUrl = tabs[0].url;
				
				if (!currentUrl.includes('instructure.com')) {
					setLoading(false);
					showError('Invalid Page', 'Please navigate to a Canvas page first');
					return;
				}

				if (!currentUrl.includes('/assignments')) {
					setLoading(false);
					showError('Wrong Page', 'Please navigate to the Assignments page in Canvas');
					return;
				}

				// Proceed with scraping
				chrome.runtime.sendMessage({ action: 'scrapeAssignments' }, response => {
					setLoading(false);

					if (chrome.runtime.lastError) {
						showError(
							'Communication Error',
							'Could not communicate with the extension. Please make sure you are on a Canvas assignments page.'
						);
						return;
					}

					if (!response) {
						showError(
							'No Response',
							'No response received from the extension. Please refresh the page and try again.'
						);
						return;
					}

					if (response.status === 'error') {
						showError('Error', response.error || 'An unexpected error occurred');
						return;
					}

					if (response.status === 'complete') {
						if (!response.assignments || response.assignments.length === 0) {
							showError(
								'No Assignments Found',
								'No assignments were found on this page. Make sure you are on a Canvas assignments page with visible assignments.'
							);
							return;
						}
						displayAssignments(response.assignments);
					}
				});
			});
		});
	}
});

function ask_for_status(tab_id){
	var msg = {
		sender: "popup",
		receiver: "background",
		destination: "background",
		action: "check_status",
		tab: currentTab
	};
	chrome.runtime.sendMessage(msg);
}

function indicate_start(tab_id, tab_url) {
	console.log("Checking page:", tab_url);
	
	if (tab_url.includes('ufl.instructure.com')) {
		const courseId = getCourseIdFromUrl(tab_url);
		if (courseId) {
			if (tab_url.includes('/modules') || tab_url.includes('/files')) {
				// On a valid page - ready to download
				ask_for_status(tab_id);
				webpage = "canvas";
				if (elements.startProcess) elements.startProcess.value = "Download Files";
				if (elements.startProcess) elements.startProcess.classList.add("pulse-animation");
				if (elements.pText) elements.pText.innerHTML = "Ready to download! <span class='gator-emoji'>🐊</span>";
				if (elements.p2Text) elements.p2Text.innerHTML = "Click the button to start downloading files";
			} else {
				// On Canvas course but not on modules/files page
				showError(
					"Wrong Page",
					"Please navigate to the Files or Modules page in your Canvas course"
				);
			}
		} else {
			// On Canvas but not in a course
			showError(
				"Not in a Course",
				"Please navigate to a Canvas course first"
			);
		}
	} else {
		// Not on Canvas
		showError(
			"Invalid Page",
			"Please navigate to UF Canvas first (ufl.instructure.com)"
		);
	}
}

function make_popup_busy(){
    try {
        const loadingSpinner = document.getElementById('loading-overlay');
        if (loadingSpinner && loadingSpinner.style) {
            loadingSpinner.style.display = 'flex';
        }
        
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            if (button) {
                button.disabled = true;
            }
        });
        
        const previousBtns = document.querySelectorAll('.previous_btn');
        previousBtns.forEach(btn => {
            if (btn && btn.style) {
                btn.style.display = 'none';
            }
        });
        
        const nextBtns = document.querySelectorAll('.next_btn');
        nextBtns.forEach(btn => {
            if (btn && btn.style) {
                btn.style.display = 'none';
            }
        });
    } catch (error) {
        console.error('Error making popup busy:', error);
    }
}

function make_popup_free(){
    try {
        const loadingSpinner = document.getElementById('loading-overlay');
        if (loadingSpinner && loadingSpinner.style) {
            loadingSpinner.style.display = 'none';
        }
        
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            if (button) {
                button.disabled = false;
            }
        });
        
        const previousBtns = document.querySelectorAll('.previous_btn');
        previousBtns.forEach(btn => {
            if (btn && btn.style) {
                btn.style.display = 'initial';
            }
        });
        
        const nextBtns = document.querySelectorAll('.next_btn');
        nextBtns.forEach(btn => {
            if (btn && btn.style) {
                btn.style.display = 'initial';
            }
        });
    } catch (error) {
        console.error('Error making popup free:', error);
	}
}

function request_download(down_id){
	try {
		var dlinks = [];
		var dnames = [];
		for(var i = 0; i < global_button_links[down_id].length; i++){
			if (global_button_links[down_id][i].link_next) {
				dlinks.push(global_button_links[down_id][i].link_next.download_link);
				dnames.push(global_button_links[down_id][i].link_next.download_filename);
			}
		}
		
		if (dlinks.length === 0) {
			throw new Error("No valid files found to download");
		}

		var folder = modules[down_id].replace(/[^a-z0-9.(),';{} +&^%\[\]$#@!~`-]/gi, '_');
		
		// Create a zip-friendly folder name
		var sanitizedFolder = folder.trim()
			.replace(/ /g, "_")
			.replace(/[^\w-]/g, "")
			.toLowerCase();
		
		for(var i = 0; i < dlinks.length; i++){
			var actual_link = 'https://ufl.instructure.com'.concat(dlinks[i]);
			chrome.downloads.download({
				url: actual_link,
				filename: sanitizedFolder + "/" + dnames[i].replace(/[^\w.-]/g, "_")
			});
		}
		
		// Show success message with count
		if (elements.p2Text) {
			elements.p2Text.innerHTML = `
				<div class="success-message">
					<span class="file-count">${dlinks.length} file${dlinks.length > 1 ? 's' : ''}</span> downloading from 
					<strong>${modules[down_id]}</strong>
				</div>`;
		}
		setTimeout(() => {
			if (elements.p2Text) elements.p2Text.textContent = "";
		}, 5000);
	} catch (error) {
		console.error("Download error:", error);
		if (elements.p2Text) {
			elements.p2Text.innerHTML = `
				<div class="error-message">
					<span class="error-icon">⚠️</span> ${error.message}
				</div>`;
		}
		setTimeout(() => {
			if (elements.p2Text) elements.p2Text.textContent = "";
		}, 5000);
	}
}

function singleLink_download(down_id){
	try {
		if (!singleLink || !singleLink[0]) {
			throw new Error("Invalid download link");
		}
		var actual_link = singleLink[0];
		chrome.downloads.download({url: actual_link});
		
		// Show success message
		if (elements.p2Text) {
			elements.p2Text.innerHTML = `
				<div class="success-message">
					<span class="download-icon">📥</span> Download started!
				</div>`;
		}
		setTimeout(() => {
			if (elements.p2Text) elements.p2Text.textContent = "";
		}, 3000);
	} catch (error) {
		console.error("Download error:", error);
		if (elements.p2Text) {
			elements.p2Text.innerHTML = `
				<div class="error-message">
					<span class="error-icon">⚠️</span> ${error.message}
				</div>`;
		}
		setTimeout(() => {
			if (elements.p2Text) elements.p2Text.textContent = "";
		}, 3000);
	}
}

function dummy(){
	chrome.downloads.download({url: "http://unec.edu.az/application/uploads/2014/12/pdf-sample.pdf"});
}

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		if(request.receiver=="popup"){
			console.log(request);
			if(request.status=="scraping_done"){
				elements.startProcess.style.display = 'none';
				var button_titles = [];
				var button_links = [];
				make_popup_free();
				
				if(request.data[currentTab.id].type == "batch"){				
					Object.entries(request.data[currentTab.id].download).forEach(([key, val]) => {
						if(val.topics && val.topics.length > 0){
							button_titles.push(key);
							button_links.push(val.topics);
						}
					});
					
					if (button_titles.length === 0) {
						if (elements.pText) elements.pText.textContent = "No downloadable content found";
						if (elements.p2Text) {
							elements.p2Text.innerHTML = `
								<div class="info-message">
									<span class="info-icon">ℹ️</span> Make sure the module contains files or assignments
								</div>`;
						}
						return;
					}

					modules = button_titles;
					global_button_links = button_links;
					
					if (elements.downloadContainer) elements.downloadContainer.innerHTML = '';
					for(var i = 0; i < button_titles.length; i++){
						var fileCount = button_links[i].length;
						elements.downloadContainer.innerHTML += `
							<div class="text-center mb-2">
								<button type="button" id="${String(i)}" 
									class="btn btn-primary download-btn" 
									title="${button_titles[i]} (${fileCount} file${fileCount > 1 ? 's' : ''})">
									${button_titles[i].trunc(30)}
									<span class="file-badge">${fileCount}</span>
								</button>
							</div>`;
					}
					
					const downloadButtons = document.querySelectorAll('.download-btn');
					downloadButtons.forEach(button => {
						button.addEventListener('click', function() {
							request_download(this.id);
							this.classList.add('downloading');
							setTimeout(() => this.classList.remove('downloading'), 1000);
						});
					});
					
					if (elements.downloadContainer) {
						elements.downloadContainer.innerHTML += `
							<div class="text-center mt-3">
								<a href="#" class="reload text-primary">Refresh</a>
							</div>`;
					}
					
					const reloadButton = document.querySelector('.reload');
					if (reloadButton) {
						reloadButton.addEventListener('click', function() {
							clean_tab_entry();
						});
					}
				} else if(request.data[currentTab.id].type == "file"){
					if (!request.data[currentTab.id].download || !request.data[currentTab.id].download[0]) {
						if (elements.pText) elements.pText.textContent = "No file found";
						if (elements.p2Text) {
							elements.p2Text.innerHTML = `
								<div class="info-message">
									<span class="info-icon">ℹ️</span> Make sure you're on a valid file page
								</div>`;
						}
						return;
					}

					button_titles.push(request.data[currentTab.id].download[0].title);
					button_links.push(request.data[currentTab.id].download[0].link);
					
					singleLink = button_links;
					if (elements.downloadContainer) elements.downloadContainer.innerHTML = '';
					for(var i = 0; i < button_titles.length; i++){
						elements.downloadContainer.innerHTML += `
							<div class="text-center mb-2">
								<button type="button" id="${String(i)}" 
									class="btn btn-primary download-btn" 
									title="${button_titles[i]}">
									${button_titles[i].trunc(30)}
								</button>
							</div>`;
					}
					
					const downloadButtons = document.querySelectorAll('.download-btn');
					downloadButtons.forEach(button => {
						button.addEventListener('click', function() {
							singleLink_download(this.id);
							this.classList.add('downloading');
							setTimeout(() => this.classList.remove('downloading'), 1000);
						});
					});
					
					if (elements.downloadContainer) {
						elements.downloadContainer.innerHTML += `
							<div class="text-center mt-3">
								<a href="#" class="reload text-primary">Refresh</a>
							</div>`;
					}
					
					const reloadButton = document.querySelector('.reload');
					if (reloadButton) {
						reloadButton.addEventListener('click', function() {
							clean_tab_entry();
						});
					}
				}
			} else if(request.status=="unknown"){
				if (elements.pText) elements.pText.textContent = "Click 'Download' to process this page";
				if (elements.startProcess) elements.startProcess.style.display = 'block';
			}
			else if(request.status=="scraping_start_success" || request.status == "scraping_ongoing"){
				make_popup_busy();
			}
			else if(request.status=="scraping_start_fail"){
				elements.startProcess.style.display = 'none';
				if (elements.waiting) elements.waiting.style.display = 'none';
				if (elements.progressContainer) elements.progressContainer.style.display = 'none';
				
				var errorMsg = request.error || "Could not process the page. Please make sure you're on a valid Canvas page.";
				if (elements.pText) elements.pText.textContent = "Something went wrong";
				if (elements.p2Text) {
					elements.p2Text.innerHTML = `
						<div class="error-message">
							<span class="error-icon">⚠️</span> ${errorMsg}
							<div class="mt-2 small">
								<ul class="text-left pl-4 mb-0">
									<li>Check if you're on a Files or Modules page</li>
									<li>Make sure you're logged into Canvas</li>
									<li>Try refreshing the page</li>
								</ul>
							</div>
						</div>`;
				}
				
				if (elements.downloadContainer) {
					elements.downloadContainer.innerHTML = `
						<div class="text-center mt-3">
							<button class="retry-button btn btn-outline-primary btn-sm">Try Again</button>
						</div>`;
				}
				
				const retryButton = document.querySelector('.retry-button');
				if (retryButton) {
					retryButton.addEventListener('click', function() {
						clean_tab_entry();
					});
				}
			}
		}
	}
);

function clean_tab_entry(){
	var msg = {
		sender: "popup",
		receiver: "background",
		destination: "background",
		action: "reload",
		webpage: webpage,
		tab: currentTab
	};

	chrome.runtime.sendMessage(msg, function(response) {
		location.reload();
		console.log(response.received_by.concat(" heard me."));
	});
}

function updateDownloadButton() {
    const checkedCount = document.querySelectorAll('.file-items input[type="checkbox"]:checked').length;
    if (elements.startProcess) {
        elements.startProcess.style.display = checkedCount > 0;
        if (checkedCount > 0) {
            if (elements.startProcess) elements.startProcess.textContent = `<i class="fas fa-download"></i> Download Selected (${checkedCount})`;
        }
    }
}

async function initiateFileScraping() {
    try {
        const response = await getCanvasFiles();
        
        if (response.status === 'navigating') {
            // Wait and retry after navigation
            showProgress("Navigating to Files page...", 0, 0, "Files");
            setTimeout(initiateFileScraping, 2000);
            return;
        }
        
        if (response.status === 'error') {
            showError("Could not retrieve files", response.error);
            return;
        }
        
        if (response.status === 'complete') {
            files = response.files;
            displayFiles(files);
            if (elements.startProcess) elements.startProcess.style.display = 'block';
        }
    } catch (error) {
        showError("Error", error.message);
    }
}

// Helper function to get current course ID
function getCurrentCourseId() {
    // We need to check the active tab's URL
    return new Promise((resolve) => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (!tabs || tabs.length === 0) {
                console.log('No active tab found');
                resolve(null);
                return;
            }
            
            const url = tabs[0].url || '';
            console.log('Current tab URL:', url);
            
            // Check for conversations page with course filter
            const conversationMatch = url.match(/filter=course_(\d+)/);
            if (conversationMatch) {
                console.log('Found course ID in conversations:', conversationMatch[1]);
                resolve(conversationMatch[1]);
                return;
            }
            
            // Check for regular course page
            const courseMatch = url.match(/\/courses\/(\d+)/);
            if (courseMatch) {
                console.log('Found course ID in regular URL:', courseMatch[1]);
                resolve(courseMatch[1]);
                return;
            }
            
            console.log('No course ID found in URL');
            resolve(null);
        });
    });
}

// Helper function to check if course is being or has been scraped
function checkCourseState(courseId) {
    return courseState[courseId] || { isScraped: false, isLoading: false };
}

// Helper function to update course state
function updateCourseState(courseId, state) {
    courseState[courseId] = { ...courseState[courseId], ...state };
}

// Add this function near the top after UIState definition
function injectContentScriptIfNeeded() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            const activeTab = tabs[0];
            
            // First try to communicate with existing content script
            chrome.tabs.sendMessage(activeTab.id, { action: 'ping' }, response => {
                if (chrome.runtime.lastError) {
                    // Content script not loaded, inject it
                    chrome.scripting.executeScript({
                        target: { tabId: activeTab.id },
                        files: ['scripts/content_canvas.js']
                    }, () => {
                        if (chrome.runtime.lastError) {
                            reject(new Error('Failed to inject content script'));
                        } else {
                            // Wait a bit for the script to initialize
                            setTimeout(resolve, 100);
                        }
                    });
                } else {
                    // Content script already loaded
                    resolve();
                }
            });
        });
    });
}

// Modify initiateAssignmentScraping function
async function initiateAssignmentScraping() {
    try {
        // Get current course ID
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        const currentTab = tabs[0];
        const courseId = currentTab.url.match(/\/courses\/(\d+)/)?.[1];
        
        if (!courseId) {
            showError("Invalid page", "Please navigate to a Canvas course first");
            return;
        }

        // Check if already scraping or scraped
        const state = checkCourseState(courseId);
        if (state.isLoading) {
            showError("In Progress", "Already collecting assignments...");
            return;
        }
        if (state.isScraped) {
            // If already scraped, just show the results
            if (state.assignments) {
                displayAssignments(state.assignments);
                updateUIState(UIState.COMPLETE, 'Showing previously collected assignments');
            }
            return;
        }

        // Clear any existing content and show progress
        if (elements.downloadContainer) {
            elements.downloadContainer.innerHTML = '';
            setElementDisplay(elements.downloadContainer, 'none');
        }
        
        // Update UI state and show progress
        updateUIState(UIState.SCRAPING, 'Starting assignment scrape...');
        showProgress('Preparing to scrape assignments...', 0, 0, 'Initialization');
        
        // Update course state
        updateCourseState(courseId, { isLoading: true });

        if (elements.scrapeButton) {
            elements.scrapeButton.disabled = true;
            setElementDisplay(elements.scrapeButton, 'none');
        }

        // Ensure content script is loaded
        await injectContentScriptIfNeeded();

        // Set up timeout for the response
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timed out')), 30000);
        });

        // Make the request
        const responsePromise = new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(currentTab.id, { action: "getAssignments" }, response => {
                if (chrome.runtime.lastError) {
                    reject(new Error('Failed to communicate with page: ' + chrome.runtime.lastError.message));
                } else if (!response) {
                    reject(new Error('No response from page'));
                } else {
                    resolve(response);
                }
            });
        });

        // Wait for either response or timeout
        const response = await Promise.race([responsePromise, timeoutPromise]);
        
        if (response.status === 'navigating') {
            showProgress("Navigating to Assignments page...", 0, 0, "Navigation");
            setTimeout(initiateAssignmentScraping, 2000);
            return;
        }
        
        if (response.status === 'error') {
            updateCourseState(courseId, { isLoading: false });
            updateUIState(UIState.ERROR, response.error);
            return;
        }
        
        if (response.status === 'complete') {
            if (!response.assignments || response.assignments.length === 0) {
                updateCourseState(courseId, { isLoading: false });
                updateUIState(UIState.ERROR, 'No assignments found on this page');
                return;
            }

            // Store the results and update state
            updateCourseState(courseId, {
                isLoading: false,
                isScraped: true,
                assignments: response.assignments
            });

            displayAssignments(response.assignments);
            updateUIState(UIState.COMPLETE, 'Successfully scraped assignments');
            
            // Show completion message briefly
            const totalAssignments = response.assignments.reduce((total, group) => total + group.assignments.length, 0);
            showProgress('Scraping complete!', totalAssignments, totalAssignments, '');
            
            // Hide progress after a delay
            setTimeout(() => {
                if (elements.progressContainer) {
                    setElementDisplay(elements.progressContainer, 'none');
                }
            }, 2000);
        }
    } catch (error) {
        console.error('Error during scraping:', error);
        
        // Show a more user-friendly error message
        let errorMessage = 'An error occurred while collecting assignments. ';
        if (error.message.includes('Failed to communicate')) {
            errorMessage += 'Please refresh the page and try again.';
        } else if (error.message.includes('timed out')) {
            errorMessage += 'The request took too long. Please check your internet connection and try again.';
        } else {
            errorMessage += error.message;
        }
        
        updateUIState(UIState.ERROR, errorMessage);
        
        // Reset loading state on error
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentUrl = tabs[0].url;
            const courseId = currentUrl.match(/\/courses\/(\d+)/)?.[1];
            if (courseId) {
                updateCourseState(courseId, { isLoading: false });
            }
        });
    }
}

function displayFiles(files) {
    if (elements.progressContainer) elements.progressContainer.style.display = 'none';
    if (elements.fileList) elements.fileList.style.display = 'block';
    
    if (files.length === 0) {
        if (elements.fileList) elements.fileList.innerHTML = `
            <div class="info-message">
                <i class="fas fa-info-circle"></i> No files found in this course
            </div>
        `;
        return;
    }
    
    const fileList = files.map(file => `
        <div class="file-item">
            <label>
                <input type="checkbox" value="${file.id}">
                <i class="fas fa-${getFileIcon(file.type)} file-icon"></i>
                <span class="file-name">${file.name}</span>
                <span class="file-size">${file.size}</span>
            </label>
        </div>
    `).join('');
    
    if (elements.fileItems) elements.fileItems.innerHTML = fileList;
    if (elements.fileItems) {
        elements.fileItems.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', updateDownloadButton);
        });
    }
}

function getFileIcon(fileType) {
    const iconMap = {
        'pdf': 'file-pdf',
        'doc': 'file-word',
        'docx': 'file-word',
        'xls': 'file-excel',
        'xlsx': 'file-excel',
        'ppt': 'file-powerpoint',
        'pptx': 'file-powerpoint',
        'zip': 'file-archive',
        'rar': 'file-archive',
        'txt': 'file-alt',
        'jpg': 'file-image',
        'jpeg': 'file-image',
        'png': 'file-image',
        'gif': 'file-image'
    };
    
    return iconMap[fileType.toLowerCase()] || 'file';
}

function displayAssignments(assignments) {
    if (!elements.downloadContainer) return;

    // Store upload batch information in a variable that can be used later if needed
    const currentBatchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    
    // Save the batch information in the local storage for potential later use
    chrome.storage.local.get(['uploadBatches'], (result) => {
        const batches = result.uploadBatches || [];
        const newBatch = {
            id: currentBatchId,
            type: 'assignments',
            count: assignments.reduce((total, group) => total + group.assignments.length, 0),
            timestamp: Date.now(),
            courseId: assignments[0]?.courseId || 'unknown'
        };
        
        batches.push(newBatch);
        chrome.storage.local.set({ uploadBatches: batches });
        console.log('Stored batch information:', newBatch);
    });

    // Flatten all assignments into a single array
    const allAssignments = assignments.reduce((acc, group) => {
        // Make sure each assignment has the group field populated and batch ID
        const groupAssignments = group.assignments.map(assignment => {
            return {
                ...assignment,
                assignmentGroup: assignment.assignmentGroup || "Uncategorized",
                points: assignment.points || 0,  // Ensure points is never null
                status: assignment.status || "Not Started",  // Ensure status is never null
                batchId: currentBatchId  // Associate with this display batch
            };
        });
        return acc.concat(groupAssignments);
    }, []);

    // Sort assignments by due date (if available)
    allAssignments.sort((a, b) => {
        if (!a.dueDate || a.dueDate === 'No due date') return 1;
        if (!b.dueDate || b.dueDate === 'No due date') return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    const assignmentList = allAssignments.map(assignment => {
        // Clean up the description
        let cleanDescription = '';
        if (assignment.description) {
            cleanDescription = assignment.description
                .replace(/[\n\r]+/g, ' ') // Replace multiple newlines with single space
                .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                .replace(/Details\s+Overview/gi, 'Overview') // Remove redundant headers
                .replace(/Instructions\s+Guidelines and Submissions/gi, 'Instructions') // Clean up sections
                .trim();
        }

        return `
            <div class="assignment-item">
                <div class="assignment-header">
                    <h4 class="assignment-title">
                        <a href="${assignment.url}" target="_blank">
                            ${assignment.title}
                        </a>
                    </h4>
                    <span class="assignment-status ${assignment.status.toLowerCase().replace(/\s+/g, '-')}">
                        ${assignment.status}
                    </span>
                </div>
                <div class="assignment-details">
                    <span><i class="far fa-calendar"></i> ${assignment.dueDate}</span>
                    <span><i class="fas fa-star"></i> ${assignment.points} points</span>
                </div>
                ${cleanDescription ? `
                    <div class="assignment-content">
                        <div class="description-preview">
                            ${cleanDescription.length > 200 ? 
                                `${cleanDescription.substring(0, 200)}...` : 
                                cleanDescription}
                        </div>
                        <button class="btn btn-sm btn-outline-primary view-content-btn" 
                                onclick="window.open('${assignment.url}', '_blank')">
                            <i class="fas fa-eye"></i> View Full Details
                        </button>
                    </div>
                ` : ''}
                ${assignment.rubric ? `
                    <div class="rubric-preview">
                        <div class="rubric-header">
                            <i class="fas fa-list-ul"></i> Rubric
                        </div>
                        <div class="rubric-items">
                            ${assignment.rubric.map(item => `
                                <div class="rubric-item">
                                    <div class="rubric-criterion">${item.criterion}</div>
                                    <div class="rubric-points">${item.points} pts</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    elements.downloadContainer.innerHTML = assignmentList;
    setElementDisplay(elements.downloadContainer, 'block');
}

function showProgress(current, total, currentTitle, groupName = '') {
    if (!elements.progressContainer) return;
    
    // Force the progress container to be visible
    elements.progressContainer.style.display = 'block';
    
    // Hide the initial messages
    if (elements.pText) elements.pText.textContent = '';
    if (elements.p2Text) elements.p2Text.textContent = '';
    
    if (current && total) {
        const percent = Math.round((current / total) * 100);
        if (elements.progressMessage) elements.progressMessage.textContent = currentTitle;
        
        let detailText = `Processing: ${currentTitle}`;
        if (groupName) {
            detailText += ` (in ${groupName})`;
        }
        if (elements.progressDetail) elements.progressDetail.textContent = detailText;
        if (elements.progressNumbers) elements.progressNumbers.textContent = `${current} of ${total} assignments (${percent}%)`;
        
        if (elements.progressBarFill) {
            elements.progressBarFill.style.width = `${percent}%`;
            elements.progressBarFill.style.display = 'block';
        }
    } else {
        if (elements.progressMessage) elements.progressMessage.textContent = currentTitle;
        if (elements.progressDetail) elements.progressDetail.textContent = '';
        if (elements.progressNumbers) elements.progressNumbers.textContent = '';
        if (elements.progressBarFill) {
            elements.progressBarFill.style.width = '0%';
            elements.progressBarFill.style.display = 'block';
        }
    }
}

// Canvas API integration
async function getCanvasFiles() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "getFiles"
            }, response => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    });
}

async function getCanvasAssignments() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "getAssignments"
            }, response => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    });
}

// FaciliGator UI Script
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize elements first
    initializeElements();

    // Check current page and course state
    try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        const currentUrl = tabs[0].url;
        const courseId = currentUrl.match(/\/courses\/(\d+)/)?.[1];

        if (!currentUrl.includes('ufl.instructure.com')) {
            updateUIState(UIState.NOT_CANVAS, 'Please navigate to Canvas to use FaciliGator');
            return;
        }

        if (!courseId) {
            updateUIState(UIState.NOT_COURSE, 'Please navigate to a Canvas course');
            return;
        }

        if (!currentUrl.includes('/assignments')) {
            updateUIState(UIState.NOT_ASSIGNMENTS, 'Please go to the Assignments page');
            return;
        }

        // Check if we already have data for this course
        const state = checkCourseState(courseId);
        if (state.isScraped && state.assignments) {
            displayAssignments(state.assignments);
            updateUIState(UIState.COMPLETE, 'Showing previously collected assignments');
        } else if (state.isLoading) {
            updateUIState(UIState.SCRAPING, 'Collecting assignments...');
            showProgress('Scraping in progress...', 0, 0, 'Initialization');
        } else {
            updateUIState(UIState.READY, 'Ready to scrape assignments');
        }

    } catch (error) {
        updateUIState(UIState.ERROR, 'Error checking page status');
    }
});

// Navigation functions
function navigateToCanvas() {
	chrome.tabs.update({ url: 'https://ufl.instructure.com' });
	window.close();
}

function navigateToAssignments(courseId) {
	chrome.tabs.update({ url: `https://ufl.instructure.com/courses/${courseId}/assignments` });
	window.close();
}

// Initialize elements
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize tab functionality
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
        });
    });

    // Initialize recording scraping button
    const scrapeRecordingsButton = document.getElementById('scrape-recordings-button');
    if (scrapeRecordingsButton) {
        scrapeRecordingsButton.addEventListener('click', initiateRecordingScraping);
    }

    // Initialize navigation buttons
    const goToInboxButton = document.getElementById('go-to-inbox');
    if (goToInboxButton) {
        goToInboxButton.addEventListener('click', () => {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                const currentTab = tabs[0];
                const courseId = currentTab.url.match(/\/courses\/(\d+)/)?.[1];
                if (courseId) {
                    chrome.tabs.update(currentTab.id, {
                        url: `https://ufl.instructure.com/conversations#filter=type=inbox&course=course_${courseId}`
                    });
                } else {
                    chrome.tabs.update(currentTab.id, {
                        url: 'https://ufl.instructure.com/conversations'
                    });
                }
            });
        });
    }

    // Check current page state
    try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        const currentUrl = tabs[0].url;
        
        if (!currentUrl.includes('ufl.instructure.com')) {
            updateRecordingsUIState('error', 'Please navigate to Canvas to use FaciliGator');
            return;
        }

        if (currentUrl.includes('/conversations')) {
            const courseId = currentUrl.match(/course=course_(\d+)/)?.[1];
            if (courseId) {
                updateRecordingsUIState('ready', 'Ready to collect recordings');
            } else {
                updateRecordingsUIState('error', 'Please select a course filter first');
            }
        } else {
            updateRecordingsUIState('error', 'Please navigate to Canvas inbox');
        }

    } catch (error) {
        updateRecordingsUIState('error', 'Error checking page status');
    }
});

// Function to update recordings UI state
async function updateRecordingsUIState(state, message) {
    try {
        // Get the new recording container elements
        const recordingsContainer = document.getElementById('recordings-container');
        const recordingsStatus = document.getElementById('recordings-status');
        const uploadButton = document.getElementById('upload-recordings-button');
        const selectAllLabel = document.getElementById('select-all-recordings-label');
        const mainOptions = document.querySelector('.main-options');
        const progressContainer = document.querySelector('.progress-container');
        const resultsContainer = document.getElementById('results-container');
        
        // Make sure we have the required elements
        if (!recordingsContainer || !recordingsStatus) {
            console.warn('Required recording UI elements not found');
            return;
        }

        // Helper to safely set display style
        const safeSetDisplay = (element, value) => {
            if (element && element.style) {
                element.style.display = value;
            }
        };

        // Update status message
        if (recordingsStatus) {
            recordingsStatus.textContent = message || '';
        }
        
        // Store the current state for persistence
        const currentCourseId = await getCurrentCourseId();
        if (currentCourseId) {
            chrome.storage.local.get(['recording_state'], (result) => {
                const recordingState = result.recording_state || {};
                
                // Update the state for this course
                recordingState[currentCourseId] = recordingState[currentCourseId] || {};
                recordingState[currentCourseId].state = state;
                recordingState[currentCourseId].message = message;
                
                // Store back to storage
                chrome.storage.local.set({
                    'recording_state': recordingState
                });
            });
        }
        
        // Handle different states
    switch (state) {
        case 'ready':
                // Show main options, hide progress and recordings
                safeSetDisplay(mainOptions, 'flex');
                safeSetDisplay(progressContainer, 'none');
                safeSetDisplay(recordingsContainer, 'none');
                safeSetDisplay(resultsContainer, 'none');
            break;

        case 'error':
                // Show error in recordings status
                safeSetDisplay(recordingsContainer, 'block');
                safeSetDisplay(progressContainer, 'none');
                safeSetDisplay(mainOptions, 'none');
                safeSetDisplay(resultsContainer, 'none');
                if (recordingsStatus) {
                    recordingsStatus.className = 'recordings-status error';
                }
            break;

        case 'scraping':
                // Show progress container, keep recordings container visible
                safeSetDisplay(progressContainer, 'block');
                safeSetDisplay(mainOptions, 'none');
                safeSetDisplay(recordingsContainer, 'block');
                safeSetDisplay(resultsContainer, 'none');
                if (recordingsStatus) {
                    recordingsStatus.className = 'recordings-status scraping';
                }
            break;

        case 'complete':
            case 'completed': 
                // Hide progress, show recordings container with success message
                safeSetDisplay(progressContainer, 'none');
                safeSetDisplay(mainOptions, 'none');
                safeSetDisplay(recordingsContainer, 'block');
                safeSetDisplay(resultsContainer, 'none');
                
                // Show upload button and select all checkbox if we have recordings
                if (window.lastRecordingsData && window.lastRecordingsData.length > 0) {
                    if (uploadButton) uploadButton.style.display = 'block';
                    if (selectAllLabel) selectAllLabel.style.display = 'flex';
                }
                
                if (recordingsStatus) {
                    recordingsStatus.className = 'recordings-status success';
                }
                break;
        }
        
        // Store the recordings data for access by other functions
        if ((state === 'complete' || state === 'completed') && window.lastRecordingsData) {
            const recordingsList = document.getElementById('recordings-list');
            if (recordingsList) {
                recordingsList.dataset.recordings = JSON.stringify(window.lastRecordingsData);
            }
        }
        
    } catch (error) {
        console.error('Error updating recordings UI state:', error);
    }
}

// Function to display recordings
async function displayRecordings(recordings) {
    console.log('Displaying recordings:', recordings);
    
    // Store recordings data for later use
    window.lastRecordingsData = recordings;
    
    // Store in persistent storage too
    const currentCourseId = await getCurrentCourseId();
    if (currentCourseId) {
        // Get existing data first
        chrome.storage.local.get(['scraped_recordings'], (result) => {
            const recordingsData = result.scraped_recordings || {};
            
            // Update with new recordings for this course
            recordingsData[currentCourseId] = recordings;
            
            // Save back to storage
            chrome.storage.local.set({
                'scraped_recordings': recordingsData
            });
        });
    }
    
    const recordingsContainer = document.getElementById('recordings-container');
    const recordingsList = document.getElementById('recordings-list');
    const uploadButton = document.getElementById('upload-recordings-button');
    const selectAllLabel = document.getElementById('select-all-recordings-label');
    
    if (!recordingsList) {
        console.error('Recordings list container not found');
        return;
    }
    
    // Clear existing content
    recordingsList.innerHTML = '';
    
    // Store recordings data in the element's dataset
    recordingsList.dataset.recordings = JSON.stringify(recordings);
    
    if (!recordings || recordings.length === 0) {
        recordingsList.innerHTML = '<div class="empty-state">No recordings found</div>';
        
        // Hide upload button and select all checkbox
        if (uploadButton) uploadButton.style.display = 'none';
        if (selectAllLabel) selectAllLabel.style.display = 'none';
        return;
    }
    
    // Create recording items with checkboxes for selection
    recordings.forEach((recording, index) => {
        // Create container for each recording
        const recordingItem = document.createElement('div');
        recordingItem.className = 'recording-item';
        recordingItem.dataset.index = index;
        
        // Create checkbox for selection
                const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'recording-checkbox-container';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
        checkbox.id = `recording-${index}`;
                checkbox.className = 'recording-checkbox';
        checkbox.dataset.index = index;
                
                checkboxContainer.appendChild(checkbox);
        
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'recording-content';
        
        // Add recording title
        const title = document.createElement('div');
        title.className = 'recording-title';
                title.textContent = recording.title || 'Untitled Recording';
                
        // Add recording date
        const date = document.createElement('div');
        date.className = 'recording-date';
                date.textContent = recording.date || 'Unknown Date';
                
        // Add host if available
        if (recording.host) {
            const host = document.createElement('div');
            host.className = 'recording-host';
            host.textContent = `Host: ${recording.host}`;
            contentContainer.appendChild(host);
        }
        
        // Add transcript status
        const transcriptStatus = document.createElement('div');
        transcriptStatus.className = 'recording-transcript-status';
        
        if (recording.transcript) {
            if (recording.transcript.status === 'success') {
                transcriptStatus.textContent = `Transcript: ${recording.transcript.segment_count || 0} segments`;
                transcriptStatus.classList.add('transcript-success');
                
                // Add a small preview of the transcript
                if (recording.transcript.formatted_text) {
                    const previewLines = recording.transcript.formatted_text.split('\n').slice(0, 3);
                    const transcriptPreview = document.createElement('div');
                    transcriptPreview.className = 'transcript-preview';
                    transcriptPreview.textContent = previewLines.join('\n') + (previewLines.length < 3 ? '' : '...');
                    contentContainer.appendChild(transcriptPreview);
                }
            } else {
                transcriptStatus.textContent = `Transcript: ${recording.transcript.error || 'Failed to extract'}`;
                transcriptStatus.classList.add('transcript-failed');
            }
        } else {
            transcriptStatus.textContent = 'Transcript: Not extracted';
            transcriptStatus.classList.add('transcript-pending');
        }
        
        contentContainer.appendChild(title);
        contentContainer.appendChild(date);
        contentContainer.appendChild(transcriptStatus);
        
        // Add button to extract transcript if not already extracted
        if (!recording.transcript || recording.transcript.status !== 'success') {
            const extractButton = document.createElement('button');
            extractButton.className = 'extract-transcript-button';
            extractButton.textContent = 'Extract Transcript';
            extractButton.dataset.index = index;
            extractButton.addEventListener('click', async (e) => {
                e.preventDefault();
                await extractSingleTranscript(recordings[index]);
                // Refresh the display
                displayRecordings(recordings);
            });
            contentContainer.appendChild(extractButton);
        }
        
        // Assemble the recording item
        recordingItem.appendChild(checkboxContainer);
        recordingItem.appendChild(contentContainer);
        
        // Add item to container
        recordingsList.appendChild(recordingItem);
    });
    
    // Show upload button and select all checkbox
    if (uploadButton) {
        uploadButton.style.display = 'block';
        uploadButton.disabled = false;
        uploadButton.textContent = 'Upload Selected Recordings';
    }
    
    if (selectAllLabel) {
        selectAllLabel.style.display = 'flex';
        const selectAllCheckbox = document.getElementById('select-all-recordings');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.addEventListener('change', function() {
                const checkboxes = document.querySelectorAll('.recording-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = this.checked;
                });
            });
        }
    }
}

async function extractSingleTranscript(recording) {
    try {
        // Update UI
        updateRecordingsUIState('scraping', `Extracting transcript for: ${recording.title}`);
        
        // Extract transcript
        const result = await ApiUtils.extractZoomTranscript(recording.url);
        
        if (result.success && result.transcript_data && result.transcript_data.length > 0) {
            // Update the recording object
            recording.transcript = {
                status: 'success',
                segment_count: result.segment_count || result.transcript_data.length,
                data: result.transcript_data,
                formatted_text: result.formatted_text
            };
            
            // Update UI
            updateRecordingsUIState('completed', `Successfully extracted transcript`);
                    } else {
            // Update the recording object
            recording.transcript = {
                status: 'failed',
                error: result.error || 'Unknown error'
            };
            
            // Update UI
            updateRecordingsUIState('error', `Failed to extract transcript: ${result.error || 'Unknown error'}`);
        }
        
        return recording;
    } catch (error) {
        console.error('Error extracting single transcript:', error);
        
        // Update the recording object
        recording.transcript = {
            status: 'error',
            error: error.message || 'Error extracting transcript'
        };
        
        // Update UI
        updateRecordingsUIState('error', error.message || 'Error extracting transcript');
        
        return recording;
    }
}

async function uploadSelectedRecordings() {
    try {
        // Get selected recordings
        const checkboxes = document.querySelectorAll('.recording-checkbox:checked');
        
        if (checkboxes.length === 0) {
            updateRecordingsUIState('error', 'Please select at least one recording to upload');
            return;
        }
        
        // Collect selected recordings
        const selectedRecordings = [];
        checkboxes.forEach(checkbox => {
            const index = parseInt(checkbox.dataset.index);
            const recordingList = document.getElementById('recordings-list');
            const recordingsData = recordingList.dataset.recordings;
            const recordings = recordingsData ? JSON.parse(recordingsData) : window.lastRecordingsData || [];
            
            if (recordings[index]) {
                selectedRecordings.push(recordings[index]);
            }
        });
        
        if (selectedRecordings.length === 0) {
            updateRecordingsUIState('error', 'Failed to retrieve selected recordings data');
            return;
        }
        
        // Create a batch ID for the upload
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        
        // Update UI
        updateRecordingsUIState('scraping', `Uploading ${selectedRecordings.length} recording(s)...`);
        
        // Upload the recordings
        await uploadZoomRecordings(selectedRecordings, batchId);
        
    } catch (error) {
        console.error('Error uploading selected recordings:', error);
        updateRecordingsUIState('error', error.message || 'Error uploading recordings');
    }
}

// Function to upload Zoom recordings to backend
async function uploadZoomRecordings(recordings, batchId) {
    try {
        console.log('uploadZoomRecordings called with', recordings.length, 'recordings and batch ID', batchId);
        
        // Get token with better error handling
        const token = await new Promise((resolve, reject) => {
            chrome.storage.local.get(['token', 'facilitator_auth_token'], function(result) {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                // Try both token keys
                const token = result.token || result.facilitator_auth_token;
                console.log('Retrieved token for upload:', token ? 'Token found' : 'No token found');
                resolve(token || null);
            });
        });
        
        if (!token) {
            console.error('No auth token available for upload');
            updateRecordingsUIState('error', 'Authentication required. Please log in.');
            return { status: 'error', error: 'Authentication required. Please log in.' };
        }
        
        // Get the API base URL from CONFIG or fallback to known URL
        let apiBaseUrl;
        try {
            apiBaseUrl = CONFIG.API_BASE_URL;
        } catch (e) {
            console.warn('CONFIG.API_BASE_URL not available, using fallback URL');
            apiBaseUrl = 'https://localhost:8000';
        }
        
        if (!apiBaseUrl) {
            console.error('API base URL not configured');
            updateRecordingsUIState('error', 'API base URL not configured.');
            return { status: 'error', error: 'API base URL not configured.' };
        }
        
        // Get selected recordings
        const selectedRecordings = recordings.filter(recording => recording.selected);
        if (selectedRecordings.length === 0) {
            console.error('No recordings selected for upload');
            updateRecordingsUIState('error', 'Please select at least one recording.');
            return { status: 'error', error: 'Please select at least one recording.' };
        }
        
        // Get course ID from first recording
        let courseId = selectedRecordings[0].courseId || 'unknown';
        console.log('Using course ID:', courseId, 'for upload');
        
        // Update UI
        updateRecordingsUIState('scraping', 'Uploading recordings...');
        
        // Format submission data
        const submissionData = {
            courseId: courseId,
            recordings: selectedRecordings.map(recording => ({
                title: recording.title || 'Untitled Recording',
                url: recording.url,
                date: recording.date || null,
                host: recording.host || null,
                courseId: courseId
            })),
            upload_batch_id: batchId
        };
        
        console.log('Submission data prepared:', {
            courseId: submissionData.courseId,
            recordingsCount: submissionData.recordings.length,
            batchId: submissionData.upload_batch_id
        });
        
        // Log the API endpoint being used
        const apiEndpoint = `${apiBaseUrl}/zoom/store`;
        console.log('Submitting to API endpoint:', apiEndpoint);
        
        // Submit to backend with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        try {
            console.log('Sending fetch request to backend...');
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(submissionData),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId); // Clear the timeout if fetch completes
            
            console.log('Received response from backend, status:', response.status);
            
            // Parse the response body as JSON
            const responseBody = await response.json();
            console.log('Response body:', responseBody);
            
            if (!response.ok) {
                const errorMsg = responseBody.detail || 'Unknown error';
                console.error('Upload error:', errorMsg);
                
                // Try using the background script as a fallback
                console.log('Trying background script as a fallback...');
                return await tryBackgroundUpload(selectedRecordings, courseId, batchId);
            }
            
            // Success - get the response data
            console.log('Upload successful:', responseBody);
            
            // Update UI with success message
            updateRecordingsUIState('complete', `Successfully uploaded ${submissionData.recordings.length} recording(s)`);
            
            // Update the checkboxes to be unchecked
            document.querySelectorAll('.recording-checkbox:checked').forEach(checkbox => {
                checkbox.checked = false;
            });
            
            return {
                status: 'success',
                message: responseBody.message || 'Recordings uploaded successfully',
                count: submissionData.recordings.length,
                upload_batch_id: batchId,
                ...responseBody
            };
        } catch (fetchError) {
            clearTimeout(timeoutId); // Clear the timeout
            
            // Handle timeout error
            if (fetchError.name === 'AbortError') {
                console.error('Fetch request timed out after 30 seconds');
                // Try using the background script as a fallback
                console.log('Trying background script as a fallback after timeout...');
                return await tryBackgroundUpload(selectedRecordings, courseId, batchId);
            }
            
            // Handle other fetch errors - try background script
            console.error('Fetch error during upload:', fetchError);
            console.log('Trying background script as a fallback after fetch error...');
            return await tryBackgroundUpload(selectedRecordings, courseId, batchId);
        }
    } catch (error) {
        console.error('Exception in uploadZoomRecordings:', error);
        updateRecordingsUIState('error', `Upload failed: ${error.message || 'Unknown error'}`);
        return { status: 'error', error: error.message || 'Unknown error' };
    }
}

// Helper function to try uploading via the background script
async function tryBackgroundUpload(recordings, courseId, batchId) {
    try {
        console.log('Using background script for upload fallback');
        // Use the background script for direct upload
        const result = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'directUploadRecordings',
                recordings: recordings,
                courseId: courseId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ 
                        status: 'error', 
                        error: 'Failed to communicate with background: ' + chrome.runtime.lastError.message 
                    });
                } else {
                    resolve(response || { status: 'error', error: 'No response from background script' });
                }
            });
            
            // Timeout in case the background doesn't respond
            setTimeout(() => {
                resolve({ status: 'error', error: 'Background script did not respond in time' });
            }, 10000);
        });
        
        if (result.status === 'success') {
            console.log('Background upload successful');
            updateRecordingsUIState('complete', `Successfully uploaded ${recordings.length} recording(s) via background script`);
            
            // Update the checkboxes to be unchecked
            document.querySelectorAll('.recording-checkbox:checked').forEach(checkbox => {
                checkbox.checked = false;
            });
        } else {
            console.error('Background upload failed:', result.error);
            updateRecordingsUIState('error', `Upload failed: ${result.error || 'Unknown error from background'}`);
        }
        
        return result;
    } catch (error) {
        console.error('Error using background fallback:', error);
        updateRecordingsUIState('error', `Background upload failed: ${error.message || 'Unknown error'}`);
        return { status: 'error', error: error.message || 'Failed to use background upload' };
    }
}

// Function to extract transcripts from Zoom recordings
async function extractZoomTranscripts(recordings) {
    try {
        // Ensure we're authenticated
        const isAuthenticated = await AuthUtils.isAuthenticated();
        if (!isAuthenticated) {
            updateRecordingsUIState('error', 'Authentication required. Please log in.');
            return;
        }
        
        // Get selected recordings
        const selectedRecordings = recordings.filter(recording => recording.selected);
        if (selectedRecordings.length === 0) {
            updateRecordingsUIState('error', 'Please select at least one recording.');
            return;
        }
        
        // Get course ID from first recording
        let courseId = selectedRecordings[0].courseId || 'unknown';
        
        // Update UI
        updateRecordingsUIState('scraping', 'Processing transcripts...');
        
        // Process each recording in sequence (not parallel to avoid overwhelming browser)
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < selectedRecordings.length; i++) {
            const recording = selectedRecordings[i];
            updateRecordingsUIState('scraping', `Extracting transcript ${i+1}/${selectedRecordings.length}: ${recording.title}`);
            
            // Extract transcript using our frontend extraction
            const result = await ApiUtils.extractZoomTranscript(recording.url);
            
            if (result.success && result.transcript_data && result.transcript_data.length > 0) {
                // Store the transcript in the database
                console.log(`Successfully extracted transcript for ${recording.title} with ${result.segment_count} segments`);
                
                // Store the transcript data
                try {
                    const storeResult = await ApiUtils.storeZoomTranscript(recording.id, result);
                    if (storeResult.success) {
                        successCount++;
                    } else {
                        console.error(`Failed to store transcript: ${storeResult.error}`);
                        errorCount++;
                    }
                } catch (storeError) {
                    console.error(`Error storing transcript: ${storeError.message}`);
                    errorCount++;
                }
            } else {
                console.error(`Failed to extract transcript: ${result.error || 'Unknown error'}`);
                errorCount++;
            }
        }
        
        // Update UI with results
        if (successCount > 0) {
            if (errorCount > 0) {
                updateRecordingsUIState('completed', `Extracted ${successCount} transcript(s) with ${errorCount} error(s)`);
            } else {
                updateRecordingsUIState('completed', `Successfully extracted ${successCount} transcript(s)`);
            }
        } else {
            updateRecordingsUIState('error', 'Failed to extract any transcripts');
        }
    } catch (error) {
        console.error('Error in extractZoomTranscripts:', error);
        updateRecordingsUIState('error', error.message || 'Error processing transcripts');
    }
}

// Function to initiate recording scraping
async function initiateRecordingScraping() {
    try {
        // Get the current course ID
        const currentCourseId = await getCurrentCourseId();
        if (!currentCourseId) {
            console.error('No course ID found, cannot scrape recordings');
            return;
        }
        
        console.log('Initiating recording scraping for course ID:', currentCourseId);
        
        // Show the loading state before we check the active tab
        await updateRecordingsUIState('scraping', 'Collecting recordings...');
        
        // Get the current active tab
        chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
            if (!tabs || tabs.length === 0) {
                console.error('No active tab found');
                updateRecordingsUIState('error', 'No active tab found');
                return;
            }
            
            const currentTab = tabs[0];
            
            // Save the scraping state immediately
            saveRecordingState(currentCourseId, {
                isLoading: true,
                state: 'scraping',
                message: 'Collecting recordings...'
            });
            
            // First, check if the content script is loaded by sending a ping
            try {
                // Use a Promise to handle the ping response
                const contentScriptLoaded = await new Promise((resolve) => {
                    chrome.tabs.sendMessage(
                        currentTab.id,
                        { action: 'ping' },
                        function(response) {
                            if (chrome.runtime.lastError) {
                                console.warn('Content script not loaded:', chrome.runtime.lastError.message);
                                resolve(false);
                            } else if (response && response.loaded) {
                                console.log('Content script is loaded and ready');
                                resolve(true);
                            } else {
                                console.warn('Unexpected response from content script');
                                resolve(false);
                            }
                        }
                    );
                    
                    // Add a timeout in case the message never gets a response
                    setTimeout(() => resolve(false), 1000);
                });
                
                // If the content script is not loaded, try to inject it
                if (!contentScriptLoaded) {
                    console.log('Content script not loaded, requesting injection');
                    
                    // Request the background script to inject the content script
                    const injected = await new Promise((resolve) => {
                        chrome.runtime.sendMessage(
                            { action: 'injectRecordingScraper', tabId: currentTab.id },
                            function(response) {
                                if (chrome.runtime.lastError) {
                                    console.error('Error injecting content script:', chrome.runtime.lastError.message);
                                    resolve(false);
                                } else if (response && response.success) {
                                    console.log('Content script injected successfully');
                                    resolve(true);
                                } else {
                                    console.warn('Failed to inject content script');
                                    resolve(false);
                                }
                            }
                        );
                        
                        // Add a timeout in case the message never gets a response
                        setTimeout(() => resolve(false), 2000);
                    });
                    
                    // If we couldn't inject the content script, show an error
                    if (!injected) {
                        updateRecordingsUIState('error', 'Failed to initialize recording scraper. Please refresh the page and try again.');
                        return;
                    }
                    
                    // Wait a moment for the content script to initialize
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error('Error checking content script:', error);
                // Continue anyway, as the script might still be loaded
            }
            
            // Send the scraping request with autoUpload flag set to true
            chrome.tabs.sendMessage(
                currentTab.id,
                {
                    action: 'scrapeRecordings',
                    autoUpload: true  // Keep this enabled for automatic upload
                },
                function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Error during scraping:', chrome.runtime.lastError);
                        updateRecordingsUIState('error', chrome.runtime.lastError.message || 'Failed to communicate with page')
                            .catch(err => console.error('Error updating UI state:', err));
                        return;
                    }
                    
                    if (!response) {
                        console.error('No response from content script');
                        updateRecordingsUIState('error', 'No response from page')
                            .catch(err => console.error('Error updating UI state:', err));
                        return;
                    }
                    
                    console.log('Recording scrape response:', response);
                    
                    // Start polling for status immediately
                    // This ensures we keep checking status even if the scraping is async
                    checkScrapingStatus(currentCourseId);
                    
                    // If the response indicates success (which means it might have finished synchronously)
                    if (response.success) {
                        // Save recordings to storage
                        chrome.storage.local.get(['scraped_recordings'], function(result) {
                            // Get existing recordings data or initialize empty object
                            const recordingsData = result.scraped_recordings || {};
                            
                            // Update recordings for this course
                            recordingsData[currentCourseId] = response.recordings;
                            
                            // Save updated recordings data
                            chrome.storage.local.set({'scraped_recordings': recordingsData}, function() {
                                console.log('Recordings saved to storage');
                                
                                // Update the recording state
                                saveRecordingState(currentCourseId, {
                                    isLoading: false,
                                    state: 'complete',
                                    message: `Found ${response.recordings.length} recordings`
                                });
                                
                                // Trigger auto-upload immediately if recordings were found (more reliable than messaging)
                                if (response.recordings && response.recordings.length > 0 && response.autoUpload) {
                                    console.log('Initiating auto-upload directly from popup...');
                                    window.autoUploadTriggered = true;
                                    
                                    // Update UI to show we're initiating auto-upload
                                    updateRecordingsUIState('scraping', `Auto-uploading ${response.recordings.length} recordings...`)
                                        .then(() => {
                                            // Perform the auto-upload
                                            autoUploadRecordings(response.recordings, currentCourseId)
                                                .then(() => {
                                                    window.autoUploadTriggered = false;
                                                })
                                                .catch(err => {
                                                    console.error('Auto upload error:', err);
                                                    window.autoUploadTriggered = false;
                                                });
                                        });
                                }
                            });
                        });
                        
                        // Store for later use
                        window.lastRecordingsData = response.recordings;
                        
                        // Update UI and display recordings (async)
                        updateRecordingsUIState('complete', `Found ${response.recordings.length} recordings`)
                            .then(() => {
                                displayRecordings(response.recordings)
                                    .catch(err => console.error('Error displaying recordings:', err));
                            })
                            .catch(err => console.error('Error updating UI state:', err));
                    }
                }
            );
        });
    } catch (error) {
        console.error('Error in initiateRecordingScraping:', error);
        updateRecordingsUIState('error', error.message || 'An unexpected error occurred');
    }
}

// Add this function to initialize the popup UI based on stored data
async function initializeRecordingsUI() {
    try {
        // Get current course ID
        const currentCourseId = await getCurrentCourseId();
        if (!currentCourseId) {
            console.log('No course ID found, cannot initialize recordings UI');
            return;
        }

        console.log('Initializing recordings UI for course ID:', currentCourseId);
        
        // Check if we have scraped recordings stored for this course
        const storageData = await new Promise(resolve => {
            chrome.storage.local.get(['scraped_recordings', 'recording_state'], resolve);
        });
        
        const recordingsData = storageData.scraped_recordings || {};
        const courseRecordings = recordingsData[currentCourseId] || [];
        
        // Get the recording state
        const recordingState = storageData.recording_state || {};
        const courseState = recordingState[currentCourseId] || {};
        
        console.log('Found stored recordings:', courseRecordings.length, 'with state:', courseState);
        
        // Hide the main options and "Scrape Recordings" button immediately if we have recordings or are loading
        if (courseRecordings.length > 0 || (courseState && courseState.isLoading)) {
            const mainOptions = document.querySelector('.main-options');
            if (mainOptions) mainOptions.style.display = 'none';
        }
        
        // Flag to track if we've received a response from content script
        let receivedContentScriptResponse = false;
        
        // Always check the live scraping status first before relying on stored state
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (!tabs || tabs.length === 0) {
                console.log('No active tab found, reverting to stored state');
                continueWithStoredState();
            return;
        }

            const currentTab = tabs[0];
            
            // Timeout for content script check - use stored state if no response after 1 second
            const statusCheckTimeout = setTimeout(() => {
                if (!receivedContentScriptResponse) {
                    console.log('Status check timed out, using stored state');
                    continueWithStoredState();
                }
            }, 1000);
            
            // Try to ping and check status from the content script
            chrome.tabs.sendMessage(currentTab.id, {action: 'ping'}, (pingResponse) => {
            if (chrome.runtime.lastError) {
                    console.log('Content script not available, using stored state:', chrome.runtime.lastError);
                    clearTimeout(statusCheckTimeout);
                    continueWithStoredState();
                return;
            }
                
                // If ping is successful, check status
                chrome.tabs.sendMessage(currentTab.id, {action: 'getRecordingsStatus'}, (statusResponse) => {
                    // Mark that we received a response
                    receivedContentScriptResponse = true;
                    clearTimeout(statusCheckTimeout);
                    
                    if (chrome.runtime.lastError || !statusResponse) {
                        console.log('Error getting status, using stored state:', chrome.runtime.lastError);
                        continueWithStoredState();
                        return;
                    }
                    
                    console.log('Got real-time status:', statusResponse);
                    
                    // If scraping is active, show scraping UI and start polling
                    if (statusResponse.isActive) {
                        // First save the state in case user closes popup
                        saveRecordingState(currentCourseId, {
                            isLoading: true,
                            state: 'scraping',
                            message: `Collecting recordings (${statusResponse.recordingsCount || 0} found)`
                        });
                        
                        // Show the scraping UI
                        updateRecordingsUIState('scraping', `Collecting recordings (${statusResponse.recordingsCount || 0} found)`)
                            .then(() => {
                                // Start polling for status updates
                                checkScrapingStatus(currentCourseId);
                            });
                    } else if (statusResponse.isComplete) {
                        // If scraping is complete but we don't have recordings yet
                        chrome.storage.local.get(['scraped_recordings'], async (result) => {
                            const recordingsData = result.scraped_recordings || {};
                            const courseRecordings = recordingsData[currentCourseId] || [];
                            
                            if (courseRecordings.length > 0) {
                                // We have recordings, display them
                                window.lastRecordingsData = courseRecordings;
                                await updateRecordingsUIState('complete', `Found ${courseRecordings.length} recordings`);
                                await displayRecordings(courseRecordings);
                        } else {
                                // No recordings yet, but scraping is complete - odd case
                                await updateRecordingsUIState('complete', 'No recordings found');
                            }
                            
                            // Update stored state to match
                            saveRecordingState(currentCourseId, {
                                isLoading: false,
                                state: 'complete',
                                message: courseRecordings.length > 0 ? 
                                    `Found ${courseRecordings.length} recordings` : 
                                    'No recordings found'
                            });
                        });
                    } else {
                        // Not active and not complete, fall back to stored state
                        continueWithStoredState();
                    }
                });
            });
        });
        
        // Helper function to continue with stored state if we can't get live status
        async function continueWithStoredState() {
            // Check if there's an in-progress scraping operation
            if (courseState && courseState.isLoading) {
                console.log('Scraping is in progress according to stored state, showing progress UI');
                // Immediately show scraping UI
                await updateRecordingsUIState('scraping', courseState.message || 'Collecting recordings...');
                
                // Also check if we need to update the status
                checkScrapingStatus(currentCourseId);
                return;
            }
            
            // Check if we have recordings to display
            if (courseRecordings.length > 0) {
                console.log('Found recordings to display:', courseRecordings.length);
                // We have recordings, display them
                await updateRecordingsUIState('complete', `Found ${courseRecordings.length} recordings`);
                
                // Store for later use
                window.lastRecordingsData = courseRecordings;
                
                // Display the recordings
                await displayRecordings(courseRecordings);
            } else if (courseState && courseState.state === 'complete') {
                // Completed but no recordings (edge case)
                await updateRecordingsUIState('complete', courseState.message || 'No recordings found');
            } else if (courseState && courseState.state === 'error') {
                // There was an error
                await updateRecordingsUIState('error', courseState.message || 'Error during recording scraping');
            } else {
                // Default case, show main options
                const mainOptions = document.querySelector('.main-options');
                if (mainOptions) mainOptions.style.display = 'flex';
            }
        }
        } catch (error) {
        console.error('Error initializing recordings UI:', error);
        // If there's an error, fallback to showing the main options
        const mainOptions = document.querySelector('.main-options');
        if (mainOptions) mainOptions.style.display = 'flex';
    }
}

// Function to check scraping status
function checkScrapingStatus(courseId) {
    console.log('Checking scraping status for course ID:', courseId);
    
    if (!courseId) {
        console.error('No course ID provided for status check');
        return;
    }
    
    // Check if we should continue polling (based on storage)
    chrome.storage.local.get(['recording_state'], (result) => {
        const recordingState = result.recording_state || {};
        const courseState = recordingState[courseId] || {};
        
        // If we're not loading anymore, stop polling
        if (courseState.state !== 'scraping' && !courseState.isLoading) {
            console.log('Not polling for scraping status because scraping is not active');
            return;
        }
        
        // Get the current active tab
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || tabs.length === 0) {
                console.error('No active tab found during status check');
                return;
            }
            
            const currentTab = tabs[0];
            
            // Send status request
            chrome.tabs.sendMessage(currentTab.id, {action: 'getRecordingsStatus'}, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error checking scraping status:', chrome.runtime.lastError);
                    return;
                }
                
                if (!response) {
                    console.error('No response from content script for status check');
                    return;
                }
                
                console.log('Scraping status response:', response);
                
                // If scraping is still active, update progress and poll again
                if (response.isActive) {
                    console.log(`Scraping is still active. Found ${response.recordingsCount || 0} recordings so far.`);
                    
                    // Update UI
                    updateRecordingsUIState('scraping', `Collecting recordings (${response.recordingsCount || 0} found)...`)
                        .catch(err => console.error('Error updating UI state:', err));
                    
                    // Poll again after a short delay
                    setTimeout(() => checkScrapingStatus(courseId), 2000);
                } 
                // If scraping is complete but it was active (just completed)
                else if (response.isComplete && !response.isActive) {
                    console.log(`Scraping is complete. Found ${response.recordingsCount || 0} recordings.`);
                    
                    // Get the latest recordings data
                    chrome.storage.local.get(['scraped_recordings'], function(result) {
                        const recordingsData = result.scraped_recordings || {};
                        const recordings = recordingsData[courseId] || [];
                        
                        // Update the recording state
                        saveRecordingState(courseId, {
                            isLoading: false,
                            state: 'complete',
                            message: `Found ${recordings.length || response.recordingsCount || 0} recordings`
                        });
                        
                        // If auto upload is enabled from the content script, handle it here
                        if (response.autoUpload && recordings.length > 0 && !window.autoUploadTriggered) {
                            console.log('Auto-upload flag detected, will upload recordings automatically as a fallback');
                            
                            // Set a flag to avoid duplicate uploads
                            window.autoUploadTriggered = true;
                            
                            // Update UI to show we're initiating auto-upload
                            updateRecordingsUIState('scraping', `Auto-uploading ${recordings.length} recordings (fallback)...`)
                                .then(() => {
                                    // Perform the auto-upload immediately from the popup script
                                    // This serves as a fallback in case the content script's direct upload fails
                                    autoUploadRecordings(recordings, courseId)
                                        .then(() => {
                                            // Reset flag after successful upload
                                            window.autoUploadTriggered = false;
                                            console.log('Auto-upload fallback completed successfully');
                                        })
                                        .catch(err => {
                                            console.error('Auto upload fallback error:', err);
                                            window.autoUploadTriggered = false;
                                            // If there's an error, show it but still mark as complete
                                            updateRecordingsUIState('error', `Auto-upload failed: ${err.message || 'Unknown error'}`);
                                        });
                                })
                                .catch(err => console.error('Error updating UI state:', err));
                        } else {
                            // Just update UI with completion status
                            updateRecordingsUIState('complete', `Found ${recordings.length || response.recordingsCount || 0} recordings`)
                                .then(() => {
                                    // Display the recordings if we have them
                                    if (recordings.length > 0) {
                                        displayRecordings(recordings)
                                            .catch(err => console.error('Error displaying recordings:', err));
                                    }
                                })
                                .catch(err => console.error('Error updating UI state:', err));
                        }
                    });
                }
            });
        });
    });
}

// Add this to document.addEventListener('DOMContentLoaded')
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...
    
    // Initialize UI with any stored recordings data
    initializeRecordingsUI();
    
    // ... existing code ...
});

// Helper function to save recording state to chrome.storage
function saveRecordingState(courseId, stateData) {
    chrome.storage.local.get(['recording_state'], function(result) {
        const recordingState = result.recording_state || {};
        recordingState[courseId] = stateData;
        
        chrome.storage.local.set({'recording_state': recordingState}, function() {
            console.log('Recording state saved:', stateData);
        });
    });
}

// Main entry point when popup opens
document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup opened, initializing...');
    
    // Initialize basic UI elements 
    initializeElements();
    
    // For specific pages, initialize their UI
    const url = document.URL;
    if (url.includes('popup.html')) {
        // Check if we're on the inbox tab for Zoom recordings
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0].url.includes('/conversations')) {
                console.log('On Canvas Inbox page, initializing recordings UI');
                
                // First check if there's an active scraping process
                getCurrentCourseId().then(courseId => {
                    if (courseId) {
                        // Immediately check scraping status when popup opens
                        checkScrapingStatus(courseId);
                    }
                    
                    // Initialize UI after checking status
                    initializeRecordingsUI();
                });
            } else if (tabs[0].url.includes('instructure.com')) {
                // Handle other Canvas pages
                setupCanvasUI(tabs[0].url);
            } else {
                // Not on a Canvas page
                showNonCanvasUI();
            }
        });
    }
});

// Remove all existing DOMContentLoaded event listeners and replace with a single one
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Popup opened, initializing...');
    
    // Initialize basic UI elements first
    initializeElements();
    setupEventListeners();
    
    try {
        // Get current tab info
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (!tabs || tabs.length === 0) {
            console.error('No active tab found');
                    return;
                }

        const currentTab = tabs[0];
        const currentUrl = currentTab.url;
        
        // Check if we're on Canvas
        if (!currentUrl.includes('ufl.instructure.com')) {
            updateUIState(UIState.NOT_CANVAS, 'Please navigate to Canvas to use FaciliGator');
                    return;
                }

        // Get course ID
        const courseId = await getCurrentCourseId();
        if (!courseId) {
            updateUIState(UIState.NOT_COURSE, 'Please navigate to a Canvas course');
            return;
        }
        
        // Handle different Canvas pages
        if (currentUrl.includes('/conversations')) {
            console.log('On Canvas Inbox page, checking recording status...');
            
            // First check if there's an active scraping process
            // This needs to happen before initializing UI
            await checkScrapingStatus(courseId);
            
            // Then initialize the recordings UI
            await initializeRecordingsUI();
            
            // Start polling for status updates if needed
            chrome.storage.local.get(['recording_state'], function(result) {
                const recordingState = result.recording_state || {};
                const courseState = recordingState[courseId] || {};
                
                if (courseState.isLoading) {
                    // If we think we're still loading, verify with content script
                    chrome.tabs.sendMessage(currentTab.id, {action: 'getRecordingsStatus'}, function(response) {
                        if (!chrome.runtime.lastError && response && response.isActive) {
                            // Content script confirms we're still scraping
                            checkScrapingStatus(courseId);
                        }
                    });
                }
            });
        } else if (currentUrl.includes('/assignments')) {
            // Handle assignments page
            const state = checkCourseState(courseId);
            if (state.isScraped && state.assignments) {
                displayAssignments(state.assignments);
                updateUIState(UIState.COMPLETE, 'Showing previously collected assignments');
            } else if (state.isLoading) {
                updateUIState(UIState.SCRAPING, 'Collecting assignments...');
                showProgress('Scraping in progress...', 0, 0, 'Initialization');
                } else {
                updateUIState(UIState.READY, 'Ready to scrape assignments');
                }
        } else {
            // Other Canvas pages
            updateUIState(UIState.NOT_ASSIGNMENTS, 'Please navigate to Assignments or Inbox');
            }

    } catch (error) {
        console.error('Error during popup initialization:', error);
        updateUIState(UIState.ERROR, 'Error initializing: ' + error.message);
    }
});

// Function to automatically upload all recordings
async function autoUploadRecordings(recordings, courseId) {
    try {
        console.log('Auto-uploading recordings:', recordings.length);
        
        if (!recordings || recordings.length === 0) {
            console.log('No recordings to auto-upload');
            return { status: 'success', message: 'No recordings to upload', count: 0 };
        }
        
        // Check for auth token first
        const token = await new Promise((resolve) => {
            chrome.storage.local.get(['token'], function(result) {
                if (chrome.runtime.lastError) {
                    console.error('Error getting token:', chrome.runtime.lastError);
                    resolve(null);
                } else {
                    resolve(result.token || null);
                }
            });
        });

        if (!token) {
            const error = 'Authentication required. Please log in.';
            console.error('Auto-upload failed:', error);
            await updateRecordingsUIState('error', error);
            return { status: 'error', error };
        }
        
        // Update UI state to show we're uploading
        await updateRecordingsUIState('scraping', `Auto-uploading ${recordings.length} recordings...`);
        
        // Generate a batch ID
        const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        console.log('Generated batch ID for auto-upload:', batchId);
        
        // Mark all recordings as selected for upload
        const recordingsToUpload = recordings.map(recording => ({
            ...recording,
            selected: true,
            courseId: courseId || recording.courseId
        }));
        
        console.log('Prepared recordings for upload:', recordingsToUpload.length);
        
        // Log each recording being uploaded
        recordingsToUpload.forEach((recording, index) => {
            console.log(`Recording ${index + 1}:`, {
                title: recording.title,
                url: recording.url,
                date: recording.date,
                courseId: recording.courseId,
                transcript: recording.transcript ? 'Present' : 'None'
            });
        });
        
        // Perform the upload
        console.log('Calling uploadZoomRecordings function...');
        const result = await uploadZoomRecordings(recordingsToUpload, batchId);
        console.log('Upload result:', result);
        
        // Update UI based on upload result
        if (result && result.status === 'success') {
            console.log('Auto-upload success:', result);
            await updateRecordingsUIState('complete', `Successfully auto-uploaded ${recordings.length} recordings`);
        } else {
            const errorMsg = result?.error || 'Unknown error';
            console.error('Auto-upload result contained error:', errorMsg);
            await updateRecordingsUIState('error', `Failed to auto-upload recordings: ${errorMsg}`);
        }
        
        return result || { status: 'unknown', message: 'No result returned from upload function' };
    } catch (error) {
        console.error('Exception in autoUploadRecordings:', error);
        await updateRecordingsUIState('error', `Auto-upload failed: ${error.message || 'Unknown error'}`);
        return { status: 'error', error: error.message || 'Unknown error' };
    }
}

// Add message listener for recordingScrapingComplete
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    // Handle recording scraping complete event from content script
    if (message.action === 'recordingScrapingComplete') {
        console.log('Received recordingScrapingComplete message:', message);
        
        // Automatically upload the recordings to the backend
        autoUploadRecordings(message.recordings, message.courseId)
            .then(result => {
                console.log('Auto-upload complete:', result);
                try {
                    // Handle potential runtime.lastError here
                    if (chrome.runtime.lastError) {
                        console.warn('Warning during response: ', chrome.runtime.lastError.message);
                    }
                    sendResponse({ status: 'success', result });
                } catch (error) {
                    console.error('Error sending response:', error);
                }
            })
            .catch(error => {
                console.error('Auto-upload error:', error);
                try {
                    // Handle potential runtime.lastError here
                    if (chrome.runtime.lastError) {
                        console.warn('Warning during error response: ', chrome.runtime.lastError.message);
                    }
                    sendResponse({ status: 'error', error: error.message });
                } catch (sendError) {
                    console.error('Error sending error response:', sendError);
                }
            });
        
        return true; // Keep message channel open for async response
    }
});

// Add a message listener for recordingsUploaded
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    // Handle successful recording uploads from content script
    if (message.action === 'recordingsUploaded') {
        console.log('Received recordingsUploaded message:', message);
        
        // Update the UI to reflect the upload
        if (message.success) {
            updateRecordingsUIState('complete', `Successfully uploaded ${message.count} recordings`)
                .then(() => {
                    // Reset checkboxes since recordings have been uploaded
                    document.querySelectorAll('.recording-checkbox:checked').forEach(checkbox => {
                        checkbox.checked = false;
                    });
                    
                    console.log('UI updated after successful upload');
                    // Clear auto-upload trigger to allow manual uploads if needed
                    window.autoUploadTriggered = false;
                })
                .catch(err => console.error('Error updating UI after upload:', err));
        } else {
            updateRecordingsUIState('error', `Upload failed: ${message.error || 'Unknown error'}`)
                .catch(err => console.error('Error updating UI on upload failure:', err));
        }
        
        // Send a response to acknowledge receipt
        if (sendResponse) {
            sendResponse({ status: 'received' });
        }
        
        return true; // Keep message channel open for async response
    }
});