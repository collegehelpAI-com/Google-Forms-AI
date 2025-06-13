// Background service worker for Google Forms Auto Filler

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Google Forms Auto Filler extension installed');
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'sendToAPI') {
        handleAPIRequest(request.data)
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep the message channel open for async response
    }
});

// Handle API requests
async function handleAPIRequest(formData) {
    try {
        const response = await fetch('http://localhost/api-example.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Handle browser action click
chrome.action.onClicked.addListener((tab) => {
    // Check if we're on a Google Form
    if (tab.url && tab.url.includes('docs.google.com/forms') && tab.url.includes('viewform')) {
        // Send message to content script to start auto-fill
        chrome.tabs.sendMessage(tab.id, { action: 'autoFill' });
    } else {
        // Show notification that extension only works on Google Forms
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'Google Forms Auto Filler',
            message: 'This extension only works on Google Forms pages.'
        });
    }
});

// Store API configuration
chrome.storage.local.set({
    apiEndpoint: 'http://localhost/api-example.php',
    autoFillDelay: 500
});

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && 
        tab.url && 
        tab.url.includes('docs.google.com/forms') && 
        tab.url.includes('viewform')) {
        
        // Ensure content script is injected
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }).catch(() => {
            // Content script might already be injected
            console.log('Content script already present or injection failed');
        });
    }
});