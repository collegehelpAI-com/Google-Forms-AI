# Google Forms Auto Filler Chrome Extension

An intelligent Chrome extension that automatically fills Google Forms using AI-powered responses. The extension extracts form structure, sends it to your local API, and fills the form with appropriate answers.

## Features

- 🤖 **AI-Powered**: Uses your custom API to generate intelligent responses
- 📋 **Form Analysis**: Automatically detects and analyzes Google Form structure
- 🎯 **Smart Filling**: Handles all question types (text, multiple choice, scales, etc.)
- ⚙️ **Customizable**: Configurable API endpoint and filling delays
- 🎨 **User-Friendly**: Clean popup interface with real-time status updates

## Supported Question Types

- ✅ Short Answer
- ✅ Paragraph
- ✅ Multiple Choice
- ✅ Checkboxes
- ✅ Dropdown
- ✅ Linear Scale
- ✅ Rating Scale
- ✅ Date
- ✅ Time
- ✅ Grid questions (partial support)

## Installation

### 1. Download the Extension Files

Save all the extension files in a folder:
- `manifest.json`
- `content.js`
- `background.js`
- `popup.html`
- `popup.js`

### 2. Set Up Your API

1. Create a folder on your local server: `http://localhost/api-example.php`
2. Place the `api-example.php` file in that folder
3. Ensure your web server (Apache, Nginx, etc.) is running
4. Test the API endpoint: `http://localhost/askapi`

### 3. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the folder containing your extension files
5. The extension should now appear in your extensions list

## Usage

### Basic Usage

1. Navigate to any Google Form
2. Click the extension icon in your browser toolbar
3. Click "🚀 Auto Fill Form" in the popup
4. Watch as the form gets automatically filled!

### Alternative Method

1. On any Google Form page, look for the "🤖 Auto Fill Form" button (top right)
2. Click the button to start auto-filling

### Configuration

In the extension popup, you can configure:
- **API Endpoint**: Change from default `http://localhost/api-example.php`
- **Fill Delay**: Adjust timing between question fills (500ms default)

## API Integration

### Request Format

Your API will receive form data in this format:

```json
{
  "metadata": {
    "title": "Form Title",
    "description": "Form description",
    "url": "https://docs.google.com/forms/..."
  },
  "items": [
    {
      "id": 12345,
      "title": "What is your name?",
      "type": 0,
      "typeName": "shortAnswer",
      "isRequired": true,
      "choices": []
    },
    {
      "id": 67890,
      "title": "Select your favorite color",
      "type": 2,
      "typeName": "multipleChoice",
      "isRequired": false,
      "choices": ["Red", "Blue", "Green"]
    }
  ],
  "count": 2
}
```

### Response Format

Your API should return an array of answers:

```json
[
  "John Doe",
  "Blue"
]
```

### Custom API Implementation

You can integrate with any AI service (OpenAI, Claude, local models):

```php
// Example with OpenAI
function generateAIAnswer($question) {
    // Call OpenAI API
    $response = callOpenAI($question['title'], $question['choices']);
    return $response;
}
```

## Development

### Project Structure

```
google-forms-auto-filler/
├── manifest.json          # Extension manifest
├── content.js            # Form extraction and filling logic
├── background.js         # Service worker
├── popup.html           # Extension popup UI
├── popup.js            # Popup functionality
├── api-example.php     # Example API implementation
└── README.md          # This file
```

### Key Components

**Content Script (`content.js`)**
- Extracts form structure from Google Forms DOM
- Handles form filling with API responses
- Manages the auto-fill button overlay

**Background Script (`background.js`)**
- Handles extension lifecycle
- Manages API communication
- Provides tab management

**Popup (`popup.html/js`)**
- User interface for manual control
- Settings configuration
- Status monitoring

## Troubleshooting

### Common Issues

**Extension not working on Google Forms:**
- Ensure you're on a Google Form page (contains `/forms/` and `/viewform`)
- Check that the extension is enabled
- Try refreshing the page

**API connection failed:**
- Verify your local server is running
- Check the API endpoint URL in settings
- Ensure CORS headers are properly set in your API

**Form not filling correctly:**
- Some forms may have custom validation
- Try increasing the fill delay in settings
- Check browser console for error messages

### Debugging

1. Open Chrome DevTools (`F12`)
2. Check the Console tab for errors
3. Look at Network tab for API requests
4. Use the Extensions page to check for extension errors

## Security Notes

- The extension only works on Google Forms pages
- All data is sent to your specified API endpoint
- No data is stored permanently by the extension
- CORS must be properly configured on your API

## Contributing

Feel free to contribute improvements:

1. Fork the repository
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

This project is open source. Feel free to modify and distribute according to your needs.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review browser console errors
3. Verify API endpoint functionality
4. Check extension permissions

---

**Note**: This extension is for educational and automation purposes. Always respect website terms of service and use responsibly.