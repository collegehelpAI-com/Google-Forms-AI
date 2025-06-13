// Content script for Google Forms Auto Filler
(function() {
    'use strict';

    // Question type mapping based on your analysis
    const questionTypes = {
        0: "shortAnswer",
        1: "paragraph", 
        2: "multipleChoice",
        3: "dropdown",
        4: "checkboxes",
        5: "linearScale",
        6: "rating",
        7: "grid",
        9: "date",
        10: "time"
    };

    // Extract form data and convert to JSON
    function extractFormData() {
        const formData = {
            metadata: {},
            items: [],
            count: 0
        };

        // Extract metadata
        const titleElement = document.querySelector('title');
        formData.metadata.title = titleElement ? titleElement.textContent.trim() : 'Untitled Form';

        const descriptionElement = document.querySelector('meta[name="description"]');
        formData.metadata.description = descriptionElement ? descriptionElement.content.trim() : '';

        // Try to get description from form content
        if (!formData.metadata.description) {
            const descElement = document.querySelector('.cBGGJ, .gubaDc');
            if (descElement) {
                formData.metadata.description = descElement.textContent.trim();
            }
        }

        // Extract form URL
        formData.metadata.url = window.location.href;

        // Extract questions using data-params attribute
        const questionElements = document.querySelectorAll('[data-params]');
        
        questionElements.forEach((element, index) => {
            try {
                const dataParams = element.getAttribute('data-params');
                if (!dataParams || dataParams.indexOf('[') === -1) return;

                // Clean and parse the data-params
                const cleanedParams = dataParams.substring(dataParams.indexOf('['));
                let parsedData;
                
                try {
                    // Handle the special format with %.@. prefix
                    let jsonStr = cleanedParams;
                    if (dataParams.startsWith('%.@.')) {
                        jsonStr = cleanedParams;
                    }
                    parsedData = JSON.parse(jsonStr);
                } catch (e) {
                    console.warn('Failed to parse data-params:', e);
                    return;
                }

                if (!parsedData || !Array.isArray(parsedData) || parsedData.length < 4) return;

                const questionData = parsedData[0];
                if (!questionData || !Array.isArray(questionData) || questionData.length < 4) return;

                const item = {
                    id: questionData[0],
                    title: questionData[1] || 'Untitled Question',
                    description: questionData[2] || '',
                    type: questionData[3],
                    typeName: questionTypes[questionData[3]] || 'unknown',
                    index: index,
                    isRequired: false,
                    choices: [],
                    validation: null
                };

                // Check if question is required
                const requiredIndicator = element.querySelector('.vnumgf, [aria-label*="obligatoire"], [aria-label*="required"]');
                item.isRequired = !!requiredIndicator;

                // Extract choices for choice-type questions
                if (questionData[4] && Array.isArray(questionData[4]) && questionData[4].length > 0) {
                    const choiceData = questionData[4][0];
                    if (choiceData && choiceData[1] && Array.isArray(choiceData[1])) {
                        item.choices = choiceData[1].map(choice => {
                            if (Array.isArray(choice)) {
                                return choice[0] || choice.toString();
                            }
                            return choice.toString();
                        });
                    }

                    // For linear scale questions, extract scale info
                    if ((item.type === 5 || item.type === 6) && choiceData[3]) {
                        item.scaleLabels = choiceData[3];
                        item.scaleMin = 1;
                        item.scaleMax = item.choices.length;
                    }
                }

                // Extract entry name for form submission
                const entryMatch = dataParams.match(/entry\.(\d+)/);
                if (entryMatch) {
                    item.entryId = entryMatch[1];
                }

                formData.items.push(item);
            } catch (error) {
                console.warn('Error processing question element:', error, element);
            }
        });

        // Fallback: extract questions from role="listitem"
        if (formData.items.length === 0) {
            const listItems = document.querySelectorAll('[role="listitem"]');
            listItems.forEach((item, index) => {
                const heading = item.querySelector('[role="heading"]');
                if (!heading) return;

                const questionItem = {
                    id: index,
                    title: heading.textContent.trim(),
                    description: '',
                    type: 0, // default to short answer
                    typeName: 'shortAnswer',
                    index: index,
                    isRequired: item.querySelector('[aria-required="true"]') !== null,
                    choices: []
                };

                // Check for multiple choice options
                const radioOptions = item.querySelectorAll('[role="radio"]');
                const checkboxOptions = item.querySelectorAll('[role="checkbox"]');
                
                if (radioOptions.length > 0) {
                    questionItem.type = 2;
                    questionItem.typeName = 'multipleChoice';
                    questionItem.choices = Array.from(radioOptions).map(option => 
                        option.getAttribute('aria-label') || option.textContent.trim()
                    );
                } else if (checkboxOptions.length > 0) {
                    questionItem.type = 4;
                    questionItem.typeName = 'checkboxes';
                    questionItem.choices = Array.from(checkboxOptions).map(option => 
                        option.getAttribute('aria-label') || option.textContent.trim()
                    );
                }

                formData.items.push(questionItem);
            });
        }

        formData.count = formData.items.length;
        return formData;
    }

    // Fill form with API responses
    async function fillForm(responses) {
        for (let i = 0; i < responses.length; i++) {
            const response = responses[i];
            const questionIndex = i;
            
            try {
                await fillQuestion(questionIndex, response);
                // Add small delay between questions
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Error filling question ${questionIndex}:`, error);
            }
        }
    }

    // Fill individual question based on type
    async function fillQuestion(questionIndex, answer) {
        const questionElements = document.querySelectorAll('[data-params]');
        if (questionIndex >= questionElements.length) return;

        const questionElement = questionElements[questionIndex];
        const questionData = extractQuestionFromElement(questionElement);
        
        if (!questionData) return;

        switch (questionData.typeName) {
            case 'shortAnswer':
            case 'paragraph':
                await fillTextQuestion(questionElement, answer);
                break;
            case 'multipleChoice':
                await fillMultipleChoice(questionElement, answer);
                break;
            case 'checkboxes':
                await fillCheckboxes(questionElement, answer);
                break;
            case 'dropdown':
                await fillDropdown(questionElement, answer);
                break;
            case 'linearScale':
            case 'rating':
                await fillScale(questionElement, answer);
                break;
            default:
                console.warn(`Unsupported question type: ${questionData.typeName}`);
        }
    }

    function extractQuestionFromElement(element) {
        try {
            const dataParams = element.getAttribute('data-params');
            if (!dataParams) return null;

            const cleanedParams = dataParams.substring(dataParams.indexOf('['));
            const parsedData = JSON.parse(cleanedParams);
            const questionData = parsedData[0];

            return {
                id: questionData[0],
                type: questionData[3],
                typeName: questionTypes[questionData[3]] || 'unknown'
            };
        } catch (e) {
            return null;
        }
    }

    // Fill text input questions
    async function fillTextQuestion(questionElement, answer) {
        const input = questionElement.querySelector('input[type="text"], input[type="email"], textarea');
        if (input) {
            input.focus();
            input.value = answer;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.blur();
        }
    }

    // Fill multiple choice questions
    async function fillMultipleChoice(questionElement, answer) {
        const radioButtons = questionElement.querySelectorAll('[role="radio"]');
        
        for (const radio of radioButtons) {
            const label = radio.getAttribute('aria-label') || radio.textContent.trim();
            if (label.toLowerCase().includes(answer.toLowerCase()) || 
                answer.toLowerCase().includes(label.toLowerCase())) {
                radio.click();
                break;
            }
        }
    }

    // Fill checkbox questions
    async function fillCheckboxes(questionElement, answers) {
        const checkboxes = questionElement.querySelectorAll('[role="checkbox"]');
        const answerArray = Array.isArray(answers) ? answers : [answers];
        
        for (const checkbox of checkboxes) {
            const label = checkbox.getAttribute('aria-label') || checkbox.textContent.trim();
            const shouldCheck = answerArray.some(answer => 
                label.toLowerCase().includes(answer.toLowerCase()) || 
                answer.toLowerCase().includes(label.toLowerCase())
            );
            
            if (shouldCheck && checkbox.getAttribute('aria-checked') !== 'true') {
                checkbox.click();
            }
        }
    }

    // Fill dropdown questions
    async function fillDropdown(questionElement, answer) {
        const dropdown = questionElement.querySelector('select, [role="combobox"], [role="listbox"]');
        if (dropdown) {
            // Try to find matching option
            const options = dropdown.querySelectorAll('option, [role="option"]');
            for (const option of options) {
                const optionText = option.textContent.trim();
                if (optionText.toLowerCase().includes(answer.toLowerCase()) || 
                    answer.toLowerCase().includes(optionText.toLowerCase())) {
                    if (option.tagName === 'OPTION') {
                        dropdown.value = option.value;
                        dropdown.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        option.click();
                    }
                    break;
                }
            }
        }
    }

    // Fill scale questions (1-5, 1-10, etc.)
    async function fillScale(questionElement, answer) {
        // Try to parse the answer as a number
        let scaleValue = parseInt(answer);
        if (isNaN(scaleValue)) {
            // If not a number, try to extract from text
            const match = answer.match(/\d+/);
            scaleValue = match ? parseInt(match[0]) : 3; // default to middle
        }

        const radioButtons = questionElement.querySelectorAll('[role="radio"]');
        for (const radio of radioButtons) {
            const value = radio.getAttribute('data-value') || radio.getAttribute('aria-label');
            if (value && parseInt(value) === scaleValue) {
                radio.click();
                break;
            }
        }
    }

    // Send form data to API and get responses
    async function processFormWithAPI() {
        try {
            console.log('Extracting form data...');
            const formData = extractFormData();
            
            if (formData.items.length === 0) {
                alert('No questions found in this form.');
                return;
            }

            console.log('Form data extracted:', formData);

            // Send to API
            console.log('Sending to API...');
            const response = await fetch('http://localhost/api-example.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const apiResponses = await response.json();
            console.log('API responses received:', apiResponses);

            // Fill the form with responses
            console.log('Filling form...');
            await fillForm(apiResponses);
            
            console.log('Form filled successfully!');
            alert('Form has been automatically filled with AI responses!');

        } catch (error) {
            console.error('Error processing form:', error);
            alert(`Error: ${error.message}`);
        }
    }

    // Add button to trigger the auto-fill
    function addAutoFillButton() {
        // Check if button already exists
        if (document.getElementById('auto-fill-btn')) return;

        const button = document.createElement('button');
        button.id = 'auto-fill-btn';
        button.textContent = '🤖 Auto Fill Form';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: #4285f4;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#3367d6';
            button.style.transform = 'translateY(-1px)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#4285f4';
            button.style.transform = 'translateY(0)';
        });

        button.addEventListener('click', processFormWithAPI);
        
        document.body.appendChild(button);
    }

    // Initialize when page loads
    function initialize() {
        // Wait for form to be fully loaded
        setTimeout(() => {
            addAutoFillButton();
        }, 2000);
    }

    // Check if we're on a Google Form
    if (window.location.href.includes('docs.google.com/forms') && 
        window.location.href.includes('viewform')) {
        initialize();
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extractForm') {
            const formData = extractFormData();
            sendResponse(formData);
        } else if (request.action === 'autoFill') {
            processFormWithAPI();
            sendResponse({ status: 'started' });
        } else if (request.action === 'fillForm') {
            fillForm(request.responses);
            sendResponse({ status: 'filling' });
        }
    });

})();