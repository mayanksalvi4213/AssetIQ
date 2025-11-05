# Comprehensive Bill Extraction System

## 📋 Overview

This system can extract information from **multiple invoice/bill formats** including:

- E-Way Bills
- Tax Invoices (with detailed item specifications)
- Kirana/Retail Bills
- Simple invoices with various table structures

## 🎯 Supported Bill Formats

### 1. **E-Way Bill Format**

```
| HSN Code | Product Name | Quantity | Taxable Amount | Tax Rates |
| 1234     | Item 01      | 12       | 3000          | 9%        |
```

**Features:**

- HSN code first column
- Product name/description
- Quantity extraction
- Tax calculation support

### 2. **Tax Invoice Format (Detailed)**

```
| SI No. | Description | HSN/SAC | Quantity | Rate | Amount |
| 1      | Computer    | 847150  | 55 Pcs   | 40000| 2200000|
| Batch : 4CE212C3F6 | | 1.00 Pcs |
| Model: P24V        |
| Part no: 97178A7   |
```

**Features:**

- Serial number column
- Detailed specifications (Model, Part No, Warranty)
- Batch/Serial number tracking
- Multi-line item details

### 3. **Kirana/Retail Bill Format**

```
| S.No. | ITEMS              | HSN | QTY  | RATE | TAX    | AMOUNT |
| 1     | FORTUNE BESAN      | .   | 20   | 70.0 | 0.0    | 1400.0 |
```

**Features:**

- S.No instead of SI No
- Tax column separate
- Handles missing HSN codes (. or -)
- Various unit types (PCS, BOR, PET)

### 4. **Simple Invoice Format**

```
| Description | Quantity | Rate | Amount |
| Monitor     | 5        | 1000 | 5000   |
```

**Features:**

- Minimal columns
- No HSN/SAC code
- Basic pricing structure

## 🔍 Extraction Capabilities

### **Vendor Information**

