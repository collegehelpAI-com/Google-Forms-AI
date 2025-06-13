// Popup script for Google Forms Auto Filler

document.addEventListener('DOMContentLoaded', async () => {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const formInfo = document.getElementById('formInfo');
    const formTitle = document.getElementById('formTitle');
    const questionCount = document.getElementById('questionCount');
    const requiredCount = document.getElementById('requiredCount');
    const autoFillBtn = document.getElementById('autoFillBtn');
    const extractBtn = document.getElementById('extractBtn');
    const autoFillText = document.getElementById('autoFillText');
    const messageDiv = document.getElementById('message');
    const apiEndpointInput = document.getElementById('apiEndpoint');
    const fillDelayInput = document.getElementById('fillDelay');

    let currentFormData = null;

    // Load saved settings
    chrome.storage.local.get(['apiEndpoint', 'fillDelay'], (result) => {
        if (result.apiEndpoint) {
            apiEndpointInput.value = result.apiEndpoint;
        }
        if (result.fillDelay) {
            fillDelayInput.value = result.fillDelay;
        }
    });

    // Save settings when changed
    apiEndpointInput.addEventListener('change', () => {
        chrome.storage.local.set({ apiEndpoint: apiEndpointInput.value });
    });

    fillDelayInput.addEventListener('change', () => {
        chrome.storage.local.set({ fillDelay: parseInt(fillDelayInput.value) });
    });

    // Check if we're on a Google Form
    async function checkCurrentPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url || !tab.url.includes('docs.google.com/forms') || !tab.url.includes('viewform')) {
                setStatus('error', 'Not on a Google Form page');
                showMessage('Please navigate to a Google Form to use this extension.', 'error');
                return false;
            }

            setStatus('loading', 'Extracting form data...');
            
            // Extract form data from the page
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractForm' });
            
            if (response && response.items && response.items.length > 0) {
                currentFormData = response;
                displayFormInfo(response);
                setStatus('ready', 'Form detected and ready');
                autoFillBtn.disabled = false;
                extractBtn.disabled = false;
                return true;
            } else {
                setStatus('error', 'No questions found in form');
                showMessage('Could not detect questions in this form.', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error checking page:', error);
            setStatus('error', 'Error analyzing form');
            showMessage('Error: ' + error.message, 'error');
            return false;
        }
    }

    // Set status indicator
    function setStatus(type, text) {
        statusDot.className = `status-dot ${type}`;
        statusText.textContent = text;
    }

    // Display form information
    function displayFormInfo(formData) {
        formTitle.textContent = formData.metadata.title || 'Untitled Form';
        questionCount.textContent = formData.items.length;
        requiredCount.textContent = formData.items.filter(item => item.isRequired).length;
        formInfo.style.display = 'block';
    }

    // Show message to user
    function showMessage(text, type = 'info') {
        messageDiv.innerHTML = `<div class="${type}-message">${text}</div>`;
        setTimeout(() => {
            messageDiv.innerHTML = '';
        }, 5000);
    }

    // Auto fill form
    async function autoFillForm() {
        if (!currentFormData) {
            showMessage('No form data available. Please refresh and try again.', 'error');
            return;
        }

        try {
            autoFillBtn.disabled = true;
            autoFillText.innerHTML = '<div class="loading"></div> Processing...';

            // Send form data to API
            const apiResponse = await sendToAPI(currentFormData);
            
            if (!apiResponse.success) {
                throw new Error(apiResponse.error || 'API request failed');
            }

            autoFillText.innerHTML = '<div class="loading"></div> Filling form...';

            // Send responses to content script for form filling
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            await chrome.tabs.sendMessage(tab.id, { 
                action: 'fillForm', 
                responses: apiResponse.data,
                delay: parseInt(fillDelayInput.value)
            });

            autoFillText.textContent = '✅ Form Filled!';
            showMessage('Form has been successfully filled with AI responses!', 'success');

            // Reset button after delay
            setTimeout(() => {
                autoFillText.textContent = '🚀 Auto Fill Form';
                autoFillBtn.disabled = false;
            }, 3000);

        } catch (error) {
            console.error('Auto fill error:', error);
            autoFillText.textContent = '❌ Failed';
            showMessage('Error: ' + error.message, 'error');
            
            setTimeout(() => {
                autoFillText.textContent = '🚀 Auto Fill Form';
                autoFillBtn.disabled = false;
            }, 3000);
        }
    }

    // Send data to API
    async function sendToAPI(formData) {
        try {
            const response = await fetch(apiEndpointInput.value, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error(`API returned status ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Extract form data
    async function extractFormData() {
        if (!currentFormData) {
            showMessage('No form data available.', 'error');
            return;
        }

        try {
            // Copy form data to clipboard
            await navigator.clipboard.writeText(JSON.stringify(currentFormData, null, 2));
            showMessage('Form data copied to clipboard!', 'success');
        } catch (error) {
            // Fallback: show in new tab
            const dataUrl = 'data:application/json,' + encodeURIComponent(JSON.stringify(currentFormData, null, 2));
            chrome.tabs.create({ url: dataUrl });
            showMessage('Form data opened in new tab.', 'success');
        }
    }

    // Event listeners
    autoFillBtn.addEventListener('click', autoFillForm);
    extractBtn.addEventListener('click', extractFormData);

    // Initialize
    await checkCurrentPage();
});