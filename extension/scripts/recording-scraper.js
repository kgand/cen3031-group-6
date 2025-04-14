// Recording scraper content script

// Guard against double-loading
if (typeof window.recordingScraperLoaded === 'undefined') {
    window.recordingScraperLoaded = true;

    console.log('Recording scraper loaded');

    // Global variables - using let instead of const to allow modification
    let isScraping = false;
    let shouldCancel = false;
    let isScrapingComplete = false;
    let scrapedRecordingsCount = 0;
    let scrapedRecordings = [];
    let shouldAutoUpload = false; // New flag to control automatic upload

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

            // Mark it as a Zoom recording
            recording.type = 'zoom';

            console.log('Found recording:', {
                title: recording.title,
                date: recording.date,
                host: recording.host,
                type: recording.type
            });
            
            // Add courseId to the recording object
            const courseId = getSelectedCourseId();
            if (courseId) {
                recording.courseId = courseId;
            }

            // Direct transcript extraction approach through background script
            console.log('Starting transcript extraction for recording URL:', recording.url);
            
            try {
                // Update progress to show we're extracting transcript
                chrome.runtime.sendMessage({
                    action: 'updateProgress',
                    data: {
                        currentTitle: `Processing transcript for: ${recording.title.substring(0, 30)}...`
                    }
                });
                
                // Request the background script to handle the transcript extraction via tabs
                const transcriptResult = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        action: 'processZoomTranscript',
                        url: recording.url,
                        title: recording.title
                    }, (response) => {
                        // Handle communication errors
                        if (chrome.runtime.lastError) {
                            console.error('Error during transcript request:', chrome.runtime.lastError);
                            resolve({
                                success: false,
                                error: chrome.runtime.lastError.message || 'Communication error',
                                recoverable: false
                            });
                            return;
                        }
                        
                        // If we got a successful response
                        if (response && response.success) {
                            resolve(response);
                        } else {
                            resolve({
                                success: false,
                                error: response?.error || 'Failed to process transcript',
                                recoverable: false
                            });
                        }
                    });
                });
                
                // Add transcript status to the recording object
                if (transcriptResult.success) {
                    recording.transcript = {
                        status: 'success',
                        segment_count: transcriptResult.segment_count || 0,
                        data: transcriptResult.transcript_data,
                        formatted_text: transcriptResult.formatted_text
                    };
                    console.log(`Successfully extracted transcript with ${recording.transcript.segment_count} segments`);
                } else {
                    recording.transcript = {
                        status: 'failed',
                        error: transcriptResult.error || 'Unknown error',
                        recoverable: false
                    };
                    console.warn('Transcript extraction failed:', recording.transcript.error);
                }
            } catch (transcriptError) {
                console.error('Error during transcript extraction:', transcriptError);
                recording.transcript = {
                    status: 'error',
                    error: 'Exception during transcript extraction: ' + transcriptError.message
                };
            }
            
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
            isScrapingComplete = false;
            scrapedRecordingsCount = 0;
            scrapedRecordings = [];
            
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
            let transcriptSuccessCount = 0;
            let transcriptFailedCount = 0;
            const totalConversations = conversations.length;

            // Process each conversation one at a time
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
                            currentTitle: `Processing recording ${processedCount} of ${totalConversations}...`
                        }
                    });

                    // Extract recording info and process Zoom link directly
                    console.log(`Processing recording ${processedCount} of ${totalConversations}`);
                    const recording = await extractRecordingInfo(conversation);
                    
                    if (recording) {
                        recordings.push(recording);
                        successfulCount++;
                        
                        // Track transcript extraction status
                        if (recording.transcript) {
                            if (recording.transcript.status === 'success') {
                                transcriptSuccessCount++;
                            } else if (recording.transcript.status === 'failed' || recording.transcript.status === 'error') {
                                transcriptFailedCount++;
                            }
                        }
                        
                        // Update progress with transcript information
                        chrome.runtime.sendMessage({
                            action: 'updateProgress',
                            data: {
                                current: processedCount,
                                total: totalConversations,
                                currentTitle: `Processed ${processedCount} of ${totalConversations} recordings (${transcriptSuccessCount} transcripts extracted)`
                            }
                        });
                        
                        // Give the UI a moment to update
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } else {
                        console.warn(`Failed to extract recording info for conversation ${processedCount}`);
                    }

                } catch (error) {
                    console.error(`Error processing conversation ${processedCount}:`, error);
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
                transcriptSuccessful: transcriptSuccessCount,
                transcriptFailed: transcriptFailedCount,
                recordings: recordings.map(r => ({
                    title: r.title,
                    date: r.date,
                    host: r.host,
                    url: r.url,
                    type: r.type || 'zoom', // Default to zoom for backward compatibility
                    transcript: r.transcript || null
                }))
            }, null, 2));
            console.log('RECORDINGS_DATA_END');

            console.log(`Scraping complete. Successfully extracted ${successfulCount} of ${conversations.length} recordings, with ${transcriptSuccessCount} transcripts`);
            isScrapingComplete = true;
            scrapedRecordingsCount = recordings.length;
            scrapedRecordings = recordings;
            isScraping = false;

            // Always try to upload recordings if any were found, regardless of shouldAutoUpload flag
            if (recordings.length > 0) {
                console.log('Recordings found, starting direct upload to backend...');
                try {
                    // First, get the auth token from storage
                    chrome.storage.local.get(['token', 'facilitator_auth_token'], async function(result) {
                        if (chrome.runtime.lastError) {
                            console.error('Error getting token from storage:', chrome.runtime.lastError);
                            return;
                        }

                        // Try to get token from either storage key
                        const token = result.token || result.facilitator_auth_token;
                        if (!token) {
                            console.error('No authentication token found for auto-upload');
                            return;
                        }

                        console.log('Successfully retrieved authentication token for upload');

                        // Get the API base URL from storage
                        chrome.storage.local.get(['api_base_url'], async function(urlResult) {
                            try {
                                // If API base URL isn't in storage, use from config
                                let apiBaseUrl = urlResult.api_base_url;
                                if (!apiBaseUrl) {
                                    // Get config from extension
                                    const configResponse = await fetch(chrome.runtime.getURL('scripts/config.js'));
                                    const configText = await configResponse.text();
                                    // Extract API_BASE_URL from config
                                    const apiUrlMatch = configText.match(/API_BASE_URL:\s*['"]([^'"]+)['"]/);
                                    apiBaseUrl = apiUrlMatch ? apiUrlMatch[1] : 'http://localhost:8000';
                                }

                                // If apiBaseUrl is localhost or undefined, try production URL
                                if (!apiBaseUrl || apiBaseUrl.includes('localhost')) {
                                    console.log('Using localhost URL, checking if it responds...');
                                    
                                    try {
                                        // Try to ping localhost first with a timeout
                                        const controller = new AbortController();
                                        const timeoutId = setTimeout(() => controller.abort(), 3000);
                                        
                                        // Ensure we're using the proper localhost URL
                                        const localhostUrl = 'http://localhost:8000';
                                        
                                        const pingResponse = await fetch(`${localhostUrl}/ping`, {
                                            method: 'GET',
                                            signal: controller.signal
                                        }).catch(() => null);
                                        
                                        clearTimeout(timeoutId);
                                        
                                        // If localhost responds, use it, otherwise use production URL
                                        if (pingResponse && pingResponse.ok) {
                                            console.log('Localhost responded successfully, using it for API calls');
                                            apiBaseUrl = localhostUrl;
                                        } else {
                                            console.log('Localhost not responding, using production URL');
                                            apiBaseUrl = 'https://facilitator-backend.onrender.com';
                                        }
                                    } catch (e) {
                                        console.log('Error pinging localhost:', e);
                                        console.log('Using production URL as fallback');
                                        apiBaseUrl = 'https://facilitator-backend.onrender.com';
                                    }
                                }

                                console.log('Using API base URL for upload:', apiBaseUrl);

                                // Generate a batch ID
                                const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                                
                                // Prepare data for upload
                                const uploadData = {
                                    courseId: selectedCourseId,
                                    recordings: recordings.map(r => ({
                                        title: r.title || 'Untitled Recording',
                                        url: r.url,
                                        date: r.date || null,
                                        host: r.host || null,
                                        courseId: selectedCourseId
                                    })),
                                    upload_batch_id: batchId
                                };

                                console.log('Uploading recordings data:', {
                                    count: uploadData.recordings.length,
                                    batchId: batchId
                                });

                                // Try content script direct upload first
                                try {
                                    // Send the upload request first with normal CORS
                                    console.log(`Sending API request to ${apiBaseUrl}/zoom/store with ${uploadData.recordings.length} recordings`);
                                    console.log('Request payload:', JSON.stringify(uploadData));
                                    console.log('Auth token (first 10 chars):', token.substring(0, 10) + '...');
                                    
                                    const controller = new AbortController();
                                    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
                                    
                                    let response;
                                    try {
                                        response = await fetch(`${apiBaseUrl}/zoom/store`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${token}`
                                            },
                                            body: JSON.stringify(uploadData),
                                            signal: controller.signal
                                        });
                                    } catch (fetchError) {
                                        // If there's a CORS error, call the background script to handle it
                                        if (fetchError.message.includes('CORS') || fetchError.message.includes('Failed to fetch')) {
                                            console.warn('CORS issue detected, using background script for upload');
                                            clearTimeout(timeoutId);
                                            callBackgroundDirectUpload(recordings, token);
                                            return;
                                        } else {
                                            throw fetchError;
                                        }
                                    }
                                    
                                    clearTimeout(timeoutId);
                                    
                                    console.log('Received API response:', response.status, response.statusText);
                                    console.log('Response headers:', Object.fromEntries([...response.headers]));

                                    // Check response
                                    if (!response.ok) {
                                        const errorData = await response.json();
                                        console.error('Upload failed:', errorData);
                                        throw new Error(errorData.detail || 'Server returned an error');
                                    }

                                    const responseData = await response.json();
                                    console.log('Upload successful:', responseData);

                                    // Update UI with success message
                                    chrome.runtime.sendMessage({
                                        action: 'updateProgress',
                                        data: {
                                            currentTitle: `Successfully uploaded ${uploadData.recordings.length} recordings`
                                        }
                                    });

                                    // Now upload the transcripts for these recordings if we have them
                                    console.log('Recordings uploaded successfully, now trying to upload transcripts...');
                                    
                                    // After successful recording upload, submit transcripts
                                    try {
                                        // Use the original 'recordings' array which contains the scraped transcript data
                                        if (responseData.recordings && recordings && recordings.length > 0) {
                                            console.log(`Attempting to submit transcripts for ${responseData.recordings.length} recordings...`);
                                            
                                            let transcriptsSubmitted = 0;
                                            let transcriptsFailed = 0;

                                            for (let i = 0; i < responseData.recordings.length; i++) {
                                                const savedRecording = responseData.recordings[i]; // Recording data from backend (has ID)
                                                
                                                // Find the original scraped recording data by URL to get the transcript
                                                const originalRecording = recordings.find(r => r.url === savedRecording.url);
                                                
                                                if (originalRecording && originalRecording.transcript && originalRecording.transcript.status === 'success') {
                                                    console.log(`Found transcript for recording ${i+1}. Submitting...`);
                                                    
                                                    // Prepare transcript data for submission
                                                    // First, check the structure of the transcript object to help debug
                                                    console.log('Original transcript object structure:', {
                                                        hasTranscriptObject: !!originalRecording.transcript,
                                                        hasData: !!originalRecording.transcript?.data,
                                                        hasTranscriptData: !!originalRecording.transcript?.transcript_data,
                                                        dataType: typeof originalRecording.transcript?.data,
                                                        dataLength: originalRecording.transcript?.data?.length || 0,
                                                        firstItem: originalRecording.transcript?.data?.[0] || null,
                                                        transcriptKeys: Object.keys(originalRecording.transcript || {})
                                                    });
                                                    
                                                    // Get the transcript data from the correct property
                                                    const transcriptData = originalRecording.transcript?.data || 
                                                                          originalRecording.transcript?.transcript_data || 
                                                                          [];
                                                    
                                                    // Verify the data is in the correct format
                                                    const isValidData = Array.isArray(transcriptData) && 
                                                                        transcriptData.length > 0 &&
                                                                        transcriptData[0] && 
                                                                        (transcriptData[0].text || transcriptData[0].timestamp);
                                                    
                                                    if (!isValidData) {
                                                        console.error('Invalid transcript data format:', transcriptData);
                                                        throw new Error('Invalid transcript data format');
                                                    }
                                                    
                                                    const transcriptPayload = {
                                                        recording_id: savedRecording.id, // Use the ID from the saved recording
                                                        transcript_data: transcriptData, // Use validated data
                                                        formatted_text: originalRecording.transcript.formatted_text || '', // Get text from original
                                                        segment_count: transcriptData.length, // Use actual length
                                                        url: savedRecording.url // Use URL for reference
                                                    };
                                                    
                                                    // Log the structure of the payload to help debug
                                                    console.log(`Transcript payload structure:`, {
                                                        hasData: !!originalRecording.transcript.data,
                                                        hasTranscriptData: !!originalRecording.transcript.transcript_data,
                                                        dataType: typeof originalRecording.transcript.data,
                                                        transcriptType: typeof originalRecording.transcript,
                                                        dataLength: (originalRecording.transcript.data || []).length,
                                                        segmentCount: transcriptPayload.segment_count
                                                    });
                                                    
                                                    console.log(`Transcript payload for recording ${i+1}:`, JSON.stringify(transcriptPayload).substring(0, 200) + '...');
                                                    
                                                    // Submit transcript to backend
                                                    try {
                                                        const transcriptResponse = await fetch(`${apiBaseUrl}/zoom/store-transcript`, {
                                                            method: 'POST',
                                                            headers: {
                                                                'Content-Type': 'application/json',
                                                                'Authorization': `Bearer ${token}`
                                                            },
                                                            body: JSON.stringify(transcriptPayload)
                                                        });
                                                        
                                                        const transcriptResponseText = await transcriptResponse.text();
                                                        if (transcriptResponse.ok) {
                                                            console.log(`Successfully uploaded transcript for recording ${i+1}`);
                                                            transcriptsSubmitted++;
                                                        } else {
                                                            console.error(`Failed to upload transcript for recording ${i+1}. Status: ${transcriptResponse.status}, Response: ${transcriptResponseText}`);
                                                            transcriptsFailed++;
                                                        }
                                                    } catch (submitError) {
                                                        console.error(`Error submitting transcript for recording ${i+1}:`, submitError);
                                                        transcriptsFailed++;
                                                    }
                                                } else {
                                                    console.log(`No matching transcript found or transcript extraction failed for recording ${i+1} (URL: ${savedRecording.url})`);
                                                }
                                            }
                                            console.log(`Transcript submission complete: ${transcriptsSubmitted} submitted, ${transcriptsFailed} failed.`);
                                        } else {
                                            console.log('No transcripts available in the scraped data or no recordings returned from backend.');
                                        }
                                    } catch (transcriptError) {
                                        console.error('Error during transcript upload process:', transcriptError);
                                    }

                                    // Also notify the popup about the successful upload
                                    chrome.runtime.sendMessage({
                                        action: 'recordingsUploaded',
                                        success: true,
                                        count: uploadData.recordings.length,
                                        batchId: batchId
                                    }, response => {
                                        // Check if the message was received
                                        if (chrome.runtime.lastError) {
                                            console.warn('Message not delivered:', chrome.runtime.lastError.message);
                                            // Try the background direct upload as a more reliable method
                                            callBackgroundDirectUpload(recordings, token);
                                        }
                                    });
                                } catch (uploadError) {
                                    // Content script upload failed, try background script as fallback
                                    console.error('Direct upload from content script failed:', uploadError);
                                    console.log('Trying background script upload as fallback...');
                                    
                                    callBackgroundDirectUpload(recordings, token);
                                }
                                
                                // Helper function to call background script for upload
                                function callBackgroundDirectUpload(recordings, token) {
                                    console.log('Falling back to background script for direct upload');
                                    const courseId = getSelectedCourseId();
                                    
                                    // Try both message formats for maximum compatibility
                                    chrome.runtime.sendMessage({
                                        action: 'direct_upload_recordings',
                                        recordings: recordings,
                                        token: token,
                                        courseId: courseId
                                    }, function(response) {
                                        if (chrome.runtime.lastError) {
                                            console.error('Error sending message to background script:', chrome.runtime.lastError);
                                            // Try alternative action name
                                            chrome.runtime.sendMessage({
                                                action: 'directUploadRecordings',
                                                recordings: recordings,
                                                token: token,
                                                courseId: courseId
                                            }, function(altResponse) {
                                                console.log('Background upload response (alt):', altResponse);
                                            });
                                        } else {
                                            console.log('Background upload response:', response);
                                        }
                                    });
                                }
                            } catch (uploadError) {
                                console.error('Error during direct upload setup:', uploadError);
                                // Send error message to UI
                                chrome.runtime.sendMessage({
                                    action: 'updateProgress',
                                    data: {
                                        currentTitle: `Upload error: ${uploadError.message || 'Unknown error'}`
                                    }
                                });
                            }
                        });
                    });
                } catch (error) {
                    console.error('Error initiating auto-upload:', error);
                }
            }

            return { 
                success: true, 
                recordings: recordings,
                courseId: selectedCourseId,
                stats: {
                    total: conversations.length,
                    processed: processedCount,
                    successful: successfulCount,
                    transcriptSuccessful: transcriptSuccessCount,
                    transcriptFailed: transcriptFailedCount
                }
            };
        } catch (error) {
            console.error('Error scraping recordings:', error);
            isScraping = false;
            isScrapingComplete = true; // Mark as complete even on error
            return { success: false, error: error.message };
        }
    }

    // Message handler for browser extension communication
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        console.log('Recording scraper received message:', request.action);
        
        // Handle ping requests to check if script is loaded
        if (request.action === 'ping') {
            console.log('Recording scraper responding to ping');
            sendResponse({ status: 'ok', loaded: true });
            return true;
        }
        
        // Start scraping process
        if (request.action === 'scrapeRecordings') {
            console.log('Recording scraper received scrapeRecordings request');
            
            // Reset tracking variables
            scrapedRecordings = [];
            scrapedRecordingsCount = 0;
            shouldCancel = false;
            isScrapingComplete = false;
            isScraping = true;
            
            // Set auto upload flag from request
            shouldAutoUpload = request.autoUpload === true;
            
            // Get course ID from request or from URL
            const courseId = request.courseId || getSelectedCourseId();
            
            // Start the scraping process
            scrapeRecordings()
                .then(result => {
                    sendResponse({
                        status: 'success',
                        recordings: result.recordings,
                        stats: result.stats,
                        autoUpload: shouldAutoUpload
                    });
                })
                .catch(error => {
                    console.error('Error scraping recordings:', error);
                    sendResponse({
                        status: 'error',
                        error: error.message || 'Failed to scrape recordings'
                    });
                })
                .finally(() => {
                    // Update tracking variables
                    isScraping = false;
                    isScrapingComplete = true;
                });
                
            return true; // Keep message channel open for async response
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

        if (request.action === 'getRecordingsStatus') {
            console.log('Received getRecordingsStatus request');
            
            // Get the current course ID
            const courseId = getSelectedCourseId();
            
            sendResponse({
                isActive: isScraping,
                isComplete: isScrapingComplete,
                courseId: courseId,
                recordingsCount: scrapedRecordingsCount,
                shouldCancel: shouldCancel,
                autoUpload: shouldAutoUpload
            });
            return true; // Keep message channel open
        }

        return false;
    });

    // Log that the script has loaded
    console.log('Recording scraper initialized');
} 