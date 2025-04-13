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

// Store recording state
const recordingState = {};

// Initialize elements when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
	initializeElements();
	setupEventListeners();
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
	console.log('Setting loading state:', isLoading);
	if (isLoading) {
		if (elements.loadingIcon) elements.loadingIcon.style.display = 'block';
		if (elements.progressContainer) elements.progressContainer.style.display = 'block';
		if (elements.scrapeButton) elements.scrapeButton.disabled = true;
		if (elements.assignmentsList) elements.assignmentsList.innerHTML = '';
	} else {
		if (elements.loadingIcon) elements.loadingIcon.style.display = 'none';
		if (elements.progressContainer) elements.progressContainer.style.display = 'none';
		if (elements.scrapeButton) elements.scrapeButton.disabled = false;
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
	if (elements.startProcess) elements.startProcess.style.display = 'none';
	if (elements.waiting) elements.waiting.style.display = 'block';
	if (elements.progressContainer) elements.progressContainer.style.display = 'block';
	if (elements.pText) elements.pText.textContent = "Processing your request...";
	
	// Initialize progress elements
	if (elements.progressMessage) {
		elements.progressMessage.textContent = "Scanning Canvas content";
	}
	
	let progressSteps = [
		"Analyzing page structure...",
		"Identifying downloadable content...",
		"Preparing file information...",
		"Organizing content structure..."
	];
	
	let currentStep = 0;
	let progressInterval = setInterval(() => {
		if (elements.progressStatus) elements.progressStatus.textContent = progressSteps[currentStep];
		currentStep = (currentStep + 1) % progressSteps.length;
	}, 2000);

	// Add timeout to prevent infinite loading
	setTimeout(() => {
		if (elements.waiting && elements.waiting.style.display === 'block') {
			clearInterval(progressInterval);
			elements.waiting.style.display = 'none';
			if (elements.progressContainer) elements.progressContainer.style.display = 'none';
			if (elements.pText) elements.pText.textContent = "Request timed out";
			if (elements.p2Text) {
				elements.p2Text.innerHTML = `
					<div class="error-message">
						<span class="error-icon">⚠️</span> Taking too long to respond
						<div class="mt-2 small">
							<ul class="text-left pl-4 mb-0">
								<li>Check your internet connection</li>
								<li>Make sure you're logged into Canvas</li>
								<li>Try refreshing the page</li>
							</ul>
						</div>
					</div>`;
			}
			if (elements.downloadContainer) {
				elements.downloadContainer.innerHTML = `
					<div class="text-center mt-3">
						<a href="#" class="reload text-primary">Try Again</a>
					</div>`;
			}
			
			const reloadButton = document.querySelector('.reload');
			if (reloadButton) {
				reloadButton.addEventListener('click', function() {
					clean_tab_entry();
				});
			}
		}
	}, 30000);
}

