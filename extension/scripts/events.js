var data = {}; // Data to be sent to the popup
var ongoing = {}; // Maintains list of tabs for which scraping is ongoing

function send_scraping_start(){
	chrome.runtime.sendMessage({status:"scraping_start_success",receiver:"popup"});
}

function send_scraping_fail(){
	chrome.runtime.sendMessage({status:"scraping_start_fail",receiver:"popup"});
}

// Background service worker for Canvas File Manager
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "getFiles") {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			chrome.tabs.sendMessage(tabs[0].id, {action: "getFiles"}, function(response) {
				if (chrome.runtime.lastError) {
					sendResponse({
						status: 'error',
						error: 'Could not connect to Canvas page'
					});
					return;
				}
				sendResponse(response);
			});
		});
		return true;
	}
});

chrome.runtime.onMessage.addListener(
function(request, sender, sendResponse) {
	if(request.receiver == "background"){
		if(request.sender == "popup"){
			// Request to start scraping the webpage
			if(request.destination.startsWith('content')){
				console.log("Initiating content scraping");
				chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
						chrome.tabs.sendMessage(tabs[0].id, {action: request.action,data:request}, function(response) {
							var lastError = chrome.runtime.lastError;
							if (lastError) {
								console.log(lastError.message);
								send_scraping_fail();
								return;
							}
							ongoing[tabs[0].id] = 1;
							send_scraping_start();
						});  
				});
				sendResponse({received_by: "scraper"});
			} else { // Checking scraping status
				if(request.action=="reload"){
					if(String(request.tab.id) in data)
						delete data[request.tab.id];
					sendResponse({received_by: "background_cleaner"});
				}
				if(String(request.tab.id) in data){
					console.log("Scraping complete. Sending results.");
					chrome.runtime.sendMessage({status:"scraping_done",receiver:"popup",data:data});
				}else if(ongoing[request.tab.id]==1){
					console.log("Scraping in progress.");
					chrome.runtime.sendMessage({status:"scraping_ongoing",receiver:"popup",data:data});
				}else{
					console.log("No scraping activity detected.");
					chrome.runtime.sendMessage({status:"unknown",receiver:"popup"});			
				}
			}
		}
		// Content script has finished scraping
		else {
			if(request.destination == "popup"){
				console.log("Content script finished scraping");
				data[sender.tab.id] = {};
				data[sender.tab.id].tab = sender.tab.id;
				data[sender.tab.id].type = request.type;
				data[sender.tab.id].download = [];
				if(request.type=="file"){
					data[sender.tab.id].download.push({title:request.title,link:request.link});
				}else{
					data[sender.tab.id].download = request.download;
				}
				sendResponse({received_by: "background events"});
				console.log("Saving scraped data");
				ongoing[sender.tab.id] = 0;
				chrome.runtime.sendMessage({status:"scraping_done",receiver:"popup",data:data});
			}
		}
	}
	return true;
});