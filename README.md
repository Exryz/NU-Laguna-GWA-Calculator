# NU Laguna GWA Calculator

The NU Laguna GWA Calculator is a browser extension that helps students track their grades. It scrapes academic records from the student portal and calculates term and cumulative Grade Weighted Averages (GWA).

## Installation

1. Download or clone this repository.
2. Open Google Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right).
4. Click **Load unpacked** and select the folder containing this project.
5. The extension icon will appear in your toolbar.

## Usage

1. Log in to the NU Laguna student portal and go to the **Grades** page.
2. Open the extension and enter your desired "From Year" and "To Year."
3. Click **Pre-load Selected Range** to save your grade data locally.
4. Use the checkboxes to filter terms or to include/exclude subjects marked with an asterisk (*).
5. Click **Export Records to PDF** to download a formatted grade report.

---

## How It Works

### 1. Data Retrieval

The extension simulates clicking the "Submit" button on the grades page. To do this, it extracts a hidden security token (`form_key`) from the page and sends it back to the server along with the year and term you requested. This tricks the portal into sending the specific grade data for that term.

### 2. Data Cleaning

Once the portal sends the page back, the extension cleans the information. It looks at the grade table, converts grades and units into numbers, and identifies which subjects are excluded (marked with an asterisk) and which count toward your GWA. This data is saved as a JSON file in your browser's local storage.

### 3. Calculation

When you change settings in the extension (like checking a box), it recalculates your GWA immediately using the locally saved data. It uses this formula:

$$\text{GWA} = \frac{\sum (\text{Grade}_i \times \text{Units}_i)}{\sum \text{Units}_i}$$

### 4. PDF Export

When you click the export button, the extension builds a new webpage in memory. It places your data into an HTML table with CSS styling to match the university's format. It then triggers your browser's native print menu, which allows you to save the page as a PDF file.

---

## Privacy Policy

This extension is private. All data is stored locally on your own computer. None of your academic information, personal details, or browsing habits are sent to or stored on any external servers.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Disclaimer

This is a third-party tool and is not affiliated with or endorsed by National University. Always verify your grades against the official university records.
