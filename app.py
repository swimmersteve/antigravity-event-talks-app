from flask import Flask, jsonify, render_template, request
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import logging
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# In-memory cache configuration
cache_data = None
cache_expiry = None
CACHE_DURATION = timedelta(minutes=10)

def parse_release_notes_feed():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    logger.info(f"Fetching BigQuery release notes from {url}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Failed to fetch release notes: {e}")
        raise RuntimeError(f"Unable to fetch release notes feed: {e}")

    try:
        # Parse XML
        xml_content = response.content
        root = ET.fromstring(xml_content)
        
        # Atom feed namespace
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = root.findall('atom:entry', ns)
        parsed_updates = []
        
        for entry in entries:
            # Extract basic entry fields
            title_el = entry.find('atom:title', ns)
            date_str = title_el.text if title_el is not None else "Unknown Date"
            
            updated_el = entry.find('atom:updated', ns)
            updated_str = updated_el.text if updated_el is not None else ""
            
            link_el = entry.find('atom:link[@rel="alternate"]', ns)
            link = link_el.get('href') if link_el is not None else "https://cloud.google.com/bigquery/docs/release-notes"
            
            content_el = entry.find('atom:content', ns)
            content_html = content_el.text if content_el is not None else ""
            
            # Parse the HTML content using BeautifulSoup
            soup = BeautifulSoup(content_html, 'html.parser')
            
            current_category = "General"
            current_elements = []
            
            # Group nodes under their corresponding h3 headers
            # If there are no h3 headers, everything will fall under "General"
            has_h3 = soup.find('h3') is not None
            
            def add_update(category, elements):
                if not elements and category == "General" and has_h3:
                    # Don't add empty general category if h3s are present
                    return
                
                # Render HTML and text
                html_snippet = "".join(str(el) for el in elements).strip()
                # If there are no tags, it might just be text
                if not html_snippet and not category:
                    return
                    
                text_snippet = BeautifulSoup(html_snippet, 'html.parser').get_text(separator=" ").strip()
                
                # Create a unique ID for this specific update item
                hash_input = f"{date_str}_{category}_{text_snippet[:100]}".encode('utf-8')
                update_id = hashlib.md5(hash_input).hexdigest()
                
                parsed_updates.append({
                    "id": update_id,
                    "date": date_str,
                    "updated": updated_str,
                    "link": link,
                    "category": category,
                    "content_html": html_snippet,
                    "content_text": text_snippet
                })

            for element in soup.contents:
                if element.name == 'h3':
                    # Save the previous block before starting a new category
                    add_update(current_category, current_elements)
                    current_elements = []
                    current_category = element.get_text().strip()
                elif element.name is not None:
                    current_elements.append(element)
                elif isinstance(element, str) and element.strip():
                    current_elements.append(element)
            
            # Save the final block
            add_update(current_category, current_elements)
            
        logger.info(f"Successfully parsed {len(parsed_updates)} individual updates.")
        return parsed_updates
        
    except ET.ParseError as pe:
        logger.error(f"XML parsing error: {pe}")
        raise RuntimeError("The release notes feed XML is malformed.")
    except Exception as e:
        logger.error(f"Error parsing release notes content: {e}")
        raise RuntimeError(f"Error parsing feed contents: {e}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    global cache_data, cache_expiry
    
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = datetime.now()
    
    if force_refresh or cache_data is None or cache_expiry is None or now > cache_expiry:
        try:
            cache_data = parse_release_notes_feed()
            cache_expiry = now + CACHE_DURATION
            logger.info("Cache updated.")
        except Exception as e:
            logger.error(f"Error updating cache: {e}")
            # If we have stale cache data, return it instead of failing completely
            if cache_data is not None:
                return jsonify({
                    "success": True,
                    "source": "stale_cache",
                    "error_warning": str(e),
                    "data": cache_data
                })
            return jsonify({
                "success": False,
                "error": str(e)
            }), 500
            
    return jsonify({
        "success": True,
        "source": "cache" if not force_refresh else "network",
        "data": cache_data
    })

if __name__ == '__main__':
    # Run the server on port 5001 or standard 5000
    app.run(host='0.0.0.0', port=5001, debug=True)