- **Company Name**: Detects keywords (LLP, Ltd, Pvt, Trust, Institute, Kirana, Shop)
- **GSTIN**: Handles standard format (15 digits) and masked format (with ##)
- **Address**: Multi-line address extraction
- **Phone**: Multiple formats (+91, 10-digit, with/without spaces)
- **Email**: Standard email pattern detection

### **Bill Details**

- **Invoice/Bill Number**: Multiple patterns (Invoice No, Bill No, Receipt No, custom formats)
- **Dates**:
  - Bill Date (DD-MM-YYYY, DD-MMM-YYYY, DD Month YYYY, YYYY-MM-DD)
  - Due Date (explicit or calculated from payment terms)
- **Amounts**:
  - Total Amount (finds largest amount if ambiguous)
  - Tax Amount (CGST + SGST, IGST, or Total Tax)
  - Discount (if applicable)

### **Asset/Item Extraction**

For each item, extracts:

- **Name/Description**
- **HSN/SAC Code** (if available)
- **Quantity** (supports Pcs, Nos, BOR, PET, etc.)
- **Unit Price**
- **Total Price**
- **Brand** (60+ brands recognized)
- **Model** (various patterns)
- **Batch/Serial Numbers** (comma-separated list)
- **Warranty Information**
- **Category** (auto-classified)

### **Category Classification**

Automatically categorizes items into:

- Computer, Laptop, Monitor, Keyboard, Mouse
- Printer, Scanner, Projector, Camera
- Server, Router, Switch, UPS
- Storage (HDD, SSD), Memory (RAM)
- Cable, Adapter, Phone, Tablet
- **Grocery** (Besan, Oil, Cookies, Biscuit, Sugar, Dal, Soap, Chana)
- Other

### **Brand Recognition**

Supports 60+ brands:

- **IT**: HP, Dell, Lenovo, Asus, Acer, Apple, Microsoft, Samsung, LG
- **Peripherals**: Logitech, Razer, Cooler Master
- **Storage**: Western Digital, Seagate, Kingston, SanDisk, Transcend, Crucial
- **Networking**: Cisco, D-Link, TP-Link, Netgear, Linksys, Ubiquiti, Mikrotik
- **Components**: Intel, AMD, Nvidia, Corsair, MSI, Gigabyte, EVGA
- And many more...

## 🛠️ How It Works

### **Multi-Pattern Matching**

The system uses **5 different regex patterns** to match various table formats:

1. **Pattern 1**: E-Way Bill (HSN first)
2. **Pattern 2**: Tax Invoice with serial number
3. **Pattern 3**: Kirana Bill with tax column
4. **Pattern 4**: Simple format without HSN
5. **Pattern 5**: Fallback text extraction

### **Intelligent Parsing**

- **Line-by-line analysis**: Reads invoice line by line
- **Context awareness**: Tracks current item being processed
- **Detail collection**: Gathers batch numbers, specifications, warranty info
- **Total row filtering**: Automatically skips total/summary rows

### **Fallback Mechanism**

If table patterns fail:

1. Searches for product keywords in text
2. Extracts quantities and prices from nearby text
3. Creates assets from unstructured data

## 📊 Example Extractions

### From E-Way Bill:

```json
{
  "name": "Item 01",
  "hsn_code": "1234",
  "quantity": 12,
  "unit_price": 250.0,
  "total_price": 3000.0,
  "category": "other"
}
```

### From Tax Invoice (HP Monitor):

```json
{
  "name": "Led Monitor HP 23.8\"",
  "hsn_code": "852851",
  "quantity": 5,
  "unit_price": 14200.0,
  "total_price": 71000.0,
  "brand": "HP",
  "model": "P24V",
  "serial_number": "1CR21913BL,1CR21913DD,1CR21913BZ,1CR21913BP,1CR21913DV",
  "warranty_period": "Warranty: 3 Years Limited by Manufacturer",
  "category": "monitor"
}
```

### From Kirana Bill:

```json
{
  "name": "FORTUNE BESAN 500 GM",
  "hsn_code": "",
  "quantity": 20,
  "unit_price": 70.0,
  "total_price": 1400.0,
  "category": "grocery"
}
```

## ✅ Key Features

### **Robustness**

- ✅ Handles table formats with/without pipes (|)
- ✅ Works with various column orders
- ✅ Supports multiple unit types
- ✅ Handles missing data gracefully
- ✅ Filters out non-item rows automatically

### **Flexibility**

- ✅ Adapts to different date formats
- ✅ Recognizes various currency symbols (₹, Rs, INR)
- ✅ Handles masked GSTIN (with ##)
- ✅ Works with/without HSN codes
- ✅ Supports both detailed and simple invoices

### **Intelligence**

- ✅ Auto-detects bill format
- ✅ Classifies items by category
- ✅ Extracts brand and model information
- ✅ Calculates unit price if needed
- ✅ Collects batch/serial numbers

### **Debug Support**

- ✅ Comprehensive logging
- ✅ Pattern matching feedback
- ✅ Extraction progress tracking
- ✅ Raw text preview for troubleshooting

## 🚀 Usage

The system automatically processes uploaded PDFs or images:

1. **Upload** any supported bill format
2. **Extracts** text using LLM Whisperer or OCR
3. **Parses** using intelligent pattern matching
4. **Returns** structured JSON with:
   - Bill information
   - Vendor details
   - Asset/item list with QR codes

## 🎯 Tested On

✅ E-Way Bills (GimBooks format)  
✅ Tax Invoices (Team One Tech Solutions format)  
✅ Kirana Bills (Hictotal Jejani Kirana format)  
✅ Various custom invoice formats

## 📈 Future Enhancements

- Add more brand recognition
- Support for international formats
- Multi-language support
- Advanced warranty parsing
- Purchase order integration

---

**Built for AssetIQ** - Your comprehensive asset management solution
