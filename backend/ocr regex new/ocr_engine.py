"""
OCR Engine Module
Uses LLMWhisperer API to extract text from invoices.
Supports multipage PDFs and image files.
"""

import os
import time
import tempfile
import requests
from dotenv import load_dotenv

# Load .env file from the project root
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# LLMWhisperer API configuration (v2 us-central endpoint)
LLMWHISPERER_BASE_URL = os.getenv(
    "LLMWHISPERER_API_URL",
    "https://llmwhisperer-api.us-central.unstract.com/api/v2",
).rstrip("/whisper").rstrip("/")  # normalise to base URL

LLMWHISPERER_API_KEY = os.getenv("LLMWHISPERER_API_KEY", "")


def _local_ocr_fallback(file_path):
    """
    Fallback OCR using pdfplumber (for text PDFs) or pytesseract (for images/scans).
    Returns a list of page text strings.
    """
    ext = os.path.splitext(file_path)[1].lower()
    print(f"[OCR] Using local fallback for: {file_path}")

    if ext == ".pdf":
        try:
            import pdfplumber
            text_pages = []
            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    text = page.extract_text() or ""
                    text_pages.append(text)
                    print(f"[OCR] pdfplumber page {i+1}: {len(text)} chars")

            # If all pages are empty it's a scanned PDF — try pytesseract
            if all(t.strip() == "" for t in text_pages):
                print("[OCR] pdfplumber returned no text (scanned PDF?), trying pytesseract")
                return _tesseract_pdf(file_path)
            return text_pages
        except ImportError:
            raise ImportError("pdfplumber not installed. Run: pip install pdfplumber")
    else:
        return _tesseract_image(file_path)


def _tesseract_pdf(pdf_path):
    """Convert each PDF page to image and run pytesseract."""
    try:
        import pdfplumber
        from PIL import Image
        import pytesseract
        text_pages = []
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                img = page.to_image(resolution=200).original
                text = pytesseract.image_to_string(img)
                text_pages.append(text)
                print(f"[OCR] tesseract page {i+1}: {len(text)} chars")
        return text_pages
    except Exception as e:
        raise RuntimeError(f"Tesseract PDF OCR failed: {e}")


def _tesseract_image(file_path):
    """Run pytesseract on a single image file."""
    try:
        from PIL import Image
        import pytesseract
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img)
        print(f"[OCR] tesseract image: {len(text)} chars")
        return [text]
    except ImportError:
        raise ImportError(
            "Pillow and pytesseract not installed. "
            "Run: pip install Pillow pytesseract  (and install Tesseract OCR)"
        )


def _call_llmwhisperer(file_path):
    """
    Send a file to LLMWhisperer v2 API and return extracted text.
    Handles async 202 + polling. Falls back to local OCR on connection errors.
    """
    headers = {
        "unstract-key": LLMWHISPERER_API_KEY,
    }
    params = {
        "mode": "table",                   # best for invoices with tabular data
        "output_mode": "layout_preserving", # preserves layout for better extraction
        "page_seperator": "<<<",            # page separator in output
    }

    whisper_url = f"{LLMWHISPERER_BASE_URL}/whisper"
    print(f"[OCR] Sending to LLMWhisperer: {whisper_url}")

    try:
        with open(file_path, "rb") as f:
            response = requests.post(
                whisper_url,
                headers=headers,
                params=params,
                data=f.read(),
                timeout=120,
            )

        print(f"[OCR] Response status: {response.status_code}")
        print(f"[OCR] Response body: {response.text[:300]}")

        # Async — poll until done
        if response.status_code == 202:
            whisper_hash = response.json().get("whisper_hash")
            if not whisper_hash:
                raise RuntimeError("202 response missing whisper_hash")
            print(f"[OCR] Async mode, polling with hash: {whisper_hash}")
            return _poll_llmwhisperer(whisper_hash, headers)

        # Synchronous success
        if response.status_code == 200:
            data = response.json()
            return data.get("extracted_text", "") or data.get("result_text", "")

        raise RuntimeError(
            f"LLMWhisperer API error {response.status_code}: {response.text}"
        )

    except requests.exceptions.ConnectionError as e:
        print(f"[OCR] API unreachable ({e}), using local fallback")
        pages = _local_ocr_fallback(file_path)
        return " ".join(pages)


