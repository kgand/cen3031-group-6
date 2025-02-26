// Canvas Content Script for FaciliGator

console.log('FaciliGator content script loaded');

// Add cancellation flag at the top of the file
let isScraping = false;
let shouldCancel = false;

// Helper functions
function sanitizeString(str) {
	return str.replace(/[/\\?%*:|"<>]/g, "-").trim();
}

function getCourseIdFromUrl(url) {
	const match = url.match(/\/courses\/(\d+)/);
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

async function navigateToSection(section) {
	const currentUrl = window.location.href;
	const courseMatch = currentUrl.match(/\/courses\/(\d+)/);
	
	if (!courseMatch) {
		throw new Error("Not in a Canvas course");
	}
	
	const courseId = courseMatch[1];
	const targetUrl = `${window.location.origin}/courses/${courseId}/${section}`;
	
	if (currentUrl === targetUrl || currentUrl.startsWith(targetUrl)) {
		return true;
	}
	
	window.location.href = targetUrl;
	return false;
}

// Function to scrape content directly from the current page
function scrapeContent() {
	console.log('Scraping content from current page...');
	
	// Get assignment description and full HTML for debugging
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
		// New Canvas UI selectors
		'[data-testid="rubric-tab"]',
		'.rubric',
		// Classic Canvas UI selectors
		'#rubrics .rubric_container',
		'.rubric_container'
	];

	for (const selector of rubricSelectors) {
		const rubricElement = document.querySelector(selector);
		if (rubricElement) {
			console.log('Found rubric using selector:', selector);
			
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
				const criteria = rubricElement.querySelectorAll(criteriaSelector);
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

	console.log('Content scraped:', {
		descriptionLength: description.length,
		rubricItems: rubric.length
	});

	return {
		description,
		rubric: rubric.length > 0 ? rubric : null,
		fullHtml // Include full HTML for debugging
	};
}

async function scrapeAssignmentContent(assignmentUrl) {
	return new Promise((resolve, reject) => {
		try {
			console.log('Requesting content scraping for:', assignmentUrl);
			
			// Send message to background script to handle tab creation and scraping
			chrome.runtime.sendMessage({
				action: 'scrapeAssignmentContent',
				url: assignmentUrl
			}, response => {
				if (chrome.runtime.lastError) {
					console.error('Error in message response:', chrome.runtime.lastError);
					reject(chrome.runtime.lastError);
					return;
				}
				
				if (response.error) {
					console.error('Error from background script:', response.error);
					reject(new Error(response.error));
					return;
				}
				
				resolve(response.content);
			});
		} catch (error) {
			console.error('Error requesting content scrape:', error);
			reject(error);
		}
	});
}

async function scrapeAssignments() {
	console.log('Starting assignment scraping');
	shouldCancel = false;
	isScraping = true;
	
	try {
		if (!window.location.href.includes('instructure.com')) {
			console.error('Not on Canvas');
			throw new Error("Please navigate to Canvas first");
		}

		const courseId = getCourseIdFromUrl(window.location.href);
		if (!courseId) {
			console.error('No course ID found in URL');
			throw new Error("Please navigate to a Canvas course first");
		}

		const isOnAssignmentsPage = window.location.href.includes('/assignments');
		if (!isOnAssignmentsPage) {
			console.error('Not on assignments page');
			throw new Error("Please navigate to the Assignments page");
		}

		console.log('Scraping assignments from course:', courseId);
		const allAssignments = [];
		
		try {
			// Wait for the content to load
			console.log('Waiting for content to load...');
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Check if cancelled during wait
			if (shouldCancel) {
				console.log('Scraping cancelled during initial wait');
				return { status: 'cancelled' };
			}

			// Get all assignment items across all groups
			const assignmentItems = document.querySelectorAll('li.assignment');
			console.log('Found assignments:', assignmentItems.length);

			if (assignmentItems.length === 0) {
				throw new Error("No assignments found on this page");
			}

			let processedAssignments = 0;
			const totalAssignments = assignmentItems.length;

			// Process all assignments
			for (const item of assignmentItems) {
				// Check for cancellation at the start of each iteration
				if (shouldCancel) {
					console.log('Scraping cancelled during assignment processing');
					return { status: 'cancelled' };
				}

				try {
					// Get assignment title and URL
					const titleElement = item.querySelector('a.ig-title');
					if (!titleElement) {
						console.log('Skipping item - no title element found');
						processedAssignments++;
						continue;
					}

					const title = titleElement.textContent.trim();
					const url = titleElement.href;
					console.log('Processing assignment:', title);

					// Send progress update
					chrome.runtime.sendMessage({
						action: 'updateProgress',
						data: {
							current: processedAssignments + 1,
							total: totalAssignments,
							currentTitle: title
						}
					});

					// Get assignment details
					const dueDateElement = item.querySelector('.assignment-date-due, .due_date');
					let dueDate = 'No due date';
					if (dueDateElement) {
						const dueDateText = dueDateElement.textContent.trim();
						// Clean up the due date format
						const cleanedDate = dueDateText
							.replace(/^Due\s*:?\s*/i, '') // Remove "Due:" prefix
							.replace(/\s+/g, ' ') // Replace multiple spaces with single space
							.replace(/\n/g, '') // Remove newlines
							.replace(/at\s+/i, ' at ') // Normalize "at" spacing
							.split(/\s+(?=[A-Za-z]{3}\s+\d{1,2})/) // Split at month name to catch duplicates
							.shift() // Take only the first occurrence
							.trim();

						// Parse and format the date in ISO-like format
						const monthMap = {
							'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
							'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
						};
						
						const match = cleanedDate.match(/([A-Za-z]{3})\s+(\d{1,2})(?:\s+at\s+(.+))?/);
						if (match) {
							const month = monthMap[match[1]];
							const day = parseInt(match[2], 10);
							const year = new Date().getFullYear(); // Current year since Canvas doesn't show year
							const timeStr = match[3] ? match[3].trim() : '';

							// Pad month and day to two digits
							const monthStr = month < 10 ? '0' + month : '' + month;
							const dayStr = day < 10 ? '0' + day : '' + day;

							if (timeStr) {
								// Parse time string (e.g., "11:59pm" or "8am") to 24-hour format
								const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
								if (timeMatch) {
									let hours = parseInt(timeMatch[1], 10);
									const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
									const ampm = timeMatch[3].toLowerCase();
									if (ampm === 'pm' && hours < 12) {
										hours += 12;
									} else if (ampm === 'am' && hours === 12) {
										hours = 0;
									}
									const hoursStr = hours < 10 ? '0' + hours : '' + hours;
									const minutesStr = minutes < 10 ? '0' + minutes : '' + minutes;
									dueDate = `${year}-${monthStr}-${dayStr}T${hoursStr}:${minutesStr}:00`;
								} else {
									dueDate = `${year}-${monthStr}-${dayStr}`;
								}
							} else {
								dueDate = `${year}-${monthStr}-${dayStr}`;
							}
						} else {
							dueDate = cleanedDate; // Fallback to cleaned date if pattern doesn't match
						}
					}

					// Get assignment content
					const content = await scrapeAssignmentContent(url);
					console.log('Got assignment content for:', title, content);

					const assignmentData = {
						title,
						url,
						dueDate,
						description: content.description || '',
						rubric: content.rubric || [],
						fullHtml: content.fullHtml || ''
					};

					allAssignments.push(assignmentData);
					console.log('Added assignment:', assignmentData);

					processedAssignments++;

				} catch (error) {
					console.error('Error processing individual assignment:', error);
					processedAssignments++;
					if (shouldCancel) {
						return { status: 'cancelled' };
					}
				}
			}

			// Log the final data in a structured format
			console.log('ASSIGNMENTS_DATA_START');
			console.log(JSON.stringify({
				status: shouldCancel ? 'cancelled' : 'complete',
				courseId: courseId,
				totalAssignments: allAssignments.length,
				assignments: allAssignments.map(a => ({
					title: a.title,
					url: a.url,
					dueDate: a.dueDate,
					description: a.description,
					rubric: a.rubric
				}))
			}, null, 2));
			console.log('ASSIGNMENTS_DATA_END');

			isScraping = false;
			return {
				status: shouldCancel ? 'cancelled' : 'complete',
				courseId: courseId,
				assignments: allAssignments
			};

		} catch (error) {
			console.error('Error during assignment list processing:', error);
			throw error;
		}

	} catch (error) {
		console.error('Error during assignment scraping:', error);
		isScraping = false;
		return {
			status: 'error',
			error: error.message || "An unexpected error occurred"
		};
	} finally {
		isScraping = false;
	}
}

// Initialize content script
document.addEventListener('DOMContentLoaded', () => {
	console.log('FaciliGator: DOM Content Loaded');
	console.log('Current URL:', window.location.href);
	console.log('Is assignments page:', window.location.href.includes('/assignments'));
});

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log('Content script received message:', request);

	if (request.action === 'scrape') {
		console.log('Starting assignment scraping');
		shouldCancel = false;
		isScraping = true;

		// Send immediate acknowledgment
		sendResponse({ status: 'started' });

		scrapeAssignments().then(result => {
			// Send results back to background script
			chrome.runtime.sendMessage({
				sender: "content_canvas",
				receiver: "background",
				destination: "popup",
				type: "assignments",
				assignments: result.assignments || []
			});
		}).catch(error => {
			console.error('Error during scraping:', error);
			chrome.runtime.sendMessage({
				sender: "content_canvas",
				receiver: "background",
				destination: "popup",
				type: "error",
				error: error.message
			});
		});

		return false; // We've already sent the response
	}

	if (request.action === 'cancelScraping') {
		console.log('Received cancel request');
		shouldCancel = true;
		if (!isScraping) {
			chrome.runtime.sendMessage({
				status: 'scraping_cancelled'
			});
		}
		sendResponse({ status: 'cancelling' });
		return false; // We've already sent the response
	}

	if (request.action === 'ping') {
		sendResponse({ status: 'ok' });
		return false; // We've already sent the response
	}

	return false; // For any other messages
});