function make_popup_free(){
	if (elements.waiting) elements.waiting.style.display = 'none';
	if (elements.progressContainer) elements.progressContainer.style.display = 'none';
	if (elements.pText) elements.pText.innerHTML = "Ready to download! <span class='gator-emoji'>🐊</span>";
	if (elements.startProcess) elements.startProcess.style.display = 'none';
	if (elements.close) elements.close.style.display = 'block';
	
	// Show success message
	if (elements.p2Text) {
		elements.p2Text.innerHTML = `
			<div class="success-message">
				<span class="success-icon">✅</span> Content analyzed successfully
			</div>`;
	}
	
	setTimeout(() => {
		if (elements.p2Text) elements.p2Text.textContent = "";
	}, 3000);
	
	if (elements.close) {
		elements.close.addEventListener('click', function() {
			window.close();
		});
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
    const url = window.location.href;
    const match = url.match(/\/courses\/(\d+)/);
    return match ? match[1] : null;
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
function updateRecordingsUIState(state, message) {
    const container = document.getElementById('recordings-status-container');
    const messageEl = document.getElementById('recordings-status-message');
    const successIcon = document.getElementById('recordings-success-icon');
    const errorIcon = document.getElementById('recordings-error-icon');
    const loadingIcon = document.getElementById('recordings-loading-icon');
    const navigationContainer = document.getElementById('recordings-navigation-container');
    const actionContainer = document.getElementById('recordings-action-container');
    const progressContainer = document.getElementById('recordings-progress-container');
    const resultsContainer = document.getElementById('recordings-results-container');

    if (!container || !messageEl) return;

    // Hide all icons first
    [successIcon, errorIcon, loadingIcon].forEach(icon => {
        if (icon) icon.style.display = 'none';
    });

    messageEl.textContent = message;

    switch (state) {
        case 'ready':
            if (actionContainer) actionContainer.style.display = 'block';
            if (navigationContainer) navigationContainer.style.display = 'none';
            if (progressContainer) progressContainer.style.display = 'none';
            if (resultsContainer) resultsContainer.style.display = 'none';
            break;

        case 'error':
            if (errorIcon) errorIcon.style.display = 'block';
            if (actionContainer) actionContainer.style.display = 'none';
            if (navigationContainer) navigationContainer.style.display = 'block';
            if (progressContainer) progressContainer.style.display = 'none';
            if (resultsContainer) resultsContainer.style.display = 'none';
            break;

        case 'scraping':
            if (loadingIcon) loadingIcon.style.display = 'block';
            if (actionContainer) actionContainer.style.display = 'none';
            if (navigationContainer) navigationContainer.style.display = 'none';
            if (progressContainer) progressContainer.style.display = 'block';
            if (resultsContainer) resultsContainer.style.display = 'none';
            break;

        case 'complete':
            if (successIcon) successIcon.style.display = 'block';
            if (actionContainer) actionContainer.style.display = 'block';
            if (navigationContainer) navigationContainer.style.display = 'none';
            if (progressContainer) progressContainer.style.display = 'none';
            if (resultsContainer) resultsContainer.style.display = 'block';
            break;
    }
}

// Function to display recordings
function displayRecordings(recordings) {
    const container = document.getElementById('recordings-list');
    if (!container) return;

    container.innerHTML = '';
    
    if (recordings.length === 0) {
        container.innerHTML = '<div class="recording-item">No recordings found</div>';
        return;
    }

    recordings.forEach(recording => {
        const item = document.createElement('div');
        item.className = 'recording-item';
        item.innerHTML = `
            <div class="recording-date">${recording.date}</div>
            <a href="${recording.url}" target="_blank" class="recording-url">View Recording</a>
        `;
        container.appendChild(item);
    });
}

// Function to initiate recording scraping
async function initiateRecordingScraping() {
    try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        const currentTab = tabs[0];
        const courseId = currentTab.url.match(/course=course_(\d+)/)?.[1];
        
        if (!courseId) {
            updateRecordingsUIState('error', 'Please select a course filter first');
            return;
        }

        // Check if already scraping
        const state = recordingState[courseId];
        if (state && state.isLoading) {
            updateRecordingsUIState('error', 'Already collecting recordings...');
            return;
        }

        // Update UI state
        updateRecordingsUIState('scraping', 'Starting to collect recordings...');
        
        // Update recording state
        recordingState[courseId] = { isLoading: true };

        // Send message to content script
        chrome.tabs.sendMessage(currentTab.id, { action: 'getRecordings' }, response => {
            if (chrome.runtime.lastError) {
                updateRecordingsUIState('error', 'Error: Content script not ready');
                return;
            }

            if (response.error) {
                updateRecordingsUIState('error', response.error);
                return;
            }

            // Update recording state
            recordingState[courseId] = {
                isLoading: false,
                recordings: response.recordings
            };

            // Display results
            displayRecordings(response.recordings);
            updateRecordingsUIState('complete', `Found ${response.recordings.length} recordings`);
        });

    } catch (error) {
        updateRecordingsUIState('error', error.message || 'An unexpected error occurred');
    }
}