def _poll_llmwhisperer(whisper_hash, headers, max_attempts=15, interval=2):
    """
    Poll LLMWhisperer v2 status, then retrieve extracted text.
    Mirrors the working implementation from the reference project.
    """
    status_url = f"{LLMWHISPERER_BASE_URL}/whisper-status"
    retrieve_url = f"{LLMWHISPERER_BASE_URL}/whisper-retrieve"
    params = {"whisper_hash": whisper_hash}

    for attempt in range(max_attempts):
        resp = requests.get(status_url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        status = result.get("status", "")
        print(f"[OCR] Poll {attempt+1}/{max_attempts} — status: {status}")

        if status == "processed":
            retrieve_resp = requests.get(
                retrieve_url, headers=headers, params=params, timeout=60
            )
            retrieve_resp.raise_for_status()
            text = retrieve_resp.text

            # Response can be JSON with result_text, or plain text
            if text.startswith("{") and "result_text" in text:
                try:
                    json_data = retrieve_resp.json()
                    text = json_data.get("result_text") or json_data.get("extracted_text", "")
                except Exception:
                    import re as _re
                    m = _re.search(r'"result_text"\s*:\s*"(.*?)"(?=\s*[,}])', text, _re.DOTALL)
                    if m:
                        text = m.group(1).replace("\\n", "\n").replace("\\t", "\t")

            print(f"[OCR] Retrieved {len(text)} chars")
            return text

        if status == "failed":
            raise RuntimeError(f"LLMWhisperer processing failed: {result}")

        if status == "processing":
            time.sleep(interval)
            continue

        raise RuntimeError(f"Unknown status from LLMWhisperer: {status}")

    raise RuntimeError(f"LLMWhisperer timed out after {max_attempts} attempts")


def _split_pdf_pages(pdf_path):
    """
    Split a multipage PDF into individual single-page PDFs.
    Returns a list of temporary file paths (one per page).
    """
    try:
        import PyPDF2
    except ImportError:
        raise ImportError("PyPDF2 is required for multipage PDF support. "
                          "Install it with: pip install PyPDF2")

    page_paths = []
    with open(pdf_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for i, page in enumerate(reader.pages):
            writer = PyPDF2.PdfWriter()
            writer.add_page(page)
            tmp = tempfile.NamedTemporaryFile(
                delete=False, suffix=f"_page_{i + 1}.pdf"
            )
            writer.write(tmp)
            tmp.close()
            page_paths.append(tmp.name)
    return page_paths


def extract_text_pages(file_path):
    """
    Extract text from a PDF or image invoice.

    For multipage PDFs:
        - Splits into individual pages
        - Sends each page to LLMWhisperer
        - Returns per-page text list and combined text

    For images / single-page PDFs:
        - Sends directly
        - Returns a single-element list and combined text

    Returns:
        dict with keys:
            page_texts  - list[str], one entry per page
            combined_text - str, all pages joined
    """
    ext = os.path.splitext(file_path)[1].lower()
    page_texts = []

    if ext == ".pdf":
        try:
            import PyPDF2
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                num_pages = len(reader.pages)
        except ImportError:
            num_pages = 1

        if num_pages > 1:
            print(f"[OCR] Multipage PDF: {num_pages} pages")
            tmp_paths = _split_pdf_pages(file_path)
            try:
                for tmp_path in tmp_paths:
                    text = _call_llmwhisperer(tmp_path)
                    page_texts.append(text)
            finally:
                for tmp_path in tmp_paths:
                    os.unlink(tmp_path)
        else:
            text = _call_llmwhisperer(file_path)
            page_texts.append(text)
    else:
        text = _call_llmwhisperer(file_path)
        page_texts.append(text)

    combined_text = " ".join(page_texts)
    print(f"[OCR] Total combined text: {len(combined_text)} chars")

    return {
        "page_texts": page_texts,
        "combined_text": combined_text,
    }



def _local_ocr_fallback(file_path):
    """
    Fallback OCR using pdfplumber (for PDFs) or pytesseract (for images).
    Used automatically when the LLMWhisperer API is unreachable.
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        try:
            import pdfplumber
            text_pages = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text_pages.append(page.extract_text() or "")
            return text_pages
        except ImportError:
            raise ImportError("pdfplumber not installed. Run: pip install pdfplumber")
    else:
        try:
            from PIL import Image
            import pytesseract
            img = Image.open(file_path)
            text = pytesseract.image_to_string(img)
            return [text]
        except ImportError:
            raise ImportError(
                "Pillow and pytesseract not installed. "
                "Run: pip install Pillow pytesseract  (and install Tesseract OCR)"
            )


def _split_pdf_pages(pdf_path):
    """
    Split a multipage PDF into individual single-page PDFs.
    Returns a list of temporary file paths (one per page).
    """
    try:
        import PyPDF2
    except ImportError:
        raise ImportError("PyPDF2 is required for multipage PDF support. "
                          "Install it with: pip install PyPDF2")

    page_paths = []
    with open(pdf_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for i, page in enumerate(reader.pages):
            writer = PyPDF2.PdfWriter()
            writer.add_page(page)
            tmp = tempfile.NamedTemporaryFile(
                delete=False, suffix=f"_page_{i + 1}.pdf"
            )
            writer.write(tmp)
            tmp.close()
            page_paths.append(tmp.name)
    return page_paths


def extract_text_pages(file_path):
    """
    Extract text from a PDF or image invoice.

    For multipage PDFs:
        - Splits into individual pages
        - Sends each page to LLMWhisperer
        - Returns per-page text list and combined text

    For images / single-page PDFs:
        - Sends directly
        - Returns a single-element list and combined text

    Returns:
        dict with keys:
            page_texts  - list[str], one entry per page
            combined_text - str, all pages joined
    """
    ext = os.path.splitext(file_path)[1].lower()
    page_texts = []

    if ext == ".pdf":
        # Check if multipage
        try:
            import PyPDF2
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                num_pages = len(reader.pages)
        except ImportError:
            # Fallback: treat entire PDF as single page
            num_pages = 1

        if num_pages > 1:
            # Split and OCR each page
            tmp_paths = _split_pdf_pages(file_path)
            try:
                for tmp_path in tmp_paths:
                    text = _call_llmwhisperer(tmp_path)
                    page_texts.append(text)
            finally:
                for tmp_path in tmp_paths:
                    os.unlink(tmp_path)
        else:
            # Single page PDF
            text = _call_llmwhisperer(file_path)
            page_texts.append(text)
    else:
        # Image file (jpg, png, etc.)
        text = _call_llmwhisperer(file_path)
        page_texts.append(text)

    combined_text = " ".join(page_texts)

    return {
        "page_texts": page_texts,
        "combined_text": combined_text,
    }
