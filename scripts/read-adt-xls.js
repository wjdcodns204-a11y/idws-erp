const xlsx = require('xlsx');
const fs = require('fs');

const filePath = 'C:\\Caps\\ACServer\\Download\\20260226.xls';
try {
    // Check if it's HTML masquerading as XLS
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');

    if (content.trim().startsWith('<html') || content.trim().startsWith('<table')) {
        console.log("File is HTML pretending to be XLS. Here is a snippet:");
        console.log(content.substring(0, 500));
    } else {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        console.log("Data sample:");
        console.log(JSON.stringify(data.slice(0, 15), null, 2));
    }
} catch (e) {
    console.error("Error reading file:", e);
